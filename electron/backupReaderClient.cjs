const { Worker } = require('node:worker_threads');
const path = require('node:path');
// Lazy, separate reader: a slow Drive read cannot hold the backup writer's queue.
function createBackupReaderClient({ timeoutMs = 60000, ...config } = {}) {
  let worker = null, counter = 0;
  const pending = new Map(), shared = new Map();
  const stop = (instance, reason) => {
    if (worker !== instance) return;
    worker = null;
    for (const item of pending.values()) {
      clearTimeout(item.timer); item.resolve({ success: false, reason });
    }
    pending.clear(); shared.clear();
    return instance.terminate();
  };
  const start = () => {
    const instance = new Worker(path.join(__dirname, 'backupReader.worker.cjs'), { workerData: config });
    worker = instance;
    instance.on('message', ({ requestId, result }) => {
      if (worker !== instance) return;
      const item = pending.get(requestId);
      if (!item) return;
      clearTimeout(item.timer); pending.delete(requestId); shared.delete(item.key); item.resolve(result);
    });
    instance.on('error', () => { stop(instance, 'backup-reader-unavailable'); });
    instance.on('exit', () => { stop(instance, 'backup-reader-unavailable'); });
    instance.unref();
  };
  return {
    execute(command = {}) {
      const key = JSON.stringify(command);
      if (shared.has(key)) return shared.get(key);
      if (pending.size >= 2) return Promise.resolve({ success: false, reason: 'backup-reader-busy' });
      try { if (!worker) start(); }
      catch (_) { return Promise.resolve({ success: false, reason: 'backup-reader-unavailable' }); }
      const instance = worker, requestId = ++counter;
      const promise = new Promise(resolve => {
        const timer = setTimeout(() => { stop(instance, 'backup-read-timeout'); }, timeoutMs);
        pending.set(requestId, { resolve, timer, key });
        try { instance.postMessage({ requestId, command }); }
        catch (_) { stop(instance, 'backup-reader-unavailable'); }
      });
      if (pending.has(requestId)) shared.set(key, promise);
      return promise;
    },
    async close() { if (worker) await stop(worker, 'backup-reader-unavailable'); }
  };
}
module.exports = { createBackupReaderClient };
