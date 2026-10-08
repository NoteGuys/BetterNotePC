import { seedPagePreviews } from './pagePreviewState.js';

// Read manifests/portable originals off-thread; never clone the original PDF into the editor.
const requestPageData = async (command, { signal } = {}) => {
  if (signal?.aborted) throw Error('Page data cancelled');
  const { default: PagesWorker } = await import('./editorPages.worker.js?worker&inline');
  if (signal?.aborted) throw Error('Page data cancelled');
  const worker = new PagesWorker();
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error, result) => {
      if (finished) return; finished = true;
      clearTimeout(timer); signal?.removeEventListener('abort', cancel); worker.terminate();
      error ? reject(error) : resolve(result);
    };
    const cancel = () => finish(Error('Page data cancelled'));
    const timer = setTimeout(() => finish(Error('Page data timeout')), 60000);
    signal?.addEventListener('abort', cancel, { once: true });
    worker.onmessage = ({ data }) => finish(data.error && Error(data.error), data);
    worker.onerror = event => { event.preventDefault(); finish(Error('Page data unavailable')); };
    try { worker.postMessage(command); } catch (_) { finish(Error('Page data unavailable')); }
  });
};
export const loadPageManifest = async (notebookId, options = {}) => {
  const result = await requestPageData({notebookId,templateId:options.templateId}, options);
  seedPagePreviews(result.previews, notebookId, result.previewEpoch);
  return result.pages;
};
export const loadPdfOwnerPage = async (notebookId, pageId, options) => (await requestPageData({action:'page',notebookId,pageId}, options)).page;
export const exportPortableNotebook = async notebookId => (await requestPageData({action:'bnote',notebookId})).bytes;

export const savePdfOwnerPage = async page => (await requestPageData({action:'save-page',page})).page;
