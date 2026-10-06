import { jsPDF } from 'jspdf';
import { getPagePdfDimensions } from './pdfExportEngine.js';
import { renderExportPageImage } from './exportDocument.js';

// Backup-only PDF generation. Explicit user export behavior is unchanged.
// Decode assets first: a valid PDF containing a silently omitted image is incomplete.
const verifyImage = src => new Promise((resolve, reject) => {
  if (!/^data:image\//i.test(src)) { reject(new Error('pdf-backup-image-unavailable')); return; }
  const image = new Image();
  const finish = error => {
    clearTimeout(timer); image.onload = image.onerror = null;
    if (error) reject(error); else resolve();
  };
  const timer = setTimeout(() => finish(new Error('pdf-backup-image-timeout')), 3000);
  image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0 ? null : new Error('pdf-backup-image-invalid'));
  image.onerror = () => finish(new Error('pdf-backup-image-invalid'));
  image.src = src;
});
export const generateVerifiedBackupPdf = async (notebook, check = () => {}) => {
  const pages = notebook.pages;
  if (!pages?.length) throw new Error('pdf-backup-empty');
  const first = getPagePdfDimensions(pages[0], notebook.templateId);
  const pdf = new jsPDF({ orientation: first.orientation, unit: 'pt', format: [first.pdfW, first.pdfH] });
  for (let index = 0; index < pages.length; index++) {
    await new Promise(resolve => setTimeout(resolve, 30));
    check();
    const page = pages[index];
    for (const source of [page.pdfPageImage, ...(page.imageElements || []).map(image => image.src)].filter(Boolean)) {
      check(); await verifyImage(source);
    }
    check();
    const dim = getPagePdfDimensions(page, notebook.templateId);
    const { blob } = await renderExportPageImage(page, notebook.templateId, getPagePdfDimensions, { format: 'jpeg', dpi: 150 });
    check();
    if (index) pdf.addPage([dim.pdfW, dim.pdfH], dim.orientation);
    pdf.addImage(new Uint8Array(await blob.arrayBuffer()), 'JPEG', 0, 0, dim.pdfW, dim.pdfH, undefined, 'FAST');
  }
  check();
  if (pdf.getNumberOfPages() !== pages.length) throw new Error('pdf-backup-incomplete');
  return 'data:application/pdf;base64,' + pdf.output('datauristring').replace(/^data:application\/pdf.*?;base64,/, '');
};
