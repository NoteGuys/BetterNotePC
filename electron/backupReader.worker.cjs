const { parentPort, workerData } = require('node:worker_threads');
const { createBackupReader } = require('./backupReader.cjs');
let activeRequest = null, lastProgress = 0;
const reader = createBackupReader({ ...workerData, onProgress: progress => {
  if (activeRequest === null) return;
  const now = Date.now();
  if (progress.bytesDone < progress.totalBytes && now - lastProgress < 250) return;
  lastProgress = now; parentPort.postMessage({ requestId: activeRequest, progress });
} });
let queue = Promise.resolve();
parentPort.on('message', ({ requestId, command }) => {
  queue = queue.then(async () => {
    activeRequest = requestId; lastProgress = 0;
    try {
      const result = await reader.execute(command);
      parentPort.postMessage({ requestId, result }, result.encoded instanceof Uint8Array ? [result.encoded.buffer] : []);
    }
    catch (_) { parentPort.postMessage({ requestId, result: { success: false, reason: 'backup-read-failed' } }); }
    finally { activeRequest = null; }
  });
});
