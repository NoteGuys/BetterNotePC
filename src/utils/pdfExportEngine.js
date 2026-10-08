import { pageForPdfExport } from '../services/pdfRasterService.js';
// PDF Export Engine for BetterNote using jsPDF & Canvas
import { jsPDF } from 'jspdf';
import { isWhiteboardPage } from './whiteboard.js';
import { renderWhiteboardToDataUrl, getWhiteboardPdfDimensions } from './whiteboardExport.js';
import { renderPaperBackground } from './paperRenderer.js';
import { renderAllStrokes } from './inkingEngine.js';
import { PAPER_TEMPLATES } from '../data/templates.js';
import { buildExportDocument, documentFromSections, exportPageSection, downloadExportBlob, renderExportPageImage } from './exportDocument.js';

/**
 * Render a single page to an offscreen canvas and return data URL
 */
export const renderPageToCanvasDataUrl = async (page, templateId = 'ruled', width = 1200, height = 1600) => {
  page = await pageForPdfExport(page);
  if (isWhiteboardPage(page, templateId)) return renderWhiteboardToDataUrl(page);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(100, Number(page.pageWidth) || width || 1200);
  canvas.height = Math.max(100, Number(page.pageHeight) || height || 1600);
  const ctx = canvas.getContext('2d');

  // 1. Draw PDF page background or Paper template (with timeout safety to prevent hanging promises)
  if (page.pdfPageImage) {
    await new Promise((resolve) => {
      const img = new Image();
      const timer = setTimeout(resolve, 3000);
      img.onload = () => {
        clearTimeout(timer);
        try {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        } catch (_) {}
        resolve();
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve();
      };
      img.src = page.pdfPageImage;
    });
  } else {
    const tmpl = PAPER_TEMPLATES.find(t => t.id === (page.templateId || templateId)) || PAPER_TEMPLATES[0];
    renderPaperBackground(ctx, canvas.width, canvas.height, tmpl);
  }

  // Helper to draw image elements on canvas (with timeout safety)
  const drawImages = async (imgs) => {
    if (!imgs || imgs.length === 0) return;
    for (const imgEl of imgs) {
      if (imgEl.src) {
        await new Promise((resolve) => {
          const img = new Image();
          const timer = setTimeout(resolve, 3000);
          img.onload = () => {
            clearTimeout(timer);
            try {
              ctx.drawImage(img, imgEl.x, imgEl.y, imgEl.width, imgEl.height);
            } catch (_) {}
            resolve();
          };
          img.onerror = () => {
            clearTimeout(timer);
            resolve();
          };
          img.src = imgEl.src;
        });
      }
    }
  };

  // 2. Draw under-ink image elements (handwriting can be drawn over them)
  const underImages = (page.imageElements || []).filter(img => img.layer !== 'over');
  await drawImages(underImages);

  // 3. Draw all handwritten strokes
  if (page.strokes && page.strokes.length > 0) {
    renderAllStrokes(ctx, page.strokes);
  }

  // 3.5 Draw over-ink image elements (images placed in front of ink)
  const overImages = (page.imageElements || []).filter(img => img.layer === 'over');
  await drawImages(overImages);

  // 4. Draw text boxes
  if (page.textElements && page.textElements.length > 0) {
    for (const txt of page.textElements) {
      ctx.save();
      ctx.font = `${txt.bold ? 'bold' : 'normal'} ${txt.fontSize || 18}px ${txt.fontFamily || 'sans-serif'}`;
      ctx.fillStyle = txt.color || '#000000';
      const lines = (txt.text || '').split('\n');
      const lineHeight = (txt.fontSize || 18) * 1.35;
      lines.forEach((line, index) => {
        ctx.fillText(line, txt.x, txt.y + index * lineHeight);
      });
      ctx.restore();
    }
  }

  return canvas.toDataURL('image/jpeg', 0.92);
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
export const exportNotebookToPdf = async (notebook, pages, onProgress = null, { loadPage } = {}) => {
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
export const exportSinglePageToPdf = async (notebook, page, pageIndex = 0) => {
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
export const exportPageAsImage = async (page, templateId, options) =>
  renderExportPageImage(await pageForPdfExport(page), templateId, getPagePdfDimensions, options);
