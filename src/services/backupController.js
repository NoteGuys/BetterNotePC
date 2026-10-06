import { notebookBackupRevision, backupMetadataRevision } from '../utils/backupRevision.js';
export const notebookPdfRevision = note => JSON.stringify([note.templateId, note.paperSize, note.orientation,
  note.pages.map(p => [p.id, p.updatedAt, p.pageIndex, p.templateId, p.pageWidth, p.pageHeight])]);

// Injectable controller: tests use synthetic data and a fake native bridge.
export const createBackupController = ({ getMetadata, getNotebook, waitForLocalSaves, native,
  makePdf, getPath = async () => null, getLocalState = () => ({ status: 'saved' }),
  canRenderPdf = () => true, yieldTask = () => new Promise(resolve => setTimeout(resolve, 0)),
  now = Date.now, scheduleDelay = 10000, persist = async () => {} }) => {
  let metadata = { folders: [], notebooks: [] }, targets = [], path = null;
  let running = null, dirtyTimer, interval, initialTimer, initialized = false;
  let generation = 0, syncing = false, lastFailure = null, disposed = false, metadataPending = false;
  let snapshot = Object.freeze({ status: 'unknown', syncing: false, targets: [], totalNotebooks: 0, lastSuccess: null });
  const listeners = new Set();
  const publish = () => {
    const tokens = metadata.notebooks.map(notebookBackupRevision);
    const currentRevision = backupMetadataRevision(metadata);
    const local = getLocalState();
    const nextTargets = targets.map(target => {
      const entries = target.notebooks || {};
      const editableCount = metadata.notebooks.filter(n => entries[n.id]?.editable?.revision === notebookBackupRevision(n)).length;
      const pdfCount = metadata.notebooks.filter(n => entries[n.id]?.pdf?.revision === notebookBackupRevision(n)).length;
      const fullCurrent = !metadataPending && local.status === 'saved' && !target.error && !!target.fullRevision && target.fullRevision === currentRevision;
      const current = fullCurrent && editableCount === tokens.length && pdfCount === tokens.length;
      return { ...target, editableCount, pdfCount, totalNotebooks: tokens.length, current, fullCurrent };
    });
    const complete = !metadataPending && !lastFailure && nextTargets.length > 0 && nextTargets.every(t => t.current);
    const someSaved = nextTargets.some(t => t.editableCount > 0 || t.lastSuccess);
    const errors = !!lastFailure || nextTargets.some(t => t.error);
    const status = syncing ? 'working' : local.status !== 'saved' ? 'pending'
      : complete ? 'current' : errors ? (someSaved ? 'partial' : 'error')
      : initialized && !tokens.length && !metadata.folders.length ? 'empty'
      : nextTargets.some(t => t.partial && t.fullRevision === currentRevision) ? 'partial'
      : someSaved ? 'pending' : initialized && nextTargets.length ? 'pending' : 'unknown';
    snapshot = Object.freeze({ status, syncing, targets: nextTargets, totalNotebooks: tokens.length,
      metadataRevision: currentRevision, revisions: Object.fromEntries(metadata.notebooks.map(n => [n.id, notebookBackupRevision(n)])),
      lastSuccess: complete ? Math.min(...nextTargets.map(t => t.lastSuccess || 0)) || null : null,
      error: lastFailure, folderWritten: complete, cloudUploadVerified: false,
      hasDriveFolder: nextTargets.some(t => t.kind === 'drive'), localSaving: local.status !== 'saved', metadataPending });
    listeners.forEach(listener => { try { listener(); } catch (_) {} });
  };
  const refresh = async ({ inspect = false, includeFiles = false } = {}) => {
    const readGeneration = generation;
    const localMetadata = await getMetadata();
    metadata = localMetadata;
    metadataPending = generation !== readGeneration;
    let details = null;
    if (inspect) {
      path = await getPath();
      details = await native({ action: 'inspect', customBackupPath: path, includeFiles });
      if (details?.targets) {
        const previous = new Map(targets.map(target => [target.targetDir, target]));
        targets = details.targets.map(target => ({ ...target, error: target.error || previous.get(target.targetDir)?.error || null }));
      }
      if (!details?.success) lastFailure = details?.reason || 'backup-inspection-failed';
    }
    initialized = true;
    publish();
    return details;
  };
  const initialize = async () => {
    try { await refresh({ inspect: true }); }
    catch (error) { lastFailure = error.message || 'backup-inspection-failed'; initialized = true; publish(); }
  };
  const run = (options = {}) => {
    if (running) return running; // One shared result, never pretend a skipped request succeeded.
    syncing = true; lastFailure = null; publish();
    const startGeneration = generation;
    running = (async () => {
      let jobId, completed = false, deferredPdf = false;
      try {
        await waitForLocalSaves();
        const backupPath = await getPath();
        path = backupPath;
        metadata = await getMetadata();
        const original = metadata;
        if (!original.notebooks.length && !original.folders.length) return { success: false, reason: 'empty-library' };
        jobId = 'backup-' + now() + '-' + Math.random().toString(36).slice(2);
        const begun = await native({ action: 'begin', jobId, customBackupPath: backupPath, metadata: original,
          metadataRevision: backupMetadataRevision(original), forcePdf: !!options.forcePdf });
        if (begun?.targets) targets = begun.targets;
        if (!begun?.success) throw new Error(begun?.reason || 'backup-destination-unavailable');
        const captured = [];
        for (const info of original.notebooks) {
          await yieldTask();
          const note = await getNotebook(info.id);
          if (!note || !note.pages?.length) throw new Error('notebook-snapshot-unavailable');
          const pdfRevision = notebookPdfRevision(note);
          const needPdf = !!options.forcePdf || targets.some(t => !t.error &&
            (!t.verifiedPdfIds?.includes(note.id) || t.notebooks?.[note.id]?.pdf?.contentRevision !== pdfRevision));
          let pdfBase64 = null, pdfError = null;
          if (needPdf && canRenderPdf()) {
            try {
              pdfBase64 = await makePdf(note, () => { if (!canRenderPdf()) throw new Error('pdf-backup-deferred'); });
              if (!pdfBase64) pdfError = 'pdf-backup-empty';
            } catch (error) { pdfError = error.message === 'pdf-backup-deferred' ? 'pdf-backup-deferred' : 'pdf-backup-incomplete'; deferredPdf ||= pdfError === 'pdf-backup-deferred'; }
          } else if (needPdf) { pdfError = 'pdf-backup-deferred'; deferredPdf = true; }
          const saved = await native({ action: 'notebook', jobId, notebook: note, pdfBase64, pdfRevision, pdfError });
          if (saved?.targets) targets = saved.targets;
          if (!saved?.success) throw new Error(saved?.reason || 'notebook-backup-failed');
          captured.push({ id: note.id, name: note.name, folderId: note.folderId, updatedAt: note.updatedAt,
            pageCount: note.pageCount, isDeleted: note.isDeleted });
          publish();
        }
        const writtenRevision = backupMetadataRevision({ folders: original.folders, notebooks: captured });
        const result = await native({ action: 'finish', jobId, metadataRevision: writtenRevision });
        completed = true;
        if (result?.targets) targets = result.targets;
        const readGeneration = generation;
        metadata = await getMetadata();
        metadataPending = generation !== readGeneration;
        const selectedPath = await getPath();
        if (selectedPath !== backupPath) { targets = []; metadataPending = true; }
        if (!result?.targets?.length) lastFailure = result?.reason || 'backup-result-missing';
        await persist({ targets, metadataRevision: writtenRevision, lastSuccess: result?.success ? result.timestamp : null }).catch(() => {});
        const current = !metadataPending && result?.success && backupMetadataRevision(metadata) === writtenRevision &&
          getLocalState().status === 'saved';
        return { ...result, success: !!current, newerEditsPending: !current && !!result?.success,
          cloudUploadVerified: false, folderWritten: !!result?.folderWritten };
      } catch (error) {
        lastFailure = error.message || 'backup-failed';
        return { success: false, error: lastFailure, targets, cloudUploadVerified: false };
      } finally {
        if (jobId && !completed) await native({ action: 'abort', jobId }).catch(() => {});
        syncing = false;
        initialized = true;
        publish();
        if ((generation !== startGeneration || deferredPdf) && !disposed) schedule();
      }
    })();
    running.then(() => { running = null; }, () => { running = null; });
    return running;
  };
  const schedule = () => {
    clearTimeout(dirtyTimer);
    if (disposed) return;
    dirtyTimer = setTimeout(() => {
      if (getLocalState().status === 'saved') {
        if (snapshot.status !== 'current') run();
      }
      else schedule();
    }, scheduleDelay);
    dirtyTimer.unref?.();
  };
  const markDirty = () => {
    generation++;
    metadataPending = true;
    publish();
    // Invalidate immediately, but do not reread notebook records between strokes.
    // The idle backup or an explicitly opened details panel reads fresh metadata.
    schedule();
  };
  const localStateChanged = () => { publish(); };
  const destinationChanged = async () => {
    targets = []; lastFailure = null; generation++; publish();
    await initialize(); schedule();
  };
  const start = () => {
    disposed = false;
    if (interval) return;
    initialize();
    initialTimer = setTimeout(() => { if (snapshot.status !== 'current') run(); }, 20000);
    interval = setInterval(() => {
      if (!running) refresh({ inspect: true }).then(() => { if (!disposed && snapshot.status !== 'current') run(); }).catch(() => {});
    }, 3600000);
  };
  const stop = () => { disposed = true; clearTimeout(dirtyTimer); clearTimeout(initialTimer); clearInterval(interval); interval = null; };
  const prune = async ids => {
    if (running) await running;
    const result = await native({ action: 'prune', notebookIds: ids, customBackupPath: await getPath() });
    if (result?.targets) targets = result.targets;
    if (!result?.success) lastFailure = result?.reason || 'backup-delete-incomplete';
    await refresh();
    return result;
  };
  return { run, start, stop, initialize, refresh, markDirty, localStateChanged, destinationChanged, prune,
    getSnapshot: () => snapshot, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    waitForRunning: () => running || Promise.resolve() };
};
