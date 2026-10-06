const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  exportPdfDocument: (html) => ipcRenderer.invoke('export-pdf-document', html),
  saveBackup: (data) => ipcRenderer.invoke('save-auto-backup', data),
  pruneBackupNotebook: (name) => ipcRenderer.invoke('prune-backup-notebook', name),
  pruneBackupNotebooksBatch: (names) => ipcRenderer.invoke('prune-backup-notebooks-batch', names),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanBackupFolder: (folderPath) => ipcRenderer.invoke('scan-backup-folder', folderPath),
  restoreBackupFromFolder: (folderPath) => ipcRenderer.invoke('restore-backup-from-folder', folderPath),
  getBackupStatusDetails: (customPath) => ipcRenderer.invoke('get-backup-status-details', customPath),
  openBackupFolder: (folderPath) => ipcRenderer.invoke('open-backup-folder', folderPath),
  revealBackupFile: (filePath) => ipcRenderer.invoke('reveal-backup-file', filePath),
  readClipboardImage: () => ipcRenderer.invoke('read-clipboard-image'),
  selectImage: (options) => ipcRenderer.invoke('select-image', options),
  openGoogleSignIn: () => ipcRenderer.invoke('open-google-signin'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});


