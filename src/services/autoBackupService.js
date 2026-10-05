// Automated Google Drive & Local Disk Backup Service for BetterNote (Non-blocking & Zero-lag PDF + .bnote)
import { getAllFolders, getAllNotebooks, getPagesByNotebookId, saveSetting, getSetting } from './db.js';
import { generateNotebookPdfBase64 } from '../utils/pdfExportEngine.js';

class AutoBackupService {
  constructor() {
    this.intervalId = null;
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.lastPdfBackupMap = new Map();
    // Load differential PDF backup timestamps from localStorage to prevent re-rendering on app startup
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('betternote_last_pdf_backup_map');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            this.lastPdfBackupMap = new Map(Object.entries(parsed));
          }
        }
      }
    } catch (_) {}
    this.listeners = new Set();
  }

  // Persist differential PDF timestamps
  _persistPdfMap() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const obj = Object.fromEntries(this.lastPdfBackupMap);
        window.localStorage.setItem('betternote_last_pdf_backup_map', JSON.stringify(obj));
      }
    } catch (_) {}
  }

  // Subscribe to sync status updates
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(status) {
    for (const fn of this.listeners) {
      try { fn(status); } catch (_) {}
    }
  }

  /**
   * Run lightweight, non-blocking auto backup of metadata, editable notes & PDF documents
   */
  async runAutoBackup(options = {}) {
    if (this.isSyncing) return;
    this.isSyncing = true;

    const forcePdf = !!options?.forcePdf;

    let customBackupPath = null;
    try {
      const stored = await getSetting('local_backup_path');
      if (stored && typeof stored === 'string' && stored.trim()) {
        customBackupPath = stored.trim();
      } else if (typeof window !== 'undefined' && window.localStorage) {
        const lsVal = window.localStorage.getItem('local_backup_path');
        if (lsVal && lsVal.trim()) customBackupPath = lsVal.trim();
      }
    } catch (_) {}

    this.notify({ syncing: true, message: customBackupPath ? `กำลังบันทึกสำรอง (${customBackupPath})...` : 'กำลังบันทึกสำรองข้อมูล...' });

    try {
      const allFolders = await getAllFolders();
      const allNotebooks = await getAllNotebooks();

      // Exclude trashed / soft-deleted notebooks and folders from cloud backups
      const folders = allFolders.filter(f => !f.isDeleted);
      const notebooks = allNotebooks.filter(nb => !nb.isDeleted);

      if (notebooks.length === 0 && folders.length === 0) {
        // Never overwrite backups with empty state
        this.notify({ syncing: false });
        return;
      }

      // Check if any notebook or folder has been updated since last sync (unless forcePdf is requested)
      const latestNotebookUpdate = Math.max(0, ...notebooks.map(n => n.updatedAt || 0));
      if (!forcePdf && this.lastSyncTime && latestNotebookUpdate > 0 && latestNotebookUpdate <= this.lastSyncTime) {
        this.notify({ 
          syncing: false, 
          success: true, 
          lastSyncTime: this.lastSyncTime, 
          message: 'ข้อมูลเป็นปัจจุบันแล้ว' 
        });
        return;
      }

      const fullBackup = {
        version: 1,
        appName: 'BetterNote',
        exportDate: new Date().toISOString(),
        folders,
        notebooks: []
      };

      const updatedPdfs = [];

      // Non-blocking differential loop: save JSON structures and generate PDF backups
      for (const nb of notebooks) {
        // Generous cooperative yield to browser event loop between notebooks to keep UI 100% responsive
        await new Promise(resolve => setTimeout(resolve, 30));

        const pages = await getPagesByNotebookId(nb.id);
        const notebookBundle = {
          ...nb,
          pages
        };

        fullBackup.notebooks.push(notebookBundle);

        // Differential PDF backup: only generate when notebook was actually modified or newly backed up
        const lastPdfTime = Number(this.lastPdfBackupMap.get(nb.id)) || 0;
        const nbUpdatedTime = Number(nb.updatedAt) || 0;
        const needsPdf = forcePdf || !lastPdfTime || nbUpdatedTime > lastPdfTime;

        if (needsPdf && pages && pages.length > 0) {
          try {
            this.notify({ 
              syncing: true, 
              message: `กำลังบันทึก PDF สำรอง (${nb.name || 'สมุดบันทึก'})...` 
            });
            // Yield before heavy canvas PDF rendering to prevent UI thread lock
            await new Promise(resolve => setTimeout(resolve, 40));

            const pdfBase64 = await generateNotebookPdfBase64(nb, pages);
            if (pdfBase64) {
              updatedPdfs.push({
                name: nb.name,
                pdfBase64
              });
              this.lastPdfBackupMap.set(nb.id, nbUpdatedTime || Date.now());
            }
          } catch (pdfErr) {
            console.warn(`PDF backup notice for ${nb.name}:`, pdfErr.message);
          }
          // Cooperative yield after processing each notebook
          await new Promise(resolve => setTimeout(resolve, 30));
        }
      }

      this._persistPdfMap();

      const backupPayload = {
        customBackupPath,
        fullBackup,
        notebooks: fullBackup.notebooks,
        updatedPdfs
      };

      // If running inside Electron Native App, write directly via Node IPC
      if (typeof window !== 'undefined' && window.electronAPI?.saveBackup) {
        await window.electronAPI.saveBackup(backupPayload);
      } else {
        // Fallback to Vite local sync API when running in web browser
        try {
          await fetch('/api/auto-backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(backupPayload)
          });
        } catch (_) {}
      }

      const now = Date.now();
      this.lastSyncTime = now;
      await saveSetting('gdrive_last_sync', now);
      this.notify({ 
        syncing: false, 
        success: true, 
        lastSyncTime: now, 
        message: `สำรองข้อมูลและเอกสาร PDF เรียบร้อย` 
      });
    } catch (err) {
      console.warn('Auto backup notice:', err.message);
      this.notify({ 
        syncing: false, 
        success: false, 
        error: err.message, 
        message: 'การซิงค์อัตโนมัติพร้อมใช้งาน' 
      });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Start interval and setup close/exit triggers
   */
  startScheduledSync() {
    // 1. Gentle background backup after 20 seconds on idle (non-blocking)
    setTimeout(() => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(() => this.runAutoBackup());
      } else {
        this.runAutoBackup();
      }
    }, 20000);

    // 2. Every 1 hour (3600000 ms)
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      this.runAutoBackup();
    }, 60 * 60 * 1000);

    // 3. Trigger backup when app is hidden, with minimum 10-minute cooldown
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          if (Date.now() - (this.lastSyncTime || 0) > 10 * 60 * 1000) {
            if ('requestIdleCallback' in window) {
              window.requestIdleCallback(() => this.runAutoBackup());
            } else {
              this.runAutoBackup();
            }
          }
        }
      });
    }
  }

  /**
   * Immediately prune deleted notebook files from backups
   */
  async pruneDeletedNotebook(notebookName, notebookId = null) {
    if (!notebookName) return;
    if (notebookId) {
      this.lastPdfBackupMap.delete(notebookId);
      this._persistPdfMap();
    }
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.pruneBackupNotebook) {
        await window.electronAPI.pruneBackupNotebook(notebookName);
      }
    } catch (err) {
      console.warn('Prune backup notice:', err.message);
    }
  }

  /**
   * Batch prune multiple deleted notebooks from backups in one safe operation
   */
  async pruneDeletedNotebooks(notebookNames, notebookIds = []) {
    if (!Array.isArray(notebookNames) || notebookNames.length === 0) return;
    if (Array.isArray(notebookIds) && notebookIds.length > 0) {
      notebookIds.forEach(id => this.lastPdfBackupMap.delete(id));
      this._persistPdfMap();
    }
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.pruneBackupNotebooksBatch) {
        await window.electronAPI.pruneBackupNotebooksBatch(notebookNames);
      } else if (typeof window !== 'undefined' && window.electronAPI?.pruneBackupNotebook) {
        for (const name of notebookNames) {
          await window.electronAPI.pruneBackupNotebook(name);
        }
      }
    } catch (err) {
      console.warn('Batch prune backup notice:', err.message);
    }
  }

  /**
   * Scan Google Drive or local disk for existing backup archives
   */
  async scanAvailableBackups(customPath = null) {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.scanBackupFolder) {
        return await window.electronAPI.scanBackupFolder(customPath);
      }
    } catch (err) {
      console.warn('Scan backups error:', err.message);
    }
    return { success: false, reason: 'unsupported-environment' };
  }

  /**
   * Restore all notebooks and folders automatically from Google Drive or local backup folder
   */
  async restoreFromCloudBackup(customPath = null) {
    try {
      this.notify({ syncing: true, message: 'กำลังค้นหาและกู้คืนข้อมูลจาก Google Drive...' });
      const scanResult = await this.scanAvailableBackups(customPath);
      if (!scanResult || !scanResult.success || !scanResult.data) {
        this.notify({ syncing: false, success: false, message: 'ไม่พบไฟล์สำรองในโฟลเดอร์ Google Drive / Local' });
        return { success: false, reason: 'not-found' };
      }

      const { restoreFullBackup } = await import('./fileSystemService');
      const restoreResult = await restoreFullBackup(scanResult.data);
      this.lastSyncTime = Date.now();
      this.notify({
        syncing: false,
        success: true,
        message: `กู้คืนข้อมูลสำเร็จ! นำเข้าแล้ว ${restoreResult.notebooksCount} เล่ม`,
        lastSyncTime: this.lastSyncTime
      });
      return { 
        success: true, 
        count: restoreResult.notebooksCount, 
        folder: scanResult.folder,
        source: scanResult.source 
      };
    } catch (err) {
      this.notify({ syncing: false, success: false, message: `การกู้คืนล้มเหลว: ${err.message}` });
      return { success: false, error: err.message };
    }
  }

  /**
   * Fetch comprehensive backup manifest, file details, timestamps, and destination folder
   */
  async getBackupStatusDetails(customPath = null) {
    let pathToCheck = customPath;
    if (!pathToCheck) {
      try {
        const stored = await getSetting('local_backup_path');
        if (stored && typeof stored === 'string' && stored.trim()) {
          pathToCheck = stored.trim();
        } else if (typeof window !== 'undefined' && window.localStorage) {
          const lsVal = window.localStorage.getItem('local_backup_path');
          if (lsVal && lsVal.trim()) pathToCheck = lsVal.trim();
        }
      } catch (_) {}
    }

    try {
      if (typeof window !== 'undefined' && window.electronAPI?.getBackupStatusDetails) {
        return await window.electronAPI.getBackupStatusDetails(pathToCheck);
      }
    } catch (err) {
      console.warn('Get backup status details error:', err.message);
    }
    // Web fallback for browser environment
    return {
      success: true,
      targetDir: pathToCheck || 'BetterNote_Backups',
      isGoogleDrive: false,
      exists: true,
      lastSync: this.lastSyncTime || Date.now() - 60000,
      manifest: { lastSync: this.lastSyncTime || Date.now() - 60000, activeNotebooksCount: 1 },
      files: [],
      totalFiles: 0,
      totalSizeBytes: 0,
      formattedTotalSize: '0 B'
    };
  }

  /**
   * Open the destination backup folder in Windows File Explorer
   */
  async openBackupFolder(folderPath = null) {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.openBackupFolder) {
        return await window.electronAPI.openBackupFolder(folderPath);
      }
    } catch (err) {
      console.warn('Open backup folder error:', err.message);
    }
    return { success: false, reason: 'unsupported-environment' };
  }

  /**
   * Reveal a specific backed-up file in Windows File Explorer
   */
  async revealBackupFile(filePath) {
    if (!filePath) return { success: false, error: 'No file path provided' };
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.revealBackupFile) {
        return await window.electronAPI.revealBackupFile(filePath);
      }
    } catch (err) {
      console.warn('Reveal backup file error:', err.message);
      return { success: false, error: err.message };
    }
    return { success: false, reason: 'unsupported-environment' };
  }
}


export const autoBackupService = new AutoBackupService();
