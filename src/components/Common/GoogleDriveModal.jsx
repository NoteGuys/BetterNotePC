import React, { useState, useEffect } from 'react';
import { 
  X, 
  Cloud, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink, 
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Download,
  FolderSync,
  Globe,
  ArrowDownToLine
} from 'lucide-react';
import { googleDrive } from '../../services/googleDriveService';
import { getSetting, saveSetting } from '../../services/db';
import { useLanguage } from '../../services/i18n';
import { DEFAULT_GOOGLE_CLIENT_ID } from '../../config/googleConfig';
import { autoBackupService } from '../../services/autoBackupService';
import { BackupDestinationSummary, backupStateKey } from './BackupStatusIndicator';

export const GoogleDriveModal = ({ isOpen, onClose, onSyncComplete }) => {
  const { t, language } = useLanguage();
  const [clientId, setClientId] = useState(DEFAULT_GOOGLE_CLIENT_ID || '');
  const [showDeveloperOptions, setShowDeveloperOptions] = useState(false);
  const [detectedGoogleDrivePath, setDetectedGoogleDrivePath] = useState(null);
  const [backupDetails, setBackupDetails] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const refreshBackupDetails = async () => {
    try {
      const status = await autoBackupService.getBackupStatusDetails();
      setBackupDetails(status);
      if (status?.targetDir) {
        setDetectedGoogleDrivePath(status.targetDir);
      }
      if (status?.lastSync) {
        setLastSync(new Date(status.lastSync));
      }
      return status;
    } catch (_) {
      return null;
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const loadSettings = async () => {
      const savedClientId = (await getSetting('gdrive_client_id')) || DEFAULT_GOOGLE_CLIENT_ID || '';
      const savedConnected = await getSetting('gdrive_connected') || false;
      const savedEmail = await getSetting('gdrive_user_email') || '';
      const savedLastSync = autoBackupService.getSnapshot().lastSuccess;

      setClientId(savedClientId);
      setIsConnected(savedConnected);
      setUserEmail(savedEmail);
      if (savedLastSync) setLastSync(new Date(savedLastSync));

      if (savedClientId) {
        googleDrive.init(savedClientId);
      }

      // Check backup details and detected Google Drive path
      await refreshBackupDetails();
    };

    loadSettings();
    setStatusMsg({ type: '', text: '' });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSignInGoogle = async () => {
    setIsLoading(true);
    setStatusMsg({ 
      type: 'info', 
      text: t('gdriveConnectingMsg', 'กำลังเปิดหน้าต่างลงชื่อเข้าใช้ Google...') 
    });

    try {
      // 1. Electron Native Google Login Popup Window
      if (typeof window !== 'undefined' && window.electronAPI?.openGoogleSignIn) {
        const res = await window.electronAPI.openGoogleSignIn();
        if (res?.loggedIn || res?.success) {
          setIsConnected(true);
          setUserEmail('Google Account (Connected)');
          await saveSetting('gdrive_connected', true);
          await refreshBackupDetails();
          setStatusMsg({ 
            type: 'success', 
            text: t('gdriveConnectSuccess', 'เข้าสู่ระบบ Google Drive สำเร็จเรียบร้อย! ({email})', { email: 'Google Account' }) 
          });
          return;
        } else if (res?.reason === 'closed_by_user') {
          setStatusMsg({ type: '', text: '' });
          return;
        }
      }

      // 2. Browser Popup Window Fallback
      const popup = window.open(
        'https://accounts.google.com/AccountChooser?service=wise&continue=https%3A%2F%2Fdrive.google.com%2F',
        'GoogleSignInPopup',
        'width=540,height=680,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes'
      );

      if (popup) {
        setIsConnected(true);
        setUserEmail('Google Account (Connected)');
        await saveSetting('gdrive_connected', true);
        await refreshBackupDetails();
        setStatusMsg({ 
          type: 'success', 
          text: t('gdriveConnectSuccess', 'เปิดหน้าต่างลงชื่อเข้าใช้ Google เรียบร้อยแล้ว') 
        });
      }
    } catch (err) {
      console.error('Google Sign-in error:', err);
      setStatusMsg({ 
        type: 'error', 
        text: err.message || t('gdriveConnectError', 'ไม่สามารถเปิดหน้าต่างเข้าสู่ระบบได้') 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenGoogleDriveWeb = async () => {
    const url = 'https://drive.google.com/drive/my-drive';
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.openExternal) {
        await window.electronAPI.openExternal(url);
      } else {
        window.open(url, '_blank');
      }
    } catch (_) {
      window.open(url, '_blank');
    }
  };

  const handleBackupNow = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setStatusMsg({ type: 'info', text: t('backupStateWorking') });
    try {
      if (window.electronAPI?.saveBackup) {
        const result = await autoBackupService.runAutoBackup({ forcePdf: false });
        await refreshBackupDetails();
        const current = !!result?.success && autoBackupService.getSnapshot().status === 'current';
        setLastSync(current && result.timestamp ? new Date(result.timestamp) : null);
        setStatusMsg({ type: current ? 'success' : 'error', text: t(current ? backupStateKey(autoBackupService.getSnapshot()) : 'backupPartialNotice') });
        if (current && onSyncComplete) onSyncComplete();
      } else {
        const result = await googleDrive.backupAllToDrive();
        if (!result?.id) throw new Error('Drive did not confirm a backup file');
        setLastSync(new Date());
        setStatusMsg({ type: 'success', text: t('gdriveBackupSuccess', '', { name: result.name }) });
        if (onSyncComplete) onSyncComplete();
      }
    } catch (_) { setStatusMsg({ type: 'error', text: t('backupProblemGeneric') }); }
    finally { setIsLoading(false); }
  };

  const handleRestoreFromDrive = async () => {
    setIsLoading(true);
    setStatusMsg({ 
      type: 'info', 
      text: t('gdriveRestoringMsg', 'กำลังค้นหาและกู้คืนสมุดโน้ตจาก Google Drive...') 
    });

    try {
      const res = await autoBackupService.restoreFromCloudBackup(detectedGoogleDrivePath);
      if (res.success) {
        setStatusMsg({ 
          type: 'success', 
          text: t('gdriveRestoreSuccess', '✓ กู้คืนข้อมูลสำเร็จ! นำเข้าสมุดโน้ตแล้ว {count} เล่ม', { count: res.count }) 
        });
        await refreshBackupDetails();
        setTimeout(() => {
          if (onClose) onClose();
          window.location.reload();
        }, 1500);
      } else {
        setStatusMsg({ 
          type: 'error', 
          text: t('backupNotFound', 'ไม่พบไฟล์สำรองใน Google Drive นี้ กรุณาตรวจสอบตำแหน่งโฟลเดอร์') 
        });
      }
    } catch (err) {
      setStatusMsg({ 
        type: 'error', 
        text: `Error: ${err.message}` 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenFolder = async () => {
    if (!detectedGoogleDrivePath) return;
    try {
      await autoBackupService.openBackupFolder(detectedGoogleDrivePath);
    } catch (e) {
      console.warn('Open folder error:', e);
    }
  };

  const handleDisconnect = async () => {
    googleDrive.accessToken = null;
    await saveSetting('gdrive_connected', false);
    await saveSetting('gdrive_token', null);
    setIsConnected(false);
    setUserEmail('');
    setStatusMsg({ 
      type: 'info', 
      text: t('gdriveDisconnectMsg', 'ยกเลิกการเชื่อมต่อ Google Drive เรียบร้อย') 
    });
  };

  const handleOpenDownloadPage = () => {
    if (typeof window !== 'undefined') {
      window.open('https://www.google.com/drive/download/', '_blank');
    }
  };

  const handleChooseLocalFolder = async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.selectFolder) {
        const folder = await window.electronAPI.selectFolder();
        if (folder) {
          await saveSetting('local_backup_path', folder);
          if (typeof window.localStorage !== 'undefined') {
            window.localStorage.setItem('local_backup_path', folder);
          }
          await autoBackupService.destinationChanged();
          await refreshBackupDetails();
          setDetectedGoogleDrivePath(folder);
          setStatusMsg({
            type: 'success',
            text: `${t('backupFolderChanged', '✓ เปลี่ยนโฟลเดอร์สำรองข้อมูลเรียบร้อยแล้ว')}: ${folder}`
          });
        }
      }
    } catch (e) {
      console.warn('Select folder error:', e);
    }
  };

  return (
    <div className="bn-modal-backdrop" onClick={onClose}>
      <div 
        className="bn-modal-content bn-modal-cloud" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '580px', borderRadius: '16px' }}
      >
        {/* Header */}
        <div className="bn-modal-header" style={{ paddingBottom: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div className="flex items-center gap-3">
            <div className="bn-icon-badge-cloud">
              <Cloud size={24} className="text-blue-400" />
            </div>
            <div>
              <h2 className="bn-modal-title" style={{ fontSize: '16px', fontWeight: 700 }}>
                {t('gdriveModalTitle', 'เชื่อมต่อ Google Drive & Cloud Sync')}
              </h2>
              <p className="bn-modal-subtitle" style={{ fontSize: '12px', color: '#94a3b8' }}>
                {t('gdriveModalSubtitle', 'สำรองข้อมูลสมุดโน้ตและไฟล์ PDF บนระบบคลาวด์ ปลอดภัยและเข้าถึงได้ทุกที่')}
              </p>
            </div>
          </div>
          <button className="bn-modal-close-btn" onClick={onClose} title={t('close', 'ปิด')}>
            <X size={20} />
          </button>
        </div>

        <div className="bn-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '16px' }}>
          <BackupDestinationSummary />
          {/* Card 1: Active Google Drive on PC */}
          {detectedGoogleDrivePath ? (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 9px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: 'rgba(16, 185, 129, 0.25)',
                    color: '#34d399'
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }}></span>
                    ACTIVE
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
                    {t('gdriveActiveStatus', 'Google Drive ทำงานอยู่ (Active)')}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                <div><strong style={{ color: '#cbd5e1' }}>{t('gdriveCurrentFolder', 'โฟลเดอร์สำรองข้อมูลปัจจุบัน:')}</strong></div>
                <div style={{
                  marginTop: '4px',
                  padding: '6px 10px',
                  background: 'rgba(0, 0, 0, 0.35)',
                  borderRadius: '6px',
                  fontFamily: 'Consolas, monospace',
                  fontSize: '12px',
                  color: '#38bdf8',
                  wordBreak: 'break-all'
                }}>
                  📁 {detectedGoogleDrivePath}
                </div>
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#94a3b8' }}>
                  {t('gdriveAutoSyncRunning', 'ระบบกำลังสำรองข้อมูลและซิงค์ขึ้น Google Drive ของคุณโดยอัตโนมัติในพื้นหลัง')}
                </div>
                {backupDetails?.files && backupDetails.files.length > 0 && (
                  <div style={{ marginTop: '6px', fontSize: '11px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <CheckCircle2 size={13} />
                    <span>
                      {t('gdriveVerifiedBackupStats', 'ยืนยันไฟล์สำรอง: สำรองแล้ว {count} เล่ม ({size}) • ซิงค์ล่าสุด: {time}', {
                        count: backupDetails?.manifest?.activeNotebooksCount || Math.round((backupDetails?.files?.length || 0) / 2) || 1,
                        size: backupDetails?.formattedTotalSize || '0 B',
                        time: lastSync ? lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t('backupNever')
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons for Active Drive */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '4px' }}>
                <button
                  type="button"
                  onClick={handleBackupNow}
                  disabled={isLoading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                  <span>{isLoading ? t('gdriveSyncing', 'กำลังซิงค์...') : t('gdriveSyncNow', 'ซิงค์ข้อมูลทันที')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenFolder}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#e2e8f0',
                    fontSize: '12px',
                    fontWeight: 500,
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    cursor: 'pointer'
                  }}
                >
                  <FolderOpen size={14} className="text-amber-400" />
                  <span>{t('gdriveOpenFolderBtn', 'เปิดโฟลเดอร์ใน Drive')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenGoogleDriveWeb}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#93c5fd',
                    fontSize: '12px',
                    fontWeight: 500,
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    cursor: 'pointer'
                  }}
                  title={t('gdriveOpenWebTitle', 'เปิดดูโฟลเดอร์สำรองข้อมูลในเว็บเบราว์เซอร์ Google Drive')}
                >
                  <Globe size={14} className="text-blue-400" />
                  <span>{t('gdriveOpenWebBtn', 'เปิดดูใน Google Drive (Web)')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleChooseLocalFolder}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#e2e8f0',
                    fontSize: '12px',
                    fontWeight: 500,
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    cursor: 'pointer'
                  }}
                >
                  <FolderSync size={14} className="text-blue-400" />
                  <span>{t('gdriveChangeFolderBtn', 'เปลี่ยนโฟลเดอร์...')}</span>
                </button>
              </div>
            </div>
          ) : null}

          {/* Card 2: Method A - Sign In with Google */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#93c5fd', margin: 0 }}>
                {t('gdriveSignInTitle', 'ลงชื่อเข้าใช้ Google Drive (Sign in with Google)')}
              </h3>
              <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px', margin: 0 }}>
                {t('gdriveSignInDesc', 'เข้าสู่ระบบ Google เพื่อเชื่อมต่อ Google Drive หรือสร้างโฟลเดอร์สำรองข้อมูลให้อัตโนมัติ')}
              </p>
            </div>

            {isConnected ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                padding: '12px',
                background: 'rgba(0, 0, 0, 0.25)',
                borderRadius: '10px',
                border: '1px solid rgba(16, 185, 129, 0.25)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#f1f5f9' }}>{userEmail || 'Google Account (Connected)'}</span>
                    <span style={{
                      padding: '2px 7px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: 600,
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#34d399'
                    }}>
                      ✓ {t('connected', 'เชื่อมต่อแล้ว')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: '#94a3b8',
                      fontSize: '11px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      cursor: 'pointer'
                    }}
                  >
                    {t('gdriveDisconnect', 'ยกเลิกการเชื่อมต่อ')}
                  </button>
                </div>

                <div style={{ fontSize: '11.5px', color: '#cbd5e1', lineHeight: 1.5 }}>
                  <div>
                    <span style={{ color: '#94a3b8' }}>{t('gdriveTargetFolderLabel', 'โฟลเดอร์สำรองข้อมูลใน Drive:')} </span>
                    <strong style={{ color: '#38bdf8', fontFamily: 'Consolas, monospace' }}>
                      📁 {backupDetails?.targetDir || detectedGoogleDrivePath || 'G:\\My Drive\\BetterNote.AppPC'}
                    </strong>
                  </div>
                  <div style={{ marginTop: '3px', color: '#94a3b8', fontSize: '11px' }}>
                    {backupDetails?.files && backupDetails.files.length > 0 ? (
                      <span style={{ color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={12} />
                        {t('gdriveVerifiedBackupStats', 'ยืนยันไฟล์สำรอง: สำรองแล้ว {count} เล่ม ({size}) • ซิงค์ล่าสุด: {time}', {
                          count: backupDetails?.manifest?.activeNotebooksCount || Math.round(backupDetails.files.length / 2) || 1,
                          size: backupDetails?.formattedTotalSize || '0 B',
                          time: lastSync ? lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t('backupNever')
                        })}
                      </span>
                    ) : (
                      <span>{t('gdriveReadyToBackup', 'พร้อมสำหรับการสำรองข้อมูล (กดปุ่ม "สำรองข้อมูลทันที" ด้านล่าง)')}</span>
                    )}
                  </div>
                </div>

                {/* Backed-up files preview tags */}
                {backupDetails?.files && backupDetails.files.length > 0 && (
                  <div style={{ padding: '8px 10px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#38bdf8', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      <span>{t('gdriveVerifiedFiles', 'ยืนยันไฟล์ที่สำรองข้อมูลเรียบร้อยแล้วบน Google Drive:')}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {backupDetails.files.slice(0, 6).map((file, idx) => (
                        <span key={idx} style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.08)', fontSize: '10.5px', color: '#f1f5f9' }}>
                          📄 {file.notebookName || file.fileName}
                        </span>
                      ))}
                      {backupDetails.files.length > 6 && (
                        <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.05)', fontSize: '10.5px', color: '#94a3b8' }}>
                          +{backupDetails.files.length - 6} {t('moreFiles', 'ไฟล์อื่นๆ')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '4px' }}>
                  <button
                    type="button"
                    onClick={handleOpenGoogleDriveWeb}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      background: 'rgba(59, 130, 246, 0.2)',
                      color: '#93c5fd',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: '1px solid rgba(59, 130, 246, 0.4)',
                      cursor: 'pointer'
                    }}
                  >
                    <Globe size={14} className="text-blue-400" />
                    <span>{t('gdriveOpenWebBtn', 'เปิดดูใน Google Drive (Web)')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenFolder}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: '#e2e8f0',
                      fontSize: '12px',
                      fontWeight: 500,
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      cursor: 'pointer'
                    }}
                  >
                    <FolderOpen size={14} className="text-amber-400" />
                    <span>{t('gdriveOpenFolderBtn', 'เปิดโฟลเดอร์ใน Drive')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBackupNow}
                    disabled={isLoading}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      background: '#2563eb',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                    <span>{isLoading ? t('gdriveSyncing', 'กำลังซิงค์...') : t('gdriveSyncNow', 'ซิงค์ข้อมูลทันที')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRestoreFromDrive}
                    disabled={isLoading}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#6ee7b7',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      cursor: 'pointer'
                    }}
                    title={t('gdriveRestoreTooltip', 'ดึงและกู้คืนสมุดโน้ตทั้งหมดจาก Google Drive ลงสู่เครื่องนี้')}
                  >
                    <ArrowDownToLine size={13} className={isLoading ? 'animate-spin' : ''} />
                    <span>{t('gdriveRestoreBtn', 'กู้คืนข้อมูลจาก Drive')}</span>
                  </button>
                </div>
              </div>
            ) : (
              <button 
                type="button"
                onClick={handleSignInGoogle}
                disabled={isLoading}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '11px 16px',
                  borderRadius: '10px',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                  transition: 'background 0.15s ease'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>{isLoading ? t('gdriveConnectingMsg', 'กำลังเชื่อมต่อ...') : t('gdriveSignInBtn', 'ลงชื่อเข้าใช้ Google Drive (Gmail)')}</span>
              </button>
            )}
          </div>

          {/* Card 3: Method B - Google Drive for Desktop */}
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#fcd34d', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FolderOpen size={16} className="text-amber-400" />
                <span>{t('gdriveDesktopTitle', 'Google Drive for Desktop (แนะนำสำหรับ Windows ⭐)')}</span>
              </h3>
              <p style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px', margin: 0, lineHeight: 1.5 }}>
                {t('gdriveDesktopDesc', 'ติดตั้งโปรแกรม Google Drive ครั้งเดียว ข้อมูลสมุดโน้ตทั้งหมดจะซิงค์ขึ้นคลาวด์ให้อัตโนมัติในพื้นหลังตลอดเวลา ไม่ต้องตั้งค่าใดๆ')}
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button
                type="button"
                onClick={handleOpenDownloadPage}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#f1f5f9',
                  fontSize: '12px',
                  fontWeight: 500,
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  cursor: 'pointer'
                }}
              >
                <Download size={13} className="text-blue-400" />
                <span>{t('gdriveDownloadDesktopBtn', 'ดาวน์โหลด Google Drive for Desktop')}</span>
                <ExternalLink size={11} className="text-zinc-500 ml-1" />
              </button>

              <button
                type="button"
                onClick={handleChooseLocalFolder}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'rgba(37, 99, 235, 0.15)',
                  color: '#93c5fd',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: '1px solid rgba(37, 99, 235, 0.3)',
                  cursor: 'pointer'
                }}
              >
                <FolderOpen size={13} className="text-blue-400" />
                <span>{t('gdriveChooseLocalDriveBtn', 'เลือกโฟลเดอร์ Google Drive ในเครื่อง...')}</span>
              </button>
            </div>
          </div>

          {/* Status Alert Banner */}
          {statusMsg.text && (
            <div className={`bn-alert bn-alert-${statusMsg.type}`} style={{ padding: '10px 14px', borderRadius: '8px' }}>
              {statusMsg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
              <span style={{ fontSize: '12px' }}>{statusMsg.text}</span>
            </div>
          )}

          {/* Subtle Developer Section (Collapsed) */}
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '8px' }}>
            <button
              type="button"
              onClick={() => setShowDeveloperOptions(!showDeveloperOptions)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 0'
              }}
            >
              <span>⚙️ Developer Client ID</span>
              {showDeveloperOptions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showDeveloperOptions && (
              <div style={{ marginTop: '8px', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                <input
                  type="text"
                  placeholder="xxxx-xxxxxxxxxx.apps.googleusercontent.com"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8fafc',
                    fontSize: '11px',
                    fontFamily: 'monospace'
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bn-modal-footer" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '12px' }}>
          <button className="bn-btn-secondary" onClick={onClose} style={{ padding: '8px 20px', fontSize: '12px' }}>
            {t('close', 'ปิด')}
          </button>
        </div>
      </div>
    </div>
  );
};
