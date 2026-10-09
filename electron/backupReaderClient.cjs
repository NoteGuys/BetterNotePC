const { Worker } = require('node:worker_threads');
const path = require('node:path');
// Lazy, separate reader: a slow Drive read cannot hold the backup writer's queue.
function createBackupReaderClient({ timeoutMs = 180000, maxDurationMs = 0, WorkerClass = Worker, ...config } = {}) {
  let worker = null, counter = 0;
  const pending = new Map(), shared = new Map();
  const stop = (instance, reason) => {
    if (worker !== instance) return;
    worker = null;
    for (const item of pending.values()) {
      clearTimeout(item.timer); clearTimeout(item.limitTimer); item.resolve({ success: false, reason, diagnostics: { elapsedMs: Date.now() - item.startedAt, ...item.lastProgress } });
    }
    pending.clear(); shared.clear();
    return instance.terminate();
  };
  const start = () => {
    const instance = new WorkerClass(path.join(__dirname, 'backupReader.worker.cjs'), { workerData: config });
    worker = instance;
    instance.on('message', ({ requestId, result, progress }) => {
      if (worker !== instance) return;
      const item = pending.get(requestId);
      if (!item) return;
      if (progress) {
        item.lastProgress = progress;
        // A queued check must not terminate a healthy read that is still making progress.
        for (const queued of pending.values()) queued.arm();
        try { item.onProgress?.(progress); } catch (_) {}
        return;
      }
      clearTimeout(item.timer); clearTimeout(item.limitTimer);
      pending.delete(requestId); shared.delete(item.key); item.resolve(result.success ? result : {...result,diagnostics:{elapsedMs:Date.now()-item.startedAt,...item.lastProgress}});
    });
    instance.on('error', () => { stop(instance, 'backup-reader-unavailable'); });
    instance.on('exit', () => { stop(instance, 'backup-reader-unavailable'); });
    instance.unref();
  };
  return {
    execute(command = {}, onProgress) {
      const key = JSON.stringify(command);
      if (shared.has(key)) return shared.get(key);
      if (pending.size >= 2) return Promise.resolve({ success: false, reason: 'backup-reader-busy' });
      try { if (!worker) start(); }
      catch (_) { return Promise.resolve({ success: false, reason: 'backup-reader-unavailable' }); }
      const instance = worker, requestId = ++counter;
      const promise = new Promise(resolve => {
        const item = { resolve, key, onProgress, startedAt: Date.now(), lastProgress: {} };
        item.arm = () => {
          clearTimeout(item.timer);
          item.timer = setTimeout(() => { stop(instance, 'backup-read-timeout'); }, timeoutMs);
        };
        if (maxDurationMs > 0) item.limitTimer = setTimeout(() => { stop(instance, 'backup-read-timeout'); }, maxDurationMs);
        pending.set(requestId, item); item.arm();
        try { instance.postMessage({ requestId, command }); }
        catch (_) { stop(instance, 'backup-reader-unavailable'); }
      });
      if (pending.has(requestId)) shared.set(key, promise);
      return promise;
    },
    async cancel() { if (worker) await stop(worker, 'backup-recovery-cancelled'); },
    async close() { if (worker) await stop(worker, 'backup-reader-unavailable'); }
  };
}
module.exports = { createBackupReaderClient };
