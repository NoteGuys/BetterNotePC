// Whiteboards keep the existing page, stroke, text and image records.
export const isWhiteboardPage = (page, templateId) => (page?.templateId || templateId) === 'whiteboard';

const strokeBoundsCache = new WeakMap();

export const getElementBounds = (element, kind, context = null) => {
  if (kind === 'strokes') {
    if (strokeBoundsCache.has(element)) return strokeBoundsCache.get(element);
    const points = element.points || [];
    if (!points.length) return null;
    let x = Infinity, y = Infinity, right = -Infinity, bottom = -Infinity;
    for (const p of points) { if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue; x = Math.min(x, p.x); y = Math.min(y, p.y); right = Math.max(right, p.x); bottom = Math.max(bottom, p.y); }
    if (!Number.isFinite(x)) return null;
    const padding = Math.max(2, (element.width || 2) * (element.tool === 'highlighter' ? 1.8 : 1.3));
    const bounds = { x: x - padding, y: y - padding, width: right - x + padding * 2, height: bottom - y + padding * 2 };
    strokeBoundsCache.set(element, bounds);
    return bounds;
  }
  if (!Number.isFinite(element.x) || !Number.isFinite(element.y)) return null;
  if (kind === 'imageElements') {
    if (!(element.width > 0 && element.height > 0)) return null;
    return { x: element.x, y: element.y, width: element.width, height: element.height };
  }
  if (!element.text?.trim()) return null;
  const fontSize = element.fontSize || 20;
  const lines = element.text.split('\n');
  let width = 0;
  if (context) {
    context.save();
    context.font = `${element.bold ? 'bold' : '500'} ${fontSize}px ${element.fontFamily || 'Inter, sans-serif'}`;
  }
  for (const line of lines) width = Math.max(width, context ? context.measureText(line).width : Array.from(line).length * fontSize);
  if (context) context.restore();
  return { x: element.x, y: element.y, width: Math.max(140, width + 8), height: lines.length * fontSize * 1.35 + 8 };
};

export const getWhiteboardContentBounds = (page, context = null, forExport = false) => {
  let x = Infinity, y = Infinity, right = -Infinity, bottom = -Infinity;
  for (const kind of ['strokes', 'imageElements', 'textElements']) {
    for (const element of page?.[kind] || []) {
      const box = getElementBounds(element, kind, context);
      if (!box) continue;
      x = Math.min(x, box.x); y = Math.min(y, box.y);
      right = Math.max(right, box.x + box.width); bottom = Math.max(bottom, box.y + box.height);
    }
  }
  if (!Number.isFinite(x)) return { x: 0, y: 0, width: 1200, height: 800, empty: true };
  const proportionalMargin = Math.max(24, Math.max(right - x, bottom - y) * 0.04);
  const margin = forExport ? proportionalMargin : Math.min(96, proportionalMargin);
  return { x: Math.floor(x - margin), y: Math.floor(y - margin), width: Math.ceil(right - x + margin * 2), height: Math.ceil(bottom - y + margin * 2), empty: false };
};

export const intersectsViewport = (box, viewport) => !!box &&
  box.x <= viewport.x + viewport.width && box.x + box.width >= viewport.x &&
  box.y <= viewport.y + viewport.height && box.y + box.height >= viewport.y;

// Reconcile only visible items; offscreen records keep their order and contents.
// A precision eraser can produce multiple segments with the same stroke ID.
export const mergeVisibleElements = (all, visible, edited) => {
  const visibleSet = new Set(visible), replacements = new Map(), consumed = new Set();
  for (const item of edited) {
    const group = replacements.get(item.id) || [];
    group.push(item); replacements.set(item.id, group);
  }
  const result = [];
  for (const item of all) {
    if (!visibleSet.has(item)) { result.push(item); continue; }
    if (!consumed.has(item.id)) {
      result.push(...(replacements.get(item.id) || [])); consumed.add(item.id);
    }
  }
  for (const [id, group] of replacements) if (!consumed.has(id)) result.push(...group);
  return result;
};
