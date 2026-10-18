import { openDB, getPage, savePage, getSetting } from './db.js';
import { pageSummary } from '../utils/pageWindow.js';
import {prepareNotebookBlob} from './notebookBlob.js';
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
    if(data.action==='bnote'){
      const {blob}=await prepareNotebookBlob(data.notebookId,{portable:true});
      self.postMessage({blob});return;
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
  } catch(error){
    const bnoteError=data.action==='bnote' && (error.message==='backup-too-large'?'bnote-too-large':error.code==='backup-incomplete'?'bnote-incomplete':error.code==='invalid-backup-data'?'bnote-invalid':null);
    self.postMessage({error:bnoteError||error.code||'Page data unavailable'});
  }
};
