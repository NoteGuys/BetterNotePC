const { parentPort, workerData } = require('node:worker_threads');
const { createBackupReader } = require('./backupReader.cjs');
const reader = createBackupReader(workerData);
let queue = Promise.resolve();
parentPort.on('message', ({ requestId, command }) => {
  queue = queue.then(async () => {
    try { parentPort.postMessage({ requestId, result: await reader.execute(command) }); }
    catch (_) { parentPort.postMessage({ requestId, result: { success: false, reason: 'backup-read-failed' } }); }
  });
});
