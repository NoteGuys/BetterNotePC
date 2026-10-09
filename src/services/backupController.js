import { notebookBackupRevision, backupMetadataRevision } from '../utils/backupRevision.js';
export const notebookPdfRevision = note => JSON.stringify([note.templateId, note.paperSize, note.orientation,
  note.pages.map(page => [page.id, page.updatedAt, page.pageIndex, page.templateId, page.pageWidth, page.pageHeight])]);
const hasConflicts=target=>Object.keys(target.notebookIssues||{}).length>0;
const rolesOf = target => target.roles || [target.kind];
const pathsKey = paths => JSON.stringify([paths.localBackupPath || null, paths.driveBackupPath || null]);
export const createBackupController = ({ getMetadata, getNotebook, waitForLocalSaves, native,
  makePdf, getPath = async () => null, getLocalState = () => ({ status: 'saved' }),
  canRenderPdf = () => true, yieldTask = () => new Promise(resolve => setTimeout(resolve, 0)),
  now = Date.now, scheduleDelay = 10000, persist = async () => {}, beforeBackup = null, beforePrune = null, onDataBackup = async () => {} }) => {
  let metadata = { folders: [], notebooks: [] }, targets = [], cachedDetails = null;
  let running = null, preparing = null, dirtyTimer, interval, initialTimer, generation = 0, initialized = false, disposed = false;
  let recoveryPauses = 0, retryPaused = false, failureCount = 0, retryTimer;
  const pruning = new Set();
  let syncing = false, phase = 'idle', metadataPending = false, lastFailure = null, pdfDeferred = false, activeJob = null;
  let progress = { stage: 'idle', done: 0, total: 0 }, pdfProgress = { done: 0, total: 0, page: 0, totalPages: 0 };
  let snapshot = Object.freeze({ status: 'unknown', pdfStatus: 'unknown', syncing: false, targets: [], totalNotebooks: 0, lastSuccess: null });
  const listeners = new Set();
  const readPaths = async () => {
    const configured = await getPath();
    return typeof configured === 'string' ? { localBackupPath: configured, driveBackupPath: null }
      : { localBackupPath: configured?.localBackupPath || null, driveBackupPath: configured?.driveBackupPath || null };
  };
  const publish = () => {
    const tokens = new Map(metadata.notebooks.map(note => [note.id, notebookBackupRevision(note)]));
    const currentRevision = backupMetadataRevision(metadata), local = getLocalState();
    const nextTargets = targets.map(target => {
      const entries = target.notebooks || {};
      const notebookIssues = Object.fromEntries(Object.entries(target.notebookIssues || {})
        .filter(([id, issue]) => issue.incomingRevision === tokens.get(id)));
      const conflict = Object.values(notebookIssues)[0];
      const editableCount = metadata.notebooks.filter(note => !Object.hasOwn(notebookIssues, note.id) && entries[note.id]?.editable?.revision === tokens.get(note.id)).length;
      const pdfCount = metadata.notebooks.filter(note => !Object.hasOwn(notebookIssues, note.id) && entries[note.id]?.pdf?.revision === tokens.get(note.id)).length;
      const fullCurrent = !metadataPending && local.status === 'saved' && !target.error &&
        !!target.fullRevision && target.fullRevision === currentRevision && !conflict;
      const dataCurrent = fullCurrent && editableCount === tokens.size;
      const pdfIssues = metadata.notebooks.filter(note => !Object.hasOwn(notebookIssues, note.id) && entries[note.id]?.pdf?.revision !== tokens.get(note.id)).map(note => ({
        id: note.id, name: note.name, error: entries[note.id]?.pdfError || target.pdfError || 'pending'
      }));
      return { ...target, notebookIssues, fatalError: target.error || null, error: target.error || conflict?.error || null,
        roles: rolesOf(target), editableCount, pdfCount, totalNotebooks: tokens.size,
        current: dataCurrent, dataCurrent, fullCurrent, pdfCurrent: pdfCount === tokens.size,
        allComplete: dataCurrent && pdfCount === tokens.size, pdfIssues };
    });
    const localTargets = nextTargets.filter(target => target.roles.includes('local'));
    const current = !lastFailure && !metadataPending && localTargets.length > 0 && localTargets.every(target => target.dataCurrent);
    const someSaved = localTargets.some(target => target.editableCount > 0 || target.lastDataSuccess || target.lastSuccess);
    const errors = !!lastFailure || localTargets.some(target => target.error);
    const status = local.status !== 'saved' ? 'pending' : syncing && phase === 'data' && !current ? 'working'
      : current ? 'current' : errors ? (someSaved ? 'partial' : 'error')
      : initialized && !tokens.size && !metadata.folders.length ? 'empty'
      : someSaved || initialized && localTargets.length ? 'pending' : 'unknown';
    const pdfComplete = localTargets.length > 0 && localTargets.every(target => target.pdfCurrent);
    const pdfErrors = localTargets.flatMap(target => target.pdfIssues).filter(issue => issue.error !== 'pending' && issue.error !== 'pdf-backup-deferred');
    const pdfStatus = syncing && phase === 'pdf' ? 'working' : pdfComplete ? 'current'
      : pdfErrors.length ? 'error' : initialized ? 'pending' : 'unknown';
    snapshot = Object.freeze({ status, pdfStatus, syncing, phase, recoveryPaused: recoveryPauses > 0, targets: nextTargets, totalNotebooks: tokens.size,
      metadataRevision: currentRevision, revisions: Object.fromEntries(tokens),
      notebooks: metadata.notebooks.map(note => ({ id: note.id, name: note.name, updatedAt: note.updatedAt, pageCount: note.pageCount })),
      lastSuccess: current ? Math.min(...localTargets.map(target => target.lastDataSuccess || target.lastSuccess || 0)) || null : null,
      allDestinationsCurrent: nextTargets.length > 0 && nextTargets.every(target => target.dataCurrent),
      allPdfsCurrent: nextTargets.length > 0 && nextTargets.every(target => target.pdfCurrent),
      error: lastFailure, folderWritten: current, cloudUploadVerified: false, pdfDeferred,
      hasDriveFolder: nextTargets.some(target => target.roles.includes('drive')),
      localSaving: local.status !== 'saved', metadataPending, automaticRetryPaused:retryPaused, progress: { ...progress }, pdfProgress: { ...pdfProgress } });
    for (const listener of listeners) { try { listener(); } catch (_) {} }
  };
  const updateTargets = (result, keepNotebookIssues = false) => {
    if (!result?.targets) return;
    const previous = new Map(targets.map(target => [target.targetDir, target]));
    targets = result.targets.map(target => keepNotebookIssues
      ? { ...target, notebookIssues: previous.get(target.targetDir)?.notebookIssues || target.notebookIssues || {} }
      : target);
  };
  const refresh = async ({ inspect = false, includeFiles = false, deepVerify = false, includeLegacy = false } = {}) => {
    const readGeneration = generation;
    metadata = await getMetadata(); metadataPending = generation !== readGeneration;
    let details = null;
    if (inspect) {
      const paths = await readPaths();
      details = await native({ action: 'inspect', ...paths, includeFiles, deepVerify, includeLegacy });
      if (details?.targets) {
        const previous = new Map(targets.map(target => [target.targetDir, target]));
        targets = details.targets.map(target => ({ ...target,
          error: target.error || null,
          notebookIssues: previous.get(target.targetDir)?.notebookIssues || target.notebookIssues || {}
        }));
      }
      lastFailure = details?.success ? null : details?.reason || 'backup-inspection-failed';
      if (includeFiles) cachedDetails = details;
    }
    initialized = true; publish();
    return details;
  };
  const initialize = async () => {
    try { await refresh({ inspect: true }); }
    catch (error) { lastFailure = error.message || 'backup-inspection-failed'; initialized = true; publish(); }
  };
  const updateMetadata = async (paths, excludeDrive = false) => {
    const readGeneration = generation;
    metadata = await getMetadata(); metadataPending = generation !== readGeneration;
    const selected = await readPaths();
    if (excludeDrive) selected.driveBackupPath = null;
    if (pathsKey(selected) !== pathsKey(paths)) { targets = []; cachedDetails = null; metadataPending = true; }
    publish();
  };
  const performRun = (options = {}) => {
    if (recoveryPauses) return Promise.resolve({ success: false, reason: 'backup-recovery-busy' });
    if (running) return running;
    const startGeneration = generation;
    syncing = true; phase = 'data'; lastFailure = null; pdfDeferred = false;
    progress = { stage: 'waiting-for-save', done: 0, total: 0, startedAt: now() }; pdfProgress = { done: 0, total: 0, page: 0, totalPages: 0 }; publish();
    running = (async () => {
      let jobId, dataCompleted = false, paths;
      try {
        await waitForLocalSaves();
        if (recoveryPauses) return { success: false, reason: 'backup-recovery-busy' };
        paths = await readPaths();
        if (options.excludeDrive) paths = { ...paths, driveBackupPath: null };
        metadata = await getMetadata(); metadataPending = false;
        const original = metadata;
        // Empty libraries must publish deletion of the last notebook to this device's backup.
        jobId = 'backup-' + now() + '-' + Math.random().toString(36).slice(2); activeJob = jobId;
        progress = { ...progress, stage: 'checking', total: original.notebooks.length }; publish();
        const begun = await native({ action: 'begin', phase: 'data', jobId, ...paths,
          metadata: original, metadataRevision: backupMetadataRevision(original), forcePdf: !!options.forcePdf,
          driveSyncGuard: options.driveSyncGuard, localSyncGuard:options.localSyncGuard, acceptedReceives: options.acceptedReceives, folderReceives: options.folderReceives });
        updateTargets(begun);
        if (!begun?.success) throw new Error(begun?.reason || 'backup-destination-unavailable');
        const captured = [];
        for (const info of original.notebooks) {
          await yieldTask();
          progress = { ...progress, stage: 'saving-data', notebookId: info.id, name: info.name }; publish();
          const viable = targets.filter(target => !target.error);
          const unchanged = viable.length > 0 && viable.every(target =>
            target.verifiedEditableIds?.includes(info.id) && target.notebooks?.[info.id]?.editable?.revision === notebookBackupRevision(info));
          let saved, writtenInfo;
          if (unchanged) {
            saved = await native({ action: 'reuse', jobId, notebook: info }); writtenInfo = info;
          } else {
            const note = await getNotebook(info.id);
            if (!note?.pages?.length) throw new Error('notebook-snapshot-unavailable');
            saved = await native({ action: 'notebook', jobId, notebook: note.backupEncoded ? undefined : note, notebookEncoded: note.backupEncoded, pdfBase64: null,
              pdfRevision: notebookPdfRevision(note) });
            writtenInfo = { id: note.id, name: note.name, folderId: note.folderId, updatedAt: note.updatedAt,
              pageCount: note.pageCount, isDeleted: note.isDeleted };
          }
          updateTargets(saved);
          if (!saved?.success) throw new Error(saved?.reason || 'notebook-backup-failed');
          captured.push(writtenInfo); progress = { ...progress, done: captured.length }; publish();
        }
        const writtenRevision = backupMetadataRevision({ folders: original.folders, notebooks: captured });
        progress = { ...progress, stage: 'saving-snapshot', name: null }; publish();
        const dataResult = await native({ action: 'finish', jobId, metadataRevision: writtenRevision });
        dataCompleted = true; updateTargets(dataResult);
        await onDataBackup({ paths, targets, notebooks: captured, folders: original.folders });
        await updateMetadata(paths, options.excludeDrive);
        progress = { ...progress, stage: 'data-complete', done: captured.length, total: captured.length }; publish();
        const localTargets = snapshot.targets.filter(target => target.roles.includes('local'));
        if (!localTargets.length || localTargets.some(target => !target.dataCurrent)) {
          if (metadataPending || backupMetadataRevision(metadata) !== writtenRevision || getLocalState().status !== 'saved') {
            return { success: false, newerEditsPending: true, targets, cloudUploadVerified: false };
          }
          // A notebook conflict blocks the complete snapshot, not other notebooks' PDF copies.
          if ((!localTargets.some(target => target.error) || localTargets.some(target => target.fatalError)) && !snapshot.targets.some(target=>target.dataCurrent))
            throw new Error(dataResult?.reason || localTargets.find(target => target.error)?.error || 'backup-data-incomplete');
        }
        // Recovery data is now confirmed. PDF work cannot postpone or undo this result.
        const pdfCandidates = captured.filter(info => targets.some(target => !target.error && !hasConflicts(target) && (options.forcePdf ||
          !Object.hasOwn(target.notebookIssues || {}, info.id) && target.notebooks?.[info.id]?.pdf?.revision !== notebookBackupRevision(info))));
        phase = 'pdf'; pdfProgress = { done: 0, total: pdfCandidates.length, page: 0, totalPages: 0 }; publish();
        const selectedIds = options.notebookIds ? new Set(options.notebookIds) : null;
        for (const info of pdfCandidates) {
          if (selectedIds && !selectedIds.has(info.id)) continue;
          // Never attach a PDF to an older or conflicting editable notebook.
          if (!targets.some(target => !target.error && !hasConflicts(target) && !Object.hasOwn(target.notebookIssues || {}, info.id) &&
            target.notebooks?.[info.id]?.editable?.revision === notebookBackupRevision(info))) continue;
          if (pathsKey(await readPaths()) !== pathsKey(paths) || generation !== startGeneration && metadataPending) break;
          if (recoveryPauses || !canRenderPdf()) { pdfDeferred = true; break; }
          const note = await getNotebook(info.id, { pdf: true });
          if (!note?.pages?.length || notebookBackupRevision(note) !== notebookBackupRevision(info)) { pdfDeferred = true; continue; }
          pdfProgress = { ...pdfProgress, notebookId: info.id, name: info.name, page: 0, totalPages: note.pages.length, rendered:0,reused:0,currentCompleted:false }; publish();
          let base64 = null, pdfError = null;
          try {
            base64 = await makePdf(note, page => {
              if (recoveryPauses || !canRenderPdf()) throw new Error('pdf-backup-deferred');
              if (page?.page) { pdfProgress = { ...pdfProgress, page: page.page, totalPages: page.totalPages || note.pages.length, ...(page.rendered!==undefined?{rendered:page.rendered,reused:page.reused}:{}) }; publish(); }
            }, { force: !!options.forcePdf });
            if (!base64) pdfError = 'pdf-backup-incomplete';
          } catch (error) {
            pdfError = error.message === 'pdf-backup-deferred' ? 'pdf-backup-deferred'
              : /image|รูป|ภาพ/i.test(error.message || '') ? 'pdf-backup-image-invalid' : 'pdf-backup-incomplete';
            pdfDeferred ||= pdfError === 'pdf-backup-deferred';
          }
          if (recoveryPauses) { pdfDeferred = true; break; }
          const saved = await native({ action: 'pdf', jobId, ...paths, notebookId: info.id,
            revision: notebookBackupRevision(info), pdfRevision: notebookPdfRevision(note), forcePdf:!!options.forcePdf, pdfBase64: base64 instanceof ArrayBuffer ? null : base64,
            pdfBytes: base64 instanceof ArrayBuffer ? base64 : undefined, pdfError,
            blockedNotebookTargets: targets.filter(target => hasConflicts(target)).map(target => target.targetDir),
            driveSyncGuard: options.driveSyncGuard ? (() => {
              const target = targets.find(item => rolesOf(item).includes('drive'));
              return target && !target.error && target.syncManifestHash ? { ready: true, manifestHash: target.syncManifestHash,
                entries: Object.fromEntries(Object.entries(target.notebooks || {}).map(([id,note]) => [id,note.editable?.hash || null])) }
                : { ready: false, reason: 'drive-sync-pending' };
            })() : undefined });
          updateTargets(saved, true); pdfProgress = { ...pdfProgress, done: pdfProgress.done + 1, currentCompleted:true }; publish();
          if (pdfError === 'pdf-backup-deferred') break;
          await yieldTask();
        }
        await updateMetadata(paths, options.excludeDrive);
        await persist({ targets, metadataRevision: writtenRevision, lastSuccess: snapshot.lastSuccess }).catch(() => {});
        return { success: snapshot.allDestinationsCurrent, localSuccess: snapshot.status === 'current',
          pdfComplete: snapshot.allPdfsCurrent, newerEditsPending: metadataPending || backupMetadataRevision(metadata) !== writtenRevision || getLocalState().status !== 'saved',
          targets, error: snapshot.targets.find(target => target.error)?.error || null,
          folderWritten: snapshot.folderWritten, timestamp: snapshot.lastSuccess,
          cloudUploadVerified: false, pdfDeferred };
      } catch (error) {
        lastFailure = error.message || 'backup-failed';
        return { success: false, error: lastFailure, targets, cloudUploadVerified: false };
      } finally {
        if (jobId && !dataCompleted) await native({ action: 'abort', jobId }).catch(() => {});
        syncing = false; phase = 'idle'; activeJob = null; initialized = true; publish();
        if ((generation !== startGeneration || pdfDeferred) && !disposed) schedule();
      }
    })();
    running.then(result => {
      clearTimeout(retryTimer);
      if(result.success){failureCount=0;retryPaused=false;}else if(!result.newerEditsPending){
        failureCount++;const codes=[result.error,result.reason,...targets.map(target=>target.error)];
        retryPaused=failureCount>=3||codes.some(code=>['folder-backup-newer','newer-backup-exists','conflicting-backup-revision','backup-conflict','invalid-existing-backup','invalid-backup-data','invalid-backup-manifest','backup-incomplete','unsafe-backup-path'].includes(code));
      }
      running = null;publish();
      if(!result.success&&!result.newerEditsPending&&!retryPaused&&!disposed&&!recoveryPauses){
        retryTimer=setTimeout(()=>run({automatic:true}),Math.min(120000,scheduleDelay*Math.pow(2,failureCount)));retryTimer.unref?.();
      }
    }, () => { running = null; });
    return running;
  };
  const run = (options = {}) => {
    if (recoveryPauses) return Promise.resolve({ success: false, reason: 'backup-recovery-busy' });
    if (running) return running;
    if(options.automatic&&retryPaused)return Promise.resolve({success:false,reason:'backup-retry-paused'});
    if(!options.automatic&&!options.checkDriveOnly){retryPaused=false;failureCount=0;}
    if (!beforeBackup) return performRun(options);
    if (preparing) return preparing;
    syncing=true;phase='checking';lastFailure=null;progress={stage:'checking',done:0,total:0,startedAt:now()};publish();
    preparing = Promise.resolve().then(async () => {
      const prepared = await beforeBackup(options);
      if (prepared?.skipBackup) return { success: true, checkOnly: true, cloudUploadVerified: false };
      if (recoveryPauses) return { success: false, reason: 'backup-recovery-busy' };
      return performRun({ ...options, ...prepared });
    }).catch(error=>{lastFailure=error.code||error.message||'backup-failed';return{success:false,error:lastFailure};}).finally(()=>{if(phase==='checking'){syncing=false;phase='idle';publish();}});
    preparing.then(() => { preparing = null; }, () => { preparing = null; });
    return preparing;
  };
  const schedule = () => {
    clearTimeout(dirtyTimer); if (disposed || recoveryPauses) return;
    dirtyTimer = setTimeout(() => {
      if (getLocalState().status !== 'saved') { schedule(); return; }
      if (snapshot.status !== 'current' || !snapshot.allDestinationsCurrent || pdfDeferred) run({automatic:true});
    }, scheduleDelay); dirtyTimer.unref?.();
  };
  const markDirty = () => { generation++; metadataPending = true; publish(); schedule(); };
  const localStateChanged = () => { publish(); };
  const destinationChanged = async () => {
    targets = []; cachedDetails = null; lastFailure = null; retryPaused=false;failureCount=0; generation++; metadataPending = true; publish();
    await initialize(); schedule();
  };
  const nativeProgress = event => {
    if (!activeJob || event?.jobId !== activeJob) return;
    progress = { ...progress, io: { stage: event.stage, bytesDone: event.bytesDone || 0,
      totalBytes: event.totalBytes || 0, fileName: event.fileName, targetDir: event.targetDir } }; publish();
  };
  const start = () => {
    disposed = false; if (interval) return;
    initialize(); initialTimer = setTimeout(() => { if (!recoveryPauses && !disposed && (snapshot.status !== 'current' || !snapshot.allDestinationsCurrent || !snapshot.allPdfsCurrent)) run({automatic:true}); }, 20000);
    interval = setInterval(() => {
      if (!running && !recoveryPauses) refresh({ inspect: true, deepVerify: true }).then(() => {
        if (!disposed && !recoveryPauses && (snapshot.status !== 'current' || !snapshot.allDestinationsCurrent || !snapshot.allPdfsCurrent)) run({automatic:true});
      }).catch(() => {});
    }, 3600000);
  };
  const stop = () => { disposed = true; clearTimeout(retryTimer); clearTimeout(dirtyTimer); clearTimeout(initialTimer); clearInterval(interval); interval = null; };
  const prune = ids => {
    // A queued prune must not enter the recovery lease's drain set while preflight owns it.
    if (preparing) return preparing.then(() => prune(ids));
    if (recoveryPauses) return Promise.resolve({ success: false, reason: 'backup-recovery-busy' });
    const job = (async () => {
      if (running) await running;
      const paths = await readPaths();
      if (recoveryPauses) return { success: false, reason: 'backup-recovery-busy' };
      const prepared=beforePrune?await beforePrune(ids):{};
      const destinations=prepared.excludeDrive?{...paths,driveBackupPath:null}:paths;
      const result = await native({ action: 'prune', notebookIds: ids, ...destinations, driveSyncGuard:prepared.driveSyncGuard,localSyncGuard:prepared.localSyncGuard }); updateTargets(result);
      if (!result?.success) lastFailure = result?.reason || 'backup-delete-incomplete';
      await refresh(); return result;
    })();
    pruning.add(job); job.then(() => pruning.delete(job), () => pruning.delete(job));
    return job;
  };
  const pauseForRecovery = () => {
    recoveryPauses++; clearTimeout(dirtyTimer); publish();
    let released = false;
    return {
      wait: async () => { await Promise.allSettled([running, ...pruning].filter(Boolean)); },
      resume: ({ changed = false } = {}) => {
        if (released) return; released = true; recoveryPauses--;
        if (changed) { cachedDetails = null; generation++; metadataPending = true; }
        publish(); schedule();
      }
    };
  };
  return { run, pauseForRecovery, start, stop, initialize, refresh, markDirty, localStateChanged, destinationChanged, prune, nativeProgress,
    getCachedDetails: () => cachedDetails, getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    waitForRunning: () => preparing || running || Promise.resolve() };
};
