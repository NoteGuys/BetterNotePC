// Automatic backup only: all rasterization/encoding runs in a worker.
import { renderStroke } from './inkingEngine.js';
import { renderPaperBackground } from './paperRenderer.js';
import { isWhiteboardPage, getWhiteboardContentBounds } from './whiteboard.js';
import { PAPER_TEMPLATES } from '../data/templates.js';
const boundsOf = (page, templateId, ctx) => isWhiteboardPage(page, templateId)
  ? getWhiteboardContentBounds(page, ctx, true)
  : { x: 0, y: 0, width: Math.max(100, Number(page.pageWidth) || 1200), height: Math.max(100, Number(page.pageHeight) || 1600) };
export const backupPageDimensions = (page, templateId) => {
  if (isWhiteboardPage(page, templateId)) {
    const canvas = new OffscreenCanvas(1, 1), bounds = boundsOf(page, templateId, canvas.getContext('2d'));
    const scale = 841.89 / Math.max(bounds.width, bounds.height);
    return { pdfW: bounds.width * scale, pdfH: bounds.height * scale, orientation: bounds.width > bounds.height ? 'landscape' : 'portrait' };
  }
  const width = page.pageWidth || 1200, height = page.pageHeight || 1600, scale = 595.28 / Math.min(width, height);
  return { pdfW: width * scale, pdfH: height * scale, orientation: width > height ? 'landscape' : 'portrait' };
};
export const renderBackupPageImage = async (page, templateId, dimensions, { decodeSvg } = {}) => {
  const canvas = new OffscreenCanvas(1, 1), ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('pdf-backup-image-unavailable');
  const whiteboard = isWhiteboardPage(page, templateId), bounds = boundsOf(page, templateId, ctx), { pdfW } = dimensions(page, templateId);
  const scale = Math.min(pdfW / 72 * 150 / bounds.width, 8192 / bounds.width, 8192 / bounds.height, Math.sqrt(16000000 / (bounds.width * bounds.height)));
  canvas.width = Math.max(1, Math.floor(bounds.width * scale)); canvas.height = Math.max(1, Math.floor(bounds.height * scale));
  try {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, -bounds.x * scale, -bounds.y * scale);
    if (!whiteboard && !page.pdfPageImage) renderPaperBackground(ctx, bounds.width, bounds.height,
      PAPER_TEMPLATES.find(item => item.id === (page.templateId || templateId)) || PAPER_TEMPLATES[0]);
    const draw = async image => {
      if (!/^data:image\//i.test(image.src || '') || ![image.x,image.y,image.width,image.height].every(Number.isFinite) || image.width <= 0 || image.height <= 0)
        throw new Error('pdf-backup-image-invalid');
      // Data URLs only: no network, filesystem or virtual-drive reads.
      const blob = await (await fetch(image.src)).blob();
      const imageScale = Math.min(scale, 8192 / image.width, 8192 / image.height, Math.sqrt(16000000 / (image.width * image.height)));
      const size = { resizeWidth: Math.max(1, Math.round(image.width * imageScale)), resizeHeight: Math.max(1, Math.round(image.height * imageScale)), resizeQuality: 'high' };
      // Chromium's worker cannot decode SVG blobs. Its asynchronous image decoder
      // supplies one transferable bitmap; ink/PDF work stays in this worker.
      const bitmap = /^data:image\/svg\+xml[;,]/i.test(image.src) && decodeSvg
        ? await decodeSvg(image.src, size) : await createImageBitmap(blob, size);
      try { ctx.drawImage(bitmap, image.x, image.y, image.width, image.height); } finally { bitmap.close(); }
    };
    if (page.pdfPageImage) await draw({src:page.pdfPageImage,x:0,y:0,width:bounds.width,height:bounds.height});
    for (const image of page.imageElements || []) if (image.layer !== 'over' && image.src) await draw(image);
    for (const stroke of page.strokes || []) renderStroke(ctx, stroke);
    for (const image of page.imageElements || []) if (image.layer === 'over' && image.src) await draw(image);
    for (const text of page.textElements || []) {
      ctx.save(); ctx.font = (text.bold ? 'bold ' : '500 ') + (text.fontSize || 20) + 'px ' + (text.fontFamily || 'Inter') + ', Segoe UI, Leelawadee UI, sans-serif';
      ctx.fillStyle = text.color || '#000000'; ctx.textBaseline = 'alphabetic';
      const ascent = ctx.measureText('Mg').fontBoundingBoxAscent || (text.fontSize || 20);
      String(text.text || '').split('\n').forEach((line,index)=>ctx.fillText(line,text.x+4,text.y+4+ascent+index*(text.fontSize||20)*1.35)); ctx.restore();
    }
    return {blob:await canvas.convertToBlob({type:'image/jpeg',quality:.95})};
  } finally { canvas.width = canvas.height = 1; }
};
