import React, { useEffect, useState } from 'react';
import { Cloud, FolderOpen, ExternalLink, AlertCircle, LoaderCircle } from 'lucide-react';
import { getSetting } from '../../services/db';
import { autoBackupService } from '../../services/autoBackupService';
import { useLanguage } from '../../services/i18n';
import { BackupDestinationSummary, BackupProgress, useBackupSnapshot } from './BackupStatusIndicator';
import { BackupFilesTable } from './BackupFilesTable';
export const GoogleDrivePanel = ({ rows, onBackup, onReveal, onRetryPdf, onNotice, onRestoreBackup }) => {
  const { t } = useLanguage(), state = useBackupSnapshot();
  const [drivePath, setDrivePath] = useState('');
  const [openingDesktop, setOpeningDesktop] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      const selected = await getSetting('gdrive_backup_method'), folder = await getSetting('gdrive_backup_path');
      if (active) setDrivePath(selected === 'desktop' ? folder || '' : '');
    })();
    return () => { active = false; };
  }, []);
  const chooseFolder = async () => {
    try {
      const folder = await window.electronAPI?.selectFolder?.();
      if (!folder) return;
      await autoBackupService.setDriveDesktopPath(folder); setDrivePath(folder);
      onNotice?.({ type: 'success', text: t('driveFolderSelected') });
    } catch (_) { onNotice?.({ type: 'error', text: t('backupActionFailed') }); }
  };
  const openWeb = async () => {
    const url = 'https://drive.google.com/drive/my-drive';
    if (window.electronAPI?.openExternal) await window.electronAPI.openExternal(url);
    else window.open(url, '_blank', 'noopener');
  };
  const openDesktop = async () => {
    if (openingDesktop) return;
    setOpeningDesktop(true);
    try {
      const result = await window.electronAPI?.openDriveDesktop?.();
      onNotice?.({ type: result?.opened ? 'info' : 'error',
        text: t(result?.opened ? 'driveDesktopOpened' : result?.reason === 'not-installed' ? 'driveDesktopMissing' : 'driveDesktopOpenFailed') });
    } catch (_) { onNotice?.({ type: 'error', text: t('driveDesktopOpenFailed') }); }
    finally { setOpeningDesktop(false); }
  };
  return <div className="bn-backup-hub-grid bn-backup-drive-panel" data-drive-method="desktop">
    <aside className="bn-backup-hub-aside">
      <section className="bn-backup-hub-card" data-drive-choice="desktop">
        <span className="bn-drive-choice-badge">{t('driveRecommended')}</span>
        <h4><Cloud size={18} />{t('driveMethodDesktop')}</h4>
        <ol className="bn-drive-guidance"><li>{t('driveSetupInstall')}</li><li>{t('driveSetupFolder')}</li><li>{t('driveSetupVerify')}</li></ol>
        <a className="bn-backup-hub-button" href="https://www.google.com/intx/en/drive/download/" target="_blank" rel="noopener noreferrer" onClick={event => {
          if (window.electronAPI?.openExternal) {
            event.preventDefault();
            Promise.resolve(window.electronAPI.openExternal(event.currentTarget.href)).catch(() => onNotice?.({ type: 'error', text: t('driveDesktopOpenFailed') }));
          }
        }}><ExternalLink size={14} />{t('driveDownloadOfficial')}</a>
        <button type="button" className="bn-backup-hub-button primary" onClick={openDesktop} disabled={openingDesktop}>
          {openingDesktop && <LoaderCircle size={14} className="bn-local-save-spinner" />}
          {t(openingDesktop ? 'driveDesktopOpening' : 'driveDesktopConnectAction')}
        </button>
      </section>
      <section className="bn-backup-hub-card" data-drive-choice="direct" aria-disabled="true">
        <span className="bn-drive-choice-badge is-soon">{t('driveComingSoon')}</span>
        <h4><Cloud size={18} />{t('driveMethodDirect')}</h4>
        <p>{t('driveDirectUnavailable')}</p>
      </section>
      <section className="bn-backup-hub-card">
        <h4><FolderOpen size={18} />{t('driveFolderPath')}</h4>
        <strong>{t(drivePath ? 'driveFolderSelected' : 'driveFolderNotSelected')}</strong>
        {drivePath && <details className="bn-backup-path-details"><summary>{t('backupShowPath')}</summary><code>{drivePath}</code></details>}
        <button type="button" className="bn-backup-hub-button" onClick={chooseFolder} disabled={state.syncing}><FolderOpen size={15} />{t('driveDesktopChooseFolder')}</button>
        {drivePath && <button type="button" className="bn-backup-hub-button primary" onClick={() => onBackup?.()} disabled={state.syncing}>{t('driveDesktopWriteAction')}</button>}
        {drivePath && onRestoreBackup && <button type="button" className="bn-backup-hub-button" disabled={state.syncing || state.localSaving} onClick={() => {
          if (window.confirm(t('backupRestoreConfirm'))) onRestoreBackup(drivePath);
        }}>{t('backupRestoreFromFolder')}</button>}
      </section>
      <section className="bn-backup-hub-card">
        <h4>{t('driveCloudLastConfirmed')}</h4><strong>{t('backupNever')}</strong>
        <p className="bn-backup-cloud-hint"><AlertCircle size={15} />{t('driveCloudUnconfirmed')}</p>
        <button type="button" className="bn-backup-hub-button" onClick={openWeb}><ExternalLink size={14} />{t('driveOpenWeb')}</button>
      </section>
    </aside>
    <section className="bn-backup-hub-content">
      <>
        <BackupProgress role="drive" />
        <BackupDestinationSummary role="drive" />
        <p className="bn-backup-hub-help">{t('drivePreparationHint')}</p>
        <h4>{t('driveDesktopPreparationTitle')}</h4>
        <BackupFilesTable rows={rows} role="drive" onReveal={onReveal} onRetryPdf={onRetryPdf} />
      </>
    </section>
  </div>;
};
