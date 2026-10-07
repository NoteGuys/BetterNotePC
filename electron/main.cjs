const { app, BrowserWindow, ipcMain, dialog, shell, clipboard } = require('electron');
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

let mainWindow = null;

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
async function scanAndLoadBackups(customPath = null, previewOnly = false) {
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
  return backupReaderClient.execute({ folderPath: customPath, candidates, previewOnly });
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
      webSecurity: false
    }
  });

  installLocalSaveGuard({ window: mainWindow, ipcMain, dialog });
  registerDriveDesktop({ ipcMain, shell, getWindow: () => mainWindow });
  registerGoogleDesktopAuth({ ipcMain, shell, getWindow: () => mainWindow,
    exchangeToken: createGoogleTokenExchange({
      brokerUrl: process.env.BETTERNOTE_GOOGLE_TOKEN_ENDPOINT || GOOGLE_TOKEN_BROKER_URL,
      credentialFile: app.isPackaged ? '' : process.env.BETTERNOTE_GOOGLE_OAUTH_FILE || ''
    }),
    onComplete: () => { if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.restore(); mainWindow.focus(); } }
  });

  // Handle IPC Auto-Backup calls directly from renderer
  ipcMain.handle('save-auto-backup', async (event, data) => {
    return await writeBackupData(data, event.sender);
  });

  // Handle immediate pruning of a deleted notebook from backups
  ipcMain.handle('prune-backup-notebook', async (event, notebookName) => {
    return await pruneNotebookFromBackups(notebookName);
  });

  // Handle batch pruning of multiple deleted notebooks from backups
  ipcMain.handle('prune-backup-notebooks-batch', async (event, notebookNames) => {
    return await pruneNotebooksBatchFromBackups(notebookNames);
  });

  // Handle scanning and restoring from Google Drive or local backup folder
  ipcMain.handle('scan-backup-folder', async (event, customPath, options) => {
    return await scanAndLoadBackups(customPath, options?.previewOnly === true);
  });

  ipcMain.handle('restore-backup-from-folder', async (event, customPath) => {
    return await scanAndLoadBackups(customPath);
  });

  // Handle detailed backup status & file inspection
  ipcMain.handle('get-backup-status-details', async (event, customPath) => {
    return await getBackupStatusDetails(customPath);
  });

  // Handle opening backup destination folder in Windows Explorer
  ipcMain.handle('open-backup-folder', async (event, folderPath) => {
    try {
      const target = folderPath || await getBackupTargetDir();
      if ((await fs.promises.stat(target).catch(() => null))?.isDirectory()) {
        await shell.openPath(target);
        return { success: true };
      } else {
        // Create if needed
        await fs.promises.mkdir(target, { recursive: true });
        await shell.openPath(target);
        return { success: true };
      }
    } catch (err) {
      console.error('open-backup-folder error:', err);
      return { success: false, error: err.message };
    }
  });

  // Handle revealing and highlighting a specific backup file in Windows Explorer
  ipcMain.handle('reveal-backup-file', async (event, filePath) => {
    try {
      if (filePath && fs.existsSync(filePath)) {
        shell.showItemInFolder(filePath);
        return { success: true };
      }
      return { success: false, error: 'File not found on disk' };
    } catch (err) {
      console.error('reveal-backup-file error:', err);
      return { success: false, error: err.message };
    }
  });

  // Handle native folder picker dialog
  ipcMain.handle('select-folder', async () => {
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
  ipcMain.handle('open-external', async (event, url) => {
    try {
      if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
        await shell.openExternal(url);
        return { success: true };
      }
      return { success: false, error: 'Invalid URL scheme' };
    } catch (err) {
      console.error('open-external error:', err);
      return { success: false, error: err.message };
    }
  });

  // Handle opening Google Sign-In popup window
  ipcMain.handle('open-google-signin', async () => {
    return new Promise((resolve) => {
      try {
        let authWindow = new BrowserWindow({
          width: 540,
          height: 680,
          title: 'Sign in - Google Accounts',
          autoHideMenuBar: true,
          parent: mainWindow,
          modal: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        });

        const targetUrl = 'https://accounts.google.com/AccountChooser?service=wise&continue=https%3A%2F%2Fdrive.google.com%2F';
        authWindow.loadURL(targetUrl);

        let finished = false;

        const checkNavigation = (navUrl) => {
          if (finished || !navUrl) return;
          try {
            const u = new URL(navUrl);
            // Must actually land on drive.google.com hostname (not accounts.google.com which has drive.google.com in query param!)
            if (u.hostname === 'drive.google.com' || u.hostname.endsWith('.drive.google.com')) {
              finished = true;
              setTimeout(() => {
                if (authWindow && !authWindow.isDestroyed()) {
                  authWindow.close();
                }
                resolve({ success: true, loggedIn: true });
              }, 1000);
            }
          } catch (_) {}
        };

        authWindow.webContents.on('did-navigate', (event, url) => checkNavigation(url));
        authWindow.webContents.on('did-redirect-navigation', (event, url) => checkNavigation(url));

        authWindow.on('closed', () => {
          authWindow = null;
          if (!finished) {
            resolve({ success: false, reason: 'closed_by_user' });
          }
        });
      } catch (err) {
        console.error('open-google-signin error:', err);
        resolve({ success: false, error: err.message });
      }
    });
  });

  // Import one image explicitly chosen in the native Windows file picker.
  registerPdfExport(ipcMain, BrowserWindow, () => mainWindow);

  ipcMain.handle('select-image', async (_event, options = {}) => {
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
  ipcMain.handle('read-clipboard-image', async () => {
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
  const distPath = path.join(__dirname, '../dist/index.html');
  const isDev = process.env.NODE_ENV === 'development' && process.argv.includes('--dev');

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000/').catch(() => {
      mainWindow.loadFile(distPath);
    });
  } else {
    mainWindow.loadFile(distPath);
  }

  // Prevent navigation outside the application
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
    }
  });

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

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
