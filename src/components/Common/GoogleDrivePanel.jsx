import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Cloud, FolderOpen, ExternalLink, LoaderCircle } from 'lucide-react';
import { getSetting, saveSetting } from '../../services/db';
import { autoBackupService } from '../../services/autoBackupService';
import { useLanguage } from '../../services/i18n';
import { BackupDestinationSummary, BackupProgress, useBackupSnapshot } from './BackupStatusIndicator';
import { BackupFilesTable } from './BackupFilesTable';

const DRIVE_PANEL_TEXT = {
  en: {
    chooseToConnect: 'Choose folder to connect Google Drive',
    accountAction: 'Sign in or switch account',
    accountGuide: "In Google Drive, click your profile picture and select or add an account. Then return here and choose that account's sync folder.",
    disconnected: 'BetterNote has disconnected from this Drive folder. Existing backups have been kept; Google Drive stays signed in.'
  },
  th: {
    chooseToConnect: 'เลือกโฟลเดอร์เพื่อเชื่อมต่อกับ Google Drive',
    accountAction: 'ลงชื่อเข้าใช้หรือเปลี่ยนบัญชี',
    accountGuide: 'ในแอป Google Drive กดรูปโปรไฟล์แล้วเลือกบัญชีหรือเพิ่มบัญชี จากนั้นกลับมาเลือกโฟลเดอร์ซิงค์ของบัญชีนั้นที่นี่',
    disconnected: 'BetterNote ยกเลิกการใช้โฟลเดอร์ Drive นี้แล้ว ไฟล์สำรองเดิมยังอยู่ และแอป Google Drive ยังลงชื่อเข้าใช้ตามเดิม'
  },
  zh: {
    chooseToConnect: '选择文件夹以连接 Google Drive',
    accountAction: '登录或切换帐号',
    accountGuide: '在 Google Drive 中点击头像，选择或添加帐号。然后返回此处，选择该帐号的同步文件夹。',
    disconnected: 'BetterNote 已断开此 Drive 文件夹。原有备份已保留；Google Drive 仍保持登录。'
  },
  ru: {
    chooseToConnect: 'Выбрать папку для подключения Google Drive',
    accountAction: 'Войти или сменить аккаунт',
    accountGuide: 'В Google Drive нажмите на фото профиля и выберите или добавьте аккаунт. Затем вернитесь сюда и выберите папку синхронизации этого аккаунта.',
    disconnected: 'BetterNote отключён от этой папки Drive. Существующие резервные копии сохранены; вход в Google Drive не изменён.'
  }
};

export const GoogleDrivePanel = ({ rows, onBackup, onReveal, onRetryPdf, onNotice, onRestoreBackup }) => {
  const { t, language } = useLanguage(), state = useBackupSnapshot();
  const sync = useSyncExternalStore(autoBackupService.subscribeDriveSync, autoBackupService.getDriveSyncSnapshot);
  const syncKey = { checking:'driveSyncChecking', receiving:'driveSyncReceiving', waiting:'driveSyncWaiting',
    pending:sync.reason==='drive-sync-restart'?'driveSyncRestart':'driveSyncPending', legacy:'driveSyncLegacy', current:'driveSyncReceived', conflict:'driveSyncConflicts' }[sync.status];
  const text = DRIVE_PANEL_TEXT[language] || DRIVE_PANEL_TEXT.en;
  const downloadLanguage = { en: 'en', th: 'th', zh: 'zh-CN', ru: 'ru' }[language] || 'en';
  const downloadUrl = 'https://www.google.com/intl/' + downloadLanguage + '/drive/download/#download';
  const [drivePath, setDrivePath] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [openingDesktop, setOpeningDesktop] = useState(false);
  const [changingFolder, setChangingFolder] = useState(false);
  const [showAccountGuide, setShowAccountGuide] = useState(false);
  const operation = useRef(false);
  const disabled = loadingSettings || openingDesktop || changingFolder || state.syncing || state.recoveryPaused;
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [selected, folder] = await Promise.all([getSetting('gdrive_backup_method'), getSetting('gdrive_backup_path')]);
        if (active) setDrivePath(selected === 'desktop' && typeof folder === 'string' ? folder.trim() : '');
      } catch (_) { if (active) onNotice?.({ type: 'error', text: t('backupActionFailed') }); }
      finally { if (active) setLoadingSettings(false); }
    })();
    return () => { active = false; };
  }, []);
  const chooseFolder = async () => {
    if (disabled || operation.current) return;
    operation.current = true; setChangingFolder(true);
    let pause;
    try {
      const folder = await window.electronAPI?.selectFolder?.();
      if (typeof folder !== 'string' || !folder.trim()) return;
      pause = autoBackupService.controller.pauseForRecovery();
      await pause.wait();
      await autoBackupService.setDriveDesktopPath(folder);
      setDrivePath(folder.trim()); setShowAccountGuide(false);
      onNotice?.({ type: 'success', text: t('driveFolderSelected') });
    } catch (_) { onNotice?.({ type: 'error', text: t('backupActionFailed') }); }
    finally { pause?.resume(); operation.current = false; setChangingFolder(false); }
  };
  const disconnect = async () => {
    if (disabled || operation.current || !drivePath) return;
    operation.current = true; setChangingFolder(true);
    const pause = autoBackupService.controller.pauseForRecovery();
    try {
      await pause.wait();
      // Disable this destination with one committed setting; keep its existing files and path.
      await saveSetting('gdrive_backup_method', null);
      setDrivePath(''); setShowAccountGuide(false);
      await autoBackupService.destinationChanged();
      onNotice?.({ type: 'success', text: text.disconnected });
    } catch (_) { onNotice?.({ type: 'error', text: t('backupActionFailed') }); }
    finally { pause.resume(); operation.current = false; setChangingFolder(false); }
  };
  const openDesktop = async () => {
    if (disabled || operation.current) return;
    operation.current = true; setOpeningDesktop(true); setShowAccountGuide(false);
    try {
      const result = await window.electronAPI?.openDriveDesktop?.();
      setShowAccountGuide(!!result?.opened);
      onNotice?.({ type: result?.opened ? 'info' : 'error',
        text: t(result?.opened ? 'driveDesktopOpened' : result?.reason === 'not-installed' ? 'driveDesktopMissing' : 'driveDesktopOpenFailed') });
    } catch (_) { onNotice?.({ type: 'error', text: t('driveDesktopOpenFailed') }); }
    finally { operation.current = false; setOpeningDesktop(false); }
  };
  return <div className="bn-backup-hub-grid bn-backup-drive-panel" data-drive-method="desktop">
    <aside className="bn-backup-hub-aside">
      <section className="bn-backup-hub-card" data-drive-choice="desktop">
        <span className="bn-drive-choice-badge">{t('driveRecommended')}</span>
        <h4><Cloud size={18} />{t('driveMethodDesktop')}</h4>
        <ol className="bn-drive-guidance"><li>{t('driveSetupInstall')}</li><li>{t('driveSetupFolder')}</li><li>{t('driveSetupVerify')}</li></ol>
        <a className="bn-backup-hub-button" href={downloadUrl} target="_blank" rel="noopener noreferrer" onClick={event => {
          if (window.electronAPI?.openExternal) {
            event.preventDefault();
            Promise.resolve(window.electronAPI.openExternal(event.currentTarget.href)).then(result => { if (!result?.success) onNotice?.({ type: 'error', text: t('externalOpenFailed') }); }).catch(() => onNotice?.({ type: 'error', text: t('externalOpenFailed') }));
          }
        }}><ExternalLink size={14} />{t('driveDownloadOfficial')}</a>
        {!drivePath && <button type="button" className="bn-backup-inline-action" style={{ marginTop: 12 }}
          onClick={openDesktop} disabled={disabled} data-drive-account-action>
          {openingDesktop ? <LoaderCircle size={14} className="bn-local-save-spinner" /> : <ExternalLink size={14} />}
          {openingDesktop ? t('driveDesktopOpening') : text.accountAction}
        </button>}
        {showAccountGuide && <p role="status" data-drive-account-guide>{text.accountGuide}</p>}
        <div style={{ marginTop: 16 }}>
          <h4><FolderOpen size={18} />{t('driveFolderPath')}</h4>
          {drivePath ? <div className="bn-backup-path-details"><code data-drive-folder-path>{drivePath}</code></div>
            : <strong>{t(loadingSettings ? 'loading' : 'driveFolderNotSelected')}</strong>}
        </div>
        <button type="button" className={'bn-backup-hub-button' + (drivePath ? '' : ' primary')}
          onClick={chooseFolder} disabled={disabled} data-drive-folder-action>
          {changingFolder ? <LoaderCircle size={15} className="bn-local-save-spinner" /> : <FolderOpen size={15} />}
          {drivePath ? t('driveDesktopChooseFolder') : text.chooseToConnect}
        </button>
        {drivePath && <button type="button" className="bn-backup-hub-button primary" onClick={disconnect} disabled={disabled}>
          {t('gdriveDisconnect')}
        </button>}
        {drivePath && <button type="button" className="bn-backup-hub-button primary" onClick={() => onBackup?.()} disabled={disabled}>{t('driveDesktopWriteAction')}</button>}
        {drivePath && onRestoreBackup && <button type="button" className="bn-backup-hub-button" disabled={disabled || state.localSaving} onClick={() => {
          if (window.confirm(t('backupRestoreConfirm'))) onRestoreBackup(drivePath);
        }}>{t('backupRestoreFromFolder')}</button>}
      </section>
      <section className="bn-backup-hub-card" data-drive-choice="direct" aria-disabled="true">
        <span className="bn-drive-choice-badge is-soon">{t('driveComingSoon')}</span>
        <h4><Cloud size={18} />{t('driveMethodDirect')}</h4>
        <p>{t('driveDirectUnavailable')}</p>
      </section>
    </aside>
    <section className="bn-backup-hub-content">
      <>
        {drivePath && syncKey && <p className="bn-backup-hub-help" role="status" data-drive-sync-state={sync.status}>
          {t(syncKey, '', { count: sync.status === 'conflict' ? sync.conflicts : sync.received })}
        </p>}
        <BackupProgress role="drive" />
        <BackupDestinationSummary role="drive" />
        <p className="bn-backup-hub-help">{t('drivePreparationHint')}</p>
        <h4>{t('driveDesktopPreparationTitle')}</h4>
        <BackupFilesTable rows={drivePath ? rows : []} role="drive" onReveal={onReveal} onRetryPdf={onRetryPdf} />
      </>
    </section>
  </div>;
};
