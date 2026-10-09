// Exact placeholder heights preserve scrolling for mixed page sizes.
export const thumbnailLayout = (pages, width) => {
  const offsets = [0];
  for (const page of pages) {
    const ratio = page.pageWidth > 0 && page.pageHeight > 0 ? page.pageWidth / page.pageHeight : 3 / 4;
    offsets.push(offsets.at(-1) + Math.min(260, width / ratio) + 16);
  }
  return offsets;
};
export const thumbnailWindow = (offsets, top, height, overscan = 2) => {
  const count = offsets.length - 1;
  const find = value => {
    let low = 0, high = count;
    while (low < high) { const mid = (low + high) >>> 1; if (offsets[mid + 1] < value) low = mid + 1; else high = mid; }
    return low;
  };
  return { start: Math.max(0, find(top) - overscan), end: Math.min(count, find(top + height) + overscan + 1) };
};
