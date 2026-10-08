import { renderNotebookThumbnail } from './notebookThumbnail.js';
import { getPage } from '../services/db.js';
import { pagePreviewKey, writePagePreview } from '../services/pagePreviewStorage.js';

const pngUrl = bytes => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result); reader.onerror = reject;
  reader.readAsDataURL(new Blob([bytes], { type: 'image/png' }));
});
self.onmessage = async ({ data }) => {
  try {
    const fromStorage = data.page?.__unloaded || data.cachePreview?.persist;
    const page = fromStorage ? await getPage(data.page.id) : data.page;
    if (!page || (fromStorage && page.updatedAt < data.page.updatedAt)) throw Error('Stale preview');
    const result = await renderNotebookThumbnail(page, data.templateId);
    let preview;
    if (data.cachePreview) {
      preview = { id: pagePreviewKey(page, data.templateId, data.cachePreview.epoch), notebookId: page.notebookId, pageId: page.id,
        updatedAt: page.updatedAt || 0, dataUrl: await pngUrl(result.bytes) };
      if (data.cachePreview.persist) await writePagePreview(preview);
    }
    self.postMessage({ requestId: data.requestId, ...result, preview }, [result.bytes]);
  } catch (_) {
    // Never return note text, source URLs or other editable content in errors.
    self.postMessage({ requestId: data.requestId, error: 'Thumbnail unavailable' });
  }
};
