// Runs inside a Node worker in production. No Electron import or automatic disk access.
const nodeFs = require('node:fs').promises;
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const hash = value => createHash('sha256').update(value).digest('hex');
const fault = code => Object.assign(new Error(code), { code });
const parse = buffer => JSON.parse(buffer.toString('utf8'));
const noteValid = value => value && typeof value.id === 'string' && value.id.length > 0 && Array.isArray(value.pages);
const fullValid = value => value && Array.isArray(value.notebooks) && value.notebooks.every(noteValid);
const cleanName = value => String(value || 'Untitled').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/[ .]+$/g, '').slice(0, 48) || 'Untitled';
const contentFingerprint = note => hash(JSON.stringify([
  note.name, note.folderId || null, !!note.isDeleted, note.templateId, note.paperSize, note.orientation, note.pdfBase64,
  note.pages.map(page => [page.id, page.pageIndex, page.strokes || [], page.textElements || [],
    page.imageElements || [], page.pdfPageImage, page.pageWidth, page.pageHeight, page.templateId, page.paperColor])
]));
const revision = n => JSON.stringify([n.id, Number(n.updatedAt) || 0, n.name || '', n.folderId || null, Number(n.pageCount) || 0, !!n.isDeleted]);
const pdfBuffer = value => {
  if (typeof value !== 'string') return null;
  const encoded = value.replace(/^data:[^;]+;base64,/, '').trim();
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 === 1) throw fault('invalid-pdf');
  const buffer = Buffer.from(encoded, 'base64');
  if (!buffer.subarray(0, 5).equals(Buffer.from('%PDF-')) || !buffer.subarray(-1024).includes(Buffer.from('%%EOF'))) throw fault('invalid-pdf');
  return buffer;
};

function createBackupWriter({ localDir, driveCandidates = [], fs = nodeFs, deadlineMs = 10000, retention = 3, now = Date.now, beforeReplace = async () => {} }) {
  if (!path.isAbsolute(localDir)) throw fault('absolute-local-folder-required');
  let session = null, sequence = Promise.resolve();
  const outstanding = new Map();
  const read = async file => {
    try { return await fs.readFile(file); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  };
  const within = (root, relative) => {
    const full = path.resolve(root, relative);
    if (!full.toLowerCase().startsWith(path.resolve(root).toLowerCase() + path.sep)) throw fault('unsafe-backup-path');
    return full;
  };
  const timed = async (task, timeout = deadlineMs) => {
    let timer;
    try { return await Promise.race([task, new Promise((_, reject) => { timer = setTimeout(() => reject(fault('destination-timeout')), timeout); })]); }
    finally { clearTimeout(timer); }
  };
  const resolveTargets = async customPath => {
    let primary = customPath && path.isAbsolute(customPath) ? path.resolve(customPath) : null;
    if (customPath && !primary) throw fault('absolute-backup-folder-required');
    if (!primary) for (const candidate of driveCandidates) {
      try {
        const parent = await timed(fs.stat(path.dirname(candidate)), Math.min(deadlineMs, 700));
        if (parent.isDirectory()) { primary = path.resolve(candidate); break; }
      } catch (_) {}
    }
    const paths = [path.resolve(localDir), ...(primary ? [primary] : [])];
    return [...new Set(paths.map(p => p.toLowerCase()))].map(key => {
      const root = paths.find(p => p.toLowerCase() === key);
      return { root, kind: root.toLowerCase() === path.resolve(localDir).toLowerCase() ? 'local'
        : /(?:my drive|google.?drive)/i.test(root) ? 'drive' : 'folder' };
    });
  };
  const verifyRoot = async root => {
    const stat = await fs.stat(root).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (stat && !stat.isDirectory()) throw fault('ENOTDIR');
  };
  const safeManifest = raw => {
    if (!raw) return { version: 2, notebooks: Object.create(null), lastSync: null, fullRevision: null };
    const parsed = parse(raw);
    if (!parsed || typeof parsed !== 'object') throw fault('invalid-backup-manifest');
    if (parsed.version === 2 && (!parsed.notebooks || typeof parsed.notebooks !== 'object' || Array.isArray(parsed.notebooks))) throw fault('invalid-backup-manifest');
    if (parsed.version !== 2) return { version: 2, notebooks: Object.create(null), lastSync: null, fullRevision: null };
    for (const [id, entry] of Object.entries(parsed.notebooks)) {
      if (!entry || typeof entry !== 'object') throw fault('invalid-backup-manifest');
      for (const kind of ['editable', 'pdf']) if (entry[kind]) {
        const artifact = entry[kind], normalized = String(artifact.path || '').replace(/\\/g, '/');
        const directory = kind === 'editable' ? 'Editable_Notes' : 'PDF_Documents';
        const extension = kind === 'editable' ? '.bnote' : '.pdf';
        const parts = normalized.split('/');
        if (parts.length !== 2 || parts[0] !== directory || /[<>:"|?*\x00-\x1f]/.test(parts[1]) ||
            !parts[1].endsWith('--' + hash(id).slice(0, 32) + extension) ||
            typeof artifact.hash !== 'string' || !/^[a-f0-9]{64}$/.test(artifact.hash)) throw fault('unsafe-backup-path');
      }
    }
    return parsed;
  };
  const atomic = async (root, relative, bytes, validate, current = () => true, keep = retention) => {
    const file = within(root, relative);
    const previous = await read(file);
    if (previous && validate && !validate(previous)) throw fault('invalid-existing-backup');
    if (validate && !validate(bytes)) throw fault('invalid-new-backup');
    if (previous && previous.equals(bytes)) return { path: relative, hash: hash(bytes), size: bytes.length, skipped: true };
    if (!current()) throw fault('backup-cancelled');
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = file + '.pending-' + randomUUID();
    let installed = false;
    try {
      const handle = await fs.open(temporary, 'wx');
      try { await handle.writeFile(bytes); await handle.sync(); }
      finally { await handle.close(); }
      const checked = await fs.readFile(temporary);
      if (!checked.equals(bytes)) throw fault('backup-verification-failed');
      if (!current()) throw fault('backup-cancelled');
      if (previous && keep) {
        const history = within(root, path.join(path.dirname(relative), '.history', path.basename(relative)));
        await fs.mkdir(history, { recursive: true });
        const archive = path.join(history, hash(previous) + '.previous');
        if (!await read(archive)) {
          const archived = await fs.open(archive, 'wx');
          try { await archived.writeFile(previous); await archived.sync(); } finally { await archived.close(); }
        }
        if (!(await fs.readFile(archive)).equals(previous)) throw fault('history-verification-failed');
      }
      await beforeReplace({ file, temporary, relative });
      if (!current()) throw fault('backup-cancelled');
      const latest = await read(file);
      if (!!latest !== !!previous || (latest && !latest.equals(previous))) throw fault('backup-changed-externally');
      // Never unlink the destination to make rename work. A failed replace leaves it intact.
      await fs.rename(temporary, file);
      installed = true;
      if (!(await fs.readFile(file)).equals(bytes)) throw fault('installed-backup-verification-failed');
      if (previous && keep) {
        const history = within(root, path.join(path.dirname(relative), '.history', path.basename(relative)));
        const archives = (await fs.readdir(history)).filter(name => name.endsWith('.previous'));
        const dated = await Promise.all(archives.map(async name => ({ name, time: (await fs.stat(path.join(history, name))).mtimeMs })));
        dated.sort((a, b) => b.time - a.time || b.name.localeCompare(a.name));
        for (const old of dated.slice(keep)) await fs.unlink(path.join(history, old.name));
      }
      return { path: relative, hash: hash(bytes), size: bytes.length, skipped: false };
    } finally {
      if (!installed) await fs.unlink(temporary).catch(() => {});
    }
  };
  const targetAction = async (target, operation) => {
    if (target.error) return;
    const rootKey = target.root.toLowerCase();
    if (outstanding.has(rootKey)) { target.error = 'destination-busy'; return; }
    let expired = false;
    const task = Promise.resolve().then(() => operation(() => !expired));
    outstanding.set(rootKey, task);
    task.then(() => { if (outstanding.get(rootKey) === task) outstanding.delete(rootKey); },
      () => { if (outstanding.get(rootKey) === task) outstanding.delete(rootKey); });
    try { await timed(task); }
    catch (error) { expired = true; target.error = error.code || error.message || 'backup-write-failed'; }
  };
  const saveManifest = (target, current) => atomic(target.root, 'Full_System/backup_manifest.json',
    Buffer.from(JSON.stringify(target.manifest)), b => { try { return !!safeManifest(b); } catch (_) { return false; } }, current, 0);
  const artifactMatches = async (target, artifact, token) => {
    if (!artifact || artifact.revision !== token || !artifact.path || !artifact.hash) return false;
    try { const raw = await read(within(target.root, artifact.path)); return !!raw && hash(raw) === artifact.hash; }
    catch (_) { return false; }
  };
  const targetResult = target => ({
    targetDir: target.root, kind: target.kind, success: !target.error && !target.partial,
    error: target.error || null, partial: !!target.partial, lastSuccess: target.manifest?.lastSync || null,
    notebooks: target.manifest?.notebooks || {}, fullRevision: target.manifest?.fullRevision || null,
    verifiedPdfIds: target.verifiedPdfIds || []
  });
  const begin = async command => {
    if (session && now() - session.started < 300000) return { success: false, reason: 'already-writing' };
    if (!command.jobId || !command.metadata || !Array.isArray(command.metadata.notebooks) || !Array.isArray(command.metadata.folders)) throw fault('invalid-backup-request');
    if (!command.metadata.notebooks.length && !command.metadata.folders.length) return { success: false, reason: 'empty-library' };
    session = { id: command.jobId, started: now(), metadata: command.metadata, metadataRevision: command.metadataRevision,
      targets: await resolveTargets(command.customBackupPath), incoming: new Map() };
    for (const target of session.targets) await targetAction(target, async () => {
      await verifyRoot(target.root);
      target.manifest = safeManifest(await read(within(target.root, 'Full_System/backup_manifest.json')));
      target.prior = new Map();
      target.priorFingerprints = new Map();
      const raw = await read(within(target.root, 'Full_System/BetterNote_Latest_Backup.json'));
      if (raw) {
        const full = parse(raw);
        if (!fullValid(full)) throw fault('invalid-existing-backup');
        for (const note of full.notebooks) {
          target.prior.set(note.id, Number(note.updatedAt) || 0);
          target.priorFingerprints.set(note.id, contentFingerprint(note));
        }
      }
      target.verifiedPdfIds = [];
      for (const note of command.metadata.notebooks) {
        const artifact = target.manifest.notebooks[note.id]?.pdf;
        if (artifact && await artifactMatches(target, artifact, artifact.revision)) target.verifiedPdfIds.push(note.id);
      }
    });
    const needsPdfIds = command.metadata.notebooks.filter(note => command.forcePdf || session.targets.some(target =>
      !target.error && (!target.verifiedPdfIds?.includes(note.id) || target.manifest.notebooks[note.id]?.pdf?.revision !== revision(note)))).map(note => note.id);
    return { success: session.targets.some(t => !t.error), jobId: session.id, needsPdfIds, targets: session.targets.map(targetResult) };
  };
  const notebook = async command => {
    const note = command.notebook;
    if (!session || command.jobId !== session.id || !noteValid(note) || !note.pages.length) throw fault('invalid-notebook-snapshot');
    const token = revision(note);
    session.incoming.set(note.id, { id: note.id, name: note.name, folderId: note.folderId, updatedAt: note.updatedAt,
      pageCount: note.pageCount, isDeleted: note.isDeleted });
    for (const target of session.targets) await targetAction(target, async current => {
      if ((target.prior.get(note.id) || 0) > (Number(note.updatedAt) || 0)) throw fault('newer-backup-exists');
      if (target.prior.has(note.id) && target.prior.get(note.id) === (Number(note.updatedAt) || 0) &&
          target.priorFingerprints.get(note.id) !== contentFingerprint(note)) throw fault('conflicting-backup-revision');
      const old = target.manifest.notebooks[note.id] || {};
      const stem = 'Notebook-' + cleanName(note.name) + '--' + hash(note.id).slice(0, 32);
      const editablePath = old.editable?.path || path.join('Editable_Notes', stem + '.bnote');
      const existing = await read(within(target.root, editablePath));
      if (existing) {
        const previous = parse(existing);
        if (!noteValid(previous) || previous.id !== note.id) throw fault('notebook-identity-mismatch');
        if ((Number(previous.updatedAt) || 0) > (Number(note.updatedAt) || 0)) throw fault('newer-backup-exists');
        if ((Number(previous.updatedAt) || 0) === (Number(note.updatedAt) || 0) && contentFingerprint(previous) !== contentFingerprint(note)) throw fault('conflicting-backup-revision');
      }
      const editable = await atomic(target.root, editablePath, Buffer.from(JSON.stringify(note)),
        b => { try { const parsed = parse(b); return noteValid(parsed) && parsed.id === note.id; } catch (_) { return false; } }, current);
      const entry = { ...old, name: note.name, revision: token, updatedAt: note.updatedAt, pageCount: note.pages.length,
        editable: { ...editable, revision: token, savedAt: now() } };
      const pdf = pdfBuffer(command.pdfBase64);
      if (pdf) {
        const pdfPath = old.pdf?.path || path.join('PDF_Documents', stem + '.pdf');
        const artifact = await atomic(target.root, pdfPath, pdf, b => b.subarray(0, 5).equals(Buffer.from('%PDF-')), current);
        entry.pdf = { ...artifact, revision: token, contentRevision: command.pdfRevision, savedAt: now() };
      } else if (entry.pdf?.contentRevision === command.pdfRevision && await artifactMatches(target, entry.pdf, entry.pdf.revision)) {
        entry.pdf = { ...entry.pdf, revision: token };
      } else target.partial = true;
      Object.defineProperty(target.manifest.notebooks, note.id, { value: entry, enumerable: true, writable: true, configurable: true });
      await saveManifest(target, current);
    });
    return { success: session.targets.some(t => !t.error), targets: session.targets.map(targetResult) };
  };
  const finish = async command => {
    if (!session || command.jobId !== session.id) throw fault('unknown-backup-job');
    const job = session;
    try {
      for (const target of job.targets) await targetAction(target, async current => {
        const incoming = new Map();
        for (const id of job.incoming.keys()) {
          const artifact = target.manifest.notebooks[id]?.editable;
          if (!artifact || !await artifactMatches(target, artifact, revision(job.incoming.get(id)))) throw fault('incomplete-editable-backup');
          const note = parse(await fs.readFile(within(target.root, artifact.path)));
          incoming.set(id, note);
        }
        if (incoming.size !== job.metadata.notebooks.length) throw fault('incomplete-notebook-set');
        const previousRaw = await read(within(target.root, 'Full_System/BetterNote_Latest_Backup.json'));
        const previous = previousRaw ? parse(previousRaw) : { notebooks: [], folders: [] };
        if (!fullValid(previous)) throw fault('invalid-existing-backup');
        const merged = new Map(previous.notebooks.map(n => [n.id, n]));
        for (const [id, note] of incoming) {
          const old = merged.get(id);
          if (old && (Number(old.updatedAt) || 0) > (Number(note.updatedAt) || 0)) throw fault('newer-backup-exists');
          if (old && (Number(old.updatedAt) || 0) === (Number(note.updatedAt) || 0) && contentFingerprint(old) !== contentFingerprint(note)) throw fault('conflicting-backup-revision');
          merged.set(id, note); // Only IDs establish identity, never sanitized names.
        }
        const folders = new Map((previous.folders || []).map(f => [f.id, f]));
        for (const folder of job.metadata.folders) {
          const old = folders.get(folder.id);
          if (old && (Number(old.updatedAt) || 0) > (Number(folder.updatedAt) || 0)) throw fault('newer-backup-exists');
          folders.set(folder.id, folder);
        }
        const version = command.metadataRevision || job.metadataRevision;
        const contentHash = hash(JSON.stringify([[...folders.values()], [...merged.values()]]));
        if (target.manifest.fullRevision !== version || target.manifest.fullContentHash !== contentHash || !previousRaw || hash(previousRaw) !== target.manifest.fullHash) {
          const full = { version: 1, appName: 'BetterNote', exportDate: new Date(now()).toISOString(),
            folders: [...folders.values()], notebooks: [...merged.values()] };
          const saved = await atomic(target.root, 'Full_System/BetterNote_Latest_Backup.json', Buffer.from(JSON.stringify(full)),
            b => { try { return fullValid(parse(b)); } catch (_) { return false; } }, current);
          target.manifest.fullHash = saved.hash;
        }
        target.manifest.fullContentHash = contentHash;
        target.manifest.fullRevision = version;
        if (!target.partial) target.manifest.lastSync = now();
        await saveManifest(target, current);
      });
      const targets = job.targets.map(targetResult);
      return { success: targets.length > 0 && targets.every(t => t.success), partial: targets.some(t => t.success || t.partial),
        targets, timestamp: now(), folderWritten: true, cloudUploadVerified: false };
    } finally { session = null; }
  };
  const inspect = async command => {
    const targets = await resolveTargets(command.customBackupPath);
    const files = [];
    for (const target of targets) await targetAction(target, async () => {
      await verifyRoot(target.root);
      target.manifest = safeManifest(await read(within(target.root, 'Full_System/backup_manifest.json')));
      target.manifest = { ...target.manifest, notebooks: JSON.parse(JSON.stringify(target.manifest.notebooks)) };
      for (const entry of Object.values(target.manifest.notebooks)) for (const kind of ['editable', 'pdf']) {
        const artifact = entry[kind];
        if (artifact && !await artifactMatches(target, artifact, artifact.revision)) {
          entry[kind] = { ...artifact, revision: null };
          target.partial = true;
        }
      }
      if (target.manifest.fullHash) {
        const raw = await read(within(target.root, 'Full_System/BetterNote_Latest_Backup.json'));
        if (!raw || hash(raw) !== target.manifest.fullHash) { target.manifest.fullRevision = null; target.partial = true; }
      }
      if (!command.includeFiles) return;
      for (const [id, note] of Object.entries(target.manifest.notebooks)) for (const kind of ['editable', 'pdf']) {
        const artifact = note[kind];
        if (!artifact?.path) continue;
        const file = within(target.root, artifact.path);
        const stat = await fs.stat(file).catch(() => null);
        if (!stat?.isFile()) continue;
        files.push({ notebookId: id, notebookName: note.name, fileName: path.basename(file), fullPath: file,
          relativeFolder: path.dirname(artifact.path), targetDir: target.root, fileSizeBytes: stat.size,
          formattedSize: (stat.size / 1024).toFixed(1) + ' KB', lastModified: stat.mtimeMs,
          pageCount: note.pageCount, kind, revision: artifact.revision });
      }
      // Legacy archives stay visible, but have no verified current revision.
      const listed = new Set(files.filter(f => f.targetDir === target.root).map(f => f.fullPath.toLowerCase()));
      for (const [directory, extension, kind] of [['Editable_Notes', '.bnote', 'editable'], ['PDF_Documents', '.pdf', 'pdf']]) {
        const names = await fs.readdir(within(target.root, directory)).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
        for (const name of names.filter(n => n.toLowerCase().endsWith(extension))) {
          const file = within(target.root, path.join(directory, name));
          if (listed.has(file.toLowerCase())) continue;
          const stat = await fs.stat(file).catch(() => null);
          if (!stat?.isFile()) continue;
          let legacy = null;
          if (kind === 'editable') { try { const value = parse(await fs.readFile(file)); if (noteValid(value)) legacy = value; } catch (_) {} }
          files.push({ notebookId: legacy?.id || null, notebookName: legacy?.name || path.basename(name, extension),
            fileName: name, fullPath: file, relativeFolder: directory, targetDir: target.root, fileSizeBytes: stat.size,
            formattedSize: (stat.size / 1024).toFixed(1) + ' KB', lastModified: stat.mtimeMs,
            pageCount: legacy?.pages.length, kind, revision: null, legacy: true });
        }
      }
      const file = within(target.root, 'Full_System/BetterNote_Latest_Backup.json');
      const stat = await fs.stat(file).catch(() => null);
      if (stat?.isFile()) files.push({ notebookId: 'full_system_backup', notebookName: 'Full System JSON',
        fileName: path.basename(file), fullPath: file, relativeFolder: 'Full_System', targetDir: target.root,
        fileSizeBytes: stat.size, formattedSize: (stat.size / 1024).toFixed(1) + ' KB', lastModified: stat.mtimeMs, kind: 'system' });
    });
    return { success: targets.some(t => !t.error), targets: targets.map(targetResult), files,
      documentsDir: path.resolve(localDir), targetDir: targets.at(-1)?.root, isGoogleDrive: targets.at(-1)?.kind === 'drive',
      lastSync: targets.at(-1)?.manifest?.lastSync || null,
      totalFiles: files.length, totalSizeBytes: files.reduce((sum, f) => sum + f.fileSizeBytes, 0),
      formattedTotalSize: (files.reduce((sum, f) => sum + f.fileSizeBytes, 0) / 1024).toFixed(1) + ' KB',
      exists: files.length > 0, cloudUploadVerified: false };
  };
  const prune = async command => {
    if (!Array.isArray(command.notebookIds) || !command.notebookIds.length || command.notebookIds.some(id => typeof id !== 'string' || !id)) throw fault('notebook-id-required');
    if (session) return { success: false, reason: 'already-writing' };
    const ids = new Set(command.notebookIds), targets = await resolveTargets(command.customBackupPath);
    for (const target of targets) await targetAction(target, async current => {
      target.manifest = safeManifest(await read(within(target.root, 'Full_System/backup_manifest.json')));
      // Validate all affected archives before any removal; names alone never authorize it.
      const file = 'Full_System/BetterNote_Latest_Backup.json';
      const raw = await read(within(target.root, file));
      const full = raw ? parse(raw) : null;
      if (full && !fullValid(full)) throw fault('invalid-existing-backup');
      const folder = within(target.root, 'Editable_Notes'), toRemove = [];
      const names = await fs.readdir(folder).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
      for (const name of names.filter(n => n.endsWith('.bnote'))) {
        const artifact = within(target.root, path.join('Editable_Notes', name));
        const note = parse(await fs.readFile(artifact));
        if (!noteValid(note)) throw fault('invalid-existing-backup');
        if (ids.has(note.id)) toRemove.push(artifact);
      }
      for (const id of ids) {
        const pdf = target.manifest.notebooks[id]?.pdf;
        if (pdf?.path) toRemove.push(within(target.root, pdf.path));
      }
      if (full) {
        full.notebooks = full.notebooks.filter(n => !ids.has(n.id));
        const saved = await atomic(target.root, file, Buffer.from(JSON.stringify(full)), b => { try { return fullValid(parse(b)); } catch (_) { return false; } }, current);
        target.manifest.fullHash = saved.hash;
        target.manifest.fullContentHash = null;
      }
      for (const artifact of toRemove) {
        if (!current()) throw fault('backup-cancelled');
        await fs.unlink(artifact).catch(e => { if (e.code !== 'ENOENT') throw e; });
      }
      for (const id of ids) delete target.manifest.notebooks[id];
      target.manifest.fullRevision = null;
      await saveManifest(target, current);
    });
    return { success: targets.every(t => !t.error), targets: targets.map(targetResult) };
  };
  const execute = command => {
    const result = sequence.then(async () => {
      try {
        if (command.action === 'begin') return await begin(command);
        if (command.action === 'notebook') return await notebook(command);
        if (command.action === 'finish') return await finish(command);
        if (command.action === 'inspect') return await inspect(command);
        if (command.action === 'prune') return await prune(command);
        if (command.action === 'abort' && session?.id === command.jobId) { session = null; return { success: true }; }
        throw fault('unsupported-backup-action');
      } catch (error) { return { success: false, reason: error.code || error.message }; }
    });
    sequence = result.catch(() => {});
    return result;
  };
  return { execute, atomic, resolveTargets };
}
module.exports = { createBackupWriter, notebookBackupRevision: revision };
