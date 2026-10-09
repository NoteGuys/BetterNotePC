import React, { useSyncExternalStore } from 'react';
import { ShieldCheck, LoaderCircle, AlertCircle, Clock3, HardDrive } from 'lucide-react';
import { autoBackupService } from '../../services/autoBackupService';
import { useLanguage } from '../../services/i18n';
import { localizeNotebookCopyName } from '../../utils/notebookNames';
export const useBackupSnapshot = () => useSyncExternalStore(autoBackupService.subscribeStatus, autoBackupService.getSnapshot, autoBackupService.getSnapshot);
export const hasBackupRole = (target, role) => (target.roles || [target.kind]).includes(role);
export const backupStateKey = state => state.status === 'current' ? 'backupLocalCurrent'
  : 'backupState' + state.status.charAt(0).toUpperCase() + state.status.slice(1);
export const BackupStatusIndicator = ({ onClick, compact = false }) => {
  const actual=useBackupSnapshot(),{t}=useLanguage();
  const state=actual.status==='current'&&actual.hasDriveFolder&&!actual.allDestinationsCurrent?{...actual,status:actual.syncing?'working':'partial'}:actual;
  const Icon = state.status === 'working' ? LoaderCircle : state.status === 'current' ? ShieldCheck
    : ['partial', 'error'].includes(state.status) ? AlertCircle : Clock3;
  return <button type="button" className={'bn-backup-indicator bn-backup-indicator-' + state.status + (compact ? ' is-compact' : '')}
    data-backup-state={state.status} onClick={onClick}
    title={t('backupHubTitle') + ' · ' + t(backupStateKey(state))}
    aria-label={t('backupHubTitle') + '. ' + t(backupStateKey(state))}>
    <Icon size={14} className={state.status === 'working' ? 'bn-local-save-spinner' : ''} />
    <span role="status" aria-live="polite">{t(backupStateKey(state))}</span>
  </button>;
};
export const backupProblemKey = error => /timeout|busy|ENOENT|ENOTDIR|EACCES|EPERM|unavailable|ENOSPC|EROFS/.test(error || '') ? 'backupProblemDestination'
  : /newer|externally|conflicting/.test(error || '') ? 'backupProblemNewer'
  : /invalid|mismatch|verification/.test(error || '') ? 'backupProblemDamaged' : 'backupProblemGeneric';
export const formatBackupSize = bytes => bytes >= 1073741824 ? (bytes / 1073741824).toFixed(1) + ' GB'
  : bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : (bytes / 1024).toFixed(1) + ' KB';
export const BackupDestinationSummary = ({ role = 'local' }) => {
  const state = useBackupSnapshot(), { t, language } = useLanguage();
  const locale = { en: 'en-US', th: 'th-TH', zh: 'zh-CN', ru: 'ru-RU' }[language] || 'en-US';
  const targets = state.targets.filter(target => hasBackupRole(target, role));
  return <section className="bn-backup-destination-summary" aria-label={t(role === 'local' ? 'backupLocalTab' : 'driveDesktopPreparationTitle')}>
    {!targets.length && <p>{t(role === 'local' ? 'backupStateUnknown' : 'driveFolderNotSelected')}</p>}
    {targets.map(target => <div className={'bn-backup-destination ' + (target.dataCurrent ? 'is-current' : 'is-pending')} key={target.targetDir}>
      <div className="bn-backup-destination-heading"><HardDrive size={16} />
        <strong>{t(role === 'local' ? 'backupRecoveryData' : 'driveDesktopPreparationTitle')}</strong>
        <span>{t(target.dataCurrent ? 'backupLocalCurrent' : target.error ? 'backupStateError' : 'backupStatePending')}</span>
      </div>
      <div className="bn-backup-destination-counts">
        <span>{t('backupEditableLabel')}: {target.editableCount}/{target.totalNotebooks}</span>
        <span>{t('backupFullLabel')}: {t(target.fullCurrent ? 'backupFileCurrent' : 'backupStatePending')}</span>
      </div>
      <div className="bn-backup-pdf-line" data-pdf-state={target.pdfCurrent ? 'current' : target.pdfIssues.some(issue => !['pending','pdf-backup-deferred'].includes(issue.error)) ? 'error' : 'pending'}>
        <strong>{t('backupPdfCopies')}: {target.pdfCount}/{target.totalNotebooks}</strong>
        <span>{t(target.pdfCurrent ? 'backupFileCurrent' : state.pdfStatus === 'working' ? 'backupPdfBackground' : 'backupPdfWaiting')}</span>
      </div>
      {target.dataCurrent && !target.pdfCurrent && <p>{t('backupDataCompletePdfPending')}</p>}
      <small>{t('backupLastDataBackup')}: {target.lastDataSuccess || target.lastSuccess
        ? new Date(target.lastDataSuccess || target.lastSuccess).toLocaleString(locale) : t(target.dataCurrent ? 'backupCompletionTimeUnknown' : 'backupNever')}</small>
      {Object.keys(target.notebookIssues || {}).length > 0 && <div className="bn-backup-notebook-issues" role="status">
        <strong>{t('backupConflictTitle')}</strong>
        <ul>{Object.values(target.notebookIssues).map(issue => <li key={issue.id} data-backup-conflict-id={issue.id}>
          <strong>{localizeNotebookCopyName(issue.name || issue.id, t('notebookCopySuffix'))}</strong>
          <p>{t(issue.error === 'newer-backup-exists' ? 'backupConflictNewer' : 'backupConflictEqual')}</p>
          <small>{t('backupConflictHereTime')}: {issue.incomingUpdatedAt
            ? new Date(issue.incomingUpdatedAt).toLocaleString(locale) : t('backupCompletionTimeUnknown')}</small>
          <small>{t('backupConflictFolderTime')}: {issue.backupUpdatedAt
            ? new Date(issue.backupUpdatedAt).toLocaleString(locale) : t('backupCompletionTimeUnknown')}</small>
        </li>)}</ul>
        <p>{t('backupConflictHelp')}</p>
      </div>}
      {(target.fatalError || target.error && !Object.keys(target.notebookIssues || {}).length) && <p className="bn-backup-problem" role="status">{t(backupProblemKey(target.fatalError || target.error))}</p>}
    </div>)}
    {state.error && role === 'local' && !targets.some(target => target.error) && <p className="bn-backup-problem">{t(backupProblemKey(state.error))}</p>}
  </section>;
};
const stageKey = stage => ({
  'waiting-for-save': 'backupProgressWaitingSave', checking: 'backupProgressChecking', 'saving-data': 'backupProgressSavingData',
  'saving-snapshot': 'backupProgressSavingFull', verifying: 'backupProgressVerifying', 'keeping-version': 'backupProgressKeepingVersion'
})[stage] || 'backupProgressSavingData';
export const BackupProgress = ({ role = 'local' }) => {
  const state = useBackupSnapshot(), { t } = useLanguage();
  const scoped = state.targets.filter(target => hasBackupRole(target, role));
  if (!state.syncing || role === 'drive' && (!scoped.length || scoped.every(target => state.phase === 'pdf' ? target.pdfCurrent : target.dataCurrent))) return null;
  const data = state.progress, pdf = state.pdfProgress;
  const io = data.io, isPdf = state.phase === 'pdf';
  const percent = isPdf ? pdf.total ? Math.min(100,Math.round((pdf.done+(!pdf.currentCompleted&&pdf.totalPages?pdf.page/pdf.totalPages:0)) / pdf.total * 100)) : 100
    : data.stage === 'data-complete' ? 100 : data.total ? Math.min(90, Math.round(data.done / data.total * 90)) : 0;
  return <div className="bn-backup-progress" role="status" aria-live="polite" data-backup-phase={state.phase}>
    <div><LoaderCircle size={15} className="bn-local-save-spinner" /><strong>{t(role === 'drive' ? 'driveDesktopPreparationTitle' : isPdf ? 'backupPdfBackground' : stageKey(data.stage))}</strong></div>
    <progress max="100" value={percent} aria-label={t(isPdf ? 'backupPdfCopies' : 'backupRecoveryData')} />
    <span>{isPdf && pdf.name ? t('backupPdfProgress', '', { name: pdf.name, page: pdf.page, totalPages: pdf.totalPages })
      : t('backupProgressCount', '', { done: data.done || 0, total: data.total || 0 })}</span>
    {isPdf && pdf.rendered!==undefined && <small>{t('backupPdfReuseProgress','',{reused:pdf.reused||0,rendered:pdf.rendered||0})}</small>}
    {!isPdf && io?.totalBytes > 0 && <small>{t(stageKey(io.stage))} {formatBackupSize(io.bytesDone)}/{formatBackupSize(io.totalBytes)}</small>}
  </div>;
};
