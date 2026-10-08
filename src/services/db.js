import { preservePdfOriginals } from '../utils/pdfOriginal.js';
import { NOTEBOOK_COPY_LABELS, localizeNotebookCopyName } from '../utils/notebookNames.js';
import { THUMBNAIL_COVER_ID } from '../data/covers.js';
import { syncPathKey, syncRevision } from '../../electron/backupSyncProtocol.js';

// High-Performance IndexedDB Storage for BetterNote
const DB_NAME = 'BetterNoteDB';
const DB_VERSION = 1;

let dbInstance = null;

export const openDB = () => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;

      // Folders store
      if (!db.objectStoreNames.contains('folders')) {
        const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
        folderStore.createIndex('parentId', 'parentId', { unique: false });
      }

      // Notebooks store
      if (!db.objectStoreNames.contains('notebooks')) {
        const nbStore = db.createObjectStore('notebooks', { keyPath: 'id' });
        nbStore.createIndex('folderId', 'folderId', { unique: false });
        nbStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Pages store (holding drawing strokes, text boxes, pdf snapshot per page)
      if (!db.objectStoreNames.contains('pages')) {
        const pageStore = db.createObjectStore('pages', { keyPath: 'id' });
        pageStore.createIndex('notebookId', 'notebookId', { unique: false });
        pageStore.createIndex('notebookPage', ['notebookId', 'pageIndex'], { unique: true });
      }

      // Settings & Cloud Cache store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };

    request.onerror = (e) => {
      console.error('IndexedDB error:', e.target.error);
      reject(e.target.error);
    };
  });
};

// Generic Transaction Helper
const getStore = async (storeName, mode = 'readonly') => {
  const db = await openDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
};

const backupChangeListeners = new Set();
export const subscribeBackupChanges = listener => {
  backupChangeListeners.add(listener);
  return () => backupChangeListeners.delete(listener);
};
const pendingWrites = new Set();
const writeListeners = new Set();
const notifyWrites = () => writeListeners.forEach(listener => listener());
export const getPendingWriteCount = () => pendingWrites.size;
export const subscribePendingWrites = listener => {
  writeListeners.add(listener);
  return () => writeListeners.delete(listener);
};
export const waitForPendingWrites = async () => {
  while (pendingWrites.size) {
    const results = await Promise.allSettled([...pendingWrites]);
    const failed = results.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
  }
};

// Request success is provisional. A write succeeds only at transaction complete.
const writeTransaction = (storeNames, operation) => {
  const promise = (async () => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, 'readwrite');
      let result, failure;
      const abort = error => {
        failure = error;
        try { tx.abort(); } catch (_) {}
      };
      tx.oncomplete = () => {
        resolve(result);
        const names = Array.isArray(storeNames) ? storeNames : [storeNames];
        if (names.some(name => ['pages', 'notebooks', 'folders'].includes(name))) {
          backupChangeListeners.forEach(listener => { try { listener(); } catch (_) {} });
        }
      };
      tx.onabort = () => reject(failure || tx.error || new Error('Local save aborted'));
      tx.onerror = event => { failure ||= tx.error || event.target?.error; };
      try { operation(tx, value => { result = value; }, abort); }
      catch (error) { abort(error); }
    });
  })();
  pendingWrites.add(promise);
  notifyWrites();
  const finish = () => { pendingWrites.delete(promise); notifyWrites(); };
  promise.then(finish, finish);
  return promise;
};
const nextUpdatedAt = (...timestamps) => Math.max(Date.now(), ...timestamps.map(value => (Number(value) || 0) + 1));

// Recovery only: one transaction; retain incoming timestamps and unrelated notebooks.
// Called in the bundled worker so rich pages are never cloned through the UI.
export const restoreBackupAtomic = (data, operationId, syncOptions = null) => writeTransaction(
  ['folders', 'notebooks', 'pages', 'settings'], (tx, done, abort) => {
    const pageStore = tx.objectStore('pages'), notebookStore = tx.objectStore('notebooks');
    const result = { ...(syncOptions?.resultExtras || {}), foldersCount: data.folders.length, notebooksCount: data.notebooks.length,
      notebooks: data.notebooks.map(note => ({ id: note.id, name: note.name, pageCount: note.pages.length })) };
    const fail = code => abort(Object.assign(new Error(code), { code }));
    const saveNextNotebook = index => {
      try {
        if (index >= data.notebooks.length) {
          for (const setting of syncOptions?.settingsUpdates || []) tx.objectStore('settings').put(setting);
          tx.objectStore('settings').put({ key: 'backup_recovery_receipt', value: { operationId, result } });
          done(result); return;
        }
        const { pages, ...note } = data.notebooks[index];
        notebookStore.put({ ...note, pageCount: pages.length });
        let pageIndex = 0;
        const saveNextPage = () => {
          try {
            if (pageIndex >= pages.length) { saveNextNotebook(index + 1); return; }
            const page = pages[pageIndex++], request = pageStore.get(page.id);
            request.onsuccess = () => {
              try {
                if (request.result && request.result.notebookId !== note.id) { fail('backup-recovery-id-conflict'); return; }
                pageStore.put(page).onsuccess = saveNextPage;
              } catch (error) { abort(error); }
            };
          } catch (error) { abort(error); }
        };
        saveNextPage();
      } catch (error) { abort(error); }
    };
    // Delete old pages before inserting reordered pages with the same unique index.
    const ids = data.notebooks.map(note => note.id);
    const deleteNextNotebook = index => {
      if (index >= ids.length) { saveNextNotebook(0); return; }
      const request = pageStore.index('notebookId').openKeyCursor(IDBKeyRange.only(ids[index]));
      request.onsuccess = () => {
        try {
          const cursor = request.result;
          if (!cursor) { deleteNextNotebook(index + 1); return; }
          pageStore.delete(cursor.primaryKey); cursor.continue();
        } catch (error) { abort(error); }
      };
    };
    const begin = () => {
      for (const folder of data.folders) tx.objectStore('folders').put(folder);
      deleteNextNotebook(0);
    };
    if (!syncOptions) { begin(); return; }
    // Compare versions and the selected destination in the SAME transaction as incoming pages.
    const expected = syncOptions.expectedRevisions || [];
    let remaining = expected.length + 2;
    const checked = () => { if (--remaining === 0) begin(); };
    for (const item of expected) {
      const request = notebookStore.get(item.id);
      request.onsuccess = () => {
        if (item.revision === null ? !!request.result : !request.result || syncRevision(request.result) !== item.revision) {
          fail('drive-sync-local-changed'); return;
        }
        checked();
      };
    }
    const method = tx.objectStore('settings').get('gdrive_backup_method');
    method.onsuccess = () => { if (method.result?.value !== 'desktop') { fail('drive-sync-destination-changed'); return; } checked(); };
    const folder = tx.objectStore('settings').get('gdrive_backup_path');
    folder.onsuccess = () => { if (syncPathKey(folder.result?.value) !== syncPathKey(syncOptions.path)) { fail('drive-sync-destination-changed'); return; } checked(); };
  }
);
export const getBackupRecoveryReceipt = async () => {
  const store = await getStore('settings');
  return new Promise((resolve, reject) => {
    const request = store.get('backup_recovery_receipt');
    request.onsuccess = () => resolve(request.result?.value || null);
    request.onerror = () => reject(request.error);
  });
};

// ==================== FOLDERS ====================
export const getFolders = async (parentId = null) => {
  const store = await getStore('folders', 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const all = request.result || [];
      if (parentId === null) {
        resolve(all.filter(f => !f.parentId));
      } else {
        resolve(all.filter(f => f.parentId === parentId));
      }
    };
    request.onerror = () => reject(request.error);
  });
};

export const getAllFolders = async () => {
  const store = await getStore('folders', 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
};

export const saveFolder = folder => writeTransaction('folders', (tx, done) => {
  tx.objectStore('folders').put(folder);
  done(folder);
});

export const deleteFolder = folderId => writeTransaction(['folders', 'notebooks'], (tx, done, abort) => {
  const folderStore = tx.objectStore('folders');
  const notebookStore = tx.objectStore('notebooks');
  const foldersRequest = folderStore.getAll();
  const notebooksRequest = notebookStore.index('folderId').getAll(folderId);
  let folders, notebooks;
  const finish = () => {
    if (!folders || !notebooks) return;
    try {
      const folder = folders.find(item => item.id === folderId);
      let parentId = folder?.parentId || null;
      const visited = new Set([folderId]);
      let ancestorId = parentId;
      while (ancestorId) {
        const ancestor = folders.find(item => item.id === ancestorId);
        if (!ancestor || ancestor.isDeleted || visited.has(ancestorId)) { parentId = null; break; }
        visited.add(ancestorId);
        ancestorId = ancestor.parentId;
      }
      const remainingFolders = folders.filter(item => item.id !== folderId).map(item => {
        if (item.parentId !== folderId) return item;
        const moved = { ...item, parentId, updatedAt: nextUpdatedAt(item.updatedAt) };
        folderStore.put(moved);
        return moved;
      });
      const movedNotebooks = notebooks.map(item => {
        const moved = { ...item, folderId: parentId, updatedAt: nextUpdatedAt(item.updatedAt) };
        notebookStore.put(moved);
        return moved;
      });
      folderStore.delete(folderId);
      done({ parentId, folders: remainingFolders, notebooks: movedNotebooks });
    } catch (error) { abort(error); }
  };
  foldersRequest.onsuccess = () => { folders = foldersRequest.result || []; finish(); };
  notebooksRequest.onsuccess = () => { notebooks = notebooksRequest.result || []; finish(); };
});

export const batchDeleteFolders = async (folderIds = []) => {
  if (!Array.isArray(folderIds)) return;
  for (const folderId of folderIds) await deleteFolder(folderId);
};

// ==================== NOTEBOOKS ====================
export const getNotebooks = async (folderId = null) => {
  const store = await getStore('notebooks', 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      if (folderId === null) {
        resolve(all.filter(n => !n.folderId));
      } else {
        resolve(all.filter(n => n.folderId === folderId));
      }
    };
    req.onerror = () => reject(req.error);
  });
};

export const getAllNotebooks = async () => {
  const store = await getStore('notebooks', 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
};

export const getNotebookById = async (id) => {
  const store = await getStore('notebooks', 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

// Match the Windows backup filename without changing the user's displayed spelling.
const notebookNameKey = (name) => String(name || 'Untitled')
  .normalize('NFC')
  .replace(/[\\/:*?"<>|]/g, '_')
  .trim()
  .toLowerCase();

const uniqueNotebookName = (requestedName, occupiedNames, nameKey = notebookNameKey) => {
  if (!occupiedNames.has(nameKey(requestedName))) return requestedName;
  const baseName = requestedName.replace(/\([1-9]\d*\)$/, '').trimEnd();
  let number = 1;
  while (occupiedNames.has(nameKey(`${baseName}(${number})`))) number++;
  return `${baseName}(${number})`;
};

export const saveNotebook = (notebook, { ensureUniqueName = false, nameKey = notebookNameKey } = {}) =>
  writeTransaction('notebooks', (tx, done) => {
    const store = tx.objectStore('notebooks');
    let previousUpdatedAt = 0, previousNotebook = null;
    const putNotebook = name => {
      const cached = previousNotebook?.firstPageThumbnail, incoming = notebook.firstPageThumbnail;
      const keepFreshCover = notebook.coverId === THUMBNAIL_COVER_ID && previousNotebook?.coverId === THUMBNAIL_COVER_ID && cached &&
        (!incoming || incoming.pageId !== cached.pageId || incoming.pageUpdatedAt < cached.pageUpdatedAt);
      const saved = { ...notebook, ...(keepFreshCover ? { firstPageThumbnail: cached } : {}), name, updatedAt: nextUpdatedAt(notebook.updatedAt, previousUpdatedAt) };
      store.put(saved);
      done(saved);
    };
    const existing = store.get(notebook.id);
    existing.onsuccess = () => {
      previousNotebook = existing.result || null;
      previousUpdatedAt = previousNotebook?.updatedAt || 0;
      if (!ensureUniqueName || typeof notebook.name !== 'string' || existing.result?.name === notebook.name) { putNotebook(notebook.name); return; }
      const occupiedNames = new Set();
      const names = store.openCursor();
      names.onsuccess = () => {
        const cursor = names.result;
        if (cursor) {
          if (cursor.primaryKey !== notebook.id) occupiedNames.add(nameKey(cursor.value.name));
          cursor.continue();
        } else putNotebook(uniqueNotebookName(notebook.name, occupiedNames, nameKey));
      };
    };
  });

// Derived cover metadata only. A stale preview must never replace a newer page's cover.
export const saveNotebookThumbnail = (notebookId, preview) => {
  if (!preview || !/^data:image\/png;base64,/i.test(preview.dataUrl || '') || preview.dataUrl.length > 600000 ||
      ![preview.width, preview.height].every(value => Number.isInteger(value) && value > 0 && value <= 320)) {
    return Promise.reject(new Error('Invalid notebook preview'));
  }
  return writeTransaction(['notebooks', 'pages'], (tx, done) => {
    const notebooks = tx.objectStore('notebooks');
    const notebookRequest = notebooks.get(notebookId);
    const firstRequest = tx.objectStore('pages').index('notebookPage').get([notebookId, 0]);
    let notebook, firstPage;
    const finish = () => {
      if (notebook === undefined || firstPage === undefined) return;
      if (!notebook || notebook.coverId !== THUMBNAIL_COVER_ID || !firstPage || firstPage.id !== preview.pageId || firstPage.updatedAt !== preview.pageUpdatedAt) {
        done(null); return;
      }
      const saved = { ...notebook, firstPageThumbnail: {
        dataUrl: preview.dataUrl, width: preview.width, height: preview.height,
        pageId: preview.pageId, pageUpdatedAt: preview.pageUpdatedAt
      } };
      // A preview refresh is not a user edit; keep name, pageCount and updatedAt intact.
      notebooks.put(saved); done(saved);
    };
    notebookRequest.onsuccess = () => { notebook = notebookRequest.result || null; finish(); };
    firstRequest.onsuccess = () => { firstPage = firstRequest.result || null; finish(); };
  });
};

export const deleteNotebook = notebookId => batchDeleteNotebooks([notebookId]);

export const batchDeleteNotebooks = (notebookIds = []) => {
  if (!Array.isArray(notebookIds) || !notebookIds.length) return Promise.resolve();
  return writeTransaction(['notebooks', 'pages'], tx => {
    const notebookStore = tx.objectStore('notebooks');
    const pageStore = tx.objectStore('pages');
    const pageIndex = pageStore.index('notebookId');
    notebookIds.forEach(id => {
      notebookStore.delete(id);
      const req = pageIndex.getAllKeys(id);
      req.onsuccess = () => (req.result || []).forEach(key => pageStore.delete(key));
    });
  });
};

/**
 * Duplicate a notebook with all its pages, strokes, and images
 */
export const duplicateNotebook = async (notebookId, { copySuffix = 'Copy' } = {}) => {
  const suffix = NOTEBOOK_COPY_LABELS.includes(copySuffix) ? copySuffix : 'Copy';
  const original = await getNotebookById(notebookId);
  if (!original) {
    const error = new Error('Notebook to duplicate was not found');
    error.code = 'NOTEBOOK_NOT_FOUND';
    throw error;
  }

  const pages = await getPagesByNotebookId(notebookId);
  const newNotebookId = `nb-${Date.now()}`;

  const clonedNotebook = {
    ...original,
    id: newNotebookId,
    name: localizeNotebookCopyName(original.name, suffix) + ' (' + suffix + ')',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const savedNotebook = await saveNotebook(clonedNotebook, {
    ensureUniqueName: true,
    // Old copies keep their stored names; avoid duplicates of their localized titles.
    nameKey: name => notebookNameKey(localizeNotebookCopyName(name, suffix))
  });

  // Clone all pages
  for (const page of pages) {
    const clonedPage = {
      ...page,
      id: `${newNotebookId}_page_${page.pageIndex}_${Date.now()}`,
      notebookId: newNotebookId,
      updatedAt: Date.now()
    };
    await savePage(clonedPage);
  }

  return savedNotebook;
};

/**
 * Move a notebook to another folder (or root folder if null)
 */
export const moveNotebookToFolder = (notebookId, targetFolderId) =>
  writeTransaction('notebooks', (tx, done, abort) => {
    const store = tx.objectStore('notebooks');
    const req = store.get(notebookId);
    req.onsuccess = () => {
      if (!req.result) { abort(new Error('Notebook not found')); return; }
      const updated = { ...req.result, folderId: targetFolderId, updatedAt: nextUpdatedAt(req.result.updatedAt) };
      store.put(updated);
      done(updated);
    };
  });

// ==================== PAGES ====================
export const getPagesByNotebookId = async (notebookId) => {
  const store = await getStore('pages', 'readonly');
  const index = store.index('notebookId');
  return new Promise((resolve, reject) => {
    const req = index.getAll(notebookId);
    req.onsuccess = () => {
      const pages = req.result || [];
      // Sort by pageIndex ascending
      pages.sort((a, b) => a.pageIndex - b.pageIndex);
      resolve(pages);
    };
    req.onerror = () => reject(req.error);
  });
};

/**
 * Fast single-page fetch for notebook covers: stops after reading the first record!
 */
export const getFirstPageByNotebookId = async (notebookId) => {
  const store = await getStore('pages', 'readonly');
  const index = store.index('notebookId');
  return new Promise((resolve, reject) => {
    const req = index.openCursor(IDBKeyRange.only(notebookId));
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        resolve(cursor.value);
      } else {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
};

// Thumbnail rendering and its guarded write must refer to the same actual first page.
// Use the existing position index, not the alphabetical order of page IDs.
export const getNotebookThumbnailPage = async notebookId => {
  const store = await getStore('pages', 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.index('notebookPage').get([notebookId, 0]);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
};

export const getPage = async (pageId) => {
  const store = await getStore('pages', 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(pageId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const savePage = (page, { preservePageIndex = false, requireExisting = false } = {}) =>
  writeTransaction(['pages', 'notebooks'], (tx, done, abort) => {
    const pages = tx.objectStore('pages');
    const notebooks = tx.objectStore('notebooks');
    const notebookRequest = notebooks.get(page.notebookId);
    const put = existing => {
      if (requireExisting && (!existing || existing.notebookId !== page.notebookId)) {
        abort(new Error('The page no longer exists'));
        return;
      }
      const { __pdfOriginalOmitted, ...pageData } = page;
      const saved = {
        ...pageData,
        ...(__pdfOriginalOmitted && existing?.pdfOriginal ? { pdfOriginal: existing.pdfOriginal } : {}),
        ...(preservePageIndex && existing ? { pageIndex: existing.pageIndex } : {}),
        updatedAt: nextUpdatedAt(page.updatedAt, existing?.updatedAt)
      };
      pages.put(saved);
      done(saved);
    };
    notebookRequest.onsuccess = () => {
      const notebook = notebookRequest.result;
      if (notebook) notebooks.put({ ...notebook, updatedAt: nextUpdatedAt(notebook.updatedAt, page.updatedAt) });
    };
    if (preservePageIndex || requireExisting || page.__pdfOriginalOmitted) {
      const existingRequest = pages.get(page.id);
      existingRequest.onsuccess = () => put(existingRequest.result);
    } else put();
  });

export const deletePage = pageId => writeTransaction('pages', tx => {
  tx.objectStore('pages').delete(pageId);
});

/**
 * Get all bookmarked / favorited pages across all notebooks
 */
export const getAllFavoritePages = async () => {
  const store = await getStore('pages', 'readonly');
  return new Promise((resolve, reject) => {
    const favorites = [];
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        if (cursor.value?.isFavorite) {
          const v = cursor.value;
          favorites.push({
            id: v.id,
            notebookId: v.notebookId,
            pageIndex: v.pageIndex,
            isFavorite: true,
            templateId: v.templateId,
            paperColor: v.paperColor,
            thumbnailUrl: v.thumbnailUrl || v.pdfPageImage,
            strokes: v.strokes || [],
            updatedAt: v.updatedAt
          });
        }
        cursor.continue();
      } else {
        resolve(favorites);
      }
    };
    req.onerror = () => reject(req.error);
  });
};

// Structural changes, reindexing and notebook pageCount commit together.
// Shift only affected pages, in index-safe order; ordinary ink is never reindexed.
export const mutateNotebookPages = (notebookId, change) =>
  writeTransaction(['pages', 'notebooks'], (tx, done, abort) => {
    const pageStore = tx.objectStore('pages');
    const notebookStore = tx.objectStore('notebooks');
    const pagesRequest = pageStore.index('notebookId').getAll(notebookId);
    const notebookRequest = notebookStore.get(notebookId);
    let pages, notebook;
    const finish = () => {
      if (!pages || notebook === undefined) return;
      try {
        if (!notebook) throw new Error('Notebook not found');
        pages.sort((a, b) => a.pageIndex - b.pageIndex);
        let nextPages, changedPage;
        if (change.kind === 'insert') {
          const target = change.afterPageId ? pages.findIndex(page => page.id === change.afterPageId) : pages.length - 1;
          if (change.afterPageId && target < 0) throw new Error('Page not found');
          const insertAt = change.atIndex === undefined ? target + 1 : change.atIndex;
          if (!Number.isInteger(insertAt) || insertAt < 0 || insertAt > pages.length) throw new Error('Invalid page position');
          if (change.page.notebookId !== notebookId || pages.some(page => page.id === change.page.id)) throw new Error('Invalid page');
          nextPages = [...pages];
          const { __pdfOriginalOmitted, ...insertedPage } = change.page;
          changedPage = { ...insertedPage, pageIndex: insertAt, updatedAt: nextUpdatedAt(change.page.updatedAt) };
          nextPages.splice(insertAt, 0, changedPage);
          nextPages = nextPages.map((page, index) => ({ ...page, pageIndex: index }));
          for (let index = nextPages.length - 1; index > insertAt; index--) pageStore.put(nextPages[index]);
          pageStore.add(nextPages[insertAt]);
        } else if (change.kind === 'delete') {
          const removeAt = pages.findIndex(page => page.id === change.pageId);
          if (removeAt < 0) throw new Error('Page not found');
          if (pages.length <= 1) throw new Error('Cannot delete the only page');
          changedPage = pages[removeAt];
          pageStore.delete(change.pageId);
          nextPages = pages.filter(page => page.id !== change.pageId).map((page, index) => ({ ...page, pageIndex: index }));
          for (let index = removeAt; index < nextPages.length; index++) pageStore.put(nextPages[index]);
        } else throw new Error('Invalid page operation');
        const portablePages = preservePdfOriginals(nextPages, change.kind === 'delete' ? changedPage : null);
        portablePages.forEach((page, index) => { if (page !== nextPages[index]) pageStore.put(page); });
        nextPages = portablePages;
        const updatedNotebook = { ...notebook, pageCount: nextPages.length, updatedAt: nextUpdatedAt(notebook.updatedAt) };
        notebookStore.put(updatedNotebook);
        done({ pages: nextPages, notebook: updatedNotebook, changedPage });
      } catch (error) { abort(error); }
    };
    pagesRequest.onsuccess = () => { pages = pagesRequest.result || []; finish(); };
    notebookRequest.onsuccess = () => { notebook = notebookRequest.result || null; finish(); };
  });

// ==================== SETTINGS / CACHE ====================
export const getSetting = async (key) => {
  const store = await getStore('settings', 'readonly');
  return new Promise((resolve) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => resolve(null);
  });
};

export const saveSetting = (key, value) => writeTransaction('settings', (tx, done) => {
  tx.objectStore('settings').put({ key, value });
  done(value);
});

// ==================== SEED INITIAL DATA ====================
export const seedInitialData = async () => {
  // The initialization marker is separate from user folders.

  // Create default sample folder
  const lectureFolder = {
    id: 'folder-demo-1',
    name: 'Lecture Notes (วิชาเรียน)',
    parentId: null,
    color: '#06b6d4',
    icon: 'book',
    createdAt: Date.now()
  };
  const workFolder = {
    id: 'folder-demo-2',
    name: 'Work & Projects (โครงการงาน)',
    parentId: null,
    color: '#10b981',
    icon: 'apple',
    createdAt: Date.now()
  };


  // Create default Welcome Notebook
  const welcomeNotebookId = 'nb-welcome-1';
  const welcomeNotebook = {
    id: welcomeNotebookId,
    name: 'ยินดีต้อนรับสู่ BetterNote',
    folderId: lectureFolder.id,
    coverId: 'deep-ocean',
    templateId: 'ruled',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pageCount: 2,
    isPdf: false
  };

  // Seed Page 1: with a warm handwritten sample message
  const page1 = {
    id: `${welcomeNotebookId}_page_0`,
    notebookId: welcomeNotebookId,
    pageIndex: 0,
    templateId: 'ruled',
    strokes: [
      // Draw smiley underline
      {
        tool: 'highlighter',
        color: '#fef08a',
        width: 24,
        points: [
          { x: 120, y: 160, pressure: 0.5 },
          { x: 300, y: 160, pressure: 0.5 },
          { x: 500, y: 160, pressure: 0.5 }
        ]
      },
      {
        tool: 'pen',
        color: '#2563eb',
        width: 3,
        points: [
          { x: 130, y: 150, pressure: 0.7 },
          { x: 140, y: 140, pressure: 0.7 },
          { x: 155, y: 155, pressure: 0.7 }
        ]
      }
    ],
    textElements: [
      {
        id: 'txt-1',
        x: 120,
        y: 110,
        text: 'ยินดีต้อนรับสู่ BetterNote!',
        fontSize: 28,
        fontFamily: 'Plus Jakarta Sans',
        color: '#1e293b',
        bold: true
      },
      {
        id: 'txt-2',
        x: 120,
        y: 190,
        text: '• วาดเขียนได้ทันทีด้วยปากกา & ปากกาไฮไลท์ ลื่นไหลระดับ Native ไม่หน่วง\n• นำเข้าไฟล์ PDF แล้วขีดเขียน จดสรุป ไฮไลท์ทับได้ทุกหน้า\n• จัดโฟลเดอร์แยกหมวดหมู่ และเชื่อมต่อสำรองข้อมูลกับ Google Drive / Cloud\n• ข้อมูลทั้งหมดบันทึกในเครื่องทันที ปลอดภัยและเปิดแอปได้ในเสี้ยววินาที',
        fontSize: 16,
        fontFamily: 'Inter',
        color: '#475569',
        bold: false
      }
    ],
    updatedAt: Date.now()
  };

  const page2 = {
    id: `${welcomeNotebookId}_page_1`,
    notebookId: welcomeNotebookId,
    pageIndex: 1,
    templateId: 'grid',
    strokes: [],
    textElements: [
      {
        id: 'txt-3',
        x: 120,
        y: 110,
        text: 'หน้ากระดาษแบบตารางกราฟ (Grid Template)',
        fontSize: 22,
        fontFamily: 'Plus Jakarta Sans',
        color: '#0f172a',
        bold: true
      },
      {
        id: 'txt-4',
        x: 120,
        y: 170,
        text: 'ทดลองใช้ปากกา หรือกล่องข้อความเพื่อเริ่มจดโน้ตในหน้านี้ได้เลย!',
        fontSize: 16,
        fontFamily: 'Inter',
        color: '#64748b',
        bold: false
      }
    ],
    updatedAt: Date.now()
  };

  return writeTransaction(['folders', 'notebooks', 'pages', 'settings'], tx => {
    const settings = tx.objectStore('settings');
    const marker = settings.get('initialDataSeeded');
    const counts = ['folders', 'notebooks', 'pages'].map(name => tx.objectStore(name).count());
    let remaining = counts.length + 1;
    const finish = () => {
      if (--remaining > 0 || marker.result?.value) return;
      // Existing content, including root-only notebooks, always wins.
      if (counts.every(request => request.result === 0)) {
        tx.objectStore('folders').add(lectureFolder);
        tx.objectStore('folders').add(workFolder);
        tx.objectStore('notebooks').add(welcomeNotebook);
        tx.objectStore('pages').add(page1);
        tx.objectStore('pages').add(page2);
      }
      settings.put({ key: 'initialDataSeeded', value: true });
    };
    marker.onsuccess = finish;
    counts.forEach(request => { request.onsuccess = finish; });
  });
};

// Backup reads share one transaction: a page reorder cannot split a snapshot.
export const getBackupMetadata = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['folders', 'notebooks'], 'readonly');
    const metadata = { folders: [], notebooks: [] };
    tx.oncomplete = () => resolve(metadata);
    tx.onabort = () => reject(tx.error || new Error('Backup metadata read aborted'));
    tx.onerror = () => {};
    for (const name of ['folders', 'notebooks']) {
      const request = tx.objectStore(name).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const value = cursor.value;
        metadata[name].push(name === 'folders' ? value : {
          id: value.id, name: value.name, folderId: value.folderId,
          updatedAt: value.updatedAt, pageCount: value.pageCount, isDeleted: value.isDeleted
        });
        cursor.continue();
      };
    }
  });
};
export const getBackupNotebookSnapshot = async notebookId => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['notebooks', 'pages'], 'readonly');
    let notebook;
    const pages = [];
    tx.oncomplete = () => resolve(notebook ? {
      ...notebook, pages: pages.sort((a, b) => a.pageIndex - b.pageIndex)
    } : null);
    tx.onabort = () => reject(tx.error || new Error('Backup notebook read aborted'));
    tx.onerror = () => {};
    const request = tx.objectStore('notebooks').get(notebookId);
    request.onsuccess = () => { notebook = request.result; };
    const cursorRequest = tx.objectStore('pages').index('notebookId').openCursor(notebookId);
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      pages.push(cursor.value);
      cursor.continue();
    };
  });
};

// Publish only after every small page image is ready; aborted imports leave no partial notebook.
export const importNotebookPagesAtomic = (notebook, pages, { requireFolder = false } = {}) => writeTransaction(requireFolder ? ['notebooks','pages','folders'] : ['notebooks','pages'], (tx,done,abort) => {
  if (!pages?.length || pages.some((p,i)=>p.notebookId!==notebook.id || p.pageIndex!==i)) { abort(Error('Incomplete PDF import')); return; }
  if(requireFolder && notebook.folderId!=null){const folder=tx.objectStore('folders').get(notebook.folderId);folder.onsuccess=()=>{if(!folder.result || folder.result.isDeleted)abort(Object.assign(Error('bnote-folder-missing'),{code:'bnote-folder-missing'}));};}
  const notebooks=tx.objectStore('notebooks'), occupied=new Set(), names=notebooks.openCursor();
  names.onsuccess=()=>{const cursor=names.result;if(cursor){occupied.add(notebookNameKey(cursor.value.name));cursor.continue();return;}
    const saved={...notebook,name:uniqueNotebookName(notebook.name,occupied,notebookNameKey),pageCount:pages.length};
    notebooks.add(saved);for(const page of pages)tx.objectStore('pages').add(page);done(saved);
  };
});
// Find the one portable source without collecting notebook media.
export const getPdfOriginalSource = async (notebookId, originalId) => {
  const db=await openDB();return new Promise((resolve,reject)=>{
    const tx=db.transaction('pages','readonly');let source=null;
    const request=tx.objectStore('pages').index('notebookId').openCursor(notebookId);
    request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;if(cursor.value.pdfOriginal?.id===originalId){source=cursor.value.pdfOriginal;return;}cursor.continue();};
    tx.oncomplete=()=>resolve(source);tx.onabort=tx.onerror=()=>reject(Error('PDF source unavailable'));
  });
};
