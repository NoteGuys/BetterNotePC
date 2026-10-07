import { prunePageHistory } from '../utils/pageHistory.js';

// Session-only history: no note database, disk backup or Canvas is retained here.
// Shared objects/media are counted once; avoid stringify/deep-copy of every stroke.
const createRetainedSizeTracker = () => {
  const nodes = new Map();
  let bytes = 0;
  const retain = (value, packedPoints = false) => {
    if (value === null || (typeof value !== 'object' && typeof value !== 'string')) return;
    const existing = nodes.get(value);
    if (existing) { existing.refs++; return; }
    let children = [], size;
    if (typeof value === 'string') size = 24 + value.length * 2;
    else if (ArrayBuffer.isView(value)) size = 48 + value.byteLength;
    else if (value instanceof ArrayBuffer) size = 48 + value.byteLength;
    // Count a stroke's point buffer as one leaf. Tracking every sampled point
    // would itself consume memory and stall the first edit of a large note.
    else if (packedPoints && Array.isArray(value)) size = 32 + value.length * 96;
    else if (typeof Blob !== 'undefined' && value instanceof Blob) size = 48 + value.size;
    else {
      // Committed arrays are immutable; share their references instead of
      // allocating a second list of tracking objects for every old stroke.
      children = Array.isArray(value) ? value : Object.values(value);
      size = Array.isArray(value) ? 32 + children.length * 8 : 48 + children.length * 16;
    }
    size += 128; // Approximate the tracker node/Map overhead as part of the budget.
    nodes.set(value, { refs: 1, size, children });
    bytes += size;
    const pointBuffer = typeof value === 'object' ? value.points : null;
    children.forEach(child => retain(child, child === pointBuffer));
  };
  const release = value => {
    const node = nodes.get(value);
    if (!node || --node.refs) return;
    nodes.delete(value);
    bytes -= node.size;
    node.children.forEach(child => release(child));
  };
  return { retain, release, getBytes: () => bytes };
};

export const createNotebookHistoryStore = ({
  maxEntries = 200,
  maxBytes = 64 * 1024 * 1024
} = {}) => {
  if (!Number.isInteger(maxEntries) || maxEntries < 1 || !Number.isFinite(maxBytes) || maxBytes < 1) {
    throw new Error('Invalid history limits');
  }
  const sessions = new Map(), memory = createRetainedSizeTracker();
  const operationListeners = new Set();
  const notifyOperations = () => operationListeners.forEach(listener => listener());
  let clock = 0;
  const publish = session => session.listeners.forEach(listener => listener());
  const update = (session, values) => {
    session.snapshot = Object.freeze({ ...session.snapshot, ...values });
    publish(session);
  };
  const discard = (session, from, count) => {
    const { stack, pointer } = session.snapshot;
    stack.slice(from, from + count).forEach(memory.release);
    const remaining = [...stack.slice(0, from), ...stack.slice(from + count)];
    const removedApplied = Math.max(0, Math.min(count, pointer - from + 1));
    update(session, { stack: remaining, pointer: pointer - removedApplied });
  };
  const enforceLimits = protectedSession => {
    for (const session of sessions.values()) {
      if (session.pending) continue;
      while (session.snapshot.stack.length > maxEntries) {
        if (session.snapshot.pointer >= 0) discard(session, 0, 1);
        else discard(session, session.snapshot.stack.length - 1, 1);
      }
    }
    // Evict least recently used history first. Keep the latest requested action,
    // even when that one page is larger than the budget, so immediate Undo works.
    while (memory.getBytes() > maxBytes) {
      const candidates = [...sessions.values()].filter(session =>
        !session.pending && session.snapshot.stack.length &&
        (session !== protectedSession || session.snapshot.stack.length > 1)
      ).sort((a, b) =>
        Number(a === protectedSession) - Number(b === protectedSession) || a.lastUsed - b.lastUsed
      );
      if (!candidates.length) break;
      const session = candidates[0];
      if (session.snapshot.pointer >= 0) discard(session, 0, 1);
      else discard(session, session.snapshot.stack.length - 1, 1);
    }
  };
  const getSession = notebookId => {
    if (!notebookId) throw new Error('Notebook ID is required');
    if (sessions.has(notebookId)) return sessions.get(notebookId);
    const session = {
      snapshot: Object.freeze({ stack: [], pointer: -1, busy: false }),
      listeners: new Set(), pending: null, lastUsed: ++clock, api: null
    };
    sessions.set(notebookId, session);
    const api = {
      getSnapshot: () => session.snapshot,
      subscribe: listener => {
        session.lastUsed = ++clock;
        session.listeners.add(listener);
        return () => session.listeners.delete(listener);
      },
      append: entry => {
        const { stack, pointer } = session.snapshot;
        stack.slice(pointer + 1).forEach(memory.release);
        const next = [...stack.slice(0, pointer + 1), entry];
        memory.retain(entry);
        session.lastUsed = ++clock;
        update(session, { stack: next, pointer: next.length - 1 });
        if (!session.pending) enforceLimits(session);
      },
      step: (direction, expected, replacement = expected) => {
        const { stack, pointer } = session.snapshot;
        const index = direction === 'undo' ? pointer : pointer + 1;
        if (!expected || stack[index] !== expected) throw new Error('History changed during replay');
        let next = stack;
        if (replacement !== expected) {
          memory.retain(replacement);
          memory.release(expected);
          next = [...stack]; next[index] = replacement;
        }
        session.lastUsed = ++clock;
        update(session, { stack: next, pointer: direction === 'undo' ? pointer - 1 : pointer + 1 });
        if (!session.pending) enforceLimits(session);
      },
      reconcile: pages => {
        const before = session.snapshot;
        const next = prunePageHistory(before.stack, before.pointer, pages);
        const kept = new Set(next.stack);
        before.stack.filter(entry => !kept.has(entry)).forEach(memory.release);
        update(session, next);
      },
      // Page operations belong to the notebook, even if its editor unmounts.
      // Later edits/replays queue behind them instead of racing a deleted page.
      run: operation => {
        const previous = session.pending;
        const job = (previous ? previous.catch(() => {}) : Promise.resolve()).then(operation);
        session.pending = job;
        update(session, { busy: true });
        notifyOperations();
        const finish = () => {
          if (session.pending !== job) return;
          session.pending = null;
          update(session, { busy: false });
          enforceLimits(session);
          notifyOperations();
        };
        job.then(finish, finish);
        return job;
      },
      wait: async () => {
        while (session.pending) {
          try { await session.pending; } catch (_) {}
        }
      }
    };
    session.api = api;
    return session;
  };
  return {
    forNotebook: notebookId => getSession(notebookId).api,
    getRetainedBytes: memory.getBytes,
    getPendingOperationCount: () => [...sessions.values()].filter(session => session.pending).length,
    subscribeOperations: listener => { operationListeners.add(listener); return () => operationListeners.delete(listener); },
    waitForPendingOperations: async () => {
      while (true) {
        const jobs = [...sessions.values()].map(session => session.pending).filter(Boolean);
        if (!jobs.length) return;
        await Promise.allSettled(jobs);
      }
    },
    clearNotebooks: notebookIds => {
      const selected = [...new Set(notebookIds)].map(id => sessions.get(id)).filter(Boolean);
      if (selected.some(session => session.pending)) throw new Error('History operation still pending');
      for (const session of selected) {
        session.snapshot.stack.forEach(memory.release);
        session.snapshot = Object.freeze({ ...session.snapshot, stack: [], pointer: -1 });
      }
      // One stale view must not prevent other imported notebooks from clearing their old Undo.
      for (const session of selected) for (const listener of session.listeners) { try { listener(); } catch (_) {} }
    },
    clear: () => {
      if ([...sessions.values()].some(session => session.pending)) throw new Error('History operation still pending');
      for (const session of sessions.values()) {
        session.snapshot.stack.forEach(memory.release);
        update(session, { stack: [], pointer: -1 });
      }
    }
  };
};

export const notebookHistoryStore = createNotebookHistoryStore();
