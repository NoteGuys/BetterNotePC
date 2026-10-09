import { appCacheService } from './appCacheService.js';
import { pageSaveQueue } from './localSaveService.js';
import { createNotebookCoverInputGuard } from './notebookCoverService.js';
import { pageSummary } from '../utils/pageWindow.js';
import { clearPagePreviewStorage } from './pagePreviewStorage.js';
import { cachedPagePreview, pagePreviewRevision, rememberPagePreview, previewKey, pagePreviewEpoch } from './pagePreviewState.js';

const pending = new Map(), identities = new WeakMap(), needsSave = new Map();
let identity = 0, worker, active, timer, idleTimer, generation = 0;
const guard = createNotebookCoverInputGuard(typeof window === 'undefined' ? null : window);
const versionOf = page => page.__unloaded ? 'stored:' + page.updatedAt : (() => {
  if (!identities.has(page)) identities.set(page, ++identity);
  return identities.get(page);
})();
const stopWorker = () => { worker?.terminate(); worker = null; };
const schedule = (delay = 0) => {
  clearTimeout(timer); clearTimeout(idleTimer);
  if (active) return;
  if (!pending.size) { guard.stop(); idleTimer = setTimeout(stopWorker, 1500); return; }
  timer = setTimeout(pump, delay);
};
const pump = async () => {
  if (active || !pending.size) return;
  if (!guard.canRun() || globalThis.window?.__bn_pen_active || globalThis.window?.__bn_drag_active || globalThis.document?.hidden) { schedule(100); return; }
  const job = [...pending.values()].find(item => item.priority === 0) || pending.values().next().value;
  pending.delete(job.key); active = job;
  const epoch = generation;
  try {
    if (!worker) {
      const { default: PreviewWorker } = await import('../utils/notebookCover.worker.js?worker&inline');
      if (epoch !== generation || !job.listeners.size) return;
      worker = new PreviewWorker();
    }
    const source = pageSaveQueue.overlay([job.page], job.page.notebookId)[0];
    const persisted = source === job.page;
    const result = await new Promise((resolve, reject) => {
      const current = worker;
      let finished = false;
      const finish = (error, data) => {
        if (finished) return; finished = true;
        clearTimeout(timeout); current.onmessage = current.onerror = null;
        job.cancel = null; error ? reject(error) : resolve(data);
      };
      const timeout = setTimeout(() => finish(Error('Preview timeout')), 15000);
      job.cancel = () => finish(Error('Preview cancelled'));
      current.onerror = event => { event.preventDefault(); finish(Error('Preview unavailable')); };
      current.onmessage = event => event.data.error ? finish(Error('Preview unavailable')) : finish(null, event.data);
      try { current.postMessage({ page: persisted ? pageSummary(source) : source, templateId: job.templateId, cachePreview: { persist: persisted, epoch: pagePreviewEpoch(job.page.notebookId) } }); }
      catch (_) { finish(Error('Preview unavailable')); }
    });
    if (epoch !== generation || !job.listeners.size) return;
    rememberPagePreview(result.preview, job.version);
    job.listeners.forEach(listener => listener(result.preview.dataUrl));
    if (!persisted) needsSave.set(job.key, { page: pageSummary(source), templateId: job.templateId });
  } catch (_) { stopWorker(); }
  finally { if (active === job) active = null; schedule(); flushSavedPreviews(); }
};
const flushSavedPreviews = () => {
  if (pageSaveQueue.getSnapshot().pending) return;
  for (const [key, entry] of needsSave) {
    needsSave.delete(key);
    // Re-render from the committed row once, not on every sampled pen point.
    requestPagePreview(entry.page, entry.templateId, () => {}, 1, true);
  }
};
pageSaveQueue.subscribe(flushSavedPreviews);
appCacheService.subscribeClear(() => {
  generation++; clearTimeout(timer); clearTimeout(idleTimer);
  pending.clear(); needsSave.clear(); active?.cancel?.(); stopWorker(); guard.stop();
  void clearPagePreviewStorage();
});
export { cachedPagePreview };
export const requestPagePreview = (page, templateId, listener, priority = 0, force = false) => {
  const key = previewKey(page, templateId), version = versionOf(page);
  const cached = cachedPagePreview(page, templateId), revision = pagePreviewRevision(key);
  if (cached) listener(cached);
  if (!force && cached && revision && revision.updatedAt === (page.updatedAt || 0) &&
      (page.__unloaded || revision.version === version)) return () => {};
  let job = active?.key === key && active.version === version ? active : pending.get(key);
  if (job && job.version !== version) job = null;
  if (!job) {
    job = { key, version, page, templateId, priority, listeners: new Set() };
    pending.set(key, job);
  } else job.priority = Math.min(job.priority, priority);
  job.listeners.add(listener); guard.start(); schedule();
  return () => {
    job.listeners.delete(listener);
    if (!job.listeners.size) {
      if (pending.get(key) === job) pending.delete(key);
      // Let an immediate remount/reconciliation reuse the same in-flight job.
      setTimeout(() => {
        if (active === job && !job.listeners.size) { job.cancel?.(); stopWorker(); }
        schedule();
      }, 0);
    }
  };
};

// One session per open editor; retain tiny previews while individual cards unmount.
export const createPagePreviewSession = () => {
  const entries = new Map();
  let latest = [], template, disposed = false;
  const update = (pages, templateId) => {
    if (disposed) return;
    latest = pages; template = templateId;
    const wanted = new Set();
    for (const page of pages) {
      const key = previewKey(page, templateId), version = versionOf(page); wanted.add(key);
      if (entries.get(key)?.version === version) continue;
      entries.get(key)?.stop();
      entries.set(key, { version, stop: requestPagePreview(page, templateId, () => {}, 1) });
    }
    for (const [key, entry] of entries) if (!wanted.has(key)) { entry.stop(); entries.delete(key); }
  };
  const clear = appCacheService.subscribeClear(() => {
    for (const entry of entries.values()) entry.stop();
    entries.clear(); update(latest, template);
  });
  return { update, dispose() { disposed = true; clear(); for (const entry of entries.values()) entry.stop(); entries.clear(); } };
};
