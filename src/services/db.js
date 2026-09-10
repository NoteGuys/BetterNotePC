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

export const saveFolder = async (folder) => {
  const store = await getStore('folders', 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(folder);
    req.onsuccess = () => resolve(folder);
    req.onerror = () => reject(req.error);
  });
};

export const deleteFolder = async (folderId) => {
  const store = await getStore('folders', 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(folderId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
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

export const saveNotebook = async (notebook) => {
  const store = await getStore('notebooks', 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put({
      ...notebook,
      updatedAt: Date.now()
    });
    req.onsuccess = () => resolve(notebook);
    req.onerror = () => reject(req.error);
  });
};

export const deleteNotebook = async (notebookId) => {
  const db = await openDB();
  const tx = db.transaction(['notebooks', 'pages'], 'readwrite');
  
  // Delete notebook
  tx.objectStore('notebooks').delete(notebookId);
  
  // Delete associated pages
  const pageStore = tx.objectStore('pages');
  const index = pageStore.index('notebookId');
  const req = index.getAllKeys(notebookId);
  
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      const keys = req.result;
      keys.forEach(k => pageStore.delete(k));
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

/**
 * Duplicate a notebook with all its pages, strokes, and images
 */
export const duplicateNotebook = async (notebookId) => {
  const original = await getNotebookById(notebookId);
  if (!original) throw new Error('ไม่พบสมุดบันทึกที่ต้องการคัดลอก');

  const pages = await getPagesByNotebookId(notebookId);
  const newNotebookId = `nb-${Date.now()}`;

  const clonedNotebook = {
    ...original,
    id: newNotebookId,
    name: `${original.name} (สำเนา)`,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await saveNotebook(clonedNotebook);

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

  return clonedNotebook;
};

/**
 * Move a notebook to another folder (or root folder if null)
 */
export const moveNotebookToFolder = async (notebookId, targetFolderId) => {
  const store = await getStore('notebooks', 'readwrite');
  return new Promise((resolve, reject) => {
    const getReq = store.get(notebookId);
    getReq.onsuccess = () => {
      const nb = getReq.result;
      if (!nb) {
        return reject(new Error('ไม่พบสมุดบันทึก'));
      }
      nb.folderId = targetFolderId;
      nb.updatedAt = Date.now();
      const putReq = store.put(nb);
      putReq.onsuccess = () => resolve(nb);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
};

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

export const getPage = async (pageId) => {
  const store = await getStore('pages', 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(pageId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const savePage = async (page) => {
  const store = await getStore('pages', 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put({
      ...page,
      updatedAt: Date.now()
    });
    req.onsuccess = () => resolve(page);
    req.onerror = () => reject(req.error);
  });
};

export const deletePage = async (pageId) => {
  const store = await getStore('pages', 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(pageId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

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

// ==================== SETTINGS / CACHE ====================
export const getSetting = async (key) => {
  const store = await getStore('settings', 'readonly');
  return new Promise((resolve) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => resolve(null);
  });
};

export const saveSetting = async (key, value) => {
  const store = await getStore('settings', 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put({ key, value });
    req.onsuccess = () => resolve(value);
    req.onerror = () => reject(req.error);
  });
};

// ==================== SEED INITIAL DATA ====================
export const seedInitialData = async () => {
  const allFolders = await getAllFolders();
  if (allFolders.length > 0) return; // Already seeded

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

  await saveFolder(lectureFolder);
  await saveFolder(workFolder);

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
  await saveNotebook(welcomeNotebook);

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

  await savePage(page1);
  await savePage(page2);
};
