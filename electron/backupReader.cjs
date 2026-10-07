// Read-only backup validation. Runs in its own worker, independently of backup writes.
const disk = require('node:fs').promises;
const path = require('node:path');
const { createHash } = require('node:crypto');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const fault = (code, details = {}) => Object.assign(new Error(code), { code, ...details });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 512;
const stamp = value => value && [value.size, value.mtimeMs, value.ctimeMs, value.ino].join(':');
const fileKey = file => process.platform === 'win32' ? path.normalize(file).toLowerCase() : path.normalize(file);
const header = note => ({ id: note.id, name: note.name || '', updatedAt: note.updatedAt || 0,
  folderId: note.folderId || null, pageCount: note.pageCount, isDeleted: !!note.isDeleted });
const revision = note => JSON.stringify([note.id, Number(note.updatedAt) || 0, note.name || '',
  note.folderId || null, Number(note.pageCount) || 0, !!note.isDeleted]);
// Compare saved content independently of property order and cached thumbnails/timestamps.
const contentHash = note => digest(JSON.stringify(note, (key, value) => {
  if (['updatedAt', 'createdAt', 'thumbnailUrl', 'thumbnailUpdatedAt'].includes(key)) return undefined;
  return object(value) ? Object.fromEntries(Object.keys(value).sort().map(k => [k, value[k]])) : value;
}));
function validateNotebook(value) {
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
  return { ...value, pageCount: pages.length, pages };
}
function validateLibrary(folders, notebooks) {
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
function validateManifest(value, maxFileBytes) {
  if (!object(value) || value.version !== 2 || !object(value.notebooks)) throw fault('invalid-backup-manifest');
  for (const [id, entry] of Object.entries(value.notebooks)) {
    if (!validId(id) || !object(entry) || !object(entry.editable)) throw fault('backup-incomplete');
    const artifact = entry.editable;
    const parts = String(artifact.path || '').replace(/\\/g, '/').split('/');
    if (parts.length !== 2 || parts[0] !== 'Editable_Notes' || !parts[1].endsWith('.bnote') ||
        /[<>:"|?*\x00-\x1f]/.test(parts[1]) ||
        !/^[a-f0-9]{64}$/.test(artifact.hash || '') || !Number.isSafeInteger(artifact.size) || artifact.size <= 0 ||
        typeof artifact.revision !== 'string') throw fault('invalid-backup-manifest');
    if (artifact.size > maxFileBytes) throw fault('backup-too-large');
    if (entry.name !== undefined && typeof entry.name !== 'string') throw fault('invalid-backup-manifest');
    if (entry.updatedAt !== undefined && (!Number.isFinite(entry.updatedAt) || entry.updatedAt < 0)) throw fault('invalid-backup-manifest');
    if (!Number.isInteger(entry.pageCount) || entry.pageCount < 1) throw fault('invalid-backup-manifest');
  }
  if (value.activeIds !== undefined && (!Array.isArray(value.activeIds) || new Set(value.activeIds).size !== value.activeIds.length ||
      value.activeIds.some(id => !Object.hasOwn(value.notebooks, id)))) throw fault('invalid-backup-manifest');
  if (value.fullHash !== undefined && value.fullHash !== null &&
      (!/^[a-f0-9]{64}$/.test(value.fullHash) || !Number.isSafeInteger(value.fullSize) || value.fullSize <= 0)) throw fault('invalid-backup-manifest');
  return value;
}
function createBackupReader({ fs = disk, deadlineMs = 5000, maxFileBytes = 256 * 1048576,
  maxTotalBytes = 512 * 1048576, maxFiles = 10000 } = {}) {
  // Cache summaries only, never notebook pages, images, or raw file contents.
  const summaries = new Map();
  const timed = async promise => {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(fault('backup-read-timeout')), deadlineMs);
    })]); } finally { clearTimeout(timer); }
  };
  const optionalStat = async file => {
    try { return await timed(fs.stat(file)); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  };
  async function readFolder(folderPath, previewOnly) {
    const requested = path.resolve(folderPath);
    const rootStat = await optionalStat(requested);
    if (!rootStat) throw fault('not-found');
    if (!rootStat.isDirectory()) throw fault('backup-folder-unavailable');
    const root = await timed(fs.realpath(requested));
    const records = new Map(); let bytesRead = 0;
    const within = relative => {
      const file = path.resolve(root, relative), remainder = path.relative(root, file);
      if (!remainder || remainder.startsWith('..' + path.sep) || remainder === '..' || path.isAbsolute(remainder)) throw fault('unsafe-backup-path');
      return file;
    };
    const safeStat = async relative => {
      const file = within(relative), stat = await optionalStat(file);
      if (!stat) { records.set(file, null); return null; }
      const canonical = await timed(fs.realpath(file));
      const remainder = path.relative(root, canonical);
      if (remainder === '..' || remainder.startsWith('..' + path.sep) || path.isAbsolute(remainder)) throw fault('unsafe-backup-path');
      records.set(file, stamp(stat)); return stat;
    };
    const readJson = async (relative, limit = maxFileBytes) => {
      const stat = await safeStat(relative);
      if (!stat) return null;
      if (!stat.isFile()) throw fault('invalid-backup-data');
      if (stat.size > limit || bytesRead + stat.size > maxTotalBytes) throw fault('backup-too-large');
      bytesRead += stat.size;
      const file = within(relative), opening = fs.open(file, 'r');
      let handle, raw;
      try { handle = await timed(opening); }
      catch (error) { opening.then(late => late.close().catch(() => {}), () => {}); throw error; }
      try {
        if (stamp(await timed(handle.stat())) !== stamp(stat)) throw fault('backup-changed-during-read');
        // Bounded reads: a file growing after stat cannot allocate an unbounded buffer.
        raw = Buffer.allocUnsafe(stat.size);
        for (let offset = 0; offset < raw.length;) {
          const chunk = await timed(handle.read(raw, offset, Math.min(1048576, raw.length - offset), offset));
          if (!chunk.bytesRead) throw fault('backup-changed-during-read');
          offset += chunk.bytesRead;
        }
        if ((await timed(handle.read(Buffer.alloc(1), 0, 1, raw.length))).bytesRead ||
            stamp(await timed(handle.stat())) !== stamp(stat) || stamp(await optionalStat(file)) !== stamp(stat)) throw fault('backup-changed-during-read');
      } finally { await timed(handle.close()); }
      try { return { value: JSON.parse(raw.toString('utf8')), hash: digest(raw) }; }
      catch (_) { throw fault('invalid-backup-data'); }
    };
    const manifestFile = 'Full_System/backup_manifest.json', fullFile = 'Full_System/BetterNote_Latest_Backup.json';
    const manifestRaw = await readJson(manifestFile, 8 * 1048576);
    const manifest = manifestRaw ? validateManifest(manifestRaw.value, maxFileBytes) : null;
    const fullStat = await safeStat(fullFile), editStat = await safeStat('Editable_Notes');
    if (fullStat && !fullStat.isFile() || editStat && !editStat.isDirectory()) throw fault('invalid-backup-data');
    if (fullStat?.size > maxFileBytes) throw fault('backup-too-large');
    const listed = editStat ? await timed(fs.readdir(within('Editable_Notes'))) : [];
    const files = listed.filter(name => name.toLowerCase().endsWith('.bnote')).sort();
    if (files.length > maxFiles || Object.keys(manifest?.notebooks || {}).length > maxFiles) throw fault('backup-too-large');
    const issues = [];
    const issue = (reason, id = null, name = '') => issues.push({ reason, id, name });
    if (manifest) {
      if (!manifest.fullHash || !fullStat || fullStat.size !== manifest.fullSize) issue('backup-incomplete');
      for (const [id, entry] of Object.entries(manifest.notebooks)) {
        const stat = await safeStat(entry.editable.path);
        if (!stat?.isFile() || stat.size !== entry.editable.size) issue('backup-incomplete', id, entry.name);
        if (entry.backupConflict) issue('backup-conflict', id, entry.name);
      }
      if (issues.length) return { success: false, reason: issues[0].reason, folder: requested, issues };
    }
    // A manifest preview checks availability only. Content/hashes are rechecked on Restore.
    if (manifest && previewOnly) {
      await ensureUnchanged();
      const notebooks = Object.entries(manifest.notebooks).map(([id, entry]) => ({ ...header({ ...entry, id }), revision: entry.editable.revision }));
      return { success: true, folder: requested, source: 'validated-backup', count: notebooks.length,
        notebooks, verification: 'metadata-only' };
    }
    // Legacy folders have no manifest: invalidate a small metadata cache on every file stamp.
    for (const file of files) await safeStat(path.join('Editable_Notes', file));
    const cacheKey = digest(JSON.stringify([...records]));
    if (!manifest && previewOnly && summaries.has(root) && summaries.get(root).key === cacheKey) {
      await ensureUnchanged(); return { ...summaries.get(root).result, folder: requested };
    }
    const selected = new Map(), verifiedEditableIds = new Set(); let folders = [];
    const add = (note, source) => {
      const fingerprint = contentHash(note), old = selected.get(note.id);
      if (!old) { selected.set(note.id, { note, fingerprint, source }); return; }
      if (old.fingerprint !== fingerprint && (Number(old.note.updatedAt) || 0) === (Number(note.updatedAt) || 0)) {
        issue('backup-conflict', note.id, note.name); return;
      }
      if ((Number(note.updatedAt) || 0) > (Number(old.note.updatedAt) || 0)) selected.set(note.id, { note, fingerprint, source });
    };
    const full = await readJson(fullFile);
    if (full) {
      if (manifest && full.hash !== manifest.fullHash) issue('backup-incomplete');
      if (!object(full.value) || !Array.isArray(full.value.notebooks) || !Array.isArray(full.value.folders) ||
          full.value.appName !== undefined && full.value.appName !== 'BetterNote' || full.value.notebooks.length > maxFiles) throw fault('invalid-backup-data');
      folders = full.value.folders;
      const seen = new Set();
      for (const value of full.value.notebooks) {
        const note = validateNotebook(value);
        if (seen.has(note.id)) throw fault('invalid-backup-data');
        seen.add(note.id); add(note, 'full');
      }
    }
    for (const file of files) {
      const relative = path.join('Editable_Notes', file), raw = await readJson(relative);
      if (!raw) { issue('backup-changed-during-read'); continue; }
      const note = validateNotebook(raw.value), entry = manifest?.notebooks[note.id];
      if (manifest) {
        if (!Object.hasOwn(manifest.notebooks, note.id)) {
          issue('backup-incomplete', note.id, note.name); continue;
        }
        if (fileKey(entry.editable.path) !== fileKey(relative)) {
          // Old filename copies can remain after upgrading the backup writer.
          const old = selected.get(note.id);
          if (!old || (Number(note.updatedAt) || 0) > (Number(entry.updatedAt) || 0) ||
              (Number(note.updatedAt) || 0) === (Number(old.note.updatedAt) || 0) && contentHash(note) !== old.fingerprint) {
            issue('backup-conflict', note.id, note.name);
          }
          continue;
        }
        if (raw.hash !== entry.editable.hash || revision(note) !== entry.editable.revision) {
          issue('backup-incomplete', note.id, note.name); continue;
        }
        verifiedEditableIds.add(note.id);
      }
      add(note, relative);
    }
    if (manifest) for (const id of Object.keys(manifest.notebooks)) {
      if (!verifiedEditableIds.has(id)) issue('backup-incomplete', id, manifest.notebooks[id].name);
    }
    await ensureUnchanged();
    if (issues.length) return { success: false, reason: issues[0].reason, folder: requested, issues };
    if (!selected.size && !folders.length) throw fault('not-found');
    const notebooks = [...selected.values()].map(item => item.note);
    validateLibrary(folders, notebooks);
    const summary = { success: true, folder: requested, source: 'validated-backup', count: notebooks.length,
      verification: 'content-checked', notebooks: [...selected.values()].map(item => ({ ...header(item.note),
        revision: revision(item.note), contentHash: item.fingerprint, selectedSource: item.source })) };
    if (previewOnly) {
      summaries.delete(root); summaries.set(root, { key: cacheKey, result: summary });
      if (summaries.size > 4) summaries.delete(summaries.keys().next().value);
      return summary;
    }
    return { ...summary, data: { version: 1, appName: 'BetterNote', folders, notebooks } };
    async function ensureUnchanged() {
      for (const [file, expected] of records) {
        if (stamp(await optionalStat(file)) !== expected) throw fault('backup-changed-during-read');
      }
    }
  }
  const scanOne = async (folder, previewOnly) => {
    if (typeof folder !== 'string' || !folder.trim() || !path.isAbsolute(folder.trim())) return { success: false, reason: 'absolute-backup-folder-required' };
    try { return await readFolder(folder.trim(), previewOnly); }
    catch (error) { return { success: false, folder: folder.trim(), reason: error.code || 'backup-read-failed' }; }
  };
  return { async execute({ folderPath = null, candidates = [], previewOnly = false } = {}) {
    // Explicit choice is strict: never fall back to another folder or merge different destinations.
    if (folderPath !== null && folderPath !== undefined) return scanOne(folderPath, previewOnly);
    const unique = [...new Set(candidates.filter(p => typeof p === 'string' && path.isAbsolute(p)).map(p => path.resolve(p)))];
    if (unique.length > 12) return { success: false, reason: 'invalid-backup-request' };
    const found = [], problems = [];
    for (const folder of unique) {
      const result = await scanOne(folder, true);
      if (result.success) found.push(result); else if (result.reason !== 'not-found') problems.push(result);
    }
    if (found.length > 1 || found.length && problems.length) return { success: false, reason: 'backup-folder-choice-required',
      folders: [...found, ...problems].map(result => ({ folder: result.folder, count: result.count || 0, reason: result.reason || null })) };
    if (!found.length) return problems[0] || { success: false, reason: 'not-found' };
    return previewOnly ? found[0] : scanOne(found[0].folder, false);
  } };
}
module.exports = { createBackupReader, validateNotebook, validateLibrary };
