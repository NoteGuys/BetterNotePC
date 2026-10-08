import { localAssetUrl } from '../utils/localAssetUrl.js';
import { pdfAssets } from '../utils/pdfAssetUrls.js';
// PDF Service for BetterNote with High-DPI Rendering & Performance Optimization
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { importNotebookPagesAtomic } from './db';

// Setup worker with local offline bundle
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = localAssetUrl(pdfWorker);
}

/**
 * Load PDF Document from an ArrayBuffer or File
 */
export const loadPdfFromFile = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, isEvalSupported:false, enableScripting:false });
  const pdfDoc = await loadingTask.promise;
  return { pdfDoc, arrayBuffer };
};

/**
 * Render a specific PDF page to a crisp high-DPI image data URL and a fast thumbnail
 */
export const renderPageToImage = async (pdfDoc, pageNum, scale = 2.0, maxEdge = 16384, maxPixels = 16 * 1024 * 1024) => {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  const rasterScale = Math.min(1, Math.sqrt(maxPixels / (viewport.width * viewport.height)), maxEdge / viewport.width, maxEdge / viewport.height);
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
const importPdfLegacy = async (file, folderId = null, onProgress = null) => {
  const originalDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(new Blob([file],{type:'application/pdf'}));
  });
  const bytes=await file.arrayBuffer();
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
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

    const importedPages=[];

    const originalId = notebookId + ':pdf';
    // Render and save each page with optimized resolution and non-blocking event loop yield
    for (let i = 1; i <= numPages; i++) {
      if (onProgress) {
        onProgress(i, numPages);
      }

      // Cooperative yield to keep UI responsive and prevent "Not Responding"
      await new Promise(resolve => setTimeout(resolve, 0));

      const { dataUrl, thumbnailUrl, width, height } = await renderPageToImage(pdfDoc, i, 2.0, 960);

      const pageRecord = {
        id: `${notebookId}_page_${i - 1}`,
        notebookId: notebookId,
        pageIndex: i - 1,
        templateId: 'blank',
        pdfPageImage: dataUrl, pdfLazyRaster: 1, pdfNativeRaster: true,
        pdfOriginalId: originalId, pdfOriginalDigest:digest, pdfPageNumber: i,
        ...(i === 1 ? { pdfOriginal: { id: originalId, name: file.name, dataUrl: originalDataUrl } } : {}),
        thumbnailUrl: thumbnailUrl,
        pageWidth: width,
        pageHeight: height,
        strokes: [],
        textElements: [],
        updatedAt: Date.now()
      };

      importedPages.push(pageRecord);
    }

    return await importNotebookPagesAtomic(notebook,importedPages);
  } finally { await pdfDoc.destroy(); }
};

const canvasDataUrl = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob(blob => {
    if (!blob) { reject(Error('PDF image unavailable')); return; }
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
  }, type, quality);
});

export const importPdfAsNotebook = async (file, folderId = null, onProgress = null) => {
  const {default:RasterWorker}=await import('./pdfRaster.worker.js?worker&inline');
  try {
    return await new Promise((resolve,reject)=>{
      const worker=new RasterWorker();let timer;
      const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>finish(Error('PDF import timeout')),120000);};
      const finish=(error,result)=>{clearTimeout(timer);worker.terminate();error?reject(error):resolve(result);};
      worker.onmessage=({data})=>{
        if(!data.progress && !data.error && !data.result)return;
        if(data.progress){arm();onProgress?.(data.progress,data.total);return;}
        finish(data.error?Error(data.error):null,data.result);
      };
      worker.onerror=e=>{e.preventDefault();finish(Error('PDF import unavailable'));};
      arm();worker.postMessage({action:'import',file,folderId,assets:pdfAssets()});
    });
  } catch(error) {
    if(error.message!=='pdf-native-filter-required')throw error;
    // Preserve uncommon native PDF color filters that OffscreenCanvas cannot render.
    return importPdfLegacy(file,folderId,onProgress);
  }
};
