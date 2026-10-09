// History follows the permanent page ID, never a page's changing position.
export const pageContentSnapshot = page => ({
  strokes: page.strokes || [],
  textElements: page.textElements || [],
  imageElements: page.imageElements || []
});

export const findHistoryPageIndex = (pages, entry) => {
  if (!entry?.pageId) return -1;
  return pages.findIndex(page => page.id === entry.pageId);
};

// Walk both branches from the current document. A deleted page's earlier ink
// remains valid when an intervening deletion can restore that exact page ID.
export const prunePageHistory = (stack, pointer, pages) => {
  const undoIds = new Set(pages.map(page => page.id));
  const redoIds = new Set(undoIds);
  const apply = (entry, ids, undo) => {
    if (!entry?.pageId) return false;
    if (entry.kind === 'insert-page' || entry.kind === 'delete-page') {
      if (entry.page?.id !== entry.pageId) return false;
      const removes = entry.kind === 'insert-page' ? undo : !undo;
      if (removes) {
        if (!ids.has(entry.pageId) || ids.size <= 1) return false;
        ids.delete(entry.pageId);
      } else {
        if (ids.has(entry.pageId)) return false;
        ids.add(entry.pageId);
      }
      return true;
    }
    return ids.has(entry.pageId);
  };
  let start = 0, end = stack.length;
  for (let index = pointer; index >= 0; index--) {
    if (!apply(stack[index], undoIds, true)) { start = index + 1; break; }
  }
  for (let index = pointer + 1; index < stack.length; index++) {
    if (!apply(stack[index], redoIds, false)) { end = index; break; }
  }
  return { stack: stack.slice(start, end), pointer: pointer - start };
};
