const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Surface Pro Hardware Acceleration, High-DPI & Touch/Stylus Flags
app.commandLine.appendSwitch('enable-features', 'TouchEvents,VaapiVideoDecoder');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('high-dpi-support', '1');

let mainWindow = null;

// Backup Directory Target (Priority: H:\My Drive\BetterNote.AppPC, Fallback: Documents\BetterNote.AppPC)
function getBackupTargetDir() {
  const gDriveRoot = 'H:\\My Drive\\BetterNote.AppPC';
  if (fs.existsSync('H:\\My Drive') || fs.existsSync(gDriveRoot)) {
    if (!fs.existsSync(gDriveRoot)) {
      try { fs.mkdirSync(gDriveRoot, { recursive: true }); } catch (_) {}
    }
    return gDriveRoot;
  }
  const fallbackDir = path.join(app.getPath('documents'), 'BetterNote.AppPC');
  if (!fs.existsSync(fallbackDir)) {
    try { fs.mkdirSync(fallbackDir, { recursive: true }); } catch (_) {}
  }
  return fallbackDir;
}

// Prune a single deleted notebook from all backup folders immediately
async function pruneNotebookFromBackups(notebookName) {
  if (!notebookName) return { success: false, reason: 'empty-name' };
  const cleanName = notebookName.replace(/[\\/:*?"<>|]/g, '_');
  const target = getBackupTargetDir();
  const localTarget = path.resolve(process.cwd(), 'BetterNote_Backups');
  const targets = [target, localTarget];
  let deletedCount = 0;

  for (const t of targets) {
    try {
      const bnoteFile = path.join(t, 'Editable_Notes', `${cleanName}.bnote`);
      const pdfFile = path.join(t, 'PDF_Documents', `${cleanName}.pdf`);

      if (fs.existsSync(bnoteFile)) {
        await fs.promises.unlink(bnoteFile);
        deletedCount++;
      }
      if (fs.existsSync(pdfFile)) {
        await fs.promises.unlink(pdfFile);
        deletedCount++;
      }
    } catch (err) {
      console.warn(`Could not prune notebook ${notebookName} from ${t}:`, err.message);
    }
  }

  return { success: true, notebookName, deletedCount };
}

// Native Auto-Backup Writer: Direct disk write without blocking the Main Process event loop
// Includes intelligent deleted notebook pruning to prevent orphaned files in backups
async function writeBackupData(data) {
  if (!data) return { success: false, reason: 'no-data' };

  const target = getBackupTargetDir();
  const localTarget = path.resolve(process.cwd(), 'BetterNote_Backups');
  const targets = [target, localTarget];

  if (data?.customBackupPath && typeof data.customBackupPath === 'string' && data.customBackupPath.trim()) {
    const customTrimmed = data.customBackupPath.trim();
    if (!targets.includes(customTrimmed)) {
      targets.unshift(customTrimmed);
    }
  }

  const savedPaths = [];
  const prunedPaths = [];

  // Build active notebook filename set for accurate disk pruning
  const activeFileBases = new Set();
  if (data.notebooks && Array.isArray(data.notebooks)) {
    for (const nb of data.notebooks) {
      const clean = (nb.name || 'Untitled').replace(/[\\/:*?"<>|]/g, '_');
      activeFileBases.add(clean);
    }
  }

  for (const t of targets) {
    try {
      const pdfDir = path.join(t, 'PDF_Documents');
      const editDir = path.join(t, 'Editable_Notes');
      const fullDir = path.join(t, 'Full_System');

      await fs.promises.mkdir(pdfDir, { recursive: true });
      await fs.promises.mkdir(editDir, { recursive: true });
      await fs.promises.mkdir(fullDir, { recursive: true });

      // Yield to Windows message pump
      await new Promise(r => setImmediate(r));

      // 1. Full System Backup JSON (compact serialization, async write)
      if (data.fullBackup) {
        const fullBackupFile = path.join(fullDir, 'BetterNote_Latest_Backup.json');
        await fs.promises.writeFile(fullBackupFile, JSON.stringify(data.fullBackup), 'utf-8');
        savedPaths.push(fullBackupFile);
      }

      // 2. Individual Notebooks (.bnote & .pdf)
      if (data.notebooks && Array.isArray(data.notebooks)) {
        for (const nb of data.notebooks) {
          // Yield between writing notebooks to prevent freezing OS message pump
          await new Promise(r => setImmediate(r));

          const cleanName = (nb.name || 'Untitled').replace(/[\\/:*?"<>|]/g, '_');

          // Editable note file (.bnote)
          const bnoteFile = path.join(editDir, `${cleanName}.bnote`);
          await fs.promises.writeFile(bnoteFile, JSON.stringify(nb), 'utf-8');
          savedPaths.push(bnoteFile);

          // PDF Document file
          if (nb.pdfBase64 && typeof nb.pdfBase64 === 'string') {
            const pdfClean = nb.pdfBase64
              .replace(/^data:application\/pdf.*?;base64,/, '')
              .replace(/^data:[^;]+;base64,/, '')
              .trim();
            if (pdfClean.length > 0) {
              const pdfFile = path.join(pdfDir, `${cleanName}.pdf`);
              await fs.promises.writeFile(pdfFile, Buffer.from(pdfClean, 'base64'));
              savedPaths.push(pdfFile);
            }
          }
        }
      }

      // 3. Prune Orphaned / Deleted Notebooks from Backup
      // Scan editDir and pdfDir, remove files that no longer exist in data.notebooks
      if (activeFileBases.size > 0) {
        try {
          const existingBnotes = await fs.promises.readdir(editDir);
          for (const f of existingBnotes) {
            if (f.endsWith('.bnote')) {
              const baseName = f.slice(0, -6);
              if (!activeFileBases.has(baseName)) {
                const targetFile = path.join(editDir, f);
                await fs.promises.unlink(targetFile);
                prunedPaths.push(targetFile);
              }
            }
          }

          const existingPdfs = await fs.promises.readdir(pdfDir);
          for (const f of existingPdfs) {
            if (f.endsWith('.pdf')) {
              const baseName = f.slice(0, -4);
              if (!activeFileBases.has(baseName)) {
                const targetFile = path.join(pdfDir, f);
                await fs.promises.unlink(targetFile);
                prunedPaths.push(targetFile);
              }
            }
          }
        } catch (pruneErr) {
          console.warn(`Prune check notice for ${t}:`, pruneErr.message);
        }
      }

      // 4. Write Backup Manifest (Prevents duplicate backups and tracks sync state)
      const manifest = {
        lastSync: Date.now(),
        backupTarget: t,
        activeNotebooksCount: activeFileBases.size,
        prunedCount: prunedPaths.length,
        activeFiles: Array.from(activeFileBases)
      };
      await fs.promises.writeFile(path.join(fullDir, 'backup_manifest.json'), JSON.stringify(manifest), 'utf-8');

    } catch (err) {
      console.warn(`Could not write backup to ${t}:`, err.message);
    }
  }

  return { 
    success: true, 
    savedCount: savedPaths.length, 
    prunedCount: prunedPaths.length, 
    target, 
    timestamp: Date.now() 
  };
}

// Smart Cloud Sync & Auto-Restore Reader: Scan and load backups from Google Drive or local folders
async function scanAndLoadBackups(customPath = null) {
  const candidates = [];
  if (customPath && typeof customPath === 'string' && customPath.trim()) {
    candidates.push(customPath.trim());
  }
  candidates.push('H:\\My Drive\\BetterNote.AppPC');
  candidates.push('G:\\My Drive\\BetterNote.AppPC');
  candidates.push(path.resolve(process.env.USERPROFILE || '', 'BetterNote_Backups'));
  candidates.push(path.resolve(process.cwd(), 'BetterNote_Backups'));

  for (const dir of candidates) {
    try {
      const stat = await fs.promises.stat(dir).catch(() => null);
      if (!stat || !stat.isDirectory()) continue;

      // 1. Try Full_System/BetterNote_Latest_Backup.json
      const fullSystemFile = path.join(dir, 'Full_System', 'BetterNote_Latest_Backup.json');
      const hasFull = await fs.promises.stat(fullSystemFile).catch(() => null);
      if (hasFull && hasFull.isFile()) {
        const raw = await fs.promises.readFile(fullSystemFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.notebooks) && parsed.notebooks.length > 0) {
          return {
            success: true,
            folder: dir,
            source: 'full_system',
            count: parsed.notebooks.length,
            data: parsed
          };
        }
      }

      // 2. Try Editable_Notes/*.bnote
      const editDir = path.join(dir, 'Editable_Notes');
      const hasEdit = await fs.promises.stat(editDir).catch(() => null);
      if (hasEdit && hasEdit.isDirectory()) {
        const files = await fs.promises.readdir(editDir);
        const bnoteFiles = files.filter(f => f.endsWith('.bnote'));
        if (bnoteFiles.length > 0) {
          const notebooks = [];
          for (const bf of bnoteFiles) {
            try {
              const rawNote = await fs.promises.readFile(path.join(editDir, bf), 'utf-8');
              const parsedNote = JSON.parse(rawNote);
              if (parsedNote && (parsedNote.id || parsedNote.name)) {
                notebooks.push(parsedNote);
              }
            } catch (_) {}
          }
          if (notebooks.length > 0) {
            return {
              success: true,
              folder: dir,
              source: 'bnote_files',
              count: notebooks.length,
              data: {
                version: 1,
                appName: 'BetterNote',
                exportDate: new Date().toISOString(),
                folders: [],
                notebooks
              }
            };
          }
        }
      }
    } catch (_) {}
  }

  return { success: false, reason: 'not-found' };
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
  const candidates = [];
  if (customPath && typeof customPath === 'string' && customPath.trim()) {
    candidates.push(customPath.trim());
  }
  candidates.push('H:\\My Drive\\BetterNote.AppPC');
  candidates.push('G:\\My Drive\\BetterNote.AppPC');
  candidates.push(path.resolve(process.env.USERPROFILE || '', 'BetterNote_Backups'));
  candidates.push(path.resolve(process.cwd(), 'BetterNote_Backups'));

  let targetDir = null;
  for (const c of candidates) {
    try {
      const st = await fs.promises.stat(c).catch(() => null);
      if (st && st.isDirectory()) {
        targetDir = c;
        break;
      }
    } catch (_) {}
  }

  if (!targetDir) {
    targetDir = candidates[0];
  }

  const isGoogleDrive = targetDir.toLowerCase().includes('drive') || targetDir.startsWith('H:') || targetDir.startsWith('h:') || targetDir.startsWith('G:') || targetDir.startsWith('g:');

  const details = {
    success: true,
    targetDir,
    isGoogleDrive,
    exists: false,
    lastSync: null,
    manifest: null,
    files: [],
    totalFiles: 0,
    totalSizeBytes: 0,
    formattedTotalSize: '0 B'
  };

  try {
    const dirStat = await fs.promises.stat(targetDir).catch(() => null);
    if (!dirStat || !dirStat.isDirectory()) {
      return details;
    }
    details.exists = true;

    // 1. Read manifest
    const manifestPath = path.join(targetDir, 'Full_System', 'backup_manifest.json');
    const hasManifest = await fs.promises.stat(manifestPath).catch(() => null);
    if (hasManifest && hasManifest.isFile()) {
      try {
        const raw = await fs.promises.readFile(manifestPath, 'utf-8');
        details.manifest = JSON.parse(raw);
        if (details.manifest?.lastSync) {
          details.lastSync = details.manifest.lastSync;
        }
      } catch (_) {}
    }

    // 2. Read Editable_Notes/*.bnote
    const editDir = path.join(targetDir, 'Editable_Notes');
    const hasEdit = await fs.promises.stat(editDir).catch(() => null);
    if (hasEdit && hasEdit.isDirectory()) {
      const dirFiles = await fs.promises.readdir(editDir);
      const bnoteFiles = dirFiles.filter(f => f.endsWith('.bnote'));
      for (const bf of bnoteFiles) {
        const fullFilePath = path.join(editDir, bf);
        const fStat = await fs.promises.stat(fullFilePath).catch(() => null);
        if (fStat && fStat.isFile()) {
          details.totalSizeBytes += fStat.size;
          let notebookName = bf.replace(/\.bnote$/i, '');
          let pageCount = null;
          let notebookId = null;
          try {
            const raw = await fs.promises.readFile(fullFilePath, 'utf-8');
            const parsed = JSON.parse(raw);
            if (parsed.name) notebookName = parsed.name;
            if (parsed.id) notebookId = parsed.id;
            if (Array.isArray(parsed.pages)) pageCount = parsed.pages.length;
          } catch (_) {}

          details.files.push({
            fileName: bf,
            notebookName,
            notebookId,
            fullPath: fullFilePath,
            relativeFolder: 'Editable_Notes',
            fileSizeBytes: fStat.size,
            formattedSize: formatBytes(fStat.size),
            lastModified: fStat.mtimeMs,
            formattedDate: new Date(fStat.mtimeMs).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }),
            pageCount
          });
        }
      }
    }

    // 3. Read PDF_Documents/*.pdf
    const pdfDir = path.join(targetDir, 'PDF_Documents');
    const hasPdf = await fs.promises.stat(pdfDir).catch(() => null);
    if (hasPdf && hasPdf.isDirectory()) {
      const dirFiles = await fs.promises.readdir(pdfDir);
      const pdfFiles = dirFiles.filter(f => f.endsWith('.pdf'));
      for (const pf of pdfFiles) {
        const fullFilePath = path.join(pdfDir, pf);
        const fStat = await fs.promises.stat(fullFilePath).catch(() => null);
        if (fStat && fStat.isFile()) {
          details.totalSizeBytes += fStat.size;
          const notebookName = pf.replace(/\.pdf$/i, '');
          details.files.push({
            fileName: pf,
            notebookName: `${notebookName} (PDF)`,
            notebookId: `pdf_${notebookName}`,
            fullPath: fullFilePath,
            relativeFolder: 'PDF_Documents',
            fileSizeBytes: fStat.size,
            formattedSize: formatBytes(fStat.size),
            lastModified: fStat.mtimeMs,
            formattedDate: new Date(fStat.mtimeMs).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }),
            pageCount: null
          });
        }
      }
    }

    // 4. Read Full_System/BetterNote_Latest_Backup.json
    const fullSystemPath = path.join(targetDir, 'Full_System', 'BetterNote_Latest_Backup.json');
    const hasFull = await fs.promises.stat(fullSystemPath).catch(() => null);
    if (hasFull && hasFull.isFile()) {
      details.totalSizeBytes += hasFull.size;
      if (!details.lastSync) details.lastSync = hasFull.mtimeMs;
      details.files.push({
        fileName: 'BetterNote_Latest_Backup.json',
        notebookName: 'สำรองข้อมูลระบบทั้งหมด (Full System JSON)',
        notebookId: 'full_system_backup',
        fullPath: fullSystemPath,
        relativeFolder: 'Full_System',
        fileSizeBytes: hasFull.size,
        formattedSize: formatBytes(hasFull.size),
        lastModified: hasFull.mtimeMs,
        formattedDate: new Date(hasFull.mtimeMs).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }),
        pageCount: null
      });
    }

    // Sort files by lastModified descending
    details.files.sort((a, b) => b.lastModified - a.lastModified);
    details.totalFiles = details.files.length;
    details.formattedTotalSize = formatBytes(details.totalSizeBytes);
    if (!details.lastSync && details.files.length > 0) {
      details.lastSync = details.files[0].lastModified;
    }
  } catch (err) {
    console.warn('getBackupStatusDetails error:', err.message);
  }

  return details;
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

  // Handle IPC Auto-Backup calls directly from renderer
  ipcMain.handle('save-auto-backup', async (event, data) => {
    return await writeBackupData(data);
  });

  // Handle immediate pruning of a deleted notebook from backups
  ipcMain.handle('prune-backup-notebook', async (event, notebookName) => {
    return await pruneNotebookFromBackups(notebookName);
  });

  // Handle scanning and restoring from Google Drive or local backup folder
  ipcMain.handle('scan-backup-folder', async (event, customPath) => {
    return await scanAndLoadBackups(customPath);
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
      const target = folderPath || getBackupTargetDir();
      if (fs.existsSync(target)) {
        await shell.openPath(target);
        return { success: true };
      } else {
        // Create if needed
        fs.mkdirSync(target, { recursive: true });
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
