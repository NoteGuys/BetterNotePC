const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  setLocalSaveGuardReady: (state) => ipcRenderer.send('local-save-ready', state),
  completeCloseSaveRequest: (result) => ipcRenderer.send('local-save-close-result', result),
  onCloseSaveRequest: (listener) => {
    const handler = (_event, request) => listener(request);
    ipcRenderer.on('local-save-before-close', handler);
    return () => ipcRenderer.removeListener('local-save-before-close', handler);
  },
  onCloseSaveCancelled: (listener) => {
    const handler = () => listener();
    ipcRenderer.on('local-save-close-cancelled', handler);
    return () => ipcRenderer.removeListener('local-save-close-cancelled', handler);
  },
  exportPdfDocument: (html) => ipcRenderer.invoke('export-pdf-document', html),
  saveBackup: (data) => ipcRenderer.invoke('save-auto-backup', data),
  onBackupProgress: (handler) => {
    const listener = (_event, progress) => handler(progress);
    ipcRenderer.on('backup-progress', listener);
    return () => ipcRenderer.removeListener('backup-progress', listener);
  },
  pruneBackupNotebook: (notebookId, customBackupPath) => ipcRenderer.invoke('prune-backup-notebook', { notebookId, customBackupPath }),
  pruneBackupNotebooksBatch: (notebookIds, customBackupPath) => ipcRenderer.invoke('prune-backup-notebooks-batch', { notebookIds, customBackupPath }),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanBackupFolder: (folderPath) => ipcRenderer.invoke('scan-backup-folder', folderPath),
  restoreBackupFromFolder: (folderPath) => ipcRenderer.invoke('restore-backup-from-folder', folderPath),
  getBackupStatusDetails: (customPath) => ipcRenderer.invoke('get-backup-status-details', customPath),
  openBackupFolder: (folderPath) => ipcRenderer.invoke('open-backup-folder', folderPath),
  revealBackupFile: (filePath) => ipcRenderer.invoke('reveal-backup-file', filePath),
  readClipboardImage: () => ipcRenderer.invoke('read-clipboard-image'),
  selectImage: (options) => ipcRenderer.invoke('select-image', options),
  openDriveDesktop: () => ipcRenderer.invoke('open-drive-desktop'),
  connectGoogleAccount: (clientId) => ipcRenderer.invoke('connect-google-account', { clientId }),
  cancelGoogleAccountConnection: () => ipcRenderer.invoke('cancel-google-account-connection'),
  openGoogleSignIn: () => ipcRenderer.invoke('open-google-signin'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});


