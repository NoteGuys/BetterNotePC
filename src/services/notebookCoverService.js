import { getNotebookById, getNotebookThumbnailPage, saveNotebookThumbnail } from './db.js';
import { pageSaveQueue } from './localSaveService.js';
import { notebookHistoryStore } from './notebookHistoryService.js';
import { THUMBNAIL_COVER_ID } from '../data/covers.js';

// Keep IDs while waiting, one worker job at a time, and discard superseded results.
export const createNotebookCoverQueue = ({ load, render, save, onSaved = () => {}, onError = () => {}, delay = 700, canRun = () => true, enabled = true, cancelRender = () => {} }) => {
  const queued = new Map(), failed = new Set();
  let active = null, running = null, timer = null;
  const arm = () => {
    clearTimeout(timer); timer = null;
    if (!enabled || running || !queued.size) return;
    const first = Math.min(...[...queued.values()].map(job => job.readyAt));
    timer = setTimeout(() => { timer = null; void pump(); }, Math.max(canRun() ? 0 : 150, first - Date.now()));
  };
  const pump = (force = false) => {
    if (running) return running;
    const job = [...queued.values()].find(item => force || item.readyAt <= Date.now());
    if (!job || (!force && (!enabled || !canRun()))) { arm(); return Promise.resolve(); }
    clearTimeout(timer); timer = null; queued.delete(job.id); active = job;
    running = Promise.resolve().then(async () => {
      try {
        const isCurrent = () => !job.cancelled;
        const source = await load(job.id, isCurrent);
        if (!source || job.cancelled) return;
        const preview = await render(source, isCurrent);
        if (job.cancelled) return;
        const saved = await save(source, preview, isCurrent);
        if (saved) { failed.delete(job.id); onSaved(saved); }
      } catch (_) { if (!job.cancelled) { failed.add(job.id); onError(job.id); } }
    }).finally(() => { active = null; running = null; arm(); });
    return running;
  };
  return {
    enqueue(id) {
      if (!id) return;
      if (active?.id === id) active.cancelled = true;
      failed.delete(id); queued.set(id, { id, readyAt: Date.now() + delay, cancelled: false }); arm();
    },
    setEnabled(next) {
      next = !!next;
      if (next === enabled) return;
      enabled = next;
      clearTimeout(timer); timer = null;
      if (!enabled && active) {
        active.cancelled = true;
        // Keep only the notebook ID for a later visit to Documents.
        if (!queued.has(active.id)) queued.set(active.id, { id: active.id, readyAt: Date.now() + delay, cancelled: false });
        try { cancelRender(); } catch (_) { /* A cancelled preview must never interrupt editing. */ }
      }
      arm();
    },
    // Explicit flush is for isolated pipeline checks; automatic work obeys visibility.
    async flush() {
      clearTimeout(timer); timer = null;
      while (running || queued.size) { if (running) await running; else await pump(true); }
      return failed.size === 0;
    },
    getSnapshot: () => ({ queued: queued.size, running: active?.id || null, failed: failed.size, paused: !enabled })
  };
};

// Preview scheduling tracks real contacts independently of the editor's pen flags.
// Observers never prevent an event, change ink state, or write page content.
export const createNotebookCoverInputGuard = target => {
  const pressed = new Set();
  let attached = false;
  const handlers = {
    pointerdown: event => pressed.add(event.pointerId),
    pointerup: event => pressed.delete(event.pointerId),
    pointercancel: event => pressed.delete(event.pointerId),
    lostpointercapture: event => pressed.delete(event.pointerId),
    pointermove: event => { if (event.pointerType !== 'touch' && event.buttons === 0) pressed.delete(event.pointerId); },
    blur: () => pressed.clear()
  };
  return {
    start() {
      if (attached || !target) return;
      attached = true;
      for (const [type, listener] of Object.entries(handlers)) target.addEventListener(type, listener, { capture: true, passive: true });
    },
    stop() {
      if (attached) for (const [type, listener] of Object.entries(handlers)) target.removeEventListener(type, listener, { capture: true });
      attached = false; pressed.clear();
    },
    canRun: () => pressed.size === 0
  };
};
const inputGuard = createNotebookCoverInputGuard(typeof window === 'undefined' ? null : window);

let worker = null, requestNumber = 0, cancelWorkerRender = null;
const renderInWorker = async (source, isCurrent) => {
  if (!isCurrent()) throw new Error('Thumbnail cancelled');
  if (!worker) {
    // The bundled Blob worker also loads when Electron opens the app via file://.
    const { default: NotebookCoverWorker } = await import('../utils/notebookCover.worker.js?worker&inline');
    if (!isCurrent()) throw new Error('Thumbnail cancelled');
    worker = new NotebookCoverWorker();
  }
  return new Promise((resolve, reject) => {
    const currentWorker = worker, requestId = ++requestNumber;
    let timer, finished = false;
    const finish = (error, result) => {
      if (finished) return;
      finished = true;
      if (cancelWorkerRender === cancel) cancelWorkerRender = null;
      clearTimeout(timer);
      currentWorker.removeEventListener('message', handleMessage);
      currentWorker.removeEventListener('error', handleError);
      if (error) {
        currentWorker.terminate(); if (worker === currentWorker) worker = null;
        reject(new Error('Thumbnail unavailable'));
      } else resolve(result);
    };
    const cancel = () => finish(true);
    cancelWorkerRender = cancel;
    const handleMessage = event => {
      if (event.data.requestId !== requestId) return;
      finish(event.data.error, event.data);
    };
    const handleError = event => { event.preventDefault(); finish(true); };
    currentWorker.addEventListener('message', handleMessage);
    currentWorker.addEventListener('error', handleError);
    timer = setTimeout(() => finish(true), 10000);
    try { currentWorker.postMessage({ requestId, page: source.page, templateId: source.templateId }); }
    catch (_) { finish(true); }
  });
};

const pngDataUrl = bytes => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Thumbnail unavailable'));
  reader.readAsDataURL(new Blob([bytes], { type: 'image/png' }));
});
const listeners = new Set();
const queue = createNotebookCoverQueue({
  enabled: false,
  canRun: inputGuard.canRun,
  cancelRender: () => cancelWorkerRender?.(),
  async load(id, isCurrent) {
    await notebookHistoryStore.forNotebook(id).wait();
    if (!isCurrent()) return null;
    await pageSaveQueue.flush(id);
    if (!isCurrent()) return null;
    const notebook = await getNotebookById(id);
    if (!isCurrent() || !notebook || notebook.coverId !== THUMBNAIL_COVER_ID) return null;
    const page = await getNotebookThumbnailPage(id);
    if (!page) return null;
    const cached = notebook.firstPageThumbnail;
    if (cached?.dataUrl && cached.pageId === page.id && cached.pageUpdatedAt === page.updatedAt) return null;
    return { notebookId: id, page, templateId: notebook.templateId || 'dotted' };
  },
  render: renderInWorker,
  async save(source, result, isCurrent) {
    const dataUrl = await pngDataUrl(result.bytes);
    if (!isCurrent()) return null;
    return saveNotebookThumbnail(source.notebookId, { dataUrl, width: result.width, height: result.height,
      pageId: source.page.id, pageUpdatedAt: source.page.updatedAt });
  },
  onSaved: notebook => listeners.forEach(listener => listener(notebook)),
  onError: () => console.warn('Could not refresh a notebook thumbnail; the saved note and previous cover have been kept.')
});
// Editing records IDs only: no page fetch, render, encoding or timer polling.
export const queueNotebookCover = id => queue.enqueue(id);
export const setNotebookCoverLibraryVisible = visible => {
  if (visible) inputGuard.start(); else inputGuard.stop();
  queue.setEnabled(visible);
};
export const subscribeNotebookCovers = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const flushNotebookCovers = () => queue.flush();
export const getNotebookCoverQueueSnapshot = () => queue.getSnapshot();
