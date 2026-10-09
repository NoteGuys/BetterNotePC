// File System Service for Local Disk & Synced Cloud Drive (Google Drive/OneDrive folder)
import { getAllFolders, getAllNotebooks, getPagesByNotebookId } from './db';
import { restoreBackup } from './backupRecoveryService.js';
import { importPortableBnote, validateBnoteBlob, saveNativeBnote } from './bnoteService.js';

/**
 * Save data as a local file (using File System Access API or Blob download)
 */
export const saveFileToDisk = async (blob, suggestedName, fileTypes = null) => {
  if (/\.bnote$/i.test(suggestedName)) {
    await validateBnoteBlob(blob);
    if (window.electronAPI?.isElectron) {
      if (!window.electronAPI.saveBnote) throw Error('bnote-restart-required');
      return saveNativeBnote(blob, suggestedName, window.electronAPI);
    }
  }
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: fileTypes || [
          {
            description: 'BetterNote Document / Backup',
            accept: {
              'application/json': ['.json', '.bnote'],
              'application/pdf': ['.pdf']
            }
          }
        ]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false; // User cancelled
      console.warn('File System Access API failed, falling back to download link:', err);
    }
  }

  // Fallback to standard browser download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
};

/**
 * Export full BetterNote database to a local backup file
 */
export const exportFullBackup = async () => {
  const folders = await getAllFolders({ includeRetired: true });
  const notebooks = await getAllNotebooks();

  const backupData = {
    version: 1,
    appName: 'BetterNote',
    exportDate: new Date().toISOString(),
    folders,
    notebooks: []
  };

  for (const nb of notebooks) {
    const pages = await getPagesByNotebookId(nb.id);
    backupData.notebooks.push({
      ...nb,
      pages
    });
  }

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const filename = `BetterNote_Backup_${new Date().toISOString().slice(0, 10)}.json`;

  return await saveFileToDisk(blob, filename);
};

/**
 * Restore full BetterNote database from a parsed backup data object
 */
export const restoreFullBackup = data => restoreBackup(() => ({ data }));

/** Import/validate the selected JSON in a bundled local worker. */
export const importFullBackup = file => restoreBackup(() => ({ file }));

/**
 * Import a single .bnote file and save its notebook and pages to IndexedDB
 */
export const importBnoteFile = (file, targetFolderId = null) => importPortableBnote(file, targetFolderId);
