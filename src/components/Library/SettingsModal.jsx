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
  Trash2
} from 'lucide-react';
import { PAPER_SIZES } from '../../data/templates';
import { getSetting, saveSetting } from '../../services/db';
import { appCacheService } from '../../services/appCacheService';


export const SettingsModal = ({
  isOpen,
  onClose,
  isDriveConnected = true,
  driveUserEmail = 'H:\\My Drive\\BetterNote.AppPC',
  isSyncing = false,
  currentTheme = 'dark',
  onSelectTheme,
  onTriggerAutoSync,
  onExportBackup,
  onImportBackup,
  onOpenDriveModal
}) => {
  const [activeTab, setActiveTab] = useState('drive'); // 'drive', 'backup', 'defaults', 'theme'
  const fileInputRef = useRef(null);
  const [backupPath, setBackupPath] = useState(driveUserEmail || 'H:\\My Drive\\BetterNote.AppPC');
  const [pathSavedToast, setPathSavedToast] = useState(false);
  const [isRestoringCloud, setIsRestoringCloud] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState(null);
  const [cacheClearedToast, setCacheClearedToast] = useState(false);

  const handleClearCache = () => {
    appCacheService.clearAll();
    setCacheClearedToast(true);
    setTimeout(() => setCacheClearedToast(false), 3500);
  };


  const handleRestoreFromFolder = async () => {
    if (isRestoringCloud) return;
    setIsRestoringCloud(true);
    setRestoreMessage('กำลังค้นหาและดึงข้อมูลจากโฟลเดอร์ Google Drive / Local...');
    try {
      const { autoBackupService } = await import('../../services/autoBackupService');
      const res = await autoBackupService.restoreFromCloudBackup(backupPath);
      if (res.success) {
        setRestoreMessage(`✓ สำเร็จ! กู้คืนสมุดโน้ต ${res.count} เล่มเรียบร้อยแล้ว`);
        setTimeout(() => {
          if (onClose) onClose();
          window.location.reload();
        }, 1500);
      } else {
        setRestoreMessage('ไม่พบไฟล์สำรองในโฟลเดอร์นี้ กรุณาตรวจสอบตำแหน่งโฟลเดอร์');
        setTimeout(() => setRestoreMessage(null), 4000);
      }
    } catch (err) {
      setRestoreMessage(`เกิดข้อผิดพลาด: ${err.message}`);
      setTimeout(() => setRestoreMessage(null), 4000);
    } finally {
      setIsRestoringCloud(false);
    }
  };

  useEffect(() => {
    async function loadBackupPath() {
      try {
        const val = await getSetting('local_backup_path');
        if (val) {
          setBackupPath(val);
        } else if (typeof window !== 'undefined' && window.localStorage?.getItem('local_backup_path')) {
          setBackupPath(window.localStorage.getItem('local_backup_path'));
        }
      } catch (err) {
        console.warn(err);
      }
    }
    if (isOpen) {
      loadBackupPath();
    }
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
      alert('บันทึกโฟลเดอร์ไม่สำเร็จ: ' + err.message);
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
    const chosen = prompt('กำหนดตำแหน่งโฟลเดอร์ในเครื่องที่ต้องการสำรองข้อมูล (เช่น H:\\My Drive\\BetterNote.AppPC หรือ C:\\Users\\...):', backupPath);
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
              <h3 className="bn-settings-title">การตั้งค่า (Settings)</h3>
              <p className="bn-settings-sub">จัดการการสำรองข้อมูล คลาวด์ และค่าเริ่มต้นระบบ</p>
            </div>
          </div>
          <button 
            className="bn-modal-close-btn"
            onClick={onClose}
            title="ปิดหน้าต่าง"
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
            <span>Google Drive</span>
          </button>

          <button
            type="button"
            className={`bn-settings-tab-item ${activeTab === 'backup' ? 'bn-settings-tab-item-active' : ''}`}
            onClick={() => setActiveTab('backup')}
          >
            <HardDrive size={16} className={activeTab === 'backup' ? 'text-blue-400' : 'text-zinc-400'} />
            <span>สำรอง & กู้คืน</span>
          </button>

          <button
            type="button"
            className={`bn-settings-tab-item ${activeTab === 'defaults' ? 'bn-settings-tab-item-active' : ''}`}
            onClick={() => setActiveTab('defaults')}
          >
            <FileText size={16} className={activeTab === 'defaults' ? 'text-amber-400' : 'text-zinc-400'} />
            <span>ค่าเริ่มต้นกระดาษ</span>
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
            <span>ธีมหน้าจอ (Theme)</span>
          </button>
        </div>

        {/* Body */}
        <div className="bn-settings-body">
          {/* Tab 1: Google Drive & Local Storage */}
          {activeTab === 'drive' && (
            <>
              {/* Cloud / Sync Status Card */}
              <div className="bn-settings-card">
                <div className="bn-settings-card-header">
                  <div 
                    className="bn-settings-icon-circle"
                    style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}
                  >
                    <CheckCircle2 size={24} />
                  </div>
                  <div className="bn-settings-card-text">
                    <div className="bn-settings-card-title-row">
                      <h4 className="bn-settings-card-h4">สถานะระบบสำรองข้อมูลอัตโนมัติ</h4>
                      <span className="bn-settings-status-tag">ACTIVE</span>
                    </div>
                    <p className="bn-settings-path-label">
                      ตำแหน่งโฟลเดอร์ปัจจุบัน: {backupPath}
                    </p>
                    <p className="bn-settings-card-hint">
                      ระบบจะสำรองข้อมูลอัตโนมัติทุกๆ 1 ชั่วโมง และสำรองก่อนปิดแอปพลิเคชัน (ทั้ง PDF และ .bnote)
                    </p>
                  </div>
                </div>

                <div className="bn-settings-btn-row">
                  <button
                    type="button"
                    className="bn-settings-btn-sync"
                    onClick={onTriggerAutoSync}
                    disabled={isSyncing}
                  >
                    <FolderSync size={16} className={isSyncing ? 'animate-spin' : ''} />
                    <span>{isSyncing ? 'กำลังซิงค์ข้อมูล...' : 'ซิงค์และสำรองข้อมูลทันที'}</span>
                  </button>

                  {onOpenDriveModal && (
                    <button
                      type="button"
                      className="bn-settings-btn-alt"
                      onClick={() => {
                        onClose();
                        onOpenDriveModal();
                      }}
                    >
                      OAuth / Cloud API
                    </button>
                  )}
                </div>
              </div>

              {/* Local & Drive Backup Directory Configuration Card */}
              <div className="bn-settings-card">
                <div className="bn-settings-card-header">
                  <div 
                    className="bn-settings-icon-circle"
                    style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}
                  >
                    <FolderOpen size={22} />
                  </div>
                  <div className="bn-settings-card-text">
                    <div className="bn-settings-card-title-row">
                      <h4 className="bn-settings-card-h4">ตำแหน่งโฟลเดอร์สำรองข้อมูลภายในเครื่อง</h4>
                      {pathSavedToast && (
                        <span className="bn-settings-status-tag" style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#34d399' }}>
                          ✓ บันทึกสำเร็จ
                        </span>
                      )}
                    </div>
                    <p className="bn-settings-card-hint">
                      เลือกโฟลเดอร์ในเครื่องที่คุณต้องการให้ไฟล์ที่เขียน อัปโหลด หรือแก้ไข ถูกสำรองไว้ที่นี่ (PDF, .bnote และระบบเต็ม)
                    </p>
                  </div>
                </div>

                {/* Path input with Browse & Save */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                    <Folder size={15} style={{ position: 'absolute', left: '12px', color: '#94a3b8', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      className="bn-folder-path-input"
                      value={backupPath}
                      onChange={(e) => setBackupPath(e.target.value)}
                      placeholder="เช่น H:\My Drive\BetterNote.AppPC หรือ C:\Users\..."
                      style={{
                        width: '100%',
                        padding: '9px 12px 9px 36px',
                        background: 'rgba(15, 15, 20, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: '12px',
                        fontFamily: 'Consolas, monospace',
                        outline: 'none',
                        transition: 'border-color 0.15s ease'
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="bn-settings-btn-alt"
                    onClick={handleBrowseFolder}
                    title="เปิดหน้าต่างเลือกโฟลเดอร์ในเครื่อง"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    <FolderOpen size={15} />
                    <span>เลือกโฟลเดอร์...</span>
                  </button>
                  <button
                    type="button"
                    className="bn-settings-btn-sync"
                    onClick={() => handleSaveBackupPath(backupPath)}
                    style={{ padding: '0 16px', flex: 'none', whiteSpace: 'nowrap' }}
                  >
                    <Save size={15} />
                    <span>บันทึกตำแหน่ง</span>
                  </button>
                </div>

                {/* Preset shortcuts */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                    ตำแหน่งโฟลเดอร์แนะนำ (คลิกเพื่อเลือกทันที):
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <button
                      type="button"
                      className="bn-preset-chip"
                      onClick={() => handleSaveBackupPath('H:\\My Drive\\BetterNote.AppPC')}
                      title="Google Drive Desktop App Directory"
                    >
                      ☁️ H:\My Drive\BetterNote.AppPC (Google Drive)
                    </button>
                    <button
                      type="button"
                      className="bn-preset-chip"
                      onClick={() => handleSaveBackupPath('C:\\Users\\ADMIN\\Documents\\BetterNote.AppPC')}
                      title="Documents Folder"
                    >
                      📁 Documents\BetterNote.AppPC
                    </button>
                    <button
                      type="button"
                      className="bn-preset-chip"
                      onClick={() => handleSaveBackupPath('C:\\Users\\ADMIN\\Desktop\\BetterNote_Storage')}
                      title="Desktop Folder"
                    >
                      💻 Desktop\BetterNote_Storage
                    </button>
                  </div>
                </div>

                {/* Cloud Restore / Migration Card */}
                <div style={{ marginTop: '16px', padding: '14px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FolderSync size={16} />
                        <span>กู้คืนข้อมูลเมื่อย้ายเครื่องใหม่ (New PC Migration)</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '3px' }}>
                        เมื่อติดตั้ง BetterNote บนเครื่องใหม่ หรือเชื่อม Google Drive เข้ามา สามารถกดปุ่มนี้เพื่อดึงสมุดโน้ตทั้งหมดกลับเข้าแอปทันที
                      </div>
                    </div>
                    <button
                      type="button"
                      className="bn-settings-btn-sync"
                      onClick={handleRestoreFromFolder}
                      disabled={isRestoringCloud}
                      style={{ background: '#2563eb', padding: '8px 18px', fontSize: '12px', whiteSpace: 'nowrap', fontWeight: 600 }}
                    >
                      <FolderSync size={15} className={isRestoringCloud ? 'animate-spin' : ''} />
                      <span>{isRestoringCloud ? 'กำลังดึงข้อมูล...' : 'ดึงและกู้คืนสมุดโน้ตทั้งหมด'}</span>
                    </button>
                  </div>
                  {restoreMessage && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: restoreMessage.startsWith('✓') ? '#34d399' : '#f87171', fontWeight: 600 }}>
                      {restoreMessage}
                    </div>
                  )}
                </div>
              </div>
            </>
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
                    <h4 className="bn-settings-card-h4">ส่งออกไฟล์สำรองฉุกเฉิน (.json)</h4>
                    <p className="bn-settings-card-hint">
                      ดาวน์โหลดข้อมูลสมุด โฟลเดอร์ และลายเส้นทั้งหมดเป็นไฟล์ .json เก็บไว้ในคอมพิวเตอร์ของคุณ
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
                        <span>ดาวน์โหลดไฟล์สำรอง</span>
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
                    <h4 className="bn-settings-card-h4">กู้คืนข้อมูลจากไฟล์สำรอง (.json หรือ .bnote)</h4>
                    <p className="bn-settings-card-hint">
                      นำเข้าไฟล์สำรองที่เคยบันทึกไว้ เพื่อกู้คืนสมุดบันทึกทั้งหมดกลับมา
                    </p>
                    <div style={{ marginTop: '12px' }}>
                      <button
                        type="button"
                        className="bn-settings-btn-alt"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload size={14} />
                        <span>เลือกไฟล์เพื่อกู้คืน</span>
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
                    <h4 className="bn-settings-card-h4">ล้างแคชและคืนหน่วยความจำ (Clear App Cache & RAM)</h4>
                    <p className="bn-settings-card-hint">
                      ล้างแคชภาพเรนเดอร์และพรีวิวชั่วคราว (ไม่ลบสมุดบันทึกของคุณ) ช่วยให้โปรแกรมทำงานลื่นขึ้นและประหยัด RAM
                    </p>
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        type="button"
                        className="bn-settings-btn-alt"
                        style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#fca5a5' }}
                        onClick={handleClearCache}
                      >
                        <Trash2 size={14} />
                        <span>ล้างแคชทั้งหมด</span>
                      </button>
                      {cacheClearedToast && (
                        <span style={{ fontSize: '11.5px', color: '#34d399', fontWeight: 600 }}>
                          ✓ ล้างแคชเรียบร้อยแล้ว (คืนพื้นที่ RAM 🚀)
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
                  ขนาดหน้ากระดาษมาตรฐาน
                </label>
                <div className="bn-new-paper-grid">
                  {PAPER_SIZES.map(s => (
                    <div key={s.id} className="bn-new-paper-card">
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', display: 'block' }}>{s.name}</span>
                      <span style={{ fontSize: '10px', color: '#a1a1aa' }}>{s.fullName}</span>
                      <span style={{ fontSize: '9px', color: '#71717a', display: 'block', marginTop: '2px' }}>{s.width} × {s.height} px</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#e4e4e7', display: 'block', marginBottom: '8px' }}>
                  รูปแบบลายเส้นที่แนะนำ
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="bn-new-paper-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', color: '#f4f4f5', fontWeight: 500 }}>• ลายจุด (Dotted 25px)</span>
                    <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Bullet Journal & Planner</span>
                  </div>
                  <div className="bn-new-paper-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', color: '#f4f4f5', fontWeight: 500 }}>• เส้นแคบ (Narrow Ruled 22px)</span>
                    <span style={{ fontSize: '11px', color: '#a1a1aa' }}>จดข้อความละเอียด</span>
                  </div>
                  <div className="bn-new-paper-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', color: '#f4f4f5', fontWeight: 500 }}>• เส้นกว้าง (Wide Ruled 38px)</span>
                    <span style={{ fontSize: '11px', color: '#a1a1aa' }}>เขียนตัวใหญ่และสรุป</span>
                  </div>
                  <div className="bn-new-paper-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', color: '#f4f4f5', fontWeight: 500 }}>• ตารางกริด (Grid 25px)</span>
                    <span style={{ fontSize: '11px', color: '#a1a1aa' }}>คณิตศาสตร์ & กราฟ</span>
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
                  เลือกรูปแบบธีมที่ต้องการใช้งาน (Theme Settings)
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
                        <span style={{ fontWeight: 700, fontSize: '13px' }}>โหมดมืด (Dark)</span>
                      </div>
                      {currentTheme === 'dark' && <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 700 }}>✓ ใช้งานอยู่</span>}
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
                      ถนอมสายตาสำหรับใช้งานในที่มืด หรือประหยัดแบตเตอรี่
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
                        <span style={{ fontWeight: 700, fontSize: '13px' }}>โหมดสว่าง (Light)</span>
                      </div>
                      {currentTheme === 'light' && <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700 }}>✓ ใช้งานอยู่</span>}
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
                      สะอาดตา สไตล์สมุดสีสว่าง ใช้งานสะดวกในที่สว่าง
                    </span>
                  </div>
                </div>
              </div>
            </>
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
            เรียบร้อย
          </button>
        </div>
      </div>
    </div>
  );
};
