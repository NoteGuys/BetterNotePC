// Three raster layers share a finite budget; logical note coordinates stay unchanged.
export const canvasRasterScale = (width, height, dpr = 1, budget = 96 * 1024 * 1024) => {
  const dimension = value => Number.isFinite(Number(value)) ? Math.max(1, Number(value)) : 1;
  const w = dimension(width), h = dimension(height);
  const ratio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const bytes = Number.isFinite(budget) && budget >= 12 ? budget : 96 * 1024 * 1024;
  return Math.min(ratio, Math.sqrt(bytes / 12) / Math.sqrt(w) / Math.sqrt(h), 16384 / w, 16384 / h);
};
export const appendedStrokeStart = (previous, next) => {
  if (!previous || next.length <= previous.length) return -1;
  for (let i = 0; i < previous.length; i++) if (previous[i] !== next[i]) return -1;
  return previous.length;
};
