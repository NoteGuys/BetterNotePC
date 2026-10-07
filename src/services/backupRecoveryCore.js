// Restore owns a short exclusive window. Background writers drain before source files are read.
export const createBackupRecovery = ({ canRestore = () => true, pauseBackups, flushLocalSaves,
  restore, afterCommit = async () => {}, onActive = () => {} }) => {
  let running = null;
  let snapshot = Object.freeze({ active: false, phase: 'idle' });
  const listeners = new Set();
  const publish = phase => {
    snapshot = Object.freeze({ active: phase !== 'idle', phase });
    for (const listener of listeners) { try { listener(); } catch (_) {} }
  };
  const fault = code => Object.assign(new Error(code), { code });
  const run = load => {
    if (running || snapshot.active) return Promise.reject(fault('backup-recovery-busy'));
    if (!canRestore()) return Promise.reject(fault('backup-recovery-editor-open'));
    publish('waiting');
    let lease;
    try { onActive(); lease = pauseBackups(); }
    catch (error) { publish('idle'); return Promise.reject(error); }
    // Register the promise before invoking asynchronous work.
    running = Promise.resolve().then(async () => {
      let committed = false, unconfirmed = false;
      try {
        await lease.wait();
        try { await flushLocalSaves(); } catch (_) { throw fault('backup-recovery-unsaved'); }
        if (!canRestore()) throw fault('backup-recovery-editor-open');
        publish('checking');
        const input = await load();
        const result = await restore(input, publish);
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
  return { run, getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    waitForPending: async () => { while (running) { try { await running; } catch (_) {} } } };
};
