const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { registerPdfExport } = require('./pdfExport.cjs');
const { installLocalSaveGuard } = require('./localSaveGuard.cjs');
const { registerDriveDesktop } = require('./driveDesktop.cjs');
const { registerGoogleDesktopAuth } = require('./googleDesktopAuth.cjs');
const { createGoogleTokenExchange } = require('./googleTokenExchange.cjs');
const { GOOGLE_TOKEN_BROKER_URL } = require('./googleOAuthConfig.cjs');

// Surface Pro Hardware Acceleration, High-DPI & Touch/Stylus Flags
app.commandLine.appendSwitch('enable-features', 'TouchEvents,VaapiVideoDecoder');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('high-dpi-support', '1');

const { ASSET_SCHEME, createGuardedIpc, protectWindow, registerAssetProtocol } = require('./appSecurity.cjs');
protocol.registerSchemesAsPrivileged([{scheme:ASSET_SCHEME,privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
const distPath = path.join(__dirname,'../dist/index.html');
const devUrl = process.env.NODE_ENV === 'development' && process.argv.includes('--dev') ? 'http://localhost:3000/' : null;
let mainWindow = null;
const guardedIpc = createGuardedIpc(ipcMain,()=>mainWindow,distPath,devUrl);

// Backup disk work and serialization run in a worker, not the Electron UI process.
let backupClient;
const getBackupClient = () => {
  if (!backupClient) {
    const { createBackupWorkerClient } = require('./backupWorkerClient.cjs');
    backupClient = createBackupWorkerClient({
      localDir: path.join(app.getPath('documents'), 'BetterNote.AppPC'),
      driveCandidates: ['H:\\My Drive\\BetterNote.AppPC', 'G:\\My Drive\\BetterNote.AppPC',
        'I:\\My Drive\\BetterNote.AppPC', 'D:\\My Drive\\BetterNote.AppPC']
    });
  }
  return backupClient;
};
async function getBackupTargetDir(customPath = null) {
  const status = await getBackupClient().execute({ action: 'inspect', customBackupPath: customPath });
  return status.targetDir || path.join(app.getPath('documents'), 'BetterNote.AppPC');
}
async function writeBackupData(data, sender) {
  let lastProgress = 0;
  return getBackupClient().execute(data, progress => {
    if (!sender || sender.isDestroyed()) return;
    const current = Date.now();
    if (current - lastProgress < 100 && progress.stage === 'writing' && progress.bytesDone < progress.totalBytes) return;
    lastProgress = current;
    sender.send('backup-progress', progress);
  });
}
async function pruneNotebookFromBackups(request) {
  return getBackupClient().execute({ action: 'prune', notebookIds: [request?.notebookId], customBackupPath: request?.customBackupPath });
}
async function pruneNotebooksBatchFromBackups(request) {
  return getBackupClient().execute({ action: 'prune', notebookIds: request?.notebookIds, customBackupPath: request?.customBackupPath });
}

// Scan a selected destination only. Discovery never combines different backup folders.
let backupReaderClient;
async function scanAndLoadBackups(customPath = null, previewOnly = false, syncOptions = {}) {
  if (!backupReaderClient) {
    const { createBackupReaderClient } = require('./backupReaderClient.cjs');
    backupReaderClient = createBackupReaderClient();
  }
  const candidates = customPath == null ? [
    'H:\\My Drive\\BetterNote.AppPC', 'G:\\My Drive\\BetterNote.AppPC',
    'I:\\My Drive\\BetterNote.AppPC', 'D:\\My Drive\\BetterNote.AppPC',
    path.join(app.getPath('documents'), 'BetterNote.AppPC'),
    path.resolve(process.env.USERPROFILE || '', 'Documents', 'BetterNote.AppPC'),
    path.resolve(process.env.USERPROFILE || '', 'BetterNote_Backups'),
    path.resolve(process.cwd(), 'BetterNote_Backups')
  ] : [];
  return backupReaderClient.execute({ folderPath: customPath, candidates, previewOnly, ...syncOptions });
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Detailed Backup Inspector: Collects information on every backed-up notebook, timestamp, location, and size
async function getBackupStatusDetails(customPath = null) {
  return getBackupClient().execute({ action: 'inspect', customBackupPath: customPath, includeFiles: true });
}

const externalActions = require('./externalActions.cjs').createExternalActions({shell});
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 940,
    minWidth: 900,
    minHeight: 600,
    title: 'BetterNote Pro Studio - Surface PC Edition',
    backgroundColor: '#090d16',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, '../app-icon.ico'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#090d16',
      symbolColor: '#cbd5e1',
      height: 38
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: true
    }
  });

  protectWindow(mainWindow,distPath,devUrl);
  installLocalSaveGuard({ window: mainWindow, ipcMain, dialog });
  registerDriveDesktop({ ipcMain: guardedIpc, shell, getWindow: () => mainWindow });
  registerGoogleDesktopAuth({ ipcMain: guardedIpc, shell, getWindow: () => mainWindow,
    exchangeToken: createGoogleTokenExchange({
      brokerUrl: process.env.BETTERNOTE_GOOGLE_TOKEN_ENDPOINT || GOOGLE_TOKEN_BROKER_URL,
      credentialFile: app.isPackaged ? '' : process.env.BETTERNOTE_GOOGLE_OAUTH_FILE || ''
    }),
    onComplete: () => { if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.restore(); mainWindow.focus(); } }
  });

  require('./bnoteSave.cjs').registerBnoteSave({ipcMain:guardedIpc,dialog,getWindow:()=>mainWindow});
  require('./storeUpdates.cjs').registerStoreUpdates({ipcMain:guardedIpc,getWindow:()=>mainWindow,isStore:()=>Boolean(process.windowsStore)});
  guardedIpc.handle('get-app-info',()=>({version:app.getVersion(),distribution:process.windowsStore?'store':'installer',deviceName:require('node:os').hostname()}));
  // Handle IPC Auto-Backup calls directly from renderer
  guardedIpc.handle('save-auto-backup', async (event, data) => {
    return await writeBackupData(data, event.sender);
  });

  // Handle immediate pruning of a deleted notebook from backups
  guardedIpc.handle('prune-backup-notebook', async (event, notebookName) => {
    return await pruneNotebookFromBackups(notebookName);
  });

  // Handle batch pruning of multiple deleted notebooks from backups
  guardedIpc.handle('prune-backup-notebooks-batch', async (event, notebookNames) => {
    return await pruneNotebooksBatchFromBackups(notebookNames);
  });

  // Handle scanning and restoring from Google Drive or local backup folder
  guardedIpc.handle('drive-sync-capabilities', async event => {
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents ||
        event.senderFrame !== mainWindow.webContents.mainFrame) return { protocol: 0 };
    return { protocol: 1 };
  });

  const recoveryReads = new Map();
  guardedIpc.handle('cancel-backup-recovery-read', async (event, recoveryId) => {
    const job = recoveryReads.get(recoveryId);
    if (!job || job.sender !== event.sender) return false;
    await job.client.cancel(); return true;
  });
  guardedIpc.handle('scan-backup-folder', async (event, customPath, options) => {
    if (options?.snapshotRecovery && options?.encodedRecovery && !options.previewOnly) {
      const id = options.recoveryId;
      if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id) || recoveryReads.size || typeof customPath !== 'string')
        return {success:false,reason:'backup-reader-busy'};
      const {createBackupReaderClient} = require('./backupReaderClient.cjs');
      const client = createBackupReaderClient();
      recoveryReads.set(id,{client,sender:event.sender});
      const destroyed = () => { client.cancel(); };
      event.sender.once('destroyed',destroyed);
      try {
        return await client.execute({folderPath:customPath,allowPrevious:options.allowPrevious===true,encodedRecovery:true,snapshotRecovery:true},progress=>{
          if (!event.sender.isDestroyed()) event.sender.send('backup-recovery-progress',{...progress,recoveryId:id});
        });
      } finally {
        event.sender.removeListener('destroyed',destroyed);
        recoveryReads.delete(id);await client.close();
      }
    }
    if (options?.syncMode) {
      if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents ||
          event.senderFrame !== mainWindow.webContents.mainFrame || typeof customPath !== 'string') {
        return { success: false, reason: 'untrusted-window' };
      }
      return scanAndLoadBackups(customPath, false, { syncMode: options.syncMode,
        syncNotebookId: options.syncNotebookId, manifestHash: options.manifestHash, syncDeviceId: options.syncDeviceId });
    }
    return await scanAndLoadBackups(customPath, options?.previewOnly === true, {allowPrevious: options?.allowPrevious === true,encodedRecovery:options?.encodedRecovery === true,listDevices:options?.listDevices === true});
  });

  guardedIpc.handle('restore-backup-from-folder', async (event, customPath) => {
    return await scanAndLoadBackups(customPath);
  });

  // Handle detailed backup status & file inspection
  guardedIpc.handle('get-backup-status-details', async (event, customPath) => {
    return await getBackupStatusDetails(customPath);
  });

  // Handle opening backup destination folder in Windows Explorer
  guardedIpc.handle('open-backup-folder', async (event, folderPath) => externalActions.openFolder(folderPath || await getBackupTargetDir()));
  guardedIpc.handle('reveal-backup-file', (event, filePath) => externalActions.revealFile(filePath));

  // Handle native folder picker dialog
  guardedIpc.handle('select-folder', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'เลือกโฟลเดอร์สำหรับสำรองข้อมูล BetterNote'
      });
      if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        return result.filePaths[0];
      }
      return null;
    } catch (err) {
      console.error('Folder selection error:', err);
      return null;
    }
  });

  // Handle opening external URLs in default system web browser
  guardedIpc.handle('open-external', (event,url) => externalActions.openExternal(url));

  // Legacy direct sign-in stays unavailable while the UI is Coming soon.
  guardedIpc.handle('open-google-signin', () => ({success:false,reason:'coming-soon'}));

  // Import one image explicitly chosen in the native Windows file picker.
  registerPdfExport(guardedIpc, BrowserWindow, () => mainWindow);

  guardedIpc.handle('select-image', async (_event, options = {}) => {
    const mimeTypes = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
      svg: 'image/svg+xml', avif: 'image/avif'
    };
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: typeof options?.title === 'string' ? options.title : 'Insert Image',
        properties: ['openFile'],
        filters: [
          { name: typeof options?.allImagesLabel === 'string' ? options.allImagesLabel : 'All Supported Images', extensions: Object.keys(mimeTypes) },
          { name: 'PNG', extensions: ['png'] },
          { name: 'JPEG', extensions: ['jpg', 'jpeg'] },
          { name: 'WebP', extensions: ['webp'] },
          { name: 'GIF', extensions: ['gif'] },
          { name: 'BMP', extensions: ['bmp'] },
          { name: 'SVG', extensions: ['svg'] },
          { name: 'AVIF', extensions: ['avif'] }
        ]
      });
      if (result.canceled || !result.filePaths?.length) return { success: false, canceled: true };
      const filePath = result.filePaths[0];
      const extension = path.extname(filePath).slice(1).toLowerCase();
      const mimeType = Object.hasOwn(mimeTypes, extension) ? mimeTypes[extension] : null;
      if (!mimeType) return { success: false, error: 'unsupported-image' };
      const data = await fs.promises.readFile(filePath);
      return { success: true, dataUrl: `data:${mimeType};base64,${data.toString('base64')}` };
    } catch (_) {
      return { success: false, error: 'image-read-failed' };
    }
  });

  // Handle reading image from Windows / system clipboard (for Long-Press Paste, External Copy, Win+Shift+S, Explorer)
  guardedIpc.handle('read-clipboard-image', async () => {
    try {
      // 1. Modern Electron Clipboard (W3C Clipboard API: clipboard.read() returns Promise<ClipboardItem[]>)
      if (typeof clipboard.read === 'function') {
        try {
          const items = await clipboard.read();
          if (Array.isArray(items)) {
            for (const item of items) {
              const imgType = item.types && item.types.find(t => t.startsWith('image/'));
              if (imgType && typeof item.getType === 'function') {
                const blob = await item.getType(imgType);
                if (blob && blob.size > 0) {
                  const arrayBuf = await blob.arrayBuffer();
                  const base64 = Buffer.from(arrayBuf).toString('base64');
                  const dataUrl = `data:${imgType};base64,${base64}`;
                  return {
                    success: true,
                    dataUrl,
                    width: 0,
                    height: 0
                  };
                }
              }
            }
          }
        } catch (e) {
          console.warn('clipboard.read() error:', e.message);
        }
      }

      // 2. Legacy Electron Image Bitmap (Win+Shift+S, Snipping Tool, Chrome Right Click -> Copy Image, etc.)
      if (typeof clipboard.readImage === 'function') {
        try {
          const img = clipboard.readImage();
          if (img && !img.isEmpty()) {
            const size = img.getSize();
            const dataUrl = img.toDataURL();
            return {
              success: true,
              dataUrl,
              width: size.width,
              height: size.height
            };
          }
        } catch (e) {
          console.warn('clipboard.readImage() error:', e.message);
        }
      }

      // 3. Check File Path in Clipboard (e.g. copied an image file from Windows Explorer or Desktop)
      let rawText = '';
      try {
        if (typeof clipboard.readText === 'function') {
          rawText = clipboard.readText()?.trim() || '';
        }
      } catch (_) {}

      let filePath = rawText;
      if (filePath && filePath.startsWith('"') && filePath.endsWith('"')) {
        filePath = filePath.slice(1, -1);
      }

      const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.svg'];
      if (filePath && imageExtensions.some(ext => filePath.toLowerCase().endsWith(ext))) {
        if (fs.existsSync(filePath)) {
          const ext = path.extname(filePath).slice(1).toLowerCase();
          const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
          const buffer = fs.readFileSync(filePath);
          const base64 = buffer.toString('base64');
          const dataUrl = `data:${mime};base64,${base64}`;
          return {
            success: true,
            dataUrl,
            width: 600,
            height: 450
          };
        }
      }

      // 4. Check HTML snippet in clipboard (e.g. copied an image element from a web page)
      try {
        const html = typeof clipboard.readHTML === 'function' ? clipboard.readHTML() : '';
        if (html) {
          const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
          if (match && match[1]) {
            const src = match[1];
            if (src.startsWith('data:image/')) {
              return {
                success: true,
                dataUrl: src,
                width: 600,
                height: 450
              };
            }
          }
        }
      } catch (_) {}

      // 5. Raw Text with Data URL
      if (rawText && rawText.startsWith('data:image/')) {
        return {
          success: true,
          dataUrl: rawText,
          width: 600,
          height: 450
        };
      }

      return { success: false, reason: 'empty' };
    } catch (err) {
      console.error('read-clipboard-image error:', err);
      return { success: false, error: err.message };
    }
  });

  // Load the offline production app directly from disk
  const isDev = process.env.NODE_ENV === 'development' && process.argv.includes('--dev');

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000/').catch(() => {
      mainWindow.loadFile(distPath);
    });
  } else {
    mainWindow.loadFile(distPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single Instance Lock: prevent opening duplicate instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Store packages receive their identity from Windows; unpackaged builds use our stable taskbar group.
    if (process.platform === 'win32' && !process.windowsStore) app.setAppUserModelId('com.betternote.studio');
    registerAssetProtocol(protocol,net,path.dirname(distPath)); createWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
