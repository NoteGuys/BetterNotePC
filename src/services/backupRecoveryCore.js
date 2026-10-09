// Restore owns a short exclusive window. Background writers drain before source files are read.
export const createBackupRecovery = ({ canRestore = () => true, pauseBackups, flushLocalSaves,
  restore, afterCommit = async () => {}, onActive = () => {} }) => {
  let running = null, abortController = null;
  let snapshot = Object.freeze({ active: false, phase: 'idle' });
  const listeners = new Set();
  const publish = (phase, progress = null) => {
    snapshot = Object.freeze({ active: phase !== 'idle', phase, ...(progress ? { progress } : {}) });
    for (const listener of listeners) { try { listener(); } catch (_) {} }
  };
  const fault = code => Object.assign(new Error(code), { code });
  const run = load => {
    if (running || snapshot.active) return Promise.reject(fault('backup-recovery-busy'));
    if (!canRestore()) return Promise.reject(fault('backup-recovery-editor-open'));
    abortController = new AbortController();
    const signal = abortController.signal;
    const checkCancelled = () => { if (signal.aborted) throw fault('backup-recovery-cancelled'); };
    const report = progress => { if (!signal.aborted) publish('checking', progress); };
    publish('waiting');
    let lease;
    try { onActive(); lease = pauseBackups(); }
    catch (error) { publish('idle'); return Promise.reject(error); }
    // Register the promise before invoking asynchronous work.
    running = Promise.resolve().then(async () => {
      let committed = false, unconfirmed = false;
      try {
        await lease.wait();
        checkCancelled();
        try { await flushLocalSaves(); } catch (_) { throw fault('backup-recovery-unsaved'); }
        if (!canRestore()) throw fault('backup-recovery-editor-open');
        checkCancelled();
        publish('checking');
        const input = await load({ signal, report });
        checkCancelled();
        const result = await restore(input, publish, { signal, report });
        committed = true;
        publish('refreshing');
        try { await afterCommit(result); } catch (_) { return { ...result, refreshFailed: true }; }
        return result;
      } catch (error) {
        unconfirmed = error.code === 'backup-recovery-unconfirmed';
        throw error;
      } finally {
        // An unreadable receipt after a worker failure cannot safely release the old UI/Undo.
        if (!unconfirmed) lease?.resume({ changed: committed });
        publish(unconfirmed ? 'unconfirmed' : 'idle');
      }
    });
    running.then(() => { running = null; }, () => { running = null; });
    return running;
  };
  return { run, cancel: () => {
    if (!snapshot.active || !['waiting','checking'].includes(snapshot.phase) || !abortController || abortController.signal.aborted) return false;
    abortController.abort(); return true;
  }, getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    waitForPending: async () => { while (running) { try { await running; } catch (_) {} } } };
};
