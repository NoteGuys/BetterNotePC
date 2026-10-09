import { getSetting, saveSetting, subscribeBackupChanges } from './db.js';
import { flushLocalSaves, getLocalSaveSnapshot, subscribeLocalSaves } from './localSaveService.js';
import { createBackupPreparationService } from './backupPreparationService.js';
import { createBackupController } from './backupController.js';
import { resolveBackupReadFolder, backupReadErrorKey } from './backupReadStatus.js';
import { t } from './i18n';
import { restoreBackup, configureRecoveryBackups } from './backupRecoveryService.js';
// Backup is outbound only. Import is performed exclusively by an explicit recovery action.
const idleSync=()=>{const snapshot=Object.freeze({status:'idle'});return {getSnapshot:()=>snapshot,subscribe:()=>()=>{},stop:()=>{}};};

class AutoBackupService {
  constructor() {
    this.listeners = new Set();
    this.pointerIds = new Set();
    this.canvasPointerIds = new Set();
    this.lastInput = 0;
    this.driveSync=idleSync();this.localSync=idleSync();
    this.devicePromise=null;
    this.preparation = createBackupPreparationService();
    this.controller = createBackupController({
      getMetadata: () => this.preparation.getMetadata(), getNotebook: (id, options) => this.preparation.getNotebook(id, options),
      waitForLocalSaves: () => flushLocalSaves(), getLocalState: getLocalSaveSnapshot,
      native: command => typeof window !== 'undefined' && window.electronAPI?.saveBackup
        ? this.backupCommand(command) : Promise.resolve({ success: false, reason: 'unsupported-environment' }),
      getPath: async () => ({
        localBackupPath: (await getSetting('local_backup_path')) || null,
        driveBackupPath: (await getSetting('gdrive_backup_method')) === 'desktop'
          ? (await getSetting('gdrive_backup_path')) || null : null
      }),
      makePdf: (note, check, options) => this.preparation.makePdf(note, check, options),
      canRenderPdf: () => this.pointerIds.size === 0 && getLocalSaveSnapshot().status === 'saved' && Date.now() - this.lastInput > 700,
      persist: data => saveSetting('backup_v2_checkpoint', data)
    });
    configureRecoveryBackups(() => this.controller.pauseForRecovery());
    this.controller.subscribe(() => this.notify({
      ...this.controller.getSnapshot(),
      lastSyncTime: this.controller.getSnapshot().lastSuccess,
      success: this.controller.getSnapshot().status === 'current'
    }));
  }
  async getBackupDevice(){
    if(!this.devicePromise)this.devicePromise=(async()=>{
      const saved=await getSetting('backup_device_v2');
      if(saved&&/^[a-z0-9-]{8,80}$/.test(saved.id))return saved;
      const info=await window.electronAPI?.getAppInfo?.().catch(()=>null);
      const device={id:crypto.randomUUID(),name:info?.deviceName||'PC'};
      await saveSetting('backup_device_v2',device);return device;
    })().catch(error=>{this.devicePromise=null;throw error;});
    return this.devicePromise;
  }
  async backupCommand(command){return window.electronAPI.saveBackup({...command,backupDevice:await this.getBackupDevice()});}
  async listRestoreSources(folder){
    if(!folder)return {success:false,reason:'backup-folder-choice-required'};
    const result=await window.electronAPI?.scanBackupFolder?.(folder,{listDevices:true});
    if(result?.success&&result.folders?.length)return result;
    // An explicitly selected device or old backup folder can still be read directly.
    const preview=await this.scanAvailableBackups(folder,{previewOnly:true});
    return preview?.success?{success:true,folders:[{folder:preview.folder,count:preview.count||0,legacy:true}]}:result||preview;
  }
  get isSyncing() { return this.controller.getSnapshot().syncing; }
  get lastSyncTime() { return this.controller.getSnapshot().lastSuccess; }
  getSnapshot = () => this.controller.getSnapshot();
  subscribeStatus = listener => this.controller.subscribe(listener);
  getDriveSyncSnapshot = () => this.driveSync.getSnapshot();
  subscribeDriveSync = listener => this.driveSync.subscribe(listener);
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
    // No background receive or restore from either destination.
  }
  stopScheduledSync() { this.stopSubscriptions?.(); this.stopSubscriptions = null; this.controller.stop(); this.driveSync.stop(); }
  async pruneDeletedNotebook(_name, notebookId = null) {
    if (!notebookId) return { success: false, reason: 'notebook-id-required' };
    this.controller.markDirty();return {success:true,queued:true};
  }
  async pruneDeletedNotebooks(_names, notebookIds = []) {
    if (!notebookIds.length) return { success: false, reason: 'notebook-id-required' };
    this.controller.markDirty();return {success:true,queued:true};
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
      return await window.electronAPI.scanBackupFolder(folder, { previewOnly: options.previewOnly === true, allowPrevious:options.allowPrevious === true,encodedRecovery:options.encodedRecovery === true });
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
      const restoreResult = await restoreBackup(async ({signal,report}) => {
        const recoveryId = crypto.randomUUID();
        const folder = await resolveBackupReadFolder(getSetting,customPath);
        const api = window.electronAPI;
        const unsubscribe = api?.onRecoveryProgress?.(progress => {
          if (progress.recoveryId === recoveryId) report(progress);
        });
        const cancel = () => { api?.cancelRecoveryRead?.(recoveryId)?.catch?.(()=>{}); };
        let scan;
        try {
          if (signal.aborted) throw Object.assign(new Error(),{code:'backup-recovery-cancelled'});
          // Dispatch first; cancellation then follows on the same IPC channel ordering.
          const pending = api?.scanBackupFolder?.(folder,{allowPrevious:true,encodedRecovery:true,snapshotRecovery:true,recoveryId});
          signal.addEventListener('abort',cancel,{once:true});
          if (signal.aborted) cancel();
          scan = await pending;
        } finally { unsubscribe?.();signal.removeEventListener('abort',cancel); }
        if (signal.aborted) throw Object.assign(new Error(),{code:'backup-recovery-cancelled'});
        if (!scan?.success || !scan.data && !(scan.encoded instanceof Uint8Array)) throw Object.assign(new Error(), { code: scan?.reason || 'backup-read-failed', diagnostics: scan?.diagnostics });
        if(scan.previousGeneration&&!window.confirm(t('backupRestorePreviousConfirm','',{date:new Date(scan.previousGeneration.savedAt).toLocaleString()})))throw Object.assign(new Error(),{code:'backup-recovery-cancelled'});
        const encoded=scan.encoded instanceof Uint8Array ? scan.encoded.byteOffset===0&&scan.encoded.byteLength===scan.encoded.buffer.byteLength?scan.encoded.buffer:scan.encoded.slice().buffer:undefined;
        return { data: scan.data, encoded,folder: scan.folder, source: scan.source, recoveredFolderNotebookIds: scan.recoveredFolderNotebookIds || [], ignoredRetiredNotebookIds: scan.ignoredRetiredNotebookIds || [] };
      });
      this.notify({
        syncing: false,
        success: true,
        message: t('backupReadRestored', '', { count: restoreResult.notebooksCount }),
        lastSyncTime: this.lastSyncTime
      });
      return { 
        success: true, 
        count: restoreResult.notebooksCount, 
        folder: restoreResult.folder,
        source: restoreResult.source, recoveredFolderNotebookIds: restoreResult.recoveredFolderNotebookIds || [], ignoredRetiredNotebookIds: restoreResult.ignoredRetiredNotebookIds || [], refreshFailed: !!restoreResult.refreshFailed
      };
    } catch (err) {
      const reason = err.code || 'backup-recovery-write-failed';
      if (err.diagnostics) console.warn('Backup recovery stopped', { reason, ...err.diagnostics });
      this.notify({ syncing: false, success: false, message: t(backupReadErrorKey(reason)) });
      return { success: false, reason };
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
