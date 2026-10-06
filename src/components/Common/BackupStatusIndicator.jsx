import React, { useSyncExternalStore } from 'react';
import { ShieldCheck, LoaderCircle, AlertCircle, Clock3, HardDrive } from 'lucide-react';
import { autoBackupService } from '../../services/autoBackupService';
import { useLanguage } from '../../services/i18n';
export const useBackupSnapshot = () => useSyncExternalStore(autoBackupService.subscribeStatus, autoBackupService.getSnapshot, autoBackupService.getSnapshot);
export const backupStateKey = state => state.status === 'current'
  ? state.hasDriveFolder ? 'backupDriveFolderCurrent' : 'backupFolderCurrent'
  : 'backupState' + state.status.charAt(0).toUpperCase() + state.status.slice(1);
export const BackupStatusIndicator = ({ onClick, compact = false }) => {
  const state = useBackupSnapshot(), { t } = useLanguage();
  const Icon = state.status === 'working' ? LoaderCircle : state.status === 'current' ? ShieldCheck
    : ['partial','error'].includes(state.status) ? AlertCircle : Clock3;
  return <button type="button" className={'bn-backup-indicator bn-backup-indicator-' + state.status + (compact ? ' is-compact' : '')}
    data-backup-state={state.status} onClick={onClick} title={t('backupStatusHint')}
    aria-label={t(backupStateKey(state)) + '. ' + t('backupOpenDetails')}>
    <Icon size={14} className={state.syncing ? 'bn-local-save-spinner' : ''} />
    <span role="status" aria-live="polite">{t(backupStateKey(state))}</span>
  </button>;
};
const problemKey = error => /timeout|ENOENT|ENOTDIR|EACCES|EPERM|unavailable|ENOSPC|EROFS/.test(error || '') ? 'backupProblemDestination'
  : /newer|externally|conflicting/.test(error || '') ? 'backupProblemNewer'
  : /invalid|mismatch|verification/.test(error || '') ? 'backupProblemDamaged' : 'backupProblemGeneric';
export const BackupDestinationSummary = () => {
  const state = useBackupSnapshot(), { t, language } = useLanguage();
  const locale = { en:'en-US', th:'th-TH', zh:'zh-CN', ru:'ru-RU' }[language] || 'en-US';
  return <section className="bn-backup-destination-summary" aria-label={t('backupDestinations')}>
    <div className="bn-backup-summary-heading"><ShieldCheck size={16} /><strong>{t(backupStateKey(state))}</strong></div>
    <p>{t('backupFolderOnlyHint')}</p>
    {!state.targets.length && <p>{t('backupStateUnknown')}</p>}
    {state.targets.map(target => <div className={'bn-backup-destination ' + (target.current ? 'is-current' : 'is-pending')} key={target.targetDir}>
      <div className="bn-backup-destination-heading"><HardDrive size={15} /><strong>{t(target.kind === 'drive' ? 'backupTargetDrive' : target.kind === 'local' ? 'backupTargetLocal' : 'backupTargetSelected')}</strong>
        <span>{t(target.current ? 'backupVersionCurrent' : target.error ? 'backupStateError' : 'backupStatePending')}</span></div>
      <div className="bn-backup-destination-path" title={target.targetDir}>{target.targetDir}</div>
      <div className="bn-backup-destination-counts">
        <span>{t('backupEditableLabel')}: {target.editableCount}/{target.totalNotebooks}</span>
        <span>{t('backupPdfLabel')}: {target.pdfCount}/{target.totalNotebooks}</span>
        <span>{t('backupFullLabel')}: {t(target.fullCurrent ? 'backupVersionCurrent' : 'backupStatePending')}</span>
      </div>
      <small>{t('backupLastCompleted')}: {target.lastSuccess ? new Date(target.lastSuccess).toLocaleString(locale) : t('backupNever')}</small>
      {target.error && <p className="bn-backup-problem" role="status">{t(problemKey(target.error))}</p>}
    </div>)}
    {state.error && !state.targets.some(t => t.error) && <p className="bn-backup-problem">{t(problemKey(state.error))}</p>}
  </section>;
};
