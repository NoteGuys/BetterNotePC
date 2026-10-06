import test from 'node:test';
import assert from 'node:assert/strict';
import { createPageSaveQueue } from '../src/services/localSaveService.js';
import { findHistoryPageIndex, prunePageHistory } from '../src/utils/pageHistory.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const page = (revision, id = 'p1', notebookId = 'n1') => ({ id, notebookId, pageIndex: 0, strokes: [revision], textElements: [], imageElements: [] });

test('Rapid saves retain the latest revision and never write an older revision after it', async () => {
  const first = deferred(), writes = [];
  const queue = createPageSaveQueue(async record => {
    writes.push(record.strokes[0]);
    if (writes.length === 1) await first.promise;
  });
  const a = queue.enqueue(page(1)), b = queue.enqueue(page(2)), c = queue.enqueue(page(3));
  assert.equal(queue.getSnapshot().status, 'saving');
  first.resolve();
  await Promise.all([a, b, c]);
  await queue.flush();
  assert.deepEqual(writes, [1, 3]);
  assert.deepEqual(queue.getSnapshot(), { status: 'saved', pending: 0, failed: 0 });
});

test('A rejected save keeps the newest edit, including edits made during that save', async () => {
  const first = deferred(); let failed = true; const writes = [];
  const queue = createPageSaveQueue(async record => {
    writes.push(record.strokes[0]);
    if (failed) { await first.promise; throw new Error('Disk unavailable'); }
  });
  const a = queue.enqueue(page(1)).catch(error => error.message);
  const b = queue.enqueue(page(2)).catch(error => error.message);
  first.resolve();
  assert.equal(await a, 'Disk unavailable'); assert.equal(await b, 'Disk unavailable');
  assert.equal(queue.getSnapshot().status, 'error');
  assert.deepEqual(queue.overlay([page(0)], 'n1')[0].strokes, [2]);
  await assert.rejects(queue.flush(), /Disk unavailable/);
  failed = false; await queue.retry();
  assert.deepEqual(writes, [1, 2]);
  assert.equal(queue.getSnapshot().status, 'saved');
});

test('New edits after a failed save remain visible and wait for explicit retry', async () => {
  let failed = true, calls = 0;
  const queue = createPageSaveQueue(async () => { calls++; if (failed) throw new Error('Quota'); });
  await queue.enqueue(page(1)).catch(() => {});
  await queue.enqueue(page(2)).catch(() => {});
  await queue.enqueue(page(3)).catch(() => {});
  assert.equal(calls, 1);
  assert.deepEqual(queue.overlay([page(0)], 'n1')[0].strokes, [3]);
  failed = false; await queue.retry();
  assert.equal(calls, 2);
});

test('One slow notebook does not block a different notebook', async () => {
  const hold = deferred();
  const queue = createPageSaveQueue(record => record.notebookId === 'n1' ? hold.promise : Promise.resolve());
  const slow = queue.enqueue(page(1));
  await queue.enqueue(page(2, 'p2', 'n2'));
  await queue.flush('n2');
  assert.equal(queue.getSnapshot().pending, 1);
  hold.resolve(); await slow; await queue.flush();
});

test('Flushing one notebook ignores failed saves in another notebook', async () => {
  const queue = createPageSaveQueue(async record => { if (record.notebookId === 'n1') throw new Error('Failure'); });
  await queue.enqueue(page(1)).catch(() => {});
  await queue.enqueue(page(2, 'p2', 'n2'));
  await queue.flush('n2');
  await assert.rejects(queue.flush(), /Failure/);
});

test('Retry failure keeps the snapshot and does not falsely report saved', async () => {
  const queue = createPageSaveQueue(async () => { throw new Error('Still unavailable'); });
  await queue.enqueue(page(1)).catch(() => {});
  await assert.rejects(queue.retry(), /Still unavailable/);
  assert.equal(queue.getSnapshot().status, 'error');
  assert.deepEqual(queue.overlay([page(0)], 'n1')[0].strokes, [1]);
});

test('Queued edits survive editor unmount/remount and keep the new database page index', async () => {
  const queue = createPageSaveQueue(async () => { throw new Error('Unavailable'); });
  await queue.enqueue({ ...page(2), pageIndex: 4 }).catch(() => {});
  const reopened = queue.overlay([{ ...page(0), pageIndex: 1 }], 'n1');
  assert.equal(reopened[0].pageIndex, 1);
  assert.deepEqual(reopened[0].strokes, [2]);
  assert.deepEqual(queue.overlay([page(0)], 'n2')[0].strokes, [0]);
});

test('Committed page payloads are released rather than retained in the save queue', async () => {
  const queue = createPageSaveQueue(async () => {});
  await queue.enqueue(page(1)); await queue.flush();
  const record = page(0);
  assert.equal(queue.overlay([record], 'n1')[0], record);
  assert.equal(queue.getSnapshot().pending, 0);
});

test('Subscribers stop receiving notifications after unsubscribe', async () => {
  const queue = createPageSaveQueue(async () => {});
  let calls = 0; const off = queue.subscribe(() => calls++);
  await queue.enqueue(page(1)); await queue.flush();
  const previous = calls; off();
  await queue.enqueue(page(2)); await queue.flush();
  assert.equal(calls, previous);
});

test('A deliberately deleted page cannot remain as a phantom failed save', async () => {
  const hold = deferred(); const queue = createPageSaveQueue(() => hold.promise);
  const pending = queue.enqueue(page(1)).catch(error => error.message);
  queue.forgetDeletedPage('p1');
  assert.match(await pending, /intentionally deleted/);
  hold.resolve(); await tick(); await queue.flush();
  assert.equal(queue.getSnapshot().status, 'saved');
});

test('Malformed pages are rejected without changing save status', async () => {
  const queue = createPageSaveQueue(async () => {});
  await assert.rejects(queue.enqueue({ id: 'p1' }), /Invalid page/);
  assert.equal(queue.getSnapshot().status, 'saved');
});

test('Undo finds its original page after a preceding page has been deleted', () => {
  const entry = { pageId: 'p2', pageIndex: 1 };
  assert.equal(findHistoryPageIndex([{ id: 'p2' }, { id: 'p3' }], entry), 0);
});

test('Undo still finds the same page after insertion or duplication before it', () => {
  assert.equal(findHistoryPageIndex([{ id: 'copy' }, { id: 'p1' }, { id: 'p2' }], { pageId: 'p2', pageIndex: 1 }), 2);
});

test('Missing/deleted history targets never fall back to the active page', () => {
  assert.equal(findHistoryPageIndex([{ id: 'p3' }], { pageId: 'p2', pageIndex: 0 }), -1);
  assert.equal(findHistoryPageIndex([{ id: 'p3' }], { pageIndex: 0 }), -1);
});

test('An externally missing page cuts incompatible older history while retaining valid Redo', () => {
  const stack = [{ pageId: 'p2' }, { pageId: 'gone' }, { pageId: 'p3' }];
  assert.deepEqual(prunePageHistory(stack, 1, [{ id: 'p2' }, { id: 'p3' }]), {
    stack: [{ pageId: 'p3' }], pointer: -1
  });
});

test('An empty/deleted history produces no enabled Undo or Redo entries', () => {
  assert.deepEqual(prunePageHistory([{ pageId: 'gone' }, {}], 1, [{ id: 'p2' }]), { stack: [], pointer: -1 });
});
