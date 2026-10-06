// Lightweight revision tokens; never hash or copy page images on the UI thread.
export const notebookBackupRevision = notebook => JSON.stringify([
  notebook.id, Number(notebook.updatedAt) || 0, notebook.name || '',
  notebook.folderId || null, Number(notebook.pageCount) || 0, !!notebook.isDeleted
]);
export const folderBackupRevision = folders => JSON.stringify(
  [...folders].sort((a, b) => String(a.id).localeCompare(String(b.id))).map(folder =>
    [folder.id, folder.name, folder.parentId || null, folder.updatedAt || 0,
      !!folder.isDeleted, folder.color, folder.icon, !!folder.isFavorite])
);
export const backupMetadataRevision = metadata => JSON.stringify([
  folderBackupRevision(metadata.folders),
  [...metadata.notebooks].sort((a, b) => String(a.id).localeCompare(String(b.id))).map(notebookBackupRevision)
]);
