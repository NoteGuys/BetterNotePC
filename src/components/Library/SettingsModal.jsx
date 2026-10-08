import { backupReadErrorKey } from '../../services/backupReadStatus.js';
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Cloud, 
  HardDrive, 
  Upload, 
  Download, 
  FolderSync, 
  CheckCircle2, 
  FileText,
  Sun,
  Moon,
  Folder,
  FolderOpen,
  Save,
  Check,
  Trash2,
  Globe,
  HelpCircle,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import { PAPER_SIZES } from '../../data/templates';
import { getSetting, saveSetting } from '../../services/db';
import { useBackupSnapshot, backupStateKey } from '../Common/BackupStatusIndicator';
import { appCacheService } from '../../services/appCacheService';
import { useLanguage } from '../../services/i18n';
import { 
  CURRENT_APP_VERSION,
  getInstalledAppInfo,
  checkForStoreUpdate, 
  openMicrosoftStore,
  STORE_URL,
  STORE_WEB_URL
} from '../../services/updateService';


export const SettingsModal = ({
  isOpen,
  onClose,
  isDriveConnected = true,
  driveUserEmail = '',
  isSyncing = false,
  currentTheme = 'dark',
  onSelectTheme,
  onTriggerAutoSync,
  onExportBackup,
  onImportBackup,
  onOpenDriveModal,
  onOpenBackupStatus,
  onOpenUpdateModal
}) => {
  const { language, setLanguage, t } = useLanguage();
  const backupState = useBackupSnapshot();
  const [activeTab, setActiveTab] = useState('drive'); // 'drive', 'backup', 'defaults', 'theme', 'updates'
  const fileInputRef = useRef(null);
  const [backupPath, setBackupPath] = useState(
    (typeof window !== 'undefined' && window.localStorage?.getItem('local_backup_path')) || driveUserEmail || ''
  );
  const [docsPresetPath, setDocsPresetPath] = useState('');
  const [pathSavedToast, setPathSavedToast] = useState(false);
  const [isRestoringCloud, setIsRestoringCloud] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState(null);
  const [cacheClearedToast, setCacheClearedToast] = useState(false);
  const [showFolderHelp, setShowFolderHelp] = useState(false);
  const [showMigrationHelp, setShowMigrationHelp] = useState(false);
  const [appInfo,setAppInfo]=useState({version:CURRENT_APP_VERSION,distribution:'installer'});
  useEffect(()=>{let live=true;getInstalledAppInfo().then(info=>{if(live)setAppInfo(info);});return()=>{live=false;};},[]);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [checkingUpdateMsg, setCheckingUpdateMsg] = useState(null);

  const handleManualCheckUpdate = async () => {
    if (isCheckingUpdate) return;
    setIsCheckingUpdate(true);
    setCheckingUpdateMsg(t('updateChecking', 'กำลังตรวจสอบการอัปเดตจาก Microsoft Store...'));
    try {
      const res = await checkForStoreUpdate({ force: true });
      if (res?.status==='store-managed') {
        setCheckingUpdateMsg(await openMicrosoftStore() ? t('updateStoreOpened') : t('updateOpenFailed'));
      } else if (res?.hasUpdate) {
        setCheckingUpdateMsg(null);
        if (onOpenUpdateModal) {
          onOpenUpdateModal(res);
        }
      } else if (res?.status === 'current') {
        setCheckingUpdateMsg(t('updateIsLatest', `BetterNote ของคุณเป็นเวอร์ชันล่าสุดแล้ว (v${CURRENT_APP_VERSION})`, { version: res.currentVersion || appInfo.version }));
        setTimeout(() => setCheckingUpdateMsg(null), 4000);
      } else {
        setCheckingUpdateMsg(t(res?.reason==='feed-not-configured'?'updateFeedUnavailable':'updateConnectError'));
      }
    } catch (err) {
      setCheckingUpdateMsg(t('updateConnectError', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์อัปเดตได้'));
      setTimeout(() => setCheckingUpdateMsg(null), 3000);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleClearCache = () => {
    appCacheService.clearAll();
    setCacheClearedToast(true);
    setTimeout(() => setCacheClearedToast(false), 3500);
  };


  const handleRestoreFromFolder = async () => {
    if (isRestoringCloud) return;
    setIsRestoringCloud(true);
    setRestoreMessage(t('gdriveRestoringMsg', 'Scanning and restoring notebooks from Google Drive / Local folder...'));
    try {
      const { autoBackupService } = await import('../../services/autoBackupService');
      const res = await autoBackupService.restoreFromCloudBackup(backupPath);
      if (res.success) {
        if (res.ignoredRetiredNotebookIds?.length) alert(t('backupRecoveryRetiredEntries', '', { count: res.ignoredRetiredNotebookIds.length }));
        if (res.recoveredFolderNotebookIds?.length) alert(t('backupRecoveryMissingFolders', '', { count: res.recoveredFolderNotebookIds.length }));
        setRestoreMessage(t('gdriveRestoreSuccess', `✓ Success! Restored ${res.count} notebooks.`, { count: res.count }));
        setTimeout(() => {
          if (onClose) onClose();
          if (res.refreshFailed) alert(t('backupRecoveryRefreshFailed'));
        }, 1500);
      } else {
        setRestoreMessage(t(backupReadErrorKey(res.reason)));
        setTimeout(() => setRestoreMessage(null), 4000);
      }
    } catch (err) {
      setRestoreMessage(`${t('error', 'Error')}: ${err.message}`);
      setTimeout(() => setRestoreMessage(null), 4000);
    } finally {
      setIsRestoringCloud(false);
    }
  };

  useEffect(() => {
    if (isOpen) { setShowFolderHelp(false); setShowMigrationHelp(false); }
  }, [isOpen]);

  const handleSaveBackupPath = async (newPath) => {
    const target = (newPath || backupPath || '').trim();
    if (!target) return;
    try {
      await saveSetting('local_backup_path', target);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('local_backup_path', target);
      }
      setBackupPath(target);
      setPathSavedToast(true);
      setTimeout(() => setPathSavedToast(false), 3000);
      if (onTriggerAutoSync) {
        onTriggerAutoSync();
      }
    } catch (err) {
      console.error(err);
      alert(t('saveFolderFailed', 'บันทึกโฟลเดอร์ไม่สำเร็จ: ') + err.message);
    }
  };

  const handleBrowseFolder = async () => {
    // 1. Electron Native Folder Dialog
    if (typeof window !== 'undefined' && window.electronAPI?.selectFolder) {
      try {
        const chosen = await window.electronAPI.selectFolder();
        if (chosen) {
          handleSaveBackupPath(chosen);
        }
      } catch (err) {
        console.error(err);
      }
      return;
    }

    // 2. Prompt fallback
    const chosen = prompt(t('setLocalBackupFolderPrompt', 'กำหนดตำแหน่งโฟลเดอร์ในเครื่องที่ต้องการสำรองข้อมูล (เช่น H:\\My Drive\\BetterNote.AppPC หรือ C:\\Users\\...):'), backupPath);
    if (chosen && chosen.trim()) {
      handleSaveBackupPath(chosen.trim());
    }
  };

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onImportBackup) {
      onImportBackup(file);
      onClose();
    }
  };

  return (
    <div className="bn-modal-backdrop" onClick={onClose}>
      <div 
        className="bn-modal-card bn-modal-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bn-settings-header">
          <div className="bn-settings-header-left">
            <div className="bn-settings-icon-badge">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="bn-settings-title">{t('settingsTitle', 'การตั้งค่า (Settings)')}</h3>
              <p className="bn-settings-sub">{t('settingsTooltip', 'จัดการการสำรองข้อมูล คลาวด์ และค่าเริ่มต้นระบบ')}</p>
            </div>
          </div>
          <button 
            className="bn-modal-close-btn"
            onClick={onClose}
            title={t('close', 'ปิดหน้าต่าง')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Header Bar */}
        <div className="bn-settings-tabs-bar">
          <button
            type="button"
            className={`bn-settings-tab-item ${activeTab === 'drive' ? 'bn-settings-tab-item-active' : ''}`}
            onClick={() => setActiveTab('drive')}
          >
            <Cloud size={16} className={activeTab === 'drive' ? 'text-emerald-400' : 'text-zinc-400'} />
            <span>{t('backupHubTitle')}</span>
          </button>

          <button
            type="button"
            className={`bn-settings-tab-item ${activeTab === 'backup' ? 'bn-settings-tab-item-active' : ''}`}
            onClick={() => setActiveTab('backup')}
          >
            <HardDrive size={16} className={activeTab === 'backup' ? 'text-blue-400' : 'text-zinc-400'} />
            <span>{t('backupTab', 'สำรอง & กู้คืน')}</span>
          </button>

          <button
            type="button"
            className={`bn-settings-tab-item ${activeTab === 'defaults' ? 'bn-settings-tab-item-active' : ''}`}
            onClick={() => setActiveTab('defaults')}
          >
            <FileText size={16} className={activeTab === 'defaults' ? 'text-amber-400' : 'text-zinc-400'} />
            <span>{t('defaultsTab', 'ค่าเริ่มต้นกระดาษ')}</span>
          </button>

          <button
            type="button"
            className={`bn-settings-tab-item ${activeTab === 'theme' ? 'bn-settings-tab-item-active' : ''}`}
            onClick={() => setActiveTab('theme')}
          >
            {currentTheme === 'light' ? (
              <Sun size={16} className={activeTab === 'theme' ? 'text-amber-400' : 'text-zinc-400'} />
            ) : (
              <Moon size={16} className={activeTab === 'theme' ? 'text-blue-400' : 'text-zinc-400'} />
            )}
            <span>{t('themeTab', 'ธีม และ ภาษา')}</span>
          </button>

          <button
            type="button"
            className={`bn-settings-tab-item ${activeTab === 'updates' ? 'bn-settings-tab-item-active' : ''}`}
            onClick={() => setActiveTab('updates')}
          >
            <Sparkles size={16} className={activeTab === 'updates' ? 'text-purple-400' : 'text-zinc-400'} />
            <span>{t('updateTab', 'อัปเดต & เวอร์ชัน')}</span>
          </button>
        </div>

        {/* Body */}
        <div className="bn-settings-body">
          {/* One entry opens the shared Backup & Sync window. */}
          {activeTab === 'drive' && (
            <div className="bn-settings-card">
              <div className="bn-settings-card-header">
                <div className="bn-settings-icon-circle" style={{ background: 'rgba(59,130,246,.12)', color: '#60a5fa' }}><ShieldCheck size={24} /></div>
                <div className="bn-settings-card-text">
                  <h4 className="bn-settings-card-h4">{t('backupHubTitle')}</h4>
                  <p className="bn-settings-card-hint">{t('backupHubSubtitle')}</p>
                  <strong className="bn-backup-settings-state" data-backup-state={backupState.status}>{t(backupStateKey(backupState))}</strong>
                </div>
              </div>
              <div className="bn-settings-btn-row">
                <button type="button" className="bn-settings-btn-sync" onClick={() => {
                  onClose(); (onOpenBackupStatus || onOpenDriveModal)?.();
                }} disabled={!onOpenBackupStatus && !onOpenDriveModal}>
                  <FolderSync size={16} /><span>{t('backupHubTitle')}</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: สำรอง & กู้คืน */}
          {activeTab === 'backup' && (
            <>
              <div className="bn-settings-card">
                <div className="bn-settings-card-header">
                  <div 
                    className="bn-settings-icon-circle"
                    style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}
                  >
                    <Download size={22} />
                  </div>
                  <div className="bn-settings-card-text">
                    <h4 className="bn-settings-card-h4">{t('exportJsonBackupTitle', 'ส่งออกไฟล์สำรองฉุกเฉิน (.json)')}</h4>
                    <p className="bn-settings-card-hint">
                      {t('exportJsonBackupDesc', 'ดาวน์โหลดข้อมูลสมุด โฟลเดอร์ และลายเส้นทั้งหมดเป็นไฟล์ .json เก็บไว้ในคอมพิวเตอร์ของคุณ')}
                    </p>
                    <div style={{ marginTop: '12px' }}>
                      <button
                        type="button"
                        className="bn-settings-btn-alt"
                        onClick={() => {
                          if (onExportBackup) onExportBackup();
                        }}
                      >
                        <Download size={14} />
                        <span>{t('downloadBackupBtn', 'ดาวน์โหลดไฟล์สำรอง')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bn-settings-card">
                <div className="bn-settings-card-header">
                  <div 
                    className="bn-settings-icon-circle"
                    style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}
                  >
                    <Upload size={22} />
                  </div>
                  <div className="bn-settings-card-text">
                    <h4 className="bn-settings-card-h4">{t('restoreBackupFileTitle', 'กู้คืนข้อมูลจากไฟล์สำรอง (.json หรือ .bnote)')}</h4>
                    <p className="bn-settings-card-hint">
                      {t('restoreBackupFileDesc', 'นำเข้าไฟล์สำรองที่เคยบันทึกไว้ เพื่อกู้คืนสมุดบันทึกทั้งหมดกลับมา')}
                    </p>
                    <div style={{ marginTop: '12px' }}>
                      <button
                        type="button"
                        className="bn-settings-btn-alt"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload size={14} />
                        <span>{t('chooseFileToRestore', 'เลือกไฟล์เพื่อกู้คืน')}</span>
                      </button>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      accept=".json,.bnote" 
                      style={{ display: 'none' }} 
                      onChange={handleFileChange} 
                    />
                  </div>
                </div>
              </div>

              <div className="bn-settings-card">
                <div className="bn-settings-card-header">
                  <div 
                    className="bn-settings-icon-circle"
                    style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}
                  >
                    <Trash2 size={22} />
                  </div>
                  <div className="bn-settings-card-text">
                    <h4 className="bn-settings-card-h4">{t('clearCacheRAMTitle', 'ล้างแคชและคืนหน่วยความจำ (Clear App Cache & RAM)')}</h4>
                    <p className="bn-settings-card-hint">
                      {t('clearCacheRAMDesc', 'ล้างแคชภาพเรนเดอร์และพรีวิวชั่วคราว (ไม่ลบสมุดบันทึกของคุณ) ช่วยให้โปรแกรมทำงานลื่นขึ้นและประหยัด RAM')}
                    </p>
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        type="button"
                        className="bn-settings-btn-alt"
                        style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#fca5a5' }}
                        onClick={handleClearCache}
                      >
                        <Trash2 size={14} />
                        <span>{t('clearAllCacheBtn', 'ล้างแคชทั้งหมด')}</span>
                      </button>
                      {cacheClearedToast && (
                        <span style={{ fontSize: '11.5px', color: '#34d399', fontWeight: 600 }}>
                          {t('cacheClearedRAM', '✓ ล้างแคชเรียบร้อยแล้ว (คืนพื้นที่ RAM 🚀)')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Tab 3: ค่าเริ่มต้นกระดาษ */}
          {activeTab === 'defaults' && (
            <>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#e4e4e7', display: 'block', marginBottom: '8px' }}>
                  {t('paperSizes', 'ขนาดหน้ากระดาษมาตรฐาน')}
                </label>
                <div className="bn-new-paper-grid">
                  {PAPER_SIZES.map(s => (
                    <div key={s.id} className="bn-new-paper-card">
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', display: 'block' }}>{s.name}</span>
                      <span style={{ fontSize: '10px', color: '#a1a1aa' }}>
                        {t('paper_size_' + s.id, s.fullName)}
                      </span>
                      <span style={{ fontSize: '9px', color: '#71717a', display: 'block', marginTop: '2px' }}>{s.width} × {s.height} px</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#e4e4e7', display: 'block', marginBottom: '8px' }}>
                  {t('recommendedPatterns', 'รูปแบบลายเส้นที่แนะนำ')}
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="bn-new-paper-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', color: '#f4f4f5', fontWeight: 500 }}>
                      • {t('template_dotted', 'Dotted (25px)')}
                    </span>
                    <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Bullet Journal & Planner</span>
                  </div>
                  <div className="bn-new-paper-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', color: '#f4f4f5', fontWeight: 500 }}>
                      • {t('template_narrow_ruled', 'Narrow Ruled (22px)')}
                    </span>
                    <span style={{ fontSize: '11px', color: '#a1a1aa' }}>
                      {t('template_desc_narrow_ruled', 'Detailed handwriting')}
                    </span>
                  </div>
                  <div className="bn-new-paper-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', color: '#f4f4f5', fontWeight: 500 }}>
                      • {t('template_wide_ruled', 'Wide Ruled (38px)')}
                    </span>
                    <span style={{ fontSize: '11px', color: '#a1a1aa' }}>
                      {t('template_desc_wide_ruled', 'Large text & summaries')}
                    </span>
                  </div>
                  <div className="bn-new-paper-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', color: '#f4f4f5', fontWeight: 500 }}>
                      • {t('template_grid', 'Grid (25px)')}
                    </span>
                    <span style={{ fontSize: '11px', color: '#a1a1aa' }}>
                      {t('template_desc_grid', 'Math & graphs')}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Tab 4: ธีมหน้าจอ (Theme) */}
          {activeTab === 'theme' && (
            <>
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, display: 'block', marginBottom: '10px' }}>
                  {t('themeChoice', 'เลือกรูปแบบธีมที่ต้องการใช้งาน (Theme Settings)')}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {/* Dark Mode Card */}
                  <div
                    className={`bn-new-paper-card ${currentTheme === 'dark' ? 'bn-new-paper-card-active' : ''}`}
                    style={{ padding: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}
                    onClick={() => onSelectTheme && onSelectTheme('dark')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Moon size={18} className="text-blue-400" />
                        <span style={{ fontWeight: 700, fontSize: '13px' }}>{t('themeDark', 'โหมดมืด (Dark)')}</span>
                      </div>
                      {currentTheme === 'dark' && <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 700 }}>{t('inUse', '✓ ใช้งานอยู่')}</span>}
                    </div>
                    {/* Simulated Mini Screen */}
                    <div style={{ width: '100%', height: '56px', background: '#161618', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', overflow: 'hidden' }}>
                      <div style={{ width: '25%', background: '#1c1c1f', borderRight: '1px solid rgba(255,255,255,0.06)' }}></div>
                      <div style={{ flex: 1, padding: '6px' }}>
                        <div style={{ width: '60%', height: '6px', background: '#3b82f6', borderRadius: '3px', marginBottom: '6px' }}></div>
                        <div style={{ width: '80%', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px' }}></div>
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#a1a1aa' }}>
                      {t('themeDarkDesc', 'ถนอมสายตาสำหรับใช้งานในที่มืด หรือประหยัดแบตเตอรี่')}
                    </span>
                  </div>

                  {/* Light Mode Card */}
                  <div
                    className={`bn-new-paper-card ${currentTheme === 'light' ? 'bn-new-paper-card-active' : ''}`}
                    style={{ padding: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}
                    onClick={() => onSelectTheme && onSelectTheme('light')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sun size={18} className="text-amber-500" />
                        <span style={{ fontWeight: 700, fontSize: '13px' }}>{t('themeLight', 'โหมดสว่าง (Light)')}</span>
                      </div>
                      {currentTheme === 'light' && <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700 }}>{t('inUse', '✓ ใช้งานอยู่')}</span>}
                    </div>
                    {/* Simulated Mini Screen */}
                    <div style={{ width: '100%', height: '56px', background: '#f8fafc', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.1)', display: 'flex', overflow: 'hidden' }}>
                      <div style={{ width: '25%', background: '#ffffff', borderRight: '1px solid rgba(0,0,0,0.08)' }}></div>
                      <div style={{ flex: 1, padding: '6px' }}>
                        <div style={{ width: '60%', height: '6px', background: '#2563eb', borderRadius: '3px', marginBottom: '6px' }}></div>
                        <div style={{ width: '80%', height: '4px', background: 'rgba(0,0,0,0.15)', borderRadius: '2px' }}></div>
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#a1a1aa' }}>
                      {t('themeLightDesc', 'สบายตา คมชัด เหมาะสำหรับการพิมพ์หรืออ่านกลางวัน')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Language Switcher beside Theme */}
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600, display: 'block', marginBottom: '10px' }}>
                  {t('languageChoice')}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {/* English Card */}
                  <div
                    className={`bn-new-paper-card ${language === 'en' ? 'bn-new-paper-card-active' : ''}`}
                    style={{ padding: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px' }}
                    onClick={() => setLanguage('en')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>🇬🇧</span>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}>{t('langEnglish')}</span>
                      </div>
                      {language === 'en' && <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>{t('inUse')}</span>}
                    </div>
                    <span style={{ fontSize: '11px', color: '#a1a1aa' }}>
                      {t('langEnglishDesc')}
                    </span>
                  </div>

                  {/* Thai Card */}
                  <div
                    className={`bn-new-paper-card ${language === 'th' ? 'bn-new-paper-card-active' : ''}`}
                    style={{ padding: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px' }}
                    onClick={() => setLanguage('th')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>🇹🇭</span>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}>{t('langThai')}</span>
                      </div>
                      {language === 'th' && <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>{t('inUse')}</span>}
                    </div>
                    <span style={{ fontSize: '11px', color: '#a1a1aa' }}>
                      {t('langThaiDesc')}
                    </span>
                  </div>

                  {/* Simplified Chinese Card */}
                  <div
                    className={`bn-new-paper-card ${language === 'zh' ? 'bn-new-paper-card-active' : ''}`}
                    style={{ padding: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px' }}
                    onClick={() => setLanguage('zh')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>🇨🇳</span>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}>{t('langChinese')}</span>
                      </div>
                      {language === 'zh' && <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>{t('inUse')}</span>}
                    </div>
                    <span style={{ fontSize: '11px', color: '#a1a1aa' }}>
                      {t('langChineseDesc')}
                    </span>
                  </div>

                  {/* Russian Card */}
                  <div
                    className={`bn-new-paper-card ${language === 'ru' ? 'bn-new-paper-card-active' : ''}`}
                    style={{ padding: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px' }}
                    onClick={() => setLanguage('ru')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>🇷🇺</span>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}>{t('langRussian')}</span>
                      </div>
                      {language === 'ru' && <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>{t('inUse')}</span>}
                    </div>
                    <span style={{ fontSize: '11px', color: '#a1a1aa' }}>
                      {t('langRussianDesc')}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Tab 5: Updates & Version Info */}
          {activeTab === 'updates' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* App Version Info Card */}
              <div className="bn-settings-card">
                <div className="bn-settings-card-header">
                  <div 
                    className="bn-settings-icon-circle"
                    style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}
                  >
                    <Sparkles size={24} />
                  </div>
                  <div className="bn-settings-card-text">
                    <div className="bn-settings-card-title-row">
                      <h4 className="bn-settings-card-title">
                        BetterNote Pro Studio
                      </h4>
                      <span className="bn-settings-badge-connected" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', borderColor: 'rgba(168, 85, 247, 0.4)' }}>
                        {t(appInfo.distribution==='store'?'updateStoreEdition':'updateInstallerEdition')}
                      </span>
                    </div>
                    <p className="bn-settings-card-desc">
                      {t('updateSectionTitle', 'เวอร์ชันและการอัปเดต')} • Version {appInfo.version}
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cbd5e1' }}>
                    <CheckCircle2 size={16} style={{ color: '#34d399' }} />
                    <span>{t(appInfo.distribution==='store'?'updateStoreNotice':'updateDailyCheckNotice')}</span>
                  </div>

                  {checkingUpdateMsg && (
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      color: '#93c5fd',
                      fontSize: '12.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>{checkingUpdateMsg}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={handleManualCheckUpdate}
                      disabled={isCheckingUpdate}
                      className="bn-settings-btn-alt"
                      style={{
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        borderColor: '#3b82f6',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: isCheckingUpdate ? 'wait' : 'pointer'
                      }}
                    >
                      <RefreshCw size={14} className={isCheckingUpdate ? 'animate-spin' : ''} />
                      <span>{isCheckingUpdate ? t('updateChecking', 'กำลังตรวจสอบ...') : t(appInfo.distribution==='store'?'updateStoreCheck':'updateCheckNow')}</span>
                    </button>


                    <button
                      type="button"
                      onClick={async () => { if (!await openMicrosoftStore()) setCheckingUpdateMsg(t('updateOpenFailed')); }}
                      className="bn-settings-btn-alt"
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        borderColor: 'rgba(255, 255, 255, 0.12)',
                        color: '#cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <ExternalLink size={14} />
                      <span>{t('updateOnMicrosoftStore', 'Update on Microsoft Store')}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* What's New in Current Version */}
              <div className="bn-settings-card">
                <h5 style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', margin: '0 0 10px 0' }}>
                  {t('updateFeaturesTitle', 'What\'s New & Improvements')}
                </h5>
                <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px', color: '#cbd5e1', lineHeight: '1.5' }}>
                  <li>{t('updateChangelog1')}</li>
                  <li>{t('updateChangelog2')}</li>
                  <li>{t('updateChangelog3')}</li>
                  <li>{t('updateChangelog4')}</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bn-settings-footer">
          <button
            type="button"
            className="bn-settings-btn-alt"
            style={{ background: '#2563eb', borderColor: '#3b82f6', color: '#ffffff', padding: '8px 22px' }}
            onClick={onClose}
          >
            {t('done', 'เรียบร้อย')}
          </button>
        </div>

        {/* New PC Migration Help Dialog Modal */}
        {showMigrationHelp && (
          <div 
            className="bn-modal-backdrop" 
            style={{ zIndex: 1100, background: 'rgba(0,0,0,0.75)' }}
            onClick={(e) => { e.stopPropagation(); setShowMigrationHelp(false); }}
          >
            <div 
              style={{
                width: '100%',
                maxWidth: '560px',
                background: '#0f172a',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                padding: '22px',
                color: '#f8fafc'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                    <FolderSync size={18} />
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#93c5fd', margin: 0 }}>
                    {t('migrationHelpTitle', 'ขั้นตอนการกู้คืนข้อมูลเมื่อย้ายเครื่องใหม่ (New PC Migration Guide)')}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMigrationHelp(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Step 1 */}
                <div style={{ padding: '12px', background: 'rgba(30, 41, 59, 0.7)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', marginBottom: '3px' }}>
                    {t('migrationHelpStep1Title', '1. เครื่องเดิม (Old PC)')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5' }}>
                    {t('migrationHelpStep1Desc', 'ตรวจสอบให้แน่ใจว่าได้เลือกโฟลเดอร์สำรองข้อมูลไว้ใน Google Drive for Desktop หรือก๊อปปี้โฟลเดอร์ BetterNote.AppPC ลงแฟลชไดรฟ์ (USB)')}
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{ padding: '12px', background: 'rgba(30, 41, 59, 0.7)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#34d399', marginBottom: '3px' }}>
                    {t('migrationHelpStep2Title', '2. เครื่องใหม่ (New PC)')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5' }}>
                    {t('migrationHelpStep2Desc', 'ติดตั้ง BetterNote จาก Microsoft Store เปิดหน้าการตั้งค่า (Settings) แล้วกดปุ่ม "เลือกโฟลเดอร์..." เพื่อระบุโฟลเดอร์ Google Drive หรือโฟลเดอร์สำรองข้อมูลนั้น')}
                  </div>
                </div>

                {/* Step 3 */}
                <div style={{ padding: '12px', background: 'rgba(30, 41, 59, 0.7)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#c084fc', marginBottom: '3px' }}>
                    {t('migrationHelpStep3Title', '3. กดกู้คืน (Restore)')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5' }}>
                    {t('migrationHelpStep3Desc', 'กดปุ่ม "ดึงและกู้คืนสมุดโน้ตทั้งหมด" ระบบจะสแกนและนำเข้าสมุดบันทึก หน้ากระดาษ ลายเส้น และรูปภาพทั้งหมดกลับคืนสู่เครื่องใหม่ให้ทันที!')}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowMigrationHelp(false)}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {t('migrationHelpGotIt', 'เข้าใจแล้ว')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Target Folder Help Dialog Modal */}
        {showFolderHelp && (
          <div 
            className="bn-modal-backdrop" 
            style={{ zIndex: 1100, background: 'rgba(0,0,0,0.75)' }}
            onClick={(e) => { e.stopPropagation(); setShowFolderHelp(false); }}
          >
            <div 
              style={{
                width: '100%',
                maxWidth: '480px',
                background: '#0f172a',
                border: '1px solid rgba(251, 191, 36, 0.4)',
                borderRadius: '14px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                padding: '20px',
                color: '#f8fafc'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FolderOpen size={18} style={{ color: '#fbbf24' }} />
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#fef08a', margin: 0 }}>
                    {t('backupTargetFolderHelpTitle', 'โฟลเดอร์สำรองข้อมูล (Target Backup Folder)')}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFolderHelp(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={18} />
                </button>
              </div>

              <p style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.6', margin: 0 }}>
                {t('backupTargetFolderHelpDesc', 'โฟลเดอร์บนเครื่องคอมพิวเตอร์ที่ BetterNote จะส่งออกสำเนาสมุดบันทึก (.bnote) และเอกสาร PDF ทุกครั้งที่มีการเขียนหรือปิดแอปพลิเคชัน หากโฟลเดอร์นี้อยู่ใน Google Drive หรือ OneDrive ไฟล์ทั้งหมดจะถูกซิงค์ขึ้นระบบคลาวด์ให้อัตโนมัติ')}
              </p>

              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowFolderHelp(false)}
                  style={{
                    padding: '7px 18px',
                    borderRadius: '8px',
                    background: '#d97706',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {t('migrationHelpGotIt', 'เข้าใจแล้ว')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
