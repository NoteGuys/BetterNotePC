import {runHeavyJob} from '../services/foregroundJobs.js';
import { pageForPdfExport } from '../services/pdfRasterService.js';
// PDF Export Engine for BetterNote using jsPDF & Canvas
import { jsPDF } from 'jspdf';
import { isWhiteboardPage } from './whiteboard.js';
import { getWhiteboardPdfDimensions } from './whiteboardExport.js';
import { buildExportDocument, documentFromSections, exportPageSection, downloadExportBlob, renderExportPageImage } from './exportDocument.js';

/**
 * Render a single page to an offscreen canvas and return data URL
 */
const renderPageToCanvasDataUrlImpl = async (page, templateId = 'ruled', width = 1200, height = 1600) => {
  page = await pageForPdfExport(page);
  for(const src of [page.pdfPageImage,...(page.imageElements||[]).map(image=>image.src)].filter(Boolean)) {
    if(!/^data:image\//i.test(src))throw Error('Image is unavailable for offline capture');
    await new Promise((resolve,reject)=>{
      const image=new Image();let finished=false;
      const finish=error=>{if(finished)return;finished=true;clearTimeout(timer);image.onload=image.onerror=null;image.src='';error?reject(error):resolve();};
      const timer=setTimeout(()=>finish(Error('Image capture timed out')),30000);
      image.onload=()=>finish(image.naturalWidth>0&&image.naturalHeight>0?null:Error('Image is unavailable for capture'));
      image.onerror=()=>finish(Error('Image is unavailable for capture'));image.src=src;
    });
  }
  const normalized={...page,pageWidth:page.pageWidth||width,pageHeight:page.pageHeight||height};
  const result=await renderExportPageImage(normalized,templateId,getPagePdfDimensions,{format:'jpeg',dpi:150});
  return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Unable to prepare page image'));reader.readAsDataURL(result.blob);});
};

/**
 * Calculate dynamic PDF dimensions preserving exact original aspect ratio
 */
export const getPagePdfDimensions = (page, templateId) => {
  if (isWhiteboardPage(page, templateId)) return getWhiteboardPdfDimensions(page);
  const canvasW = page?.pageWidth || 1200;
  const canvasH = page?.pageHeight || 1600;
  const isLandscape = canvasW > canvasH;
  
  let pdfW = 595.28; // Standard A4 width in pt
  let pdfH = (pdfW * canvasH) / canvasW;

  if (isLandscape) {
    pdfH = 595.28;
    pdfW = (pdfH * canvasW) / canvasH;
  }

  return {
    pdfW,
    pdfH,
    orientation: isLandscape ? 'landscape' : 'portrait'
  };
};

/**
 * Export full notebook as a PDF document preserving natural aspect ratio
 */
const exportNotebookToPdfImpl = async (notebook, pages, onProgress = null, { loadPage } = {}) => {
  if (!pages || pages.length === 0) {
    throw new Error('สมุดบันทึกไม่มีหน้าเอกสารให้ส่งออก');
  }

  if (window.electronAPI?.exportPdfDocument) {
    const invoke = request => window.electronAPI.exportPdfDocument(request);
    let capabilities;
    try { capabilities = await invoke({ action: 'capabilities' }); } catch (_) {}
    if (capabilities?.protocol !== 2) throw Error('pdf-restart-required');
    const session = await invoke({ action: 'begin', pages: pages.length });
    if (session.error || !session.id) throw Error(session.error || 'pdf-session-expired');
    let done = 0, part = [], partSize = 0, bytes;
    const report = (stage, current = done) => onProgress?.(current, pages.length, stage);
    const failure = (result, first, count) => Object.assign(Error(result.error), { exportPage: first + 1, exportEnd: first + count });
    const send = async sections => {
      report('print', done);
      const first = done;
      const result = await invoke({ action: 'append', id: session.id, start: done,
        pages: sections.length, html: documentFromSections(notebook, sections) });
      if (result.error) {
        // Native print failure retries progressively smaller batches, retaining quality.
        if (result.retry && sections.length > 1) {
          const middle = Math.ceil(sections.length / 2);
          await send(sections.slice(0, middle)); await send(sections.slice(middle)); return;
        }
        throw failure(result, first, sections.length);
      }
      if (result.pages !== done + sections.length) throw failure({error:'pdf-page-count'}, first, sections.length);
      done = result.pages;
    };
    try {
      for (let index = 0; index < pages.length; index++) {
        report('prepare', index);
        let stored;
        try { stored = loadPage ? await loadPage(index) : pages[index]; }
        catch (_) { throw Object.assign(Error('pdf-page-unavailable'), { exportPage: index + 1, exportEnd: index + 1 }); }
        if (!stored || stored.__unloaded) throw Object.assign(Error('pdf-page-unavailable'), { exportPage: index + 1, exportEnd: index + 1 });
        let section;
        try { section = await exportPageSection(await pageForPdfExport(stored), notebook.templateId, getPagePdfDimensions, index); }
        catch (_) { throw Object.assign(Error('pdf-page-unavailable'), { exportPage: index + 1, exportEnd: index + 1 }); }
        const size = new TextEncoder().encode(section.body).byteLength;
        if (part.length && (part.length >= capabilities.batchPages || partSize + size > capabilities.batchBytes)) {
          await send(part); part = []; partSize = 0;
        }
        part.push(section); partSize += size;
        if (part.length >= capabilities.batchPages || partSize >= capabilities.batchBytes) {
          await send(part); part = []; partSize = 0;
        }
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (part.length) await send(part);
      part = []; report('merge');
      const result = await invoke({ action: 'finish', id: session.id });
      if (result.error) throw failure(result, 0, pages.length);
      if (result.pages !== pages.length || !result.bytes?.byteLength) throw Error('pdf-page-count');
      bytes = result.bytes; report('save');
    } finally {
      // Also cleans an incomplete export after a page read/raster failure.
      await invoke({ action: 'cancel', id: session.id }).catch(() => {});
    }
    const filename = `${notebook.name || 'Notebook'}.pdf`;
    downloadExportBlob(new Blob([bytes], { type: 'application/pdf' }), filename);
    return filename;
  }

  const firstPage = pages[0];
  const firstDim = getPagePdfDimensions(firstPage, notebook.templateId);

  const pdf = new jsPDF({
    orientation: firstDim.orientation,
    unit: 'pt',
    format: [firstDim.pdfW, firstDim.pdfH]
  });

  for (let i = 0; i < pages.length; i++) {
    if (onProgress) {
      onProgress(i + 1, pages.length);
    }

    const page = await pageForPdfExport(loadPage ? await loadPage(i) : pages[i]);
    const dim = getPagePdfDimensions(page, notebook.templateId);

    if (i > 0) {
      pdf.addPage([dim.pdfW, dim.pdfH], dim.orientation);
    }

    const { blob } = await renderExportPageImage(page, notebook.templateId, getPagePdfDimensions);
    pdf.addImage(new Uint8Array(await blob.arrayBuffer()), 'PNG', 0, 0, dim.pdfW, dim.pdfH, undefined, 'FAST');
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  const filename = `${notebook.name || 'Notebook'}.pdf`;
  pdf.save(filename);
  return filename;
};

/**
 * Export single page as a PDF document preserving natural aspect ratio
 */
const exportSinglePageToPdfImpl = async (notebook, page, pageIndex = 0) => {
  if (!page) {
    throw new Error('ไม่พบข้อมูลหน้าเอกสารที่ต้องการส่งออก');
  }

  page = await pageForPdfExport(page);
  if (window.electronAPI?.exportPdfDocument) {
    const html = await buildExportDocument(notebook, [page], getPagePdfDimensions);
    const bytes = await window.electronAPI.exportPdfDocument(html);
    const filename = `${notebook.name || 'Notebook'}_Page_${pageIndex + 1}.pdf`;
    downloadExportBlob(new Blob([bytes], { type: 'application/pdf' }), filename);
    return filename;
  }

  const dim = getPagePdfDimensions(page, notebook.templateId);
  const pdf = new jsPDF({
    orientation: dim.orientation,
    unit: 'pt',
    format: [dim.pdfW, dim.pdfH]
  });

  const { blob } = await renderExportPageImage(page, notebook.templateId, getPagePdfDimensions);
  pdf.addImage(new Uint8Array(await blob.arrayBuffer()), 'PNG', 0, 0, dim.pdfW, dim.pdfH, undefined, 'FAST');

  const filename = `${notebook.name || 'Notebook'}_Page_${pageIndex + 1}.pdf`;
  pdf.save(filename);
  return filename;
};

/**
 * Generate a complete, valid multi-page PDF as a Base64 Data URL (Non-blocking & Zero-lag)
 * Safe for automated background backups without opening browser save dialogs.
 */
export const generateNotebookPdfBase64 = async (notebook, pages, onProgress = null) => {
  if (!pages || pages.length === 0) {
    return null;
  }

  const firstPage = pages[0];
  const firstDim = getPagePdfDimensions(firstPage, notebook.templateId);

  const pdf = new jsPDF({
    orientation: firstDim.orientation,
    unit: 'pt',
    format: [firstDim.pdfW, firstDim.pdfH]
  });

  for (let i = 0; i < pages.length; i++) {
    // Cooperative yield between pages to ensure zero UI frame drops
    await new Promise(resolve => setTimeout(resolve, 30));

    if (onProgress) {
      onProgress(i + 1, pages.length);
    }

    const page = pages[i];
    const dim = getPagePdfDimensions(page, notebook.templateId);

    if (i > 0) {
      pdf.addPage([dim.pdfW, dim.pdfH], dim.orientation);
    }

    try {
      const imgData = await renderPageToCanvasDataUrl(page, notebook.templateId || 'ruled');
      if (imgData) {
        pdf.addImage(imgData, 'JPEG', 0, 0, dim.pdfW, dim.pdfH, undefined, 'FAST');
      }
    } catch (pageErr) {
      console.warn(`Could not render page ${i + 1} to PDF:`, pageErr.message);
    }
  }

  // Standardize Base64 Data URL (e.g. data:application/pdf;base64,JVBERi0xLjc...)
  const rawUri = pdf.output('datauristring');
  const base64Data = rawUri.replace(/^data:application\/pdf.*?;base64,/, '').replace(/^data:[^;]+;base64,/, '');
  return `data:application/pdf;base64,${base64Data}`;
};



// Explicit image exports only; backup and preview renderers keep their original defaults.
export const exportPageAsImage = (page, templateId, options) => runHeavyJob(async()=>
  renderExportPageImage(await pageForPdfExport(page), templateId, getPagePdfDimensions, options));

export const exportSinglePageToPdf=(...args)=>runHeavyJob(()=>exportSinglePageToPdfImpl(...args));

export const exportNotebookToPdf=(...args)=>runHeavyJob(()=>exportNotebookToPdfImpl(...args));

export const renderPageToCanvasDataUrl=(...args)=>runHeavyJob(()=>renderPageToCanvasDataUrlImpl(...args));
