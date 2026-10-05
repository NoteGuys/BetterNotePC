const { app, BrowserWindow, ipcMain, dialog, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

// Surface Pro Hardware Acceleration, High-DPI & Touch/Stylus Flags
app.commandLine.appendSwitch('enable-features', 'TouchEvents,VaapiVideoDecoder');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('high-dpi-support', '1');

let mainWindow = null;

// Backup Directory Targets Discovery (Deduplicated, max 2 targets: Primary Active Target + Local Backup)
function getAllBackupTargets(customPath = null) {
  const targets = [];
  const localTarget = path.resolve(process.cwd(), 'BetterNote_Backups');

  // 1. Check custom path requested by user
  if (customPath && typeof customPath === 'string' && customPath.trim()) {
    const trimmed = customPath.trim();
    try {
      if (!fs.existsSync(trimmed)) fs.mkdirSync(trimmed, { recursive: true });
      targets.push(trimmed);
    } catch (_) {}
  }

  // 2. If no custom path, pick the FIRST valid mounted Google Drive
  if (targets.length === 0) {
    const gDriveCandidates = [
      'H:\\My Drive\\BetterNote.AppPC',
      'G:\\My Drive\\BetterNote.AppPC',
      'I:\\My Drive\\BetterNote.AppPC',
      'D:\\My Drive\\BetterNote.AppPC'
    ];

    for (const gPath of gDriveCandidates) {
      const root = path.dirname(gPath);
      if (fs.existsSync(root) || fs.existsSync(gPath)) {
        try {
          if (!fs.existsSync(gPath)) fs.mkdirSync(gPath, { recursive: true });
          targets.push(gPath);
          break; // Stop at first valid cloud drive to prevent parallel network drive thrashing!
        } catch (_) {}
      }
    }
  }

  // 3. Fallback: Documents if neither custom nor Google Drive is available
  if (targets.length === 0) {
    let fallbackDir;
    try {
      fallbackDir = path.join(app.getPath('documents'), 'BetterNote.AppPC');
    } catch (_) {
      fallbackDir = path.resolve(process.env.USERPROFILE || '', 'Documents', 'BetterNote.AppPC');
    }
    if (!fs.existsSync(fallbackDir)) {
      try { fs.mkdirSync(fallbackDir, { recursive: true }); } catch (_) {}
    }
    targets.push(fallbackDir);
  }

  // 4. Always ensure local backup folder exists as safe offline fallback
  if (!targets.includes(localTarget)) {
    targets.push(localTarget);
  }

  return targets;
}

function getBackupTargetDir(customPath = null) {
  const all = getAllBackupTargets(customPath);
  return all[0] || path.resolve(process.cwd(), 'BetterNote_Backups');
}

// Prune a single deleted notebook from all backup folders immediately upon user action
async function pruneNotebookFromBackups(notebookName) {
  if (!notebookName) return { success: false, reason: 'empty-name' };
  return await pruneNotebooksBatchFromBackups([notebookName]);
}

// Prune multiple deleted notebooks from all backup folders in a single efficient, safe pass
async function pruneNotebooksBatchFromBackups(notebookNames) {
  if (!Array.isArray(notebookNames) || notebookNames.length === 0) {
    return { success: true, count: 0 };
  }
  const cleanNamesSet = new Set(notebookNames.map(n => (n || '').replace(/[\\/:*?"<>|]/g, '_')).filter(Boolean));
  if (cleanNamesSet.size === 0) return { success: true, count: 0 };

  const targets = getAllBackupTargets();
  let deletedFiles = 0;

  for (const t of targets) {
    try {
      const editDir = path.join(t, 'Editable_Notes');
      const pdfDir = path.join(t, 'PDF_Documents');
      const fullBackupFile = path.join(t, 'Full_System', 'BetterNote_Latest_Backup.json');

      for (const cleanName of cleanNamesSet) {
        const bnoteFile = path.join(editDir, `${cleanName}.bnote`);
        const pdfFile = path.join(pdfDir, `${cleanName}.pdf`);

        try {
          if (fs.existsSync(bnoteFile)) {
            await fs.promises.unlink(bnoteFile);
            deletedFiles++;
          }
        } catch (_) {}

        try {
          if (fs.existsSync(pdfFile)) {
            await fs.promises.unlink(pdfFile);
            deletedFiles++;
          }
        } catch (_) {}
      }

      // Update Full_System/BetterNote_Latest_Backup.json in ONE pass per target
      if (fs.existsSync(fullBackupFile)) {
        try {
          const raw = await fs.promises.readFile(fullBackupFile, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.notebooks)) {
            parsed.notebooks = parsed.notebooks.filter(nb => {
              const nbClean = (nb.name || '').replace(/[\\/:*?"<>|]/g, '_');
              return !cleanNamesSet.has(nbClean);
            });
            await fs.promises.writeFile(fullBackupFile, JSON.stringify(parsed), 'utf-8');
          }
        } catch (_) {}
      }
    } catch (err) {
      console.warn(`Could not prune batch notebooks from ${t}:`, err.message);
    }
  }

  return { success: true, count: cleanNamesSet.size, deletedFiles };
}

// Mutex lock for backup writes to prevent parallel collision & Windows network drive freezes
let isWritingBackup = false;

// Native Auto-Backup Writer: Direct disk write without blocking the Main Process event loop
// SAFE NON-DESTRUCTIVE BACKUP: Never deletes existing backup files based on client state!
async function writeBackupData(data) {
  if (!data) return { success: false, reason: 'no-data' };
  if (isWritingBackup) {
    return { success: false, reason: 'already-writing' };
  }
  isWritingBackup = true;

  try {
    const targets = getAllBackupTargets(data?.customBackupPath);
    const target = targets[0] || getBackupTargetDir(data?.customBackupPath);
    const savedPaths = [];

    // Helper: strip bulky binary base64 from note object before writing JSON
    const sanitizeNotebookForJson = (nb) => {
      if (!nb) return nb;
      const { pdfBase64, ...cleanNb } = nb;
      return cleanNb;
    };

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

        // 1. Full System Backup JSON (clean, compact serialization WITHOUT base64 blobs)
        if (data.fullBackup) {
          const fullBackupFile = path.join(fullDir, 'BetterNote_Latest_Backup.json');
          
          const cleanFullBackup = {
            ...data.fullBackup,
            notebooks: (data.fullBackup.notebooks || []).map(sanitizeNotebookForJson)
          };

          let fullDataToWrite = cleanFullBackup;
          try {
            const existingRaw = await fs.promises.readFile(fullBackupFile, 'utf-8').catch(() => null);
            if (existingRaw) {
              const existingParsed = JSON.parse(existingRaw);
              if (existingParsed && Array.isArray(existingParsed.notebooks)) {
                const incomingNames = new Set((cleanFullBackup.notebooks || []).map(nb => (nb.name || '').replace(/[\\/:*?"<>|]/g, '_')));
                const incomingIds = new Set((cleanFullBackup.notebooks || []).map(nb => nb.id));
                const preserved = existingParsed.notebooks.filter(nb => {
                  const nbName = (nb.name || '').replace(/[\\/:*?"<>|]/g, '_');
                  return !incomingIds.has(nb.id) && !incomingNames.has(nbName);
                });
                if (preserved.length > 0) {
                  fullDataToWrite = {
                    ...cleanFullBackup,
                    folders: Array.from(new Map([...(existingParsed.folders || []), ...(cleanFullBackup.folders || [])].map(f => [f.id, f])).values()),
                    notebooks: [...(cleanFullBackup.notebooks || []), ...preserved]
                  };
                }
              }
            }
          } catch (_) {}

          await fs.promises.writeFile(fullBackupFile, JSON.stringify(fullDataToWrite), 'utf-8');
          savedPaths.push(fullBackupFile);
        }

        // 2. Individual Notebooks (.bnote) - clean JSON without bloated base64
        if (data.notebooks && Array.isArray(data.notebooks)) {
          for (const nb of data.notebooks) {
            await new Promise(r => setImmediate(r));
            const cleanName = (nb.name || 'Untitled').replace(/[\\/:*?"<>|]/g, '_');
            const cleanNb = sanitizeNotebookForJson(nb);

            const bnoteFile = path.join(editDir, `${cleanName}.bnote`);
            await fs.promises.writeFile(bnoteFile, JSON.stringify(cleanNb), 'utf-8');
            savedPaths.push(bnoteFile);
          }
        }

        // 3. Write PDF documents (from separate updatedPdfs array or notebook.pdfBase64)
        const pdfItems = data.updatedPdfs || (data.notebooks || []).filter(nb => !!nb.pdfBase64);
        for (const item of pdfItems) {
          const rawBase64 = item.pdfBase64;
          const cleanName = (item.name || 'Untitled').replace(/[\\/:*?"<>|]/g, '_');
          if (rawBase64 && typeof rawBase64 === 'string') {
            const pdfClean = rawBase64
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

        // 4. Write Backup Manifest (Prevents duplicate backups and tracks sync state)
        const manifest = {
          lastSync: Date.now(),
          backupTarget: t,
          activeNotebooksCount: (data.notebooks && data.notebooks.length) || 0,
          savedCount: savedPaths.length
        };
        await fs.promises.writeFile(path.join(fullDir, 'backup_manifest.json'), JSON.stringify(manifest), 'utf-8');

      } catch (err) {
        console.warn(`Could not write backup to ${t}:`, err.message);
      }
    }

    return { 
      success: true, 
      savedCount: savedPaths.length, 
      target, 
      timestamp: Date.now() 
    };
  } finally {
    isWritingBackup = false;
  }
}

// Smart Cloud Sync & Auto-Restore Reader: Scan and load backups from Google Drive or local folders
async function scanAndLoadBackups(customPath = null) {
  const candidates = [];
  if (customPath && typeof customPath === 'string' && customPath.trim()) {
    candidates.push(customPath.trim());
  }
  candidates.push('H:\\My Drive\\BetterNote.AppPC');
  candidates.push('G:\\My Drive\\BetterNote.AppPC');
  candidates.push('I:\\My Drive\\BetterNote.AppPC');
  candidates.push('D:\\My Drive\\BetterNote.AppPC');
  try {
    candidates.push(path.join(app.getPath('documents'), 'BetterNote.AppPC'));
  } catch (_) {}
  candidates.push(path.resolve(process.env.USERPROFILE || '', 'Documents', 'BetterNote.AppPC'));
  candidates.push(path.resolve(process.env.USERPROFILE || '', 'BetterNote_Backups'));
  candidates.push(path.resolve(process.cwd(), 'BetterNote_Backups'));

  for (const dir of candidates) {
    try {
      const stat = await fs.promises.stat(dir).catch(() => null);
      if (!stat || !stat.isDirectory()) continue;

      const notebooksMap = new Map();
      let folders = [];

      // 1. Try Full_System/BetterNote_Latest_Backup.json
      const fullSystemFile = path.join(dir, 'Full_System', 'BetterNote_Latest_Backup.json');
      const hasFull = await fs.promises.stat(fullSystemFile).catch(() => null);
      if (hasFull && hasFull.isFile()) {
        try {
          const raw = await fs.promises.readFile(fullSystemFile, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed) {
            if (Array.isArray(parsed.folders)) folders = parsed.folders;
            if (Array.isArray(parsed.notebooks)) {
              for (const nb of parsed.notebooks) {
                const key = nb.id || nb.name;
                if (key) notebooksMap.set(key, nb);
              }
            }
          }
        } catch (_) {}
      }

      // 2. Also scan Editable_Notes/*.bnote (to seamlessly include all individual notebooks)
      const editDir = path.join(dir, 'Editable_Notes');
      const hasEdit = await fs.promises.stat(editDir).catch(() => null);
      if (hasEdit && hasEdit.isDirectory()) {
        try {
          const files = await fs.promises.readdir(editDir);
          const bnoteFiles = files.filter(f => f.endsWith('.bnote'));
          for (const bf of bnoteFiles) {
            try {
              const rawNote = await fs.promises.readFile(path.join(editDir, bf), 'utf-8');
              const parsedNote = JSON.parse(rawNote);
              if (parsedNote && (parsedNote.id || parsedNote.name)) {
                const key = parsedNote.id || parsedNote.name;
                if (!notebooksMap.has(key)) {
                  notebooksMap.set(key, parsedNote);
                }
              }
            } catch (_) {}
          }
        } catch (_) {}
      }

      if (notebooksMap.size > 0) {
        return {
          success: true,
          folder: dir,
          source: 'merged_backup',
          count: notebooksMap.size,
          data: {
            version: 1,
            appName: 'BetterNote',
            exportDate: new Date().toISOString(),
            folders,
            notebooks: Array.from(notebooksMap.values())
          }
        };
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
  candidates.push('I:\\My Drive\\BetterNote.AppPC');
  candidates.push('D:\\My Drive\\BetterNote.AppPC');
  try {
    candidates.push(path.join(app.getPath('documents'), 'BetterNote.AppPC'));
  } catch (_) {}
  candidates.push(path.resolve(process.env.USERPROFILE || '', 'Documents', 'BetterNote.AppPC'));
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
    targetDir = getBackupTargetDir(customPath);
  }

  const isGoogleDrive = targetDir.toLowerCase().includes('drive') || targetDir.startsWith('H:') || targetDir.startsWith('h:') || targetDir.startsWith('G:') || targetDir.startsWith('g:');

  let docsDir = 'BetterNote.AppPC';
  try {
    docsDir = app ? path.join(app.getPath('documents'), 'BetterNote.AppPC') : path.resolve(process.env.USERPROFILE || '', 'Documents', 'BetterNote.AppPC');
  } catch (_) {}

  const details = {
    success: true,
    targetDir,
    documentsDir: docsDir,
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

  // Handle batch pruning of multiple deleted notebooks from backups
  ipcMain.handle('prune-backup-notebooks-batch', async (event, notebookNames) => {
    return await pruneNotebooksBatchFromBackups(notebookNames);
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
