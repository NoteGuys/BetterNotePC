import { jsPDF } from 'jspdf';
import { getPagePdfDimensions } from './pdfExportEngine.js';
import { renderExportPageImage } from './exportDocument.js';
const verifyImage = src => new Promise((resolve, reject) => {
  if (!/^data:image\//i.test(src)) { reject(new Error('pdf-backup-image-unavailable')); return; }
  const image = new Image();
  const finish = error => { clearTimeout(timer); image.onload = image.onerror = null; if (error) reject(error); else resolve(); };
  const timer = setTimeout(() => finish(new Error('pdf-backup-image-timeout')), 3000);
  image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0 ? null : new Error('pdf-backup-image-invalid'));
  image.onerror = () => finish(new Error('pdf-backup-image-invalid'));
  image.src = src;
});
const pageKey = (note, page) => JSON.stringify([note.id, page.id, page.updatedAt, page.pageIndex,
  note.templateId, note.paperSize, note.orientation, page.templateId, page.pageWidth, page.pageHeight]);
export const createVerifiedBackupPdfRenderer = ({ maxCacheBytes = 12 * 1024 * 1024,
  maxCachedPages = 8, maxRetainedDocumentBytes = 16 * 1024 * 1024, idleLifetime = 30000,
  dimensions = getPagePdfDimensions, renderImage = renderExportPageImage, validateImage = verifyImage,
  yieldForPage = () => new Promise(resolve => setTimeout(resolve, 30)),
  output = pdf => 'data:application/pdf;base64,' + pdf.output('datauristring').replace(/^data:application\/pdf.*?;base64,/, '') } = {}) => {
  const cache = new Map();
  let bytes = 0, retained = null, cleanupTimer = null;
  const clear = () => { cache.clear(); bytes = 0; retained = null; clearTimeout(cleanupTimer); cleanupTimer = null; };
  const armCleanup = () => { clearTimeout(cleanupTimer); cleanupTimer = setTimeout(clear, idleLifetime); cleanupTimer.unref?.(); };
  const remember = (key, image) => {
    if (image.byteLength > maxCacheBytes) return;
    const old = cache.get(key); if (old) bytes -= old.byteLength;
    cache.delete(key); cache.set(key, image); bytes += image.byteLength;
    while (cache.size > maxCachedPages || bytes > maxCacheBytes) {
      const first = cache.keys().next().value; bytes -= cache.get(first).byteLength; cache.delete(first);
    }
  };
  const render = async (notebook, check = () => {}, { force = false } = {}) => {
    const pages = notebook.pages;
    if (!pages?.length) throw new Error('pdf-backup-empty');
    clearTimeout(cleanupTimer);
    const keys = pages.map(page => pageKey(notebook, page)), key = JSON.stringify(keys);
    const first = dimensions(pages[0], notebook.templateId);
    let session = !force && retained?.key === key ? retained : {
      key, next: 0, bytes: 0,
      pdf: new jsPDF({ orientation: first.orientation, unit: 'pt', format: [first.pdfW, first.pdfH] })
    };
    retained = null;
    try {
      for (let index = session.next; index < pages.length; index++) {
        await yieldForPage({ page: index + 1, totalPages: pages.length });
        check({ page: index + 1, totalPages: pages.length });
        const page = pages[index], dim = dimensions(page, notebook.templateId);
        let image = !force && cache.get(keys[index]);
        if (!image) {
          for (const source of [page.pdfPageImage, ...(page.imageElements || []).map(item => item.src)].filter(Boolean)) {
            check(); await validateImage(source);
          }
          check();
          const { blob } = await renderImage(page, notebook.templateId, dimensions, { format: 'jpeg', dpi: 150 });
          image = new Uint8Array(await blob.arrayBuffer()); remember(keys[index], image);
        }
        check();
        if (index) session.pdf.addPage([dim.pdfW, dim.pdfH], dim.orientation);
        session.pdf.addImage(image, 'JPEG', 0, 0, dim.pdfW, dim.pdfH, undefined, 'FAST');
        session.next = index + 1; session.bytes += image.byteLength;
      }
      check({ page: pages.length, totalPages: pages.length });
      if (session.pdf.getNumberOfPages() !== pages.length) throw new Error('pdf-backup-incomplete');
      return output(session.pdf);
    } catch (error) {
      // Keep one bounded PDF during a short writing pause, never the notebook/media objects.
      if (error.message === 'pdf-backup-deferred' && session.bytes <= maxRetainedDocumentBytes) retained = session;
      throw error;
    } finally { armCleanup(); }
  };
  return { render, clear, getStats: () => ({ cachedPages: cache.size, cachedBytes: bytes,
    retainedPages: retained?.next || 0, retainedDocumentBytes: retained?.bytes || 0 }) };
};
const backupPdfRenderer = createVerifiedBackupPdfRenderer();
export const generateVerifiedBackupPdf = (...args) => backupPdfRenderer.render(...args);
export const clearBackupPdfCache = () => backupPdfRenderer.clear();
export const getBackupPdfCacheStats = () => backupPdfRenderer.getStats();
