const { Worker } = require('node:worker_threads');
const path = require('node:path');
// Lazy worker; importing this module never reads or creates a backup folder.
const createBackupWorkerClient = config => {
  let worker;
  const pending = new Map();
  let counter = 0;
  const start = () => {
    worker = new Worker(path.join(__dirname, 'backup.worker.cjs'), { workerData: config });
    const instance = worker;
    worker.on('message', ({ requestId, result, progress }) => {
      const item = pending.get(requestId);
      if (!item) return;
      if (progress) { item.arm(); try { item.onProgress?.(progress); } catch (_) {} return; }
      clearTimeout(item.timer); pending.delete(requestId); item.resolve(result);
    });
    const failed = () => { if (worker !== instance) return; for (const item of pending.values()) { clearTimeout(item.timer); item.resolve({ success: false, reason: 'backup-worker-unavailable' }); } pending.clear(); worker = null; };
    worker.on('error', failed);
    worker.on('exit', failed);
    worker.unref();
  };
  return {
    execute: (command, onProgress) => {
      if (!worker) start();
      return new Promise(resolve => {
        const requestId = ++counter, item = { resolve, onProgress };
        item.arm = () => {
          clearTimeout(item.timer);
          item.timer = setTimeout(() => { pending.delete(requestId); resolve({ success: false, reason: 'backup-worker-timeout' }); }, 120000);
        };
        item.arm(); pending.set(requestId, item);
        try { worker.postMessage({ requestId, command }, [command.notebookEncoded, command.pdfBytes].filter(value => value instanceof ArrayBuffer)); }
        catch (_) { clearTimeout(item.timer); pending.delete(requestId); resolve({ success: false, reason: 'backup-worker-unavailable' }); }
      });
    },
    close: async () => {
      const instance = worker;
      if (!instance) return;
      for (const item of pending.values()) { clearTimeout(item.timer); item.resolve({ success: false, reason: 'backup-worker-unavailable' }); }
      pending.clear(); worker = null;
      await instance.terminate();
    }
  };
};
module.exports = { createBackupWorkerClient };
