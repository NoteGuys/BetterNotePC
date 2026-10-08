// Only fields used for navigation/layout. Never keep media or strokes in a placeholder.
export const pageSummary = page => {
  const result = { __unloaded: true, ...(page.pdfOriginal || page.__pdfOriginalOmitted ? { __pdfOriginalOwner: true } : {}) };
  for (const key of ['id','notebookId','pageIndex','updatedAt','templateId','sizeId','orientation','pageWidth','pageHeight','isFavorite','paperColor','paperPattern','pageSize','pageOrientation']) {
    if (page[key] !== undefined) result[key] = page[key];
  }
  if (typeof page.thumbnailUrl === 'string' && page.thumbnailUrl.length <= 256 * 1024 && /^data:image\/(png|jpeg|webp);base64,/i.test(page.thumbnailUrl)) result.thumbnailUrl = page.thumbnailUrl;
  return result;
};
export const windowPageIds = (pages, index, radius = 2) => new Set(pages.slice(Math.max(0, index-radius), index+radius+1).map(page => page.id));
export const trimPageWindow = (pages, wanted) => pages.map(page => wanted.has(page.id) || page.__unloaded ? page : pageSummary(page));

export const editorPageView = page => { const { pdfOriginal, ...rest } = page; return pdfOriginal ? { ...rest, __pdfOriginalOmitted: true } : page; };
