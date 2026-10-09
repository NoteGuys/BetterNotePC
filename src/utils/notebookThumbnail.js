import { renderStroke } from './inkingEngine.js';
import { renderPaperBackground } from './paperRenderer.js';
import { isWhiteboardPage, getWhiteboardContentBounds } from './whiteboard.js';
import { PAPER_TEMPLATES } from '../data/templates.js';

// Only the preview bitmap is scaled; note coordinates and export quality stay intact.
export const getThumbnailDimensions = bounds => {
  if (![bounds.width, bounds.height].every(value => Number.isFinite(value) && value > 0)) throw new Error('Invalid preview dimensions');
  const scale = Math.min(1, 320 / bounds.width, 320 / bounds.height);
  return { width: Math.max(1, Math.round(bounds.width * scale)), height: Math.max(1, Math.round(bounds.height * scale)), scale };
};

export const renderNotebookThumbnail = async (page, templateId = 'dotted') => {
  const canvas = new OffscreenCanvas(1, 1), ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Preview canvas unavailable');
  const whiteboard = isWhiteboardPage(page, templateId);
  const bounds = whiteboard ? getWhiteboardContentBounds(page, ctx, true) : {
    x: 0, y: 0, width: Math.max(100, Number(page.pageWidth) || 1200), height: Math.max(100, Number(page.pageHeight) || 1697)
  };
  const size = getThumbnailDimensions(bounds);
  canvas.width = size.width; canvas.height = size.height;
  try {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size.width, size.height);
    ctx.setTransform(size.scale, 0, 0, size.scale, -bounds.x * size.scale, -bounds.y * size.scale);
    if (!whiteboard && !page.pdfPageImage) {
      renderPaperBackground(ctx, bounds.width, bounds.height, PAPER_TEMPLATES.find(item => item.id === (page.templateId || templateId)) || PAPER_TEMPLATES[0]);
    }
    const drawImage = async image => {
      if (!/^data:image\//i.test(image.src || '')) throw new Error('Preview image unavailable');
      if (![image.x, image.y, image.width, image.height].every(Number.isFinite) || image.width <= 0 || image.height <= 0) throw new Error('Invalid preview image');
      // This fetch accepts in-memory data URLs only, never files or network URLs.
      const blob = await (await fetch(image.src)).blob();
      const bitmap = await createImageBitmap(blob, { resizeWidth: Math.max(1, Math.min(640, Math.round(image.width * size.scale))), resizeHeight: Math.max(1, Math.min(640, Math.round(image.height * size.scale))), resizeQuality: 'high' });
      try { ctx.drawImage(bitmap, image.x, image.y, image.width, image.height); } finally { bitmap.close(); }
    };
    if (page.pdfPageImage) await drawImage({ src: page.pdfPageImage, x: 0, y: 0, width: bounds.width, height: bounds.height });
    for (const image of page.imageElements || []) if (image.layer !== 'over' && image.src) await drawImage(image);
    for (const stroke of page.strokes || []) renderStroke(ctx, stroke);
    for (const image of page.imageElements || []) if (image.layer === 'over' && image.src) await drawImage(image);
    for (const text of page.textElements || []) {
      ctx.save();
      ctx.font = (text.bold ? 'bold ' : '500 ') + (text.fontSize || 20) + 'px ' + (text.fontFamily || 'Inter, Segoe UI, Leelawadee UI, sans-serif');
      ctx.fillStyle = text.color || '#000000'; ctx.textBaseline = 'top';
      String(text.text || '').split('\n').forEach((line, index) => ctx.fillText(line, text.x + 4, text.y + 4 + index * (text.fontSize || 20) * 1.35));
      ctx.restore();
    }
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return { bytes: await blob.arrayBuffer(), width: size.width, height: size.height };
  } finally { canvas.width = canvas.height = 1; }
};
