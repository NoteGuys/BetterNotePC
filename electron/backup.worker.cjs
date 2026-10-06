const { parentPort, workerData } = require('node:worker_threads');
const { createBackupWriter } = require('./backupWriter.cjs');
const writer = createBackupWriter(workerData);
parentPort.on('message', async ({ requestId, command }) => {
  try { parentPort.postMessage({ requestId, result: await writer.execute(command) }); }
  catch (error) { parentPort.postMessage({ requestId, result: { success: false, reason: error.code || 'backup-worker-failed' } }); }
});
