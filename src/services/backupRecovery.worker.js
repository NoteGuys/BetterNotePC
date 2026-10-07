import { prepareBackup } from '../../electron/backupValidation.js';
import { restoreBackupAtomic, getBackupNotebookSnapshot, getAllFolders, getSetting } from './db.js';
import { DRIVE_SYNC_BASE_KEY, freshSyncBase, planSyncedNotebook } from './backupSyncCore.js';
import { syncPathKey } from '../../electron/backupSyncProtocol.js';

self.onmessage = async ({ data: { operationId, data, file, encoded, sync } }) => {
  try {
    if (file) {
      if (!Number.isFinite(file.size) || file.size <= 0 || file.size > 256 * 1048576) throw Object.assign(new Error(), { code: 'backup-too-large' });
      data = JSON.parse(await file.text());
    }
    if (encoded) {
      if (!(encoded instanceof ArrayBuffer) || encoded.byteLength > 272 * 1048576) throw Object.assign(new Error(), { code: 'backup-too-large' });
      data = JSON.parse(new TextDecoder().decode(encoded));
    }
    const prepared = prepareBackup(data);
    if (sync) {
      if (prepared.notebooks.length !== 1) throw Object.assign(new Error(), { code: 'invalid-backup-data' });
      const incoming = prepared.notebooks[0], local = await getBackupNotebookSnapshot(incoming.id);
      let journal = await getSetting(DRIVE_SYNC_BASE_KEY);
      if (!journal || journal.version !== 1 || journal.path !== syncPathKey(sync.path)) journal = freshSyncBase(sync.path);
      const plan = await planSyncedNotebook({ incoming, local, base: Object.hasOwn(journal.entries||{},incoming.id)?journal.entries[incoming.id]:null, remoteHash: sync.remoteHash,
        folders: prepared.folders, localFolders: await getAllFolders(), copyLabel: sync.copyLabel });
      if (!plan.entry) { self.postMessage({ result: { notebooks: [], notebooksCount: 0, skipped: true } }); return; }
      const checkpoint = await getSetting('backup_v2_checkpoint');
      const localTarget = checkpoint?.targets?.find(target => (target.roles || [target.kind]).includes('local') && !target.error && target.lastDataSuccess);
      const previousHash = localTarget?.notebooks?.[incoming.id]?.editable?.hash;
      journal = { ...journal, entries: { ...journal.entries, [incoming.id]: plan.entry }, receives: { ...journal.receives } };
      if (plan.notebooks.some(note => note.id === incoming.id) && previousHash) {
        Object.defineProperty(journal.receives,incoming.id,{enumerable:true,writable:true,configurable:true,value:{ targetDir: localTarget.targetDir, previousHash }});
      }
      self.postMessage({ phase: 'writing' });
      const result = await restoreBackupAtomic({ folders: plan.folders, notebooks: plan.notebooks }, operationId, {
        path: sync.path, expectedRevisions: plan.expected, settingsUpdates: [{ key: DRIVE_SYNC_BASE_KEY, value: journal }],
        resultExtras: { conflictsCount: plan.conflict ? 1 : 0, receivedCount: plan.notebooks.some(note => note.id === incoming.id) ? 1 : 0 }
      });
      self.postMessage({ result }); return;
    }
    self.postMessage({ phase: 'writing' });
    const result = await restoreBackupAtomic(prepared, operationId);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: (typeof error.code === 'string' ? error.code : null) || (error instanceof SyntaxError ? 'invalid-backup-data' : 'backup-recovery-write-failed') });
  }
};
