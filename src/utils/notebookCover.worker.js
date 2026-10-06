import { renderNotebookThumbnail } from './notebookThumbnail.js';

self.onmessage = async ({ data }) => {
  try {
    const result = await renderNotebookThumbnail(data.page, data.templateId);
    self.postMessage({ requestId: data.requestId, ...result }, [result.bytes]);
  } catch (_) {
    // Do not return image URLs, note text or other note content in errors.
    self.postMessage({ requestId: data.requestId, error: 'Thumbnail unavailable' });
  }
};
