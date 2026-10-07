import { prepareBackup } from '../../electron/backupValidation.js';
import { restoreBackupAtomic } from './db.js';

self.onmessage = async ({ data: { operationId, data, file } }) => {
  try {
    if (file) {
      if (!Number.isFinite(file.size) || file.size <= 0 || file.size > 256 * 1048576) throw Object.assign(new Error(), { code: 'backup-too-large' });
      data = JSON.parse(await file.text());
    }
    const prepared = prepareBackup(data);
    self.postMessage({ phase: 'writing' });
    const result = await restoreBackupAtomic(prepared, operationId);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: (typeof error.code === 'string' ? error.code : null) || (error instanceof SyntaxError ? 'invalid-backup-data' : 'backup-recovery-write-failed') });
  }
};
