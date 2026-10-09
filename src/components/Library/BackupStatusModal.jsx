import React, { useEffect, useId, useState, useRef } from 'react';
import { X, ShieldCheck, HardDrive, Cloud, FolderOpen, RefreshCw, Search, AlertCircle, CheckCircle2, LoaderCircle, ExternalLink, ArrowDownToLine } from 'lucide-react';
import { autoBackupService } from '../../services/autoBackupService';
import { usePenButtonTap } from '../../utils/usePenButtonTap';
import { useLanguage } from '../../services/i18n';
import { backupReadErrorKey } from '../../services/backupReadStatus';
import { getSetting } from '../../services/db';
import { useBackupSnapshot, BackupDestinationSummary, BackupProgress, backupStateKey, hasBackupRole, formatBackupSize } from '../Common/BackupStatusIndicator';
import { BackupFilesTable, backupRowsFromSnapshot } from '../Common/BackupFilesTable';
import { GoogleDrivePanel } from '../Common/GoogleDrivePanel';
// Keep the source menu inside the dialog. Native Windows select popups can fail
// to reopen after the dialog temporarily becomes inert during recovery.
function RecoveryDevicePicker({ sources, value, onChange, disabled, label, optionLabel }) {
  const [open, setOpen] = useState(false), [active, setActive] = useState(0);
  const listId = useId(), trigger = useRef(null), options = useRef([]), container = useRef(null);
  useEffect(() => { setOpen(false); }, [sources, disabled]);
  useEffect(() => {
    if (open) options.current[active]?.focus();
  }, [open, active]);
  const select = index => {
    if (disabled || !sources[index]) return;
    onChange(sources[index].folder);setOpen(false);trigger.current?.focus();
  };
  const show = index => { if (!disabled && sources.length) {setActive(Math.max(0,index));setOpen(true);} };
  const selected = sources.find(source => source.folder === value);
  const selectedIndex = sources.findIndex(source => source.folder === value);
  return <div ref={container} data-recovery-device-picker style={{position:'relative'}} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={event => {
    if (event.key === 'Escape' && open) {event.preventDefault();event.stopPropagation();setOpen(false);trigger.current?.focus();}
  }}>
    <button ref={trigger} type="button" className="bn-backup-hub-button" data-recovery-device-trigger
      aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
      disabled={disabled} style={{width:'100%',justifyContent:'space-between',textAlign:'left',minHeight:44}}
      onClick={() => open ? setOpen(false) : show(selectedIndex)} onKeyDown={event => {
        if (['ArrowDown','ArrowUp'].includes(event.key)) {event.preventDefault();show(selectedIndex);}
      }}>
      <span>{selected ? optionLabel(selected) : label}</span><span aria-hidden="true">{open ? '▴' : '▾'}</span>
    </button>
    {open && <div id={listId} role="listbox" aria-label={label} style={{position:'absolute',top:'100%',left:0,right:0,zIndex:2,marginTop:6,maxHeight:240,overflowY:'auto',border:'1px solid var(--border-color, #475569)',borderRadius:8,padding:4,background:'var(--bg-secondary, #1e293b)'}}>
      {sources.map((source,index) => <button key={source.folder} ref={element => options.current[index]=element}
        type="button" role="option" aria-selected={source.folder===value} tabIndex={index===active?0:-1}
        data-recovery-device-option={source.folder} className="bn-backup-hub-button"
        style={{display:'block',width:'100%',minHeight:44,textAlign:'left',marginBottom:2,background:source.folder===value?'rgba(59,130,246,.2)':undefined}}
        onClick={() => select(index)} onKeyDown={event => {
          let next;
          if (event.key==='ArrowDown') next=(index+1)%sources.length;
          else if (event.key==='ArrowUp') next=(index+sources.length-1)%sources.length;
          else if (event.key==='Home') next=0;
          else if (event.key==='End') next=sources.length-1;
          if (next !== undefined) {event.preventDefault();setActive(next);}
        }}>{optionLabel(source)}</button>)}
    </div>}
  </div>;
}
export default function BackupStatusModal({ isOpen, onClose, notebooks = [], onTriggerSync, onRestoreBackup, initialTab = 'local' }) {
  const penTap=usePenButtonTap(),backupRequest=useRef(false);
  const { t } = useLanguage(), state = useBackupSnapshot(), titleId = useId();
  const [tab, setTab] = useState(initialTab), [search, setSearch] = useState(''), [showOlder, setShowOlder] = useState(false);
  const [details, setDetails] = useState(null), [loading, setLoading] = useState(false), [notice, setNotice] = useState(null);
  const [recoveryChoices,setRecoveryChoices]=useState(null),[recoverySource,setRecoverySource]=useState(''),[recoveryLoading,setRecoveryLoading]=useState(false);
  const recoveryRequest=useRef(false),sourceRequest=useRef(0);
  const [localPath, setLocalPath] = useState(''), [pathExpanded, setPathExpanded] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    sourceRequest.current++;setRecoveryChoices(null);setRecoverySource('');setRecoveryLoading(false);
    setTab(initialTab === 'drive' ? 'drive' : 'local'); setSearch(''); setNotice(null);
    setDetails(null); setShowOlder(false); setPathExpanded(false);
    (async () => {
      const path = (await getSetting('local_backup_path')) || '';
      if (active) setLocalPath(path);
      await autoBackupService.controller.refresh();
    })().catch(() => {});
    const closeOnEscape = event => { if (event.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => { active = false;sourceRequest.current++; window.removeEventListener('keydown', closeOnEscape); };
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
    if (state.syncing || backupRequest.current) return;
    backupRequest.current=true;setNotice(null); setDetails(null);
    try {
      const result = onTriggerSync ? await onTriggerSync(options) : await autoBackupService.runAutoBackup(options);
      const latest = autoBackupService.getSnapshot();
      const driveTargets = latest.targets.filter(target => hasBackupRole(target, 'drive'));
      const current = tab === 'drive' ? driveTargets.length > 0 && driveTargets.every(target => target.dataCurrent)
        : latest.targets.some(target=>hasBackupRole(target,'local')) && latest.targets.filter(target=>hasBackupRole(target,'local')).every(target=>target.dataCurrent);
      const pdfComplete = tab === 'drive' ? driveTargets.every(target => target.pdfCurrent) : result?.pdfComplete;
      const destinationError = latest.targets.find(target => hasBackupRole(target, tab === 'drive' ? 'drive' : 'local') && target.error)?.error;
      const conflict = latest.targets.filter(target => hasBackupRole(target, tab === 'drive' ? 'drive' : 'local'))
        .some(target => Object.keys(target.notebookIssues || {}).length > 0);
      setNotice({ type: current ? pdfComplete ? 'success' : 'info' : 'error',
        text: t(current ? pdfComplete ? tab === 'drive' ? 'driveDesktopPreparationTitle' : 'backupLocalCurrent'
          : 'backupDataCompletePdfPending' : conflict ? 'backupConflictNotice' : (tab === 'drive' && autoBackupService.getDriveSyncSnapshot().reason
            ? backupReadErrorKey(autoBackupService.getDriveSyncSnapshot().reason) : destinationError ? backupReadErrorKey(destinationError) : 'backupActionFailed')) });
      if (showOlder) loadFiles({ includeLegacy: true });
    } catch (_) { setNotice({ type: 'error', text: t('backupActionFailed') }); }
    finally { backupRequest.current=false; }
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
  const performRestore = async path => {
    if (state.syncing || state.recoveryPaused || state.localSaving||recoveryRequest.current) return;
    recoveryRequest.current=true;setRecoveryLoading(true);
    setNotice({ type: 'info', text: t('backupReadRestoring') });
    try {
      if (onRestoreBackup) { await onRestoreBackup(path); setNotice(null); return; }
      const result = await autoBackupService.restoreFromCloudBackup(path);
      setNotice({ type: result.success ? 'success' : 'error', text: result.success
        ? t('backupReadRestored', '', { count: result.count }) : t(backupReadErrorKey(result.reason)) });
    } catch (_) { setNotice({ type: 'error', text: t('backupReadUnavailable') }); }
    finally {recoveryRequest.current=false;setRecoveryLoading(false);setRecoveryChoices(null);}
  };
  const chooseRestore=async path=>{
    if(state.syncing||state.recoveryPaused||state.localSaving||recoveryLoading)return;
    const request=++sourceRequest.current;setRecoveryLoading(true);setRecoveryChoices(null);setNotice(null);
    try{
      const result=await autoBackupService.listRestoreSources(path);
      if(request!==sourceRequest.current)return;
      if(!result?.success||!result.folders?.length){setNotice({type:'error',text:t(backupReadErrorKey(result?.reason||'not-found'))});return;}
      const device=await autoBackupService.getBackupDevice();if(request!==sourceRequest.current)return;
      setRecoveryChoices(result.folders.map(source=>({...source,current:source.deviceId===device.id})));
      setRecoverySource('');
    }catch(_){if(request===sourceRequest.current)setNotice({type:'error',text:t('backupReadUnavailable')});}
    finally{if(request===sourceRequest.current)setRecoveryLoading(false);}
  };
  const restore=()=>chooseRestore(local?.selectedRoot||localPath||folder||null);
  const changeTab = next => {sourceRequest.current++;setRecoveryChoices(null);setRecoverySource('');setRecoveryLoading(false);setTab(next);setNotice(null);};
  const tabKey = event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault(); const next = event.key === 'Home' ? 'local' : event.key === 'End' ? 'drive' : tab === 'local' ? 'drive' : 'local';
    changeTab(next); document.getElementById(titleId + '-tab-' + next)?.focus();
  };
  return <div className="bn-modal-backdrop" onClick={onClose}>
    <div {...penTap} className="bn-backup-dialog bn-backup-hub" role="dialog" aria-modal="true" aria-labelledby={titleId}
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
        {recoveryLoading&&<p className="bn-backup-hub-loading" role="status"><LoaderCircle size={16} className="bn-local-save-spinner" />{t('backupInspecting')}</p>}
        {recoveryChoices&&<section className="bn-backup-hub-card" data-recovery-choices style={{marginBottom:16}}>
          <h4>{t('backupChooseRecoverySource')}</h4><p>{t('backupRestoreManualHelp')}</p>
          <RecoveryDevicePicker sources={recoveryChoices} value={recoverySource} onChange={setRecoverySource}
            disabled={recoveryLoading} label={t('backupChooseRecoverySource')} optionLabel={source =>
              (source.legacy?t('backupLegacySource'):source.deviceName||source.deviceId) +
              (source.current?' · '+t('backupThisDevice'):'') + ' · ' + source.count + ' · ' +
              (source.savedAt?new Date(source.savedAt).toLocaleString():t('backupStateUnknown'))}/>
          {recoverySource&&<p className="bn-backup-path-details"><code>{recoverySource}</code></p>}
          <div style={{display:'flex',gap:8,marginTop:12}}>
            <button type="button" className="bn-backup-hub-button primary" disabled={!recoverySource||recoveryLoading||state.syncing} onClick={()=>{
              if(window.confirm(t('backupRestoreConfirm')))performRestore(recoverySource);
            }}>{t('backupRestoreFromFolder')}</button>
            <button type="button" className="bn-backup-hub-button" disabled={recoveryLoading} onClick={()=>setRecoveryChoices(null)}>{t('close')}</button>
          </div>
        </section>}
        {tab === 'local' && <BackupProgress />}
        {tab === 'local' ? <div className="bn-backup-hub-grid">
          <aside className="bn-backup-hub-aside">
            <section className="bn-backup-hub-card">
              <h4><FolderOpen size={18} />{t('backupLocalFolder')}</h4>
              <strong className="bn-backup-folder-name">{(local?.selectedRoot||localPath||folder)?.split(/[\\/]/).filter(Boolean).at(-1)||t('backupStateUnknown')}</strong>
              <p>{t('backupPerDeviceHelp')}</p>
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
            {<button type="button" className="bn-backup-hub-button" onClick={restore} disabled={state.syncing || state.localSaving}><ArrowDownToLine size={15} />{t('backupRestoreFromFolder')}</button>}
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
          onRetryPdf={id => backupNow({ notebookIds: [id] })} onNotice={setNotice} onRestoreBackup={chooseRestore} />}
      </div>
      <footer className="bn-backup-hub-footer">
        <div className={'bn-backup-hub-footer-state is-' + (tab === 'local' ? state.status : 'unknown')}>
          {tab === 'local' ? <ShieldCheck size={16} /> : <Cloud size={16} />}<span>{t(tab === 'local' ? backupStateKey(state) : 'driveCloudUnconfirmed')}</span></div>
        <div>{<button type="button" className="bn-backup-hub-button primary bn-backup-btn-sync-now" onClick={() => backupNow()} disabled={state.syncing || loading||recoveryLoading||state.recoveryPaused}>
          <RefreshCw size={15} className={state.syncing ? 'bn-local-save-spinner' : ''} />{t(state.phase === 'pdf' ? 'backupPdfBackground' : state.syncing ? 'backupStateWorking' : 'backupNowAction')}</button>}
          <button type="button" className="bn-backup-hub-button bn-backup-btn-close" onClick={onClose}>{t('close')}</button>
        </div>
      </footer>
    </div>
  </div>;
}
