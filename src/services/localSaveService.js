import { savePage, getPendingWriteCount, subscribePendingWrites, waitForPendingWrites } from './db.js';
import { notebookHistoryStore } from './notebookHistoryService.js';

// Pending snapshots belong to the app, so switching/unmounting an editor cannot
// discard failed saves. Committed snapshots are released immediately.
export const createPageSaveQueue = (writePage) => {
  const entries = new Map();
  const listeners = new Set();
  let snapshot = Object.freeze({ status: 'saved', pending: 0, failed: 0 });
  const publish = () => {
    const failed = [...entries.values()].filter(entry => entry.error).length;
    snapshot = Object.freeze({
      status: failed ? 'error' : entries.size ? 'saving' : 'saved',
      pending: entries.size,
      failed
    });
    listeners.forEach(listener => listener());
  };
  const settle = (entry, revision, error) => {
    const waiting = entry.waiters;
    entry.waiters = waiting.filter(waiter => waiter.revision > revision);
    waiting.filter(waiter => waiter.revision <= revision).forEach(waiter => {
      if (error) waiter.reject(error);
      else waiter.resolve();
    });
  };
  const run = entry => {
    if (entry.running || entry.error || entries.get(entry.page.id) !== entry) return;
    entry.running = (async () => {
      while (entries.get(entry.page.id) === entry && !entry.error) {
        const page = entry.page;
        const revision = entry.revision;
        try {
          await writePage(page);
          settle(entry, revision);
          if (entry.revision === revision) {
            if (entries.get(page.id) === entry) entries.delete(page.id);
            break;
          }
        } catch (error) {
          entry.error = error || new Error('Page save failed');
          // Retain the newest snapshot, including edits made during this write.
          settle(entry, entry.revision, entry.error);
        }
      }
    })();
    entry.running.then(() => {
      entry.running = null;
      publish();
    });
  };
  const enqueue = page => {
    if (!page?.id || !page.notebookId) return Promise.reject(new Error('Invalid page'));
    let entry = entries.get(page.id);
    if (!entry) {
      entry = { page, revision: 0, waiters: [], running: null, error: null };
      entries.set(page.id, entry);
    }
    entry.page = page;
    entry.revision++;
    const result = new Promise((resolve, reject) => {
      entry.waiters.push({ revision: entry.revision, resolve, reject });
    });
    if (entry.error) settle(entry, entry.revision, entry.error);
    else run(entry);
    publish();
    return result;
  };
  const flush = async notebookId => {
    while (true) {
      const relevant = [...entries.values()].filter(entry => !notebookId || entry.page.notebookId === notebookId);
      const failed = relevant.find(entry => entry.error);
      if (failed) throw failed.error;
      if (!relevant.length) return;
      relevant.forEach(run);
      await Promise.all(relevant.map(entry => entry.running));
    }
  };
  const retry = async notebookId => {
    const relevant = [...entries.values()].filter(entry => !notebookId || entry.page.notebookId === notebookId);
    relevant.forEach(entry => { entry.error = null; run(entry); });
    publish();
    return flush(notebookId);
  };
  const forgetDeletedPage = pageId => {
    const entry = entries.get(pageId);
    if (!entry) return;
    entries.delete(pageId);
    settle(entry, entry.revision, new Error('Page intentionally deleted'));
    publish();
  };
  return {
    enqueue, flush, retry, forgetDeletedPage,
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    overlay: (pages, notebookId) => pages.map(page => {
      const pending = entries.get(page.id)?.page;
      return pending?.notebookId === notebookId
        ? { ...pending, pageIndex: page.pageIndex }
        : page;
    })
  };
};

export const pageSaveQueue = createPageSaveQueue(page =>
  page.__pdfOriginalOmitted
    ? import('./editorPagesService.js').then(({ savePdfOwnerPage }) => savePdfOwnerPage(page))
    : savePage(page, { preservePageIndex: true, requireExisting: true })
);

let localSnapshot;
const localListeners = new Set();
const refreshLocalSnapshot = () => {
  const queued = pageSaveQueue.getSnapshot();
  const writes = getPendingWriteCount();
  const historyOperations = notebookHistoryStore.getPendingOperationCount();
  localSnapshot = Object.freeze({
    ...queued,
    status: queued.failed ? 'error' : queued.pending || writes || historyOperations ? 'saving' : 'saved',
    writes, historyOperations
  });
  localListeners.forEach(listener => listener());
};
pageSaveQueue.subscribe(refreshLocalSnapshot);
subscribePendingWrites(refreshLocalSnapshot);
notebookHistoryStore.subscribeOperations(refreshLocalSnapshot);
refreshLocalSnapshot();

export const getLocalSaveSnapshot = () => localSnapshot;
export const subscribeLocalSaves = listener => {
  localListeners.add(listener);
  return () => localListeners.delete(listener);
};
export const flushLocalSaves = async ({ retry = false } = {}) => {
  // Queued history operations can start their next transaction after the
  // previous one completes. Wait for the whole operation, including that gap.
  do {
    await notebookHistoryStore.waitForPendingOperations();
    if (retry) await pageSaveQueue.retry();
    else await pageSaveQueue.flush();
    await waitForPendingWrites();
  } while (notebookHistoryStore.getPendingOperationCount());
};
