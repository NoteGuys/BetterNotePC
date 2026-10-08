import React, { useEffect, useId, useState } from 'react';
import { X, ShieldCheck, HardDrive, Cloud, FolderOpen, RefreshCw, Search, AlertCircle, CheckCircle2, LoaderCircle, ExternalLink, ArrowDownToLine } from 'lucide-react';
import { autoBackupService } from '../../services/autoBackupService';
import { useLanguage } from '../../services/i18n';
import { getSetting } from '../../services/db';
import { useBackupSnapshot, BackupDestinationSummary, BackupProgress, backupStateKey, hasBackupRole, formatBackupSize } from '../Common/BackupStatusIndicator';
import { BackupFilesTable, backupRowsFromSnapshot } from '../Common/BackupFilesTable';
import { GoogleDrivePanel } from '../Common/GoogleDrivePanel';
export default function BackupStatusModal({ isOpen, onClose, notebooks = [], onTriggerSync, onRestoreBackup, initialTab = 'local' }) {
  const { t } = useLanguage(), state = useBackupSnapshot(), titleId = useId();
  const [tab, setTab] = useState(initialTab), [search, setSearch] = useState(''), [showOlder, setShowOlder] = useState(false);
  const [details, setDetails] = useState(null), [loading, setLoading] = useState(false), [notice, setNotice] = useState(null);
  const [localPath, setLocalPath] = useState(''), [pathExpanded, setPathExpanded] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setTab(initialTab === 'drive' ? 'drive' : 'local'); setSearch(''); setNotice(null);
    setDetails(null); setShowOlder(false); setPathExpanded(false);
    (async () => {
      const path = (await getSetting('local_backup_path')) || '';
      if (active) setLocalPath(path);
      await autoBackupService.controller.refresh();
    })().catch(() => {});
    const closeOnEscape = event => { if (event.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => { active = false; window.removeEventListener('keydown', closeOnEscape); };
  }, [isOpen, initialTab]);
  if (!isOpen) return null;
  const local = state.targets.find(target => hasBackupRole(target, 'local'));
  const folder = local?.targetDir || localPath;
  const snapshotRows = backupRowsFromSnapshot(state);
  const rows = details?.files ? [
    ...details.files,
    ...snapshotRows.filter(row => !row.fullPath && !details.files.some(file => file.notebookId === row.notebookId && file.kind === row.kind && file.targetDir === row.targetDir))
  ] : snapshotRows;
  const localRows = rows.filter(row => (row.roles || state.targets.find(target => target.targetDir === row.targetDir)?.roles || ['local']).includes('local'));
  const stored = localRows.filter(row => row.fullPath);
  const bytes = stored.reduce((sum, row) => sum + (row.fileSizeBytes || 0), 0);
  const loadFiles = async (options = {}) => {
    if (loading) return;
    setLoading(true);
    try { setDetails(await autoBackupService.getBackupStatusDetails({ includeLegacy: showOlder, ...options })); }
    catch (_) { setNotice({ type: 'error', text: t('backupActionFailed') }); }
    finally { setLoading(false); }
  };
  const backupNow = async (options = {}) => {
    if (state.syncing) return;
    setNotice(null); setDetails(null);
    try {
      const result = onTriggerSync ? await onTriggerSync(options) : await autoBackupService.runAutoBackup(options);
      const latest = autoBackupService.getSnapshot();
      const driveTargets = latest.targets.filter(target => hasBackupRole(target, 'drive'));
      const current = tab === 'drive' ? driveTargets.length > 0 && driveTargets.every(target => target.dataCurrent)
        : !!result?.success && latest.status === 'current';
      const pdfComplete = tab === 'drive' ? driveTargets.every(target => target.pdfCurrent) : result?.pdfComplete;
      const conflict = latest.targets.filter(target => hasBackupRole(target, tab === 'drive' ? 'drive' : 'local'))
        .some(target => Object.keys(target.notebookIssues || {}).length > 0);
      setNotice({ type: current ? pdfComplete ? 'success' : 'info' : 'error',
        text: t(current ? pdfComplete ? tab === 'drive' ? 'driveDesktopPreparationTitle' : 'backupLocalCurrent'
          : 'backupDataCompletePdfPending' : conflict ? 'backupConflictNotice' : 'backupActionFailed') });
      if (showOlder) loadFiles({ includeLegacy: true });
    } catch (_) { setNotice({ type: 'error', text: t('backupActionFailed') }); }
  };
  const chooseFolder = async () => {
    try {
      const chosen = window.electronAPI?.selectFolder ? await window.electronAPI.selectFolder()
        : window.prompt(t('backupChooseFolder'), folder);
      if (!chosen?.trim()) return;
      await autoBackupService.setLocalBackupPath(chosen); setLocalPath(chosen); setDetails(null);
      setNotice({ type: 'success', text: t('backupFolderChangeSuccess') });
    } catch (_) { setNotice({ type: 'error', text: t('backupActionFailed') }); }
  };
  const openFolder = async () => {
    const result = await autoBackupService.openBackupFolder(folder || null);
    if (!result?.success) setNotice({ type: 'error', text: t(result?.reason === 'open-timeout' ? 'backupFolderOpenTimeout' : 'backupActionFailed') });
  };
  const reveal = async path => {
    const result = await autoBackupService.revealBackupFile(path);
    if (!result?.success) setNotice({ type: 'error', text: t(result?.reason === 'open-timeout' ? 'backupFolderOpenTimeout' : 'backupActionFailed') });
  };
  const restore = () => {
    if (window.confirm(t('backupRestoreConfirm'))) onRestoreBackup?.(folder || null);
  };
  const changeTab = next => { setTab(next); setNotice(null); };
  const tabKey = event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault(); const next = event.key === 'Home' ? 'local' : event.key === 'End' ? 'drive' : tab === 'local' ? 'drive' : 'local';
    changeTab(next); document.getElementById(titleId + '-tab-' + next)?.focus();
  };
  return <div className="bn-modal-backdrop" onClick={onClose}>
    <div className="bn-backup-dialog bn-backup-hub" role="dialog" aria-modal="true" aria-labelledby={titleId}
      data-active-tab={tab} onClick={event => event.stopPropagation()}>
      <header className="bn-backup-hub-header">
        <div className="bn-backup-hub-title"><ShieldCheck size={25} /><div><h3 id={titleId}>{t('backupHubTitle')}</h3><p>{t('backupHubSubtitle')}</p></div></div>
        <button type="button" className="bn-modal-close-btn" onClick={onClose} title={t('close')} aria-label={t('close')}><X size={21} /></button>
      </header>
      <nav className="bn-backup-hub-tabs" role="tablist" aria-label={t('backupHubTitle')} onKeyDown={tabKey}>
        {['local','drive'].map(key => {
          const Icon = key === 'local' ? HardDrive : Cloud;
          return <button type="button" key={key} id={titleId + '-tab-' + key} role="tab" aria-selected={tab === key}
            aria-controls={titleId + '-panel-' + key} tabIndex={tab === key ? 0 : -1}
            className={tab === key ? 'is-active' : ''} onClick={() => changeTab(key)}><Icon size={18} />{t(key === 'local' ? 'backupLocalTab' : 'backupDriveTab')}</button>;
        })}
      </nav>
      {notice && <div className={'bn-backup-hub-notice is-' + notice.type} role="status">
        {notice.type === 'error' ? <AlertCircle size={16} /> : notice.type === 'success' ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}
        <span>{notice.text}</span><button type="button" onClick={() => setNotice(null)} aria-label={t('close')}><X size={15} /></button>
      </div>}
      <div className="bn-backup-hub-body" role="tabpanel" id={titleId + '-panel-' + tab} aria-labelledby={titleId + '-tab-' + tab}>
        {tab === 'local' && <BackupProgress />}
        {tab === 'local' ? <div className="bn-backup-hub-grid">
          <aside className="bn-backup-hub-aside">
            <section className="bn-backup-hub-card">
              <h4><FolderOpen size={18} />{t('backupLocalFolder')}</h4>
              <strong className="bn-backup-folder-name">{folder ? folder.split(/[\\/]/).filter(Boolean).at(-1) : t('backupStateUnknown')}</strong>
              <p>{t('backupLocalFolderHelp')}</p>
              <button type="button" className="bn-backup-hub-button" onClick={chooseFolder} disabled={state.syncing}><FolderOpen size={15} />{t('backupChooseFolder')}</button>
              <button type="button" className="bn-backup-hub-button" onClick={openFolder}><ExternalLink size={15} />{t('backupOpenLocalFolder')}</button>
              {folder && <details className="bn-backup-path-details" open={pathExpanded} onToggle={event => setPathExpanded(event.currentTarget.open)}>
                <summary>{t('backupShowPath')}</summary><code>{folder}</code>
              </details>}
            </section>
            <section className="bn-backup-hub-card bn-backup-hub-metrics">
              <div><span>{t('backupSavedNotebooks')}</span><strong>{state.totalNotebooks || notebooks.length || 0}</strong></div>
              <div><span>{t('backupStoredFiles')}</span><strong>{stored.length}</strong></div>
              <div><span>{t('backupTotalSize')}</span><strong>{formatBackupSize(bytes)}</strong></div>
            </section>
            {onRestoreBackup && <button type="button" className="bn-backup-hub-button" onClick={restore} disabled={state.syncing || state.localSaving}><ArrowDownToLine size={15} />{t('backupRestoreFromFolder')}</button>}
          </aside>
          <section className="bn-backup-hub-content">
            <BackupDestinationSummary role="local" />
            <div className="bn-backup-hub-file-controls">
              <h4>{t('backupFilesTitle')}</h4>
              <label className="bn-backup-hub-search"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)}
                placeholder={t('backupSearchPlaceholder')} aria-label={t('backupSearchPlaceholder')} /></label>
            </div>
            <div className="bn-backup-hub-list-tools">
              <label><input type="checkbox" checked={showOlder} disabled={loading || state.syncing} onChange={event => {
                const checked = event.target.checked; setShowOlder(checked); if (checked) loadFiles({ includeLegacy: true }); else setDetails(null);
              }} />{t('backupViewOlder')}</label>
              <button type="button" className="bn-backup-inline-action" disabled={loading || state.syncing} onClick={() => loadFiles()}><RefreshCw size={13} />{t('backupRefreshAction')}</button>
              <button type="button" className="bn-backup-inline-action" disabled={loading || state.syncing} onClick={() => loadFiles({ deepVerify: true })}><ShieldCheck size={13} />{t('backupVerifyAction')}</button>
            </div>
            {loading && <div className="bn-backup-hub-loading" role="status"><LoaderCircle size={14} className="bn-local-save-spinner" />{t('backupInspecting')}</div>}
            <BackupFilesTable rows={localRows} role="local" search={search} onReveal={reveal} onRetryPdf={id => backupNow({ notebookIds: [id] })} />
          </section>
        </div> : <GoogleDrivePanel rows={rows} onBackup={backupNow} onReveal={reveal}
          onRetryPdf={id => backupNow({ notebookIds: [id] })} onNotice={setNotice} onRestoreBackup={onRestoreBackup} />}
      </div>
      <footer className="bn-backup-hub-footer">
        <div className={'bn-backup-hub-footer-state is-' + (tab === 'local' ? state.status : 'unknown')}>
          {tab === 'local' ? <ShieldCheck size={16} /> : <Cloud size={16} />}<span>{t(tab === 'local' ? backupStateKey(state) : 'driveCloudUnconfirmed')}</span></div>
        <div>{tab === 'local' && <button type="button" className="bn-backup-hub-button primary bn-backup-btn-sync-now" onClick={() => backupNow()} disabled={state.syncing || loading}>
          <RefreshCw size={15} className={state.syncing ? 'bn-local-save-spinner' : ''} />{t(state.phase === 'pdf' ? 'backupPdfBackground' : state.syncing ? 'backupStateWorking' : 'backupNowAction')}</button>}
          <button type="button" className="bn-backup-hub-button bn-backup-btn-close" onClick={onClose}>{t('close')}</button>
        </div>
      </footer>
    </div>
  </div>;
}
