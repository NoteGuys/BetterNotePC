import { getBackupMetadata, getBackupNotebookSnapshot, getSetting, saveSetting, subscribeBackupChanges } from './db.js';
import { flushLocalSaves, getLocalSaveSnapshot, subscribeLocalSaves } from './localSaveService.js';
import { generateVerifiedBackupPdf } from '../utils/backupPdf.js';
import { createBackupController } from './backupController.js';
import { resolveBackupReadFolder, backupReadErrorKey } from './backupReadStatus.js';
import { t } from './i18n';

class AutoBackupService {
  constructor() {
    this.listeners = new Set();
    this.pointerIds = new Set();
    this.canvasPointerIds = new Set();
    this.lastInput = 0;
    this.controller = createBackupController({
      getMetadata: getBackupMetadata, getNotebook: getBackupNotebookSnapshot,
      waitForLocalSaves: () => flushLocalSaves(), getLocalState: getLocalSaveSnapshot,
      native: command => typeof window !== 'undefined' && window.electronAPI?.saveBackup
        ? window.electronAPI.saveBackup(command) : Promise.resolve({ success: false, reason: 'unsupported-environment' }),
      getPath: async () => ({
        localBackupPath: (await getSetting('local_backup_path')) || null,
        driveBackupPath: (await getSetting('gdrive_backup_method')) === 'desktop'
          ? (await getSetting('gdrive_backup_path')) || null : null
      }),
      makePdf: (note, check, options) => generateVerifiedBackupPdf(note, check, options),
      canRenderPdf: () => this.pointerIds.size === 0 && getLocalSaveSnapshot().status === 'saved' && Date.now() - this.lastInput > 700,
      persist: data => saveSetting('backup_v2_checkpoint', data)
    });
    this.controller.subscribe(() => this.notify({
      ...this.controller.getSnapshot(),
      lastSyncTime: this.controller.getSnapshot().lastSuccess,
      success: this.controller.getSnapshot().status === 'current'
    }));
  }
  get isSyncing() { return this.controller.getSnapshot().syncing; }
  get lastSyncTime() { return this.controller.getSnapshot().lastSuccess; }
  getSnapshot = () => this.controller.getSnapshot();
  subscribeStatus = listener => this.controller.subscribe(listener);
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  notify(status) { for (const fn of this.listeners) { try { fn(status); } catch (_) {} } }
  runAutoBackup(options = {}) { return this.controller.run(options); }
  destinationChanged() { return this.controller.destinationChanged(); }
  getCachedDetails() { return this.controller.getCachedDetails(); }
  async setLocalBackupPath(folder) {
    if (typeof folder !== 'string' || !folder.trim()) return;
    await saveSetting('local_backup_path', folder.trim());
    if (typeof window !== 'undefined') window.localStorage?.setItem('local_backup_path', folder.trim());
    await this.destinationChanged();
  }
  async setDriveDesktopPath(folder) {
    if (typeof folder !== 'string' || !folder.trim()) return;
    await saveSetting('gdrive_backup_path', folder.trim());
    await saveSetting('gdrive_backup_method', 'desktop');
    await this.destinationChanged();
  }
  startScheduledSync() {
    if (this.stopSubscriptions) return;
    const offData = subscribeBackupChanges(() => this.controller.markDirty());
    const offLocal = subscribeLocalSaves(() => this.controller.localStateChanged());
    const offProgress = typeof window !== 'undefined' && window.electronAPI?.onBackupProgress
      ? window.electronAPI.onBackupProgress(event => this.controller.nativeProgress(event)) : () => {};
    const down = e => {
      this.pointerIds.add(e.pointerId);
      if (e.target?.closest?.('canvas')) { this.canvasPointerIds.add(e.pointerId); this.lastInput = Date.now(); }
    };
    const up = e => {
      this.pointerIds.delete(e.pointerId);
      if (this.canvasPointerIds.delete(e.pointerId)) this.lastInput = Date.now();
    };
    const move = e => { if (e.pointerType !== 'touch' && !e.buttons) { this.pointerIds.delete(e.pointerId); this.canvasPointerIds.delete(e.pointerId); } };
    const blur = () => { this.pointerIds.clear(); this.canvasPointerIds.clear(); };
    const key = e => { if (e.target?.closest?.('input,textarea,[contenteditable="true"]')) this.lastInput = Date.now(); };
    const events = [['pointerdown', down], ['pointerup', up], ['pointercancel', up],
      ['lostpointercapture', up], ['pointermove', move], ['blur', blur], ['keydown', key]];
    if (typeof window !== 'undefined') events.forEach(([event, handler]) => window.addEventListener(event, handler, { capture: true, passive: true }));
    this.stopSubscriptions = () => {
      offData(); offLocal(); offProgress();
      if (typeof window !== 'undefined') events.forEach(([event, handler]) => window.removeEventListener(event, handler, true));
      this.pointerIds.clear(); this.canvasPointerIds.clear();
    };
    this.controller.start();
  }
  stopScheduledSync() { this.stopSubscriptions?.(); this.stopSubscriptions = null; this.controller.stop(); }
  async pruneDeletedNotebook(_name, notebookId = null) {
    if (!notebookId) return { success: false, reason: 'notebook-id-required' };
    return this.controller.prune([notebookId]);
  }
  async pruneDeletedNotebooks(_names, notebookIds = []) {
    if (!notebookIds.length) return { success: false, reason: 'notebook-id-required' };
    return this.controller.prune(notebookIds);
  }

  /**
   * Scan Google Drive or local disk for existing backup archives
   */
  async scanAvailableBackups(customPath = null, options = {}) {
    if (typeof window === 'undefined' || !window.electronAPI?.scanBackupFolder) {
      return { success: false, reason: 'unsupported-environment' };
    }
    try {
      const folder = await resolveBackupReadFolder(getSetting, customPath);
      return await window.electronAPI.scanBackupFolder(folder, { previewOnly: options.previewOnly === true });
    } catch (_) {
      return { success: false, reason: 'backup-read-failed' };
    }
  }

  /**
   * Restore all notebooks and folders automatically from Google Drive or local backup folder
   */
  async restoreFromCloudBackup(customPath = null) {
    try {
      this.notify({ syncing: true, message: t('backupReadRestoring') });
      const scanResult = await this.scanAvailableBackups(customPath);
      if (!scanResult || !scanResult.success || !scanResult.data) {
        this.notify({ syncing: false, success: false, message: t(backupReadErrorKey(scanResult?.reason)) });
        return { ...scanResult, success: false, reason: scanResult?.reason || 'backup-read-failed' };
      }

      const { restoreFullBackup } = await import('./fileSystemService');
      const restoreResult = await restoreFullBackup(scanResult.data);
      this.notify({
        syncing: false,
        success: true,
        message: t('backupReadRestored', '', { count: restoreResult.notebooksCount }),
        lastSyncTime: this.lastSyncTime
      });
      return { 
        success: true, 
        count: restoreResult.notebooksCount, 
        folder: scanResult.folder,
        source: scanResult.source 
      };
    } catch (err) {
      this.notify({ syncing: false, success: false, message: t('backupReadUnavailable') });
      return { success: false, reason: 'backup-read-failed' };
    }
  }

  /**
   * Fetch comprehensive backup manifest, file details, timestamps, and destination folder
   */
  async getBackupStatusDetails(options = {}) {
    const settings = options && typeof options === 'object' ? options : {};
    const details = await this.controller.refresh({ inspect: true, includeFiles: true, ...settings });
    return { ...(details || { success: false, files: [], lastSync: null }), snapshot: this.getSnapshot() };
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
