import { openDB, getPage, savePage, getSetting, getBackupNotebookSnapshot } from './db.js';
import { pageSummary } from '../utils/pageWindow.js';
import { decodeBnote } from '../../electron/bnoteFormat.js';
import { readPagePreviews } from './pagePreviewStorage.js';
self.onmessage = async ({ data }) => {
  try {
    if (data.action === 'save-page') {
      const saved = await savePage(data.page, { preservePageIndex: true, requireExisting: true });
      const { pdfOriginal, ...page } = saved;
      self.postMessage({ page: { ...page, ...(pdfOriginal ? { __pdfOriginalOmitted: true } : {}) } });
      return;
    }
    if (data.action === 'page') {
      const stored = await getPage(data.pageId);
      if (!stored || stored.notebookId !== data.notebookId) throw Error('Page unavailable');
      const { pdfOriginal, ...page } = stored;
      self.postMessage({ page: { ...page, ...(pdfOriginal ? { __pdfOriginalOmitted: true } : {}) } });
      return;
    }
    if (data.action === 'bnote') {
      const snapshot = await getBackupNotebookSnapshot(data.notebookId);
      if (!snapshot) throw Error('Notebook unavailable');
      const { pages, ...notebook } = snapshot;
      const bytes = new TextEncoder().encode(JSON.stringify({format:'BetterNote_Document',version:1,exportedAt:new Date().toISOString(),notebook,pages})).buffer;
      decodeBnote(new Uint8Array(bytes));
      self.postMessage({ bytes }, [bytes]); return;
    }
    const db = await openDB();
    const pages = await new Promise((resolve, reject) => {
      const tx = db.transaction('pages', 'readonly'), results = [];
      const request = tx.objectStore('pages').index('notebookId').openCursor(data.notebookId);
      request.onsuccess = () => { const cursor = request.result; if (cursor) { results.push(pageSummary(cursor.value)); cursor.continue(); } };
      tx.oncomplete = () => resolve(results.sort((a,b) => a.pageIndex-b.pageIndex));
      tx.onerror = tx.onabort = () => reject(Error('Page list unavailable'));
    });
    const receipt = await getSetting('backup_recovery_receipt');
    const previewEpoch = receipt?.operationId || '';
    const previews = await readPagePreviews(data.notebookId, pages, data.templateId, previewEpoch);
    self.postMessage({ pages, previews, previewEpoch });
  } catch (error) { self.postMessage({ error: error.code || 'Page data unavailable' }); }
};
