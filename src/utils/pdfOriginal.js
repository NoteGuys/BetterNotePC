// Keep exactly one original PDF payload per source inside portable page records.
export const preservePdfOriginals = (pages, removed = null) => {
  const sources = new Map();
  for (const page of [...pages, removed].filter(Boolean)) if (page.pdfOriginal?.id) sources.set(page.pdfOriginal.id, page.pdfOriginal);
  let result = pages;
  for (const [id, source] of sources) {
    const candidates = result.filter(page => page.pdfOriginalId === id);
    if (!candidates.length) continue;
    const owner = candidates.find(page => page.pdfOriginal?.id === id) || candidates[0];
    result = result.map(page => {
      if (page.id === owner.id && page.pdfOriginal !== source) return { ...page, pdfOriginal: source };
      if (page.id !== owner.id && page.pdfOriginal?.id === id) { const { pdfOriginal, ...rest } = page; return rest; }
      return page;
    });
  }
  return result;
};
