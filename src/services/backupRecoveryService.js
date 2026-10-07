import { createBackupRecovery } from './backupRecoveryCore.js';
import { getBackupRecoveryReceipt } from './db.js';
import { flushLocalSaves } from './localSaveService.js';
import { notebookHistoryStore } from './notebookHistoryService.js';
import { setNotebookCoverLibraryVisible, queueNotebookCover } from './notebookCoverService.js';

let editorActive = false;
let pauseBackups = () => ({ wait: async () => {}, resume: () => {} });
const restoredListeners = new Set();
const fault = code => Object.assign(new Error(code), { code });
const commitInWorker = async (input, publish) => {
  const { default: RecoveryWorker } = await import('./backupRecovery.worker.js?worker&inline');
  const operationId = crypto.randomUUID();
  let worker, timer;
  try {
    const result = await new Promise((resolve, reject) => {
      worker = new RecoveryWorker();
      // Limit validation only. Once writing starts, await commit/abort instead of timing it out.
      timer = setTimeout(() => reject(fault('backup-read-timeout')), 60000);
      worker.onmessage = ({ data }) => {
        if (data.phase === 'writing') { clearTimeout(timer); publish('writing'); }
        else if (data.error) reject(fault(data.error));
        else if (data.result) resolve(data.result);
      };
      worker.onerror = () => reject(fault('backup-recovery-write-failed'));
      worker.onmessageerror = () => reject(fault('backup-recovery-write-failed'));
      worker.postMessage({ operationId, data: input.data, file: input.file });
    });
    return { ...result, folder: input.folder, source: input.source, recoveredFolderNotebookIds: input.recoveredFolderNotebookIds || [], ignoredRetiredNotebookIds: input.ignoredRetiredNotebookIds || [] };
  } catch (error) {
    worker?.terminate();
    // A worker can fail after commit but before its reply. The receipt shares the transaction.
    let receipt;
    try { receipt = await getBackupRecoveryReceipt(); }
    catch (_) { throw fault('backup-recovery-unconfirmed'); }
    if (receipt?.operationId === operationId) return { ...receipt.result, folder: input.folder, source: input.source, recoveredFolderNotebookIds: input.recoveredFolderNotebookIds || [], ignoredRetiredNotebookIds: input.ignoredRetiredNotebookIds || [] };
    throw error;
  } finally { clearTimeout(timer); worker?.terminate(); }
};
export const backupRecovery = createBackupRecovery({
  canRestore: () => !editorActive, pauseBackups: () => pauseBackups(), flushLocalSaves,
  onActive: () => setNotebookCoverLibraryVisible(false), restore: commitInWorker,
  afterCommit: async result => {
    const ids = result.notebooks.map(note => note.id);
    notebookHistoryStore.clearNotebooks(ids);
    ids.forEach(queueNotebookCover);
    const refreshed = await Promise.allSettled([...restoredListeners].map(listener => Promise.resolve().then(() => listener(result))));
    if (refreshed.some(item => item.status === 'rejected')) throw new Error('Recovery library refresh failed');
  }
});
export const configureRecoveryBackups = pause => { pauseBackups = pause; };
export const setRecoveryEditorActive = active => { editorActive = !!active; };
export const subscribeBackupRestored = listener => { restoredListeners.add(listener); return () => restoredListeners.delete(listener); };
export const restoreBackup = loader => backupRecovery.run(loader);
