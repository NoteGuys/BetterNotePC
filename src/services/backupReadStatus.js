// Recovery errors are shown in the selected language; native errors never become raw UI text.
const recoveryErrorKeys = Object.freeze({
  'not-found': 'backupReadNotFound',
  'backup-incomplete': 'backupReadIncomplete',
  'backup-conflict': 'backupReadConflict',
  'backup-changed-during-read': 'backupReadChanged',
  'backup-read-timeout': 'backupReadTimeout',
  'backup-folder-choice-required': 'backupReadChooseFolder',
  'backup-too-large': 'backupReadTooLarge',
  'backup-reader-busy': 'backupReadBusy',
  'invalid-backup-data': 'backupReadInvalid',
  'invalid-backup-manifest': 'backupReadInvalid',
  'unsafe-backup-path': 'backupReadInvalid'
});
export const backupReadErrorKey = reason => Object.hasOwn(recoveryErrorKeys, reason) ? recoveryErrorKeys[reason] : 'backupReadUnavailable';
export async function resolveBackupReadFolder(getSetting, customPath = null) {
  if (customPath !== null && customPath !== undefined) return customPath;
  if (await getSetting('gdrive_backup_method') === 'desktop') {
    const drive = await getSetting('gdrive_backup_path');
    if (typeof drive === 'string' && drive.trim()) return drive.trim();
  }
  const local = await getSetting('local_backup_path');
  return typeof local === 'string' && local.trim() ? local.trim() : null;
}
