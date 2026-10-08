// Disposable, local-only PNGs. This database never contains editable note records.
export const pagePreviewKey = (page, templateId, epoch = '') => 'page-preview:' + JSON.stringify([page.notebookId, page.id, page.templateId || templateId || 'dotted', epoch]);
const LIMIT = 64 * 1024 * 1024;
let connection;
const open = () => {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    let ended = false;
    const request = indexedDB.open('BetterNote_PagePreviews', 1);
    const timer = setTimeout(() => { ended = true; connection = null; reject(Error('Preview cache unavailable')); }, 750);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('previews', { keyPath: 'id' });
      store.createIndex('notebookId', 'notebookId');
      store.createIndex('savedAt', 'savedAt');
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      if (ended) { request.result.close(); return; }
      request.result.onversionchange = () => { request.result.close(); connection = null; };
      resolve(request.result);
    };
    request.onerror = () => { clearTimeout(timer); connection = null; reject(Error('Preview cache unavailable')); };
  });
  return connection;
};
export const readPagePreviews = async (notebookId, pages, templateId, epoch = '') => {
  try {
    const db = await open(), wanted = new Set(pages.map(page => pagePreviewKey(page, templateId, epoch)));
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('previews', 'readonly'), found = [];
      let bytes = 0;
      const request = tx.objectStore('previews').index('notebookId').openCursor(notebookId);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const record = cursor.value;
        if (wanted.has(record.id) && bytes + record.size <= 24 * 1024 * 1024) { found.push(record); bytes += record.size; }
        cursor.continue();
      };
      tx.oncomplete = () => resolve(found);
      tx.onabort = tx.onerror = () => reject(Error('Preview cache unavailable'));
    });
  } catch (_) { return []; }
};
export const writePagePreview = async record => {
  if (!/^data:image\/png;base64,/i.test(record.dataUrl || '')) return;
  const size = record.dataUrl.length * 2;
  if (size > 512 * 1024) return;
  try {
    const db = await open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('previews', 'readwrite'), store = tx.objectStore('previews');
      const old = store.get(record.id), stats = store.get('__stats');
      let total;
      const save = () => {
        if (old.readyState !== 'done' || stats.readyState !== 'done') return;
        if ((old.result?.updatedAt || 0) > record.updatedAt) return;
        total = (stats.result?.total || 0) - (old.result?.size || 0) + size;
        store.put({ ...record, size, savedAt: Date.now() });
        if (total <= LIMIT) store.put({ id: '__stats', total });
        else {
          const request = store.index('savedAt').openCursor();
          request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor || total <= LIMIT) { store.put({ id: '__stats', total }); return; }
            total -= cursor.value.size || 0; cursor.delete(); cursor.continue();
          };
        }
      };
      old.onsuccess = stats.onsuccess = save;
      tx.oncomplete = resolve;
      tx.onabort = tx.onerror = () => reject(Error('Preview cache unavailable'));
    });
  } catch (_) { /* A cache failure never blocks editing or persistence. */ }
};
export const clearPagePreviewStorage = async () => {
  try {
    const db = await open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('previews', 'readwrite'); tx.objectStore('previews').clear();
      tx.oncomplete = resolve; tx.onabort = tx.onerror = reject;
    });
  } catch (_) { /* Disposable cache only. */ }
};
