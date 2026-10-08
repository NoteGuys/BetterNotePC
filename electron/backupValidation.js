const fault = code => Object.assign(new Error(code), { code });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 512;
export function validateNotebook(value) {
  if (!object(value) || !validId(value.id) || !Array.isArray(value.pages) || !value.pages.length ||
      value.name !== undefined && typeof value.name !== 'string' ||
      value.updatedAt !== undefined && (!Number.isFinite(value.updatedAt) || value.updatedAt < 0) ||
      value.folderId != null && !validId(value.folderId) ||
      value.pageCount !== undefined && value.pageCount !== value.pages.length) throw fault('invalid-backup-data');
  const ids = new Set(), indexes = new Set();
  const pages = value.pages.map((page, index) => {
    if (!object(page) || !validId(page.id) || ids.has(page.id) ||
        page.notebookId !== undefined && page.notebookId !== value.id) throw fault('invalid-backup-data');
    const pageIndex = page.pageIndex ?? index;
    if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= value.pages.length || indexes.has(pageIndex)) throw fault('invalid-backup-data');
    for (const key of ['strokes', 'textElements', 'imageElements', 'drawings', 'textBlocks', 'images']) {
      if (page[key] !== undefined && !Array.isArray(page[key])) throw fault('invalid-backup-data');
    }
    for (const key of ['pageWidth', 'pageHeight']) {
      if (page[key] !== undefined && (!Number.isFinite(page[key]) || page[key] <= 0)) throw fault('invalid-backup-data');
    }
    if (page.pdfPageImage != null && typeof page.pdfPageImage !== 'string') throw fault('invalid-backup-data');
    for (const key of ['strokes', 'textElements', 'imageElements']) for (const element of page[key] || []) {
      if (!object(element)) throw fault('invalid-backup-data');
      for (const coordinate of ['x', 'y', 'width', 'height']) {
        if (element[coordinate] !== undefined && !Number.isFinite(element[coordinate])) throw fault('invalid-backup-data');
      }
      if (key === 'strokes' && element.points !== undefined && (!Array.isArray(element.points) ||
          element.points.some(point => !object(point) || !Number.isFinite(point.x) || !Number.isFinite(point.y)))) throw fault('invalid-backup-data');
      if (key === 'textElements' && element.text !== undefined && typeof element.text !== 'string' ||
          key === 'imageElements' && element.src !== undefined && typeof element.src !== 'string') throw fault('invalid-backup-data');
    }
    ids.add(page.id); indexes.add(pageIndex);
    return { ...page, notebookId: value.id, pageIndex };
  }).sort((a, b) => a.pageIndex - b.pageIndex);
  const originals=new Map(pages.filter(page=>page.pdfOriginal?.id).map(page=>[page.pdfOriginal.id,page.pdfOriginal]));
  for(const page of pages)if(page.pdfLazyRaster!==undefined){
    if(page.pdfLazyRaster!==1 || !validId(page.pdfOriginalId) || !Number.isInteger(page.pdfPageNumber) || page.pdfPageNumber<1 ||
       !/^[a-f0-9]{64}$/i.test(page.pdfOriginalDigest||'') || !/^data:image\/jpeg;base64,/i.test(page.pdfPageImage||''))
      throw fault('invalid-backup-data');
    if(!/^data:application\/pdf(?:;[^,]*)?;base64,/i.test(originals.get(page.pdfOriginalId)?.dataUrl||''))
      throw fault('backup-incomplete');
  }
  return { ...value, pageCount: pages.length, pages };
}
export function validateLibrary(folders, notebooks) {
  const folderMap = new Map(), notebookIds = new Set(), pageIds = new Set();
  for (const folder of folders) {
    if (!object(folder) || !validId(folder.id) || folderMap.has(folder.id) ||
        folder.parentId != null && !validId(folder.parentId)) throw fault('invalid-backup-data');
    folderMap.set(folder.id, folder);
  }
  const checked = new Set();
  for (const folder of folders) {
    const trail = new Set(); let current = folder;
    while (current && !checked.has(current.id)) {
      if (trail.has(current.id)) throw fault('invalid-backup-data');
      trail.add(current.id);
      if (current.parentId && !folderMap.has(current.parentId)) throw fault('backup-incomplete');
      current = folderMap.get(current.parentId);
    }
    for (const id of trail) checked.add(id);
  }
  for (const note of notebooks) {
    if (notebookIds.has(note.id)) throw fault('invalid-backup-data');
    notebookIds.add(note.id);
    if (note.folderId && !folderMap.has(note.folderId)) throw fault('backup-incomplete');
    for (const page of note.pages) {
      if (pageIds.has(page.id)) throw fault('invalid-backup-data');
      pageIds.add(page.id);
    }
  }
}

export function prepareBackup(data) {
  if (!object(data) || !Array.isArray(data.notebooks) || data.folders !== undefined && !Array.isArray(data.folders)) throw fault('invalid-backup-data');
  const folders = data.folders || [];
  if (!data.notebooks.length && !folders.length) throw fault('invalid-backup-data');
  if (data.notebooks.length > 10000 || folders.length > 10000) throw fault('backup-too-large');
  const notebooks = data.notebooks.map(validateNotebook);
  validateLibrary(folders, notebooks);
  return { folders, notebooks };
}

export function recoverMissingNotebookFolders(folders, notebooks) {
  // Missing parents, malformed folders and cycles still block recovery.
  validateLibrary(folders, []);
  const folderMap = new Map(folders.map(folder => [folder.id, folder]));
  const recoveredFolderNotebookIds = [];
  const repaired = notebooks.map(note => {
    if (!note.folderId || folderMap.has(note.folderId) && !folderMap.get(note.folderId).isDeleted) return note;
    recoveredFolderNotebookIds.push(note.id);
    // Relocating a notebook is a real metadata edit, so the next backup must not see an equal-time content conflict.
    return { ...note, folderId: null, updatedAt: Math.max(Date.now(), (Number(note.updatedAt) || 0) + 1) };
  });
  return { notebooks: repaired, recoveredFolderNotebookIds };
}
