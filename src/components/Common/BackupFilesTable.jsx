import React from 'react';
import { FileText, BookOpen, FileCheck, ExternalLink, RefreshCw } from 'lucide-react';
import { useLanguage } from '../../services/i18n';
import { useBackupSnapshot, hasBackupRole, formatBackupSize } from './BackupStatusIndicator';
import { localizeNotebookCopyName } from '../../utils/notebookNames';
const fileName = path => String(path || '').split(/[\\/]/).at(-1) || '';
export const backupRowsFromSnapshot = state => state.targets.flatMap(target => {
  const rows = [];
  const infos = new Map((state.notebooks || []).map(note => [note.id, note]));
  const ids = new Set([...Object.keys(target.notebooks || {}), ...infos.keys()]);
  for (const id of ids) for (const kind of ['editable','pdf']) {
    const note = target.notebooks?.[id], info = infos.get(id), artifact = note?.[kind];
    if (!artifact?.path && !info) continue;
    rows.push({ notebookId: id, notebookName: info?.name || note?.name, kind, revision: artifact?.revision,
      fullPath: artifact?.path ? target.targetDir + '/' + artifact.path : null, fileName: fileName(artifact?.path),
      targetDir: target.targetDir, roles: target.roles || [target.kind],
      fileSizeBytes: artifact?.size || 0, lastModified: artifact?.savedAt, pdfError: note?.pdfError });
  }
  if (target.fullRevision || target.fullSize) rows.push({ notebookId: 'full_system_backup', notebookName: '',
    kind: 'system', revision: target.fullRevision, fullPath: target.targetDir + '/Full_System/BetterNote_Latest_Backup.json',
    fileName: 'BetterNote_Latest_Backup.json', targetDir: target.targetDir, roles: target.roles || [target.kind],
    fileSizeBytes: target.fullSize || 0, lastModified: target.lastDataSuccess || target.lastSuccess });
  return rows;
});
export const BackupFilesTable = ({ rows, role = 'local', search = '', onReveal, onRetryPdf }) => {
  const state = useBackupSnapshot(), { t, language } = useLanguage();
  const locale = { en: 'en-US', th: 'th-TH', zh: 'zh-CN', ru: 'ru-RU' }[language] || 'en-US';
  const shown = rows.filter(row => (row.roles || state.targets.find(target => target.targetDir === row.targetDir)?.roles || ['local']).includes(role))
    .filter(row => ((row.notebookName || '') + ' ' + row.fileName).toLowerCase().includes(search.toLowerCase()));
  return <div className="bn-backup-hub-table-wrap">
    <table className="bn-backup-hub-table">
      <thead><tr><th>{t('backupFileName')}</th><th>{t('backupFileType')}</th><th>{t('backupFileTime')}</th><th>{t('backupFileSize')}</th><th>{t('backupFileState')}</th><th>{t('backupFileOpen')}</th></tr></thead>
      <tbody>{shown.map(row => {
        const target = state.targets.find(item => item.targetDir === row.targetDir);
        const expected = state.revisions?.[row.notebookId];
        const notebookConflict = Object.hasOwn(target?.notebookIssues || {}, row.notebookId) ? target.notebookIssues[row.notebookId] : null;
        const current = !state.localSaving && !state.metadataPending && !target?.fatalError && !notebookConflict && (row.kind === 'system'
          ? !!target?.fullCurrent : !!row.revision && row.revision === expected);
        const issue = row.kind === 'pdf' && !current && !notebookConflict && expected
          ? target?.pdfIssues?.find(item => item.id === row.notebookId) : null;
        const failedPdf = issue && !['pending','pdf-backup-deferred'].includes(issue.error);
        const label = notebookConflict ? row.kind === 'pdf' ? 'backupConflictPdfBlocked' : 'backupConflictFile' : current ? 'backupFileCurrent' : row.legacy ? 'backupFileOld' : issue
          ? failedPdf ? 'backupPdfFailed' : 'backupPdfWaiting' : expected || row.kind === 'system' ? 'backupStatePending' : 'backupFileStored';
        const type = row.kind === 'editable' ? 'backupFileEditable' : row.kind === 'pdf' ? 'backupFilePdf' : 'backupFileFull';
        const Icon = row.kind === 'editable' ? BookOpen : row.kind === 'pdf' ? FileCheck : FileText;
        return <tr key={(row.fullPath || row.targetDir + ':' + row.notebookId) + ':' + row.kind} data-notebook-id={row.notebookId} data-file-kind={row.kind}>
          <td><div className="bn-backup-hub-file-title"><Icon size={17} /><div><strong>{row.kind === 'system' ? t('backupFileFull') : localizeNotebookCopyName(row.notebookName || row.fileName, t('notebookCopySuffix'))}</strong><small>{row.fileName}</small></div></div></td>
          <td>{t(type)}</td>
          <td>{row.lastModified ? new Date(row.lastModified).toLocaleString(locale) : '—'}</td>
          <td className="bn-backup-size-cell">{formatBackupSize(row.fileSizeBytes || 0)}</td>
          <td><span className={'bn-backup-file-state ' + (current ? 'is-current' : failedPdf || notebookConflict ? 'is-error' : 'is-pending')}>{t(label)}</span>
            {failedPdf && <small className="bn-backup-problem">{t(/image/.test(issue.error) ? 'backupPdfProblemImage' : 'backupPdfProblemGeneric')}</small>}
            {issue && onRetryPdf && <button type="button" className="bn-backup-inline-action" disabled={state.syncing} onClick={() => onRetryPdf(row.notebookId)}><RefreshCw size={12} />{t('backupRetryPdf')}</button>}
          </td>
          <td><button type="button" className="bn-backup-inline-action" disabled={!row.fullPath} onClick={() => onReveal?.(row.fullPath)} title={t('backupFileOpen')} aria-label={t('backupFileOpen') + ' ' + row.fileName}><ExternalLink size={14} /></button></td>
        </tr>;
      })}</tbody>
    </table>
    {!shown.length && <div className="bn-backup-hub-empty"><FileText size={24} /><p>{t('backupNoFiles')}</p></div>}
  </div>;
};
