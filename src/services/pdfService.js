// PDF Service for BetterNote with High-DPI Rendering & Performance Optimization
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { saveNotebook, savePage } from './db';

// Setup worker with local offline bundle
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker || `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
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
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  // Fill white background
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: context,
    viewport: viewport
  };

  await page.render(renderContext).promise;

  // Main high-res page image (optimized 0.82 JPEG for fast loading and low memory)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

  // Fast lightweight thumbnail (~15KB) for instant sidebar rendering without freezing
  let thumbnailUrl = '';
  try {
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = Math.max(120, Math.round(viewport.width * 0.18));
    thumbCanvas.height = Math.max(160, Math.round(viewport.height * 0.18));
    const thumbCtx = thumbCanvas.getContext('2d', { alpha: false });
    thumbCtx.fillStyle = '#ffffff';
    thumbCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
    thumbCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
    thumbnailUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);
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
};

/**
 * Import full PDF file into BetterNote database with cooperative multitasking
 */
export const importPdfAsNotebook = async (file, folderId = null, onProgress = null) => {
  const { pdfDoc } = await loadPdfFromFile(file);
  const numPages = pdfDoc.numPages;

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

  await saveNotebook(notebook);

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
      thumbnailUrl: thumbnailUrl,
      pageWidth: width,
      pageHeight: height,
      strokes: [],
      textElements: [],
      updatedAt: Date.now()
    };

    await savePage(pageRecord);
  }

  return notebook;
};
