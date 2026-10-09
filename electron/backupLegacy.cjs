const isLegacySummary = value => value && typeof value === 'object' && !Array.isArray(value) &&
  value.version === undefined && value.notebooks === undefined &&
  Number.isFinite(value.lastSync) && value.lastSync >= 0 && typeof value.backupTarget === 'string' &&
  Number.isInteger(value.activeNotebooksCount) && value.activeNotebooksCount >= 0 &&
  Number.isInteger(value.savedCount) && value.savedCount >= 0 &&
  Object.keys(value).every(key => ['lastSync','backupTarget','activeNotebooksCount','savedCount'].includes(key));
module.exports = { isLegacySummary };
