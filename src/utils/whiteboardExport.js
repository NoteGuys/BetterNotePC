import { renderStroke } from './inkingEngine.js';
import { getWhiteboardContentBounds } from './whiteboard.js';

export const getWhiteboardPdfDimensions = page => {
  const context = document.createElement('canvas').getContext('2d');
  const bounds = getWhiteboardContentBounds(page, context, true);
  const scale = 841.89 / Math.max(bounds.width, bounds.height);
  return { pdfW: bounds.width * scale, pdfH: bounds.height * scale, orientation: bounds.width > bounds.height ? 'landscape' : 'portrait' };
};

// Allocate only the cropped export bitmap, never a canvas the size of the world.
export const renderWhiteboardToDataUrl = async page => {
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  const bounds = getWhiteboardContentBounds(page, ctx, true);
  const scale = Math.min(2, 4096 / bounds.width, 4096 / bounds.height, Math.sqrt(12000000 / (bounds.width * bounds.height)));
  canvas.width = Math.max(1, Math.ceil(bounds.width * scale));
  canvas.height = Math.max(1, Math.ceil(bounds.height * scale));
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale); ctx.translate(-bounds.x, -bounds.y);
  const drawImages = async layer => {
    for (const image of page.imageElements || []) {
      if ((image.layer === 'over') !== (layer === 'over') || !image.src) continue;
      await new Promise(resolve => {
        const decoded = new Image();
        const finish = () => { clearTimeout(timer); decoded.onload = decoded.onerror = null; resolve(); };
        const timer = setTimeout(finish, 3000);
        decoded.onload = () => { try { ctx.drawImage(decoded, image.x, image.y, image.width, image.height); } catch (_) {} finish(); };
        decoded.onerror = finish;
        decoded.src = image.src;
      });
    }
  };
  await drawImages('under');
  let sliceStarted = performance.now();
  for (const stroke of page.strokes || []) {
    renderStroke(ctx, stroke);
    if (performance.now() - sliceStarted > 8) { await new Promise(resolve => setTimeout(resolve, 0)); sliceStarted = performance.now(); }
  }
  await drawImages('over');
  for (const text of page.textElements || []) {
    ctx.save(); ctx.font = `${text.bold ? 'bold' : '500'} ${text.fontSize || 20}px ${text.fontFamily || 'Inter, sans-serif'}`;
    ctx.fillStyle = text.color || '#000000'; ctx.textBaseline = 'top';
    (text.text || '').split('\n').forEach((line, index) => ctx.fillText(line, text.x + 4, text.y + 4 + index * (text.fontSize || 20) * 1.35));
    ctx.restore();
  }
  const result = canvas.toDataURL('image/jpeg', 0.92);
  canvas.width = canvas.height = 1;
  return result;
};
