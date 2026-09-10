// PDF Export Engine for BetterNote using jsPDF & Canvas
import { jsPDF } from 'jspdf';
import { renderPaperBackground } from './paperRenderer.js';
import { renderAllStrokes } from './inkingEngine.js';
import { PAPER_TEMPLATES } from '../data/templates.js';

/**
 * Render a single page to an offscreen canvas and return data URL
 */
export const renderPageToCanvasDataUrl = async (page, templateId = 'ruled', width = 1200, height = 1600) => {
  const canvas = document.createElement('canvas');
  canvas.width = page.pageWidth || width;
  canvas.height = page.pageHeight || height;
  const ctx = canvas.getContext('2d');

  // 1. Draw PDF page background or Paper template
  if (page.pdfPageImage) {
    await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve();
      };
      img.src = page.pdfPageImage;
    });
  } else {
    const tmpl = PAPER_TEMPLATES.find(t => t.id === (page.templateId || templateId)) || PAPER_TEMPLATES[0];
    renderPaperBackground(ctx, canvas.width, canvas.height, tmpl);
  }

  // 2. Draw pasted image elements & snipped crops
  if (page.imageElements && page.imageElements.length > 0) {
    for (const imgEl of page.imageElements) {
      if (imgEl.src) {
        await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, imgEl.x, imgEl.y, imgEl.width, imgEl.height);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = imgEl.src;
        });
      }
    }
  }

  // 3. Draw all handwritten strokes
  if (page.strokes && page.strokes.length > 0) {
    renderAllStrokes(ctx, page.strokes);
  }

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
export const getPagePdfDimensions = (page) => {
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
export const exportNotebookToPdf = async (notebook, pages, onProgress = null) => {
  if (!pages || pages.length === 0) {
    throw new Error('สมุดบันทึกไม่มีหน้าเอกสารให้ส่งออก');
  }

  const firstPage = pages[0];
  const firstDim = getPagePdfDimensions(firstPage);

  const pdf = new jsPDF({
    orientation: firstDim.orientation,
    unit: 'pt',
    format: [firstDim.pdfW, firstDim.pdfH]
  });

  for (let i = 0; i < pages.length; i++) {
    if (onProgress) {
      onProgress(i + 1, pages.length);
    }

    const page = pages[i];
    const dim = getPagePdfDimensions(page);

    if (i > 0) {
      pdf.addPage([dim.pdfW, dim.pdfH], dim.orientation);
    }

    const imgData = await renderPageToCanvasDataUrl(page, notebook.templateId);
    pdf.addImage(imgData, 'JPEG', 0, 0, dim.pdfW, dim.pdfH, undefined, 'FAST');
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

  const dim = getPagePdfDimensions(page);
  const pdf = new jsPDF({
    orientation: dim.orientation,
    unit: 'pt',
    format: [dim.pdfW, dim.pdfH]
  });

  const imgData = await renderPageToCanvasDataUrl(page, notebook.templateId);
  pdf.addImage(imgData, 'JPEG', 0, 0, dim.pdfW, dim.pdfH, undefined, 'FAST');

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
  const firstDim = getPagePdfDimensions(firstPage);

  const pdf = new jsPDF({
    orientation: firstDim.orientation,
    unit: 'pt',
    format: [firstDim.pdfW, firstDim.pdfH]
  });

  for (let i = 0; i < pages.length; i++) {
    // Cooperative yield between pages to ensure zero UI frame drops
    await new Promise(resolve => setTimeout(resolve, 20));

    if (onProgress) {
      onProgress(i + 1, pages.length);
    }

    const page = pages[i];
    const dim = getPagePdfDimensions(page);

    if (i > 0) {
      pdf.addPage([dim.pdfW, dim.pdfH], dim.orientation);
    }

    const imgData = await renderPageToCanvasDataUrl(page, notebook.templateId || 'ruled');
    pdf.addImage(imgData, 'JPEG', 0, 0, dim.pdfW, dim.pdfH, undefined, 'FAST');
  }

  // Standardize Base64 Data URL (e.g. data:application/pdf;base64,JVBERi0xLjc...)
  const rawUri = pdf.output('datauristring');
  const base64Data = rawUri.replace(/^data:application\/pdf.*?;base64,/, '').replace(/^data:[^;]+;base64,/, '');
  return `data:application/pdf;base64,${base64Data}`;
};


