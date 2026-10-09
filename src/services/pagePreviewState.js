import { appCacheService } from './appCacheService.js';
import { pagePreviewKey } from './pagePreviewStorage.js';
const revisions = new Map(), epochs = new Map();
export const pagePreviewEpoch = notebookId => epochs.get(notebookId) || '';
export const previewKey = (page, templateId) => pagePreviewKey(page, templateId, pagePreviewEpoch(page.notebookId));
export const cachedPagePreview = (page, templateId) => {
  const cached = appCacheService.get(previewKey(page, templateId));
  if (cached) return cached;
  const thumbnail = page.thumbnailUrl;
  return typeof thumbnail === 'string' && thumbnail.length <= 256 * 1024 && /^data:image\/(png|jpeg|webp);base64,/i.test(thumbnail) ? thumbnail : null;
};
export const pagePreviewRevision = key => revisions.get(key);
export const rememberPagePreview = (record, version) => {
  if (!record?.dataUrl || !appCacheService.set(record.id, record.dataUrl, 'thumbnail')) return;
  revisions.delete(record.id); revisions.set(record.id, { updatedAt: record.updatedAt, version });
  while (revisions.size > 2048) revisions.delete(revisions.keys().next().value);
};
export const seedPagePreviews = (records, notebookId, epoch = '') => {
  if (pagePreviewEpoch(notebookId) !== epoch) appCacheService.invalidate('page-preview:[' + JSON.stringify(notebookId) + ',');
  epochs.set(notebookId, epoch);
  records?.forEach(record => rememberPagePreview(record));
};
appCacheService.subscribeClear(() => revisions.clear());
