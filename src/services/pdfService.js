// PDF Service for BetterNote with High-DPI Rendering & Performance Optimization
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { saveNotebook, savePage } from './db';

// Setup worker with local offline bundle
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

/**
 * Load PDF Document from an ArrayBuffer or File
 */
export const loadPdfFromFile = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  return { pdfDoc, arrayBuffer };
};

/**
 * Render a specific PDF page to a crisp high-DPI image data URL and a fast thumbnail
 */
export const renderPageToImage = async (pdfDoc, pageNum, scale = 2.0) => {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  const rasterScale = Math.min(1, Math.sqrt(16 * 1024 * 1024 / (viewport.width * viewport.height)), 16384 / viewport.width, 16384 / viewport.height);
  canvas.width = Math.max(1, Math.floor(viewport.width * rasterScale));
  canvas.height = Math.max(1, Math.floor(viewport.height * rasterScale));
  let thumbCanvas;
  try {
    // Fill white background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      transform: rasterScale === 1 ? undefined : [rasterScale, 0, 0, rasterScale, 0, 0]
    };

    await page.render(renderContext).promise;

    // Main high-res page image (optimized 0.82 JPEG for fast loading and low memory)
    const dataUrl = await canvasDataUrl(canvas, 'image/jpeg', 0.82);

    // Fast lightweight thumbnail (~15KB) for instant sidebar rendering without freezing
    let thumbnailUrl = '';
    try {
      thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = Math.max(1, Math.round(viewport.width * Math.min(1, 320 / viewport.width, 320 / viewport.height)));
      thumbCanvas.height = Math.max(1, Math.round(viewport.height * Math.min(1, 320 / viewport.width, 320 / viewport.height)));
      const thumbCtx = thumbCanvas.getContext('2d', { alpha: false });
      thumbCtx.fillStyle = '#ffffff';
      thumbCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
      thumbCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
      thumbnailUrl = await canvasDataUrl(thumbCanvas, 'image/jpeg', 0.7);
      thumbCanvas.width = thumbCanvas.height = 1;
    } catch (_) {
      thumbnailUrl = dataUrl;
    }

    return {
      dataUrl,
      thumbnailUrl,
      width: viewport.width,
      height: viewport.height,
      aspectRatio: viewport.width / viewport.height
    };
  } finally { canvas.width = canvas.height = 1; if (thumbCanvas) thumbCanvas.width = thumbCanvas.height = 1; page.cleanup(); }
};

/**
 * Import full PDF file into BetterNote database with cooperative multitasking
 */
export const importPdfAsNotebook = async (file, folderId = null, onProgress = null) => {
  const originalDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
  });
  const { pdfDoc } = await loadPdfFromFile(file);
  const numPages = pdfDoc.numPages;
  try {
    const notebookId = `nb-pdf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const notebookName = file.name.replace(/\.[^/.]+$/, "");

    // Create notebook record
    const notebook = {
      id: notebookId,
      name: notebookName,
      folderId: folderId,
      coverId: 'nordic-slate',
      templateId: 'blank',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pageCount: numPages,
      isPdf: true,
      pdfName: file.name
    };

    const savedNotebook = await saveNotebook(notebook, { ensureUniqueName: true });

    const originalId = notebookId + ':pdf';
    // Render and save each page with optimized resolution and non-blocking event loop yield
    for (let i = 1; i <= numPages; i++) {
      if (onProgress) {
        onProgress(i, numPages);
      }

      // Cooperative yield to keep UI responsive and prevent "Not Responding"
      await new Promise(resolve => setTimeout(resolve, 0));

      const { dataUrl, thumbnailUrl, width, height } = await renderPageToImage(pdfDoc, i, 2.0);

      const pageRecord = {
        id: `${notebookId}_page_${i - 1}`,
        notebookId: notebookId,
        pageIndex: i - 1,
        templateId: 'blank',
        pdfPageImage: dataUrl,
        pdfOriginalId: originalId, pdfPageNumber: i,
        ...(i === 1 ? { pdfOriginal: { id: originalId, name: file.name, dataUrl: originalDataUrl } } : {}),
        thumbnailUrl: thumbnailUrl,
        pageWidth: width,
        pageHeight: height,
        strokes: [],
        textElements: [],
        updatedAt: Date.now()
      };

      await savePage(pageRecord);
    }

    return savedNotebook;
  } finally { await pdfDoc.destroy(); }
};

const canvasDataUrl = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob(blob => {
    if (!blob) { reject(Error('PDF image unavailable')); return; }
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
  }, type, quality);
});
