// Read-only backup validation. Runs in its own worker, independently of backup writes.
const disk = require('node:fs').promises;
const { isLegacySummary } = require('./backupLegacy.cjs');
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
function validateManifest(value, maxFileBytes) {
  if (!object(value) || value.version !== 2 || !object(value.notebooks)) throw fault('invalid-backup-manifest');
  if(value.fullPath&&!/^Full_System[\\/]Backup--[a-f0-9]{64}\.json$/.test(value.fullPath))throw fault('unsafe-backup-path');
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
function createBackupReader({ fs = disk, deadlineMs = 120000, onProgress = () => {}, maxFileBytes = 256 * 1048576,
  maxTotalBytes = 512 * 1048576, maxSnapshotBytes = 512 * 1048576, maxFiles = 10000 } = {}) {
  const syncReader = require('./backupSyncReader.cjs').createBackupSyncReader({ fs, deadlineMs, maxFileBytes, onProgress });
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
  async function readFolder(folderPath, previewOnly, previousManifest = null, snapshotRecovery = false) {
    const { validateNotebook, validateLibrary, recoverMissingNotebookFolders } = await import('./backupValidation.js');
    const requested = path.resolve(folderPath);
    const rootStat = await optionalStat(requested);
    if (!rootStat) throw fault('not-found');
    if (!rootStat.isDirectory()) throw fault('backup-folder-unavailable');
    const root = await timed(fs.realpath(requested));
    const records = new Map(), artifacts = new Map(), locations = new Map(); let bytesRead = 0;
    const within = relative => {
      const file = path.resolve(root, locations.get(relative) || relative), remainder = path.relative(root, file);
      if (!remainder || remainder.startsWith('..' + path.sep) || remainder === '..' || path.isAbsolute(remainder)) throw fault('unsafe-backup-path');
      return file;
    };
    const safeStat = async relative => {
      let file = within(relative), stat = await optionalStat(file);
      if (!stat && previousManifest && /^(Editable_Notes|Full_System)[\\/]([^\\/]+)$/.test(relative) && relative !== 'Full_System/backup_manifest.json') {
        records.set(file,null);
        locations.set(relative,path.join('Backup_History',relative));file=within(relative);stat=await optionalStat(file);
      }
      if (!stat) { records.set(file, null); return null; }
      const canonical = await timed(fs.realpath(file));
      const remainder = path.relative(root, canonical);
      if (remainder === '..' || remainder.startsWith('..' + path.sep) || path.isAbsolute(remainder)) throw fault('unsafe-backup-path');
      records.set(file, stamp(stat)); return stat;
    };
    const progress = details => { try { onProgress(details); } catch (_) {} };
    const readArtifact = async (relative, { limit = maxFileBytes, parseJson = true, keepBytes = false } = {}) => {
      const stat = await safeStat(relative);
      if (!stat) return null;
      if (!stat.isFile()) throw fault('invalid-backup-data');
      if (stat.size > limit || bytesRead + stat.size > maxTotalBytes) throw fault('backup-too-large');
      bytesRead += stat.size;
      const file = within(relative), opening = fs.open(file, 'r');
      progress({ stage: 'opening', file: relative, bytesDone: 0, totalBytes: stat.size });
      let handle, raw, hash;
      try { handle = await timed(opening); }
      catch (error) { opening.then(late => late.close().catch(() => {}), () => {}); throw error; }
      try {
        if (stamp(await timed(handle.stat())) !== stamp(stat)) throw fault('backup-changed-during-read');
        // Hash an already-parsed full-snapshot notebook using one 1 MiB buffer.
        raw = keepBytes ? Buffer.allocUnsafeSlow(stat.size) : Buffer.allocUnsafe(parseJson ? stat.size : Math.min(1048576, stat.size));
        const hasher = createHash('sha256');
        for (let offset = 0; offset < stat.size;) {
          const bufferOffset = parseJson ? offset : 0;
          const chunk = await timed(handle.read(raw, bufferOffset, Math.min(1048576, stat.size - offset), offset));
          if (!chunk.bytesRead) throw fault('backup-changed-during-read');
          hasher.update(raw.subarray(bufferOffset, bufferOffset + chunk.bytesRead));
          offset += chunk.bytesRead;
          progress({ stage: 'reading', file: relative, bytesDone: offset, totalBytes: stat.size });
        }
        hash = hasher.digest('hex');
        if ((await timed(handle.read(Buffer.alloc(1), 0, 1, stat.size))).bytesRead ||
            stamp(await timed(handle.stat())) !== stamp(stat) || stamp(await optionalStat(file)) !== stamp(stat)) throw fault('backup-changed-during-read');
      } finally { await timed(handle.close()); }
      artifacts.set(relative, { path: relative, hash, size: stat.size });
      if (!parseJson) return { hash };
      progress({ stage: 'checking', file: relative, bytesDone: stat.size, totalBytes: stat.size });
      try { return { value: JSON.parse(raw.toString('utf8')), hash, ...(keepBytes ? { bytes: raw } : {}) }; }
      catch (_) { throw fault('invalid-backup-data'); }
    };
    const readJson = (relative, limit = maxFileBytes) => readArtifact(relative, { limit });
    const manifestFile = previousManifest || 'Full_System/backup_manifest.json';
    const manifestRaw = await readJson(manifestFile, 8 * 1048576);
    if(previousManifest&&(!manifestRaw||manifestRaw.hash!==path.basename(previousManifest).slice(0,64)))throw fault('invalid-backup-manifest');
    const legacy = !manifestRaw || isLegacySummary(manifestRaw.value);
    const manifest = legacy ? null : validateManifest(manifestRaw.value, maxFileBytes);
    const fullFile=manifest?.fullPath||'Full_System/BetterNote_Latest_Backup.json';
    // Manual recovery uses a committed, content-verified full snapshot. Editable copies
    // and PDF exports can hydrate independently. Legacy/file verification remains strict.
    if (snapshotRecovery && manifest?.backupDevice && manifest.fullPath && manifest.fullHash && Array.isArray(manifest.activeIds)) {
      const full = await readArtifact(fullFile, { limit: maxSnapshotBytes, keepBytes: true });
      if (!full || full.hash !== manifest.fullHash || full.bytes.length !== manifest.fullSize)
        return { success: false, reason: 'backup-incomplete', folder: requested };
      const data = full.value;
      if (!object(data) || data.appName !== 'BetterNote' || !Array.isArray(data.folders) ||
          !Array.isArray(data.notebooks) || data.notebooks.length > maxFiles) throw fault('invalid-backup-data');
      const active = new Set(manifest.activeIds), seen = new Set(), notebooks = [];
      if (data.notebooks.length !== active.size) throw fault('backup-incomplete');
      for (const value of data.notebooks) {
        const note = validateNotebook(value), entry = manifest.notebooks[note.id];
        if (seen.has(note.id)) throw fault('invalid-backup-data');
        if (!active.has(note.id) || !entry || revision(note) !== entry.editable.revision ||
            digest(JSON.stringify(value)) !== entry.editable.hash) throw fault('backup-incomplete');
        seen.add(note.id); notebooks.push(note);
        progress({ stage: 'checking', file: fullFile, notebooksDone: notebooks.length, totalNotebooks: active.size,
          bytesDone: full.bytes.length, totalBytes: full.bytes.length });
        await new Promise(resolve => setImmediate(resolve));
      }
      const repaired = recoverMissingNotebookFolders(data.folders, notebooks);
      validateLibrary(data.folders, repaired.notebooks);
      await ensureUnchanged();
      const summary = { success: true, folder: requested, source: 'validated-backup', count: notebooks.length,
        verification: 'snapshot-checked', completedAt: manifest.lastDataSuccess || null,
        recoveredFolderNotebookIds: repaired.recoveredFolderNotebookIds,
        ignoredRetiredNotebookIds: Object.keys(manifest.notebooks).filter(id => !active.has(id)),
        notebooks: repaired.notebooks.map(note => ({ ...header(note), revision: revision(note), selectedSource: 'full' })) };
      // Transfer validated source bytes; only an older snapshot needing folder repair is reserialized.
      const bytes = repaired.recoveredFolderNotebookIds.length
        ? Buffer.from(JSON.stringify({ version: 1, appName: 'BetterNote', folders: data.folders, notebooks: repaired.notebooks })) : full.bytes;
      return { ...summary, encoded: repaired.recoveredFolderNotebookIds.length ? new Uint8Array(bytes) : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) };
    }
    const fullStat = await safeStat(fullFile), editStat = await safeStat('Editable_Notes');
    if (fullStat && !fullStat.isFile() || editStat && !editStat.isDirectory()) throw fault('invalid-backup-data');
    if (fullStat?.size > maxFileBytes) throw fault('backup-too-large');
    // Old writers published the note index before their first full commit. Recover it only
    // with a parseable full snapshot AND every indexed notebook verified below.
    const recoverableLegacyRound=!!manifest&&!manifest.fullPath&&!manifest.fullHash&&!!fullStat;
    const listed = editStat ? await timed(fs.readdir(within('Editable_Notes'))) : [];
    // v2 manifest names the current set. Old filenames remain for safety, not automatic import.
    const files = manifest ? Object.values(manifest.notebooks).map(entry => path.basename(entry.editable.path.replace(/\\/g, '/')))
      : listed.filter(name => name.toLowerCase().endsWith('.bnote')).sort();
    if (files.length > maxFiles || Object.keys(manifest?.notebooks || {}).length > maxFiles) throw fault('backup-too-large');
    const issues = [], deferredMissingIds = new Set(), ignoredRetiredNotebookIds = [];
    const activeIds = manifest?.activeIds ? new Set(manifest.activeIds) : null;
    const completedAt = manifest?.lastDataSuccess;
    const completedSnapshot = activeIds && typeof manifest.fullRevision === 'string' && !!manifest.fullRevision &&
      Number.isFinite(completedAt) && completedAt > 0;
    const issue = (reason, id = null, name = '') => issues.push({ reason, id, name });
    if (manifest) {
      if (!recoverableLegacyRound&&(!manifest.fullHash || !fullStat || fullStat.size !== manifest.fullSize)) issue('backup-incomplete');
      for (const [id, entry] of Object.entries(manifest.notebooks)) {
        const stat = await safeStat(entry.editable.path);
        if (!stat?.isFile() || stat.size !== entry.editable.size) {
          // A missing inactive entry may be left behind after deletion. Verify the full snapshot before ignoring it.
          if (!stat && completedSnapshot && !activeIds.has(id) && Number.isFinite(entry.editable.savedAt) &&
              entry.editable.savedAt > 0 && entry.editable.savedAt <= completedAt) deferredMissingIds.add(id);
          else issue('backup-incomplete', id, entry.name);
        }
        if (entry.backupConflict) issue('backup-conflict', id, entry.name);
      }
      if (issues.length) return { success: false, reason: issues[0].reason, folder: requested, issues };
    }
    // A manifest preview checks availability only. Content/hashes are rechecked on Restore.
    if (manifest && previewOnly) {
      await ensureUnchanged();
      const notebooks = Object.entries(manifest.notebooks).filter(([id]) => !deferredMissingIds.has(id)).map(([id, entry]) => ({ ...header({ ...entry, id }), revision: entry.editable.revision }));
      return { success: true, folder: requested, source: 'validated-backup', count: notebooks.length,
        notebooks, verification: 'metadata-only', inactiveEntriesPendingCheck: deferredMissingIds.size };
    }
    // Legacy folders have no manifest: invalidate a small metadata cache on every file stamp.
    for (const file of files) await safeStat(path.join('Editable_Notes', file));
    const cacheKey = digest(JSON.stringify([...records]));
    if (!manifest && previewOnly && summaries.has(root) && summaries.get(root).key === cacheKey) {
      await ensureUnchanged(); return { ...summaries.get(root).result, folder: requested };
    }
    const selected = new Map(), verifiedEditableIds = new Set(), matchingFullNotes = new Map(); let folders = [];
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
      if (manifest && !recoverableLegacyRound && full.hash !== manifest.fullHash) return { success: false, reason: 'backup-incomplete', folder: requested, issues: [{ reason: 'backup-incomplete' }] };
      if (!object(full.value) || !Array.isArray(full.value.notebooks) || !Array.isArray(full.value.folders) ||
          full.value.appName !== undefined && full.value.appName !== 'BetterNote' || full.value.notebooks.length > maxFiles) throw fault('invalid-backup-data');
      folders = full.value.folders;
      const seen = new Set();
      for (const value of full.value.notebooks) {
        const note = validateNotebook(value);
        if (seen.has(note.id)) throw fault('invalid-backup-data');
        seen.add(note.id); add(note, 'full');
        const entry = manifest && Object.hasOwn(manifest.notebooks, note.id) ? manifest.notebooks[note.id] : null;
        if (entry && revision(note) === entry.editable.revision && digest(JSON.stringify(value)) === entry.editable.hash) matchingFullNotes.set(note.id, note);
      }
    }
    if (manifest && deferredMissingIds.size) {
      for (const id of deferredMissingIds) {
        if (full && !selected.has(id)) ignoredRetiredNotebookIds.push(id);
        else issue('backup-incomplete', id, manifest.notebooks[id].name);
      }
    }
    const ignoredRetiredIds = new Set(ignoredRetiredNotebookIds);
    const manifestByPath = new Map(Object.entries(manifest?.notebooks || {}).map(([id, entry]) => [fileKey(entry.editable.path), { id, entry }]));
    for (const file of files) {
      const relative = path.join('Editable_Notes', file), indexed = manifestByPath.get(fileKey(relative));
      if (indexed && ignoredRetiredIds.has(indexed.id)) continue;
      const fullNote = indexed && matchingFullNotes.get(indexed.id);
      const raw = await readArtifact(relative, { parseJson: !fullNote });
      if (!raw) { issue('backup-changed-during-read'); continue; }
      const note = fullNote || validateNotebook(raw.value), entry = indexed?.entry;
      if (manifest) {
        if (!indexed || note.id !== indexed.id || raw.hash !== entry.editable.hash || revision(note) !== entry.editable.revision) {
          issue('backup-incomplete', indexed?.id || note.id, note.name); continue;
        }
        verifiedEditableIds.add(note.id);
      }
      // The exact notebook is already in the verified full snapshot: do not parse/hash its rich content twice.
      if (!fullNote) add(note, relative);
    }
    if (manifest) for (const id of Object.keys(manifest.notebooks)) {
      if (!ignoredRetiredIds.has(id) && !verifiedEditableIds.has(id)) issue('backup-incomplete', id, manifest.notebooks[id].name);
    }
    await ensureUnchanged();
    if (issues.length) return { success: false, reason: issues[0].reason, folder: requested, issues };
    if (!selected.size && !folders.length && !(manifest?.backupDevice&&manifest.fullHash&&manifest.activeIds?.length===0)) throw fault('not-found');
    let notebooks = [...selected.values()].map(item => item.note), recoveredFolderNotebookIds = [];
    if (manifest) ({ notebooks, recoveredFolderNotebookIds } = recoverMissingNotebookFolders(folders, notebooks));
    validateLibrary(folders, notebooks);
    const recoveredById = new Map(notebooks.map(note => [note.id, note]));
    const summary = { success: true, folder: requested, source: 'validated-backup', count: notebooks.length,
      verification: 'content-checked',completedAt:manifest?.lastDataSuccess||manifest?.lastSync||null, recoveredFolderNotebookIds, ignoredRetiredNotebookIds, notebooks: [...selected.values()].map(item => {
        const note = recoveredById.get(item.note.id);
        return { ...header(note), revision: revision(note),
          contentHash: note === item.note ? item.fingerprint : contentHash(note), selectedSource: item.source };
      }) };
    if (previewOnly) {
      summaries.delete(root); summaries.set(root, { key: cacheKey, result: summary });
      if (summaries.size > 4) summaries.delete(summaries.keys().next().value);
      return summary;
    }
    return { ...summary, ...(legacy ? { legacyUpgrade: { manifestHash: manifestRaw?.hash || null,
      files: [...artifacts.values()].filter(item => item.path !== manifestFile) } } : {}),
      ...(manifest?{repairUpgrade:{manifestHash:manifestRaw.hash,entries:Object.fromEntries(Object.entries(manifest.notebooks).map(([id,entry])=>[id,entry.editable.hash]))}}:{}),
      data: { version: 1, appName: 'BetterNote', folders, notebooks } };
    async function ensureUnchanged() {
      for (const [file, expected] of records) {
        if (stamp(await optionalStat(file)) !== expected) throw fault('backup-changed-during-read');
      }
    }
  }
  const scanOne = async (folder, previewOnly, allowPrevious = false, snapshotRecovery = false) => {
    if (typeof folder !== 'string' || !folder.trim() || !path.isAbsolute(folder.trim())) return { success: false, reason: 'absolute-backup-folder-required' };
    try {
      const current=await readFolder(folder.trim(),previewOnly,null,snapshotRecovery);
      if(current.success||!allowPrevious||previewOnly||!['backup-incomplete','backup-conflict'].includes(current.reason))return current;
      const candidates=[];
      for(const directory of ['Backup_History/Manifests','Full_System/.history/backup_manifest.json']){
        const names=(await timed(fs.readdir(path.join(folder.trim(),directory))).catch(()=>[])).filter(name=>/^[a-f0-9]{64}\.previous$/.test(name));
        for(const name of names.slice(0,12)){const relative=path.join(directory,name),stat=await optionalStat(path.join(folder.trim(),relative));if(stat?.isFile())candidates.push({relative,time:stat.mtimeMs});}
      }
      candidates.sort((a,b)=>b.time-a.time);
      for(const item of candidates.slice(0,12)){
        try{const result=await readFolder(folder.trim(),false,item.relative,snapshotRecovery);
          if(result.success)return {...result,previousGeneration:{savedAt:result.completedAt||item.time,currentReason:current.reason}};
        }catch(_){}
      }
      return current;
    }
    catch (error) { return { success: false, folder: folder.trim(), reason: error.code || 'backup-read-failed' }; }
  };
  return { async execute({ folderPath = null, candidates = [], previewOnly = false, syncMode, syncNotebookId, manifestHash, syncDeviceId, allowPrevious = false, encodedRecovery = false, listDevices = false, snapshotRecovery = false } = {}) {
    if(listDevices){
      if(typeof folderPath!=='string'||!path.isAbsolute(folderPath))return {success:false,reason:'backup-folder-choice-required'};
      try{return {success:true,folder:folderPath,folders:await require('./backupDevices.cjs').listBackupDevices({fs,timed,root:folderPath})};}
      catch(error){return {success:false,reason:error.code==='ENOENT'?'not-found':error.code||'backup-read-failed'};}
    }
    if (syncMode) return syncReader.execute({ folderPath, syncMode, syncNotebookId, manifestHash, syncDeviceId });
    // Explicit choice is strict: never fall back to another folder or merge different destinations.
    if (folderPath !== null && folderPath !== undefined) {const result=await scanOne(folderPath, previewOnly, allowPrevious, snapshotRecovery && encodedRecovery && !previewOnly);
      if(encodedRecovery&&result.data){const encoded=new Uint8Array(Buffer.from(JSON.stringify(result.data)));return {...result,data:undefined,encoded};}return result;}
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
module.exports = { createBackupReader };
