// File System Service for Local Disk & Synced Cloud Drive (Google Drive/OneDrive folder)
import { getAllFolders, getAllNotebooks, getPagesByNotebookId, saveFolder, saveNotebook, savePage } from './db';

/**
 * Save data as a local file (using File System Access API or Blob download)
 */
export const saveFileToDisk = async (blob, suggestedName) => {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'BetterNote Document / Backup',
            accept: {
              'application/json': ['.json', '.bnote'],
              'application/pdf': ['.pdf']
            }
          }
        ]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false; // User cancelled
      console.warn('File System Access API failed, falling back to download link:', err);
    }
  }

  // Fallback to standard browser download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
};

/**
 * Export full BetterNote database to a local backup file
 */
export const exportFullBackup = async () => {
  const folders = await getAllFolders();
  const notebooks = await getAllNotebooks();

  const backupData = {
    version: 1,
    appName: 'BetterNote',
    exportDate: new Date().toISOString(),
    folders,
    notebooks: []
  };

  for (const nb of notebooks) {
    const pages = await getPagesByNotebookId(nb.id);
    backupData.notebooks.push({
      ...nb,
      pages
    });
  }

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const filename = `BetterNote_Backup_${new Date().toISOString().slice(0, 10)}.json`;

  return await saveFileToDisk(blob, filename);
};

/**
 * Import full BetterNote database from a local file
 */
export const importFullBackup = async (file) => {
  const text = await file.text();
  const data = JSON.parse(text);

  if (!data.notebooks) {
    throw new Error('รูปแบบไฟล์ไม่ถูกต้อง ไม่พบข้อมูลสมุดโน้ต');
  }

  // Restore folders
  if (data.folders && Array.isArray(data.folders)) {
    for (const f of data.folders) {
      await saveFolder(f);
    }
  }

  // Restore notebooks & pages
  for (const nb of data.notebooks) {
    const { pages, ...notebookMeta } = nb;
    await saveNotebook(notebookMeta);

    if (pages && Array.isArray(pages)) {
      for (const p of pages) {
        await savePage(p);
      }
    }
  }

  return {
    foldersCount: data.folders?.length || 0,
    notebooksCount: data.notebooks.length
  };
};

/**
 * Import a single .bnote file and save its notebook and pages to IndexedDB
 */
export const importBnoteFile = async (file, targetFolderId = null) => {
  const text = await file.text();
  const data = JSON.parse(text);

  let rawNotebook = null;
  let rawPages = [];

  if (data.format === 'BetterNote_Document' && data.notebook) {
    rawNotebook = data.notebook;
    rawPages = data.pages || [];
  } else if (data.notebook && Array.isArray(data.pages)) {
    rawNotebook = data.notebook;
    rawPages = data.pages;
  } else if (data.pages && Array.isArray(data.pages) && (data.name || data.id)) {
    const { pages, ...nbMeta } = data;
    rawNotebook = nbMeta;
    rawPages = pages;
  } else {
    throw new Error('รูปแบบไฟล์ .bnote ไม่ถูกต้อง หรือไม่พบข้อมูลเนื้อหาของสมุด');
  }

  // Generate a distinct notebook ID to prevent accidental collisions
  const newNotebookId = `nb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const cleanName = rawNotebook.name || file.name.replace(/\.bnote$/i, '') || 'สมุดโน้ตนำเข้า';

  const importedNotebook = {
    ...rawNotebook,
    id: newNotebookId,
    name: cleanName,
    folderId: targetFolderId !== undefined && targetFolderId !== null ? targetFolderId : (rawNotebook.folderId || null),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pageCount: rawPages.length || 1
  };

  // Save notebook metadata
  await saveNotebook(importedNotebook);

  // Save all pages with newly linked notebookId
  if (Array.isArray(rawPages) && rawPages.length > 0) {
    for (let i = 0; i < rawPages.length; i++) {
      const page = rawPages[i];
      const newPageId = `page-${newNotebookId}-${i + 1}`;
      await savePage({
        ...page,
        id: newPageId,
        notebookId: newNotebookId,
        pageIndex: typeof page.pageIndex === 'number' ? page.pageIndex : i
      });
    }
  } else {
    // Create at least one initial page if empty
    const firstPageId = `page-${newNotebookId}-1`;
    await savePage({
      id: firstPageId,
      notebookId: newNotebookId,
      pageIndex: 0,
      strokes: [],
      drawings: [],
      textBlocks: [],
      images: [],
      templateId: importedNotebook.templateId || 'blank'
    });
  }

  return importedNotebook;
};
