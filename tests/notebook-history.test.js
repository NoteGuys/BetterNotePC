import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotebookHistoryStore } from '../src/services/notebookHistoryService.js';
import { prunePageHistory } from '../src/utils/pageHistory.js';

const content = (id, n = 1) => ({
  kind: 'content', pageId: id,
  before: { strokes: [], textElements: [], imageElements: [] },
  after: { strokes: [{ points: [{ x: n, y: n }] }], textElements: [], imageElements: [] }
});
const deleted = id => ({ kind: 'delete-page', pageId: id, page: { id, strokes: [] }, pageIndex: 0 });
const inserted = id => ({ kind: 'insert-page', pageId: id, page: { id, strokes: [] }, pageIndex: 0 });
const defer = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('A notebook keeps both Undo and Redo positions after another notebook is edited', () => {
  const store = createNotebookHistoryStore();
  const a = store.forNotebook('a'), b = store.forNotebook('b');
  const first = content('a-p', 1), second = content('a-p', 2);
  a.append(first); a.append(second); a.step('undo', second);
  b.append(content('b-p'));
  const reopened = store.forNotebook('a');
  assert.equal(reopened, a);
  assert.deepEqual(reopened.getSnapshot().stack, [first, second]);
  assert.equal(reopened.getSnapshot().pointer, 0);
  reopened.step('redo', second);
  assert.equal(reopened.getSnapshot().pointer, 1);
  assert.equal(b.getSnapshot().pointer, 0);
});

test('A new edit clears only that notebook redo branch', () => {
  const store = createNotebookHistoryStore();
  const a = store.forNotebook('a'), b = store.forNotebook('b');
  const old = content('a-p'), other = content('b-p'), next = content('a-p', 3);
  a.append(old); a.step('undo', old);
  b.append(other); b.step('undo', other);
  a.append(next);
  assert.deepEqual(a.getSnapshot().stack, [next]);
  assert.equal(b.getSnapshot().stack[0], other);
  assert.equal(b.getSnapshot().pointer, -1);
});

test('Deleted-page content remains undoable after its page is restored', () => {
  const ink = content('p0'), removal = deleted('p0');
  assert.deepEqual(prunePageHistory([ink, removal], 1, [{ id: 'p1' }]), {
    stack: [ink, removal], pointer: 1
  });
  assert.deepEqual(prunePageHistory([ink, removal], 0, [{ id: 'p0' }, { id: 'p1' }]), {
    stack: [ink, removal], pointer: 0
  });
  assert.deepEqual(prunePageHistory([ink, removal], -1, [{ id: 'p0' }, { id: 'p1' }]), {
    stack: [ink, removal], pointer: -1
  });
});

test('Undone insertion retains its Redo and later ink across reopening', () => {
  const add = inserted('p1'), ink = content('p1');
  assert.deepEqual(prunePageHistory([add, ink], -1, [{ id: 'p0' }]), {
    stack: [add, ink], pointer: -1
  });
});

test('Mixed insert, ink and delete actions remain valid at every replay boundary', () => {
  const add = inserted('p1'), ink = content('p1'), remove = deleted('p1');
  const stack = [add, ink, remove];
  for (const [pointer, ids] of [[2,['p0']], [1,['p0','p1']], [0,['p0','p1']], [-1,['p0']]]) {
    assert.deepEqual(prunePageHistory(stack, pointer, ids.map(id => ({ id }))), { stack, pointer });
  }
});

test('Missing external targets discard incompatible history without selecting a different page', () => {
  const ink = content('gone'), current = content('p0');
  assert.deepEqual(prunePageHistory([ink, current], 1, [{ id: 'p0' }]), { stack: [current], pointer: 0 });
  assert.deepEqual(prunePageHistory([current, ink], -1, [{ id: 'p0' }]), { stack: [current], pointer: -1 });
});

test('The last remaining page cannot be removed by a malformed historical insertion', () => {
  const add = inserted('p0');
  assert.deepEqual(prunePageHistory([add], 0, [{ id: 'p0' }]), { stack: [], pointer: -1 });
});

test('A page operation survives view unsubscribe and completes before its next action', async () => {
  const store = createNotebookHistoryStore(), a = store.forNotebook('a'), hold = defer(), order = [];
  let notifications = 0;
  const off = a.subscribe(() => notifications++);
  const first = a.run(async () => { order.push('start'); await hold.promise; a.append(inserted('new')); order.push('commit'); });
  const second = a.run(() => { order.push('undo'); a.step('undo', a.getSnapshot().stack[0]); });
  off(); const before = notifications;
  const waiting = store.forNotebook('a').wait().then(() => order.push('opened'));
  assert.equal(a.getSnapshot().busy, true);
  hold.resolve(); await Promise.all([first, second, waiting]);
  assert.deepEqual(order, ['start', 'commit', 'undo', 'opened']);
  assert.equal(a.getSnapshot().busy, false);
  assert.equal(a.getSnapshot().pointer, -1);
  assert.equal(notifications, before);
});

test('Failed operations keep the history pointer and allow the next retry to run', async () => {
  const a = createNotebookHistoryStore().forNotebook('a'), entry = deleted('p0');
  a.append(entry);
  await assert.rejects(a.run(async () => { throw new Error('Synthetic transaction abort'); }), /abort/);
  assert.equal(a.getSnapshot().pointer, 0);
  await a.run(() => a.step('undo', entry));
  await a.wait();
  assert.equal(a.getSnapshot().pointer, -1);
  assert.equal(a.getSnapshot().busy, false);
});

test('Undo/Redo replacement retains a removed page with its latest metadata', () => {
  const store = createNotebookHistoryStore(), a = store.forNotebook('a'), entry = inserted('p1');
  a.append(entry);
  const replacement = { ...entry, page: { ...entry.page, isFavorite: true, templateId: 'dotted' } };
  a.step('undo', entry, replacement);
  assert.equal(a.getSnapshot().stack[0].page.isFavorite, true);
  a.step('redo', replacement);
  assert.equal(a.getSnapshot().stack[0].page.templateId, 'dotted');
});

test('The history count limit keeps the latest available actions in order', () => {
  const a = createNotebookHistoryStore({ maxEntries: 3 }).forNotebook('a');
  const entries = Array.from({ length: 5 }, (_, i) => content('p0', i));
  entries.forEach(a.append);
  assert.deepEqual(a.getSnapshot().stack, entries.slice(2));
  assert.equal(a.getSnapshot().pointer, 2);
  a.step('undo', entries[4]);
  a.step('undo', entries[3]);
  a.step('undo', entries[2]);
  assert.equal(a.getSnapshot().pointer, -1);
});

test('Shared large media is retained once and fully released when history is cleared', () => {
  const store = createNotebookHistoryStore(), a = store.forNotebook('a');
  const image = { id: 'image', src: 'data:image/png;base64,' + 'A'.repeat(250000), width: 40, height: 40 };
  const images = [image];
  const first = { ...content('p0'), before: { imageElements: images }, after: { imageElements: images } };
  a.append(first); const once = store.getRetainedBytes();
  a.append({ ...first, after: { imageElements: images, strokes: [1] } });
  const twice = store.getRetainedBytes();
  assert.ok(once > 500000);
  assert.ok(twice - once < 4096, 'Shared media should not be counted/copied again per history entry');
  store.clear();
  assert.equal(store.getRetainedBytes(), 0);
  assert.equal(a.getSnapshot().pointer, -1);
});

test('Memory pressure drops old notebook history before the latest action', () => {
  const store = createNotebookHistoryStore({ maxBytes: 2600 }), a = store.forNotebook('a'), b = store.forNotebook('b');
  a.append({ ...deleted('a-p'), page: { id: 'a-p', pdfPageImage: 'A'.repeat(700) } });
  const latest = { ...deleted('b-p'), page: { id: 'b-p', pdfPageImage: 'B'.repeat(700) } };
  b.append(latest);
  assert.equal(a.getSnapshot().stack.length, 0);
  assert.equal(b.getSnapshot().stack.at(-1), latest);
  assert.ok(store.getRetainedBytes() <= 2600);
});

test('A single large deleted page stays available for immediate Undo despite the budget', () => {
  const store = createNotebookHistoryStore({ maxBytes: 256 }), a = store.forNotebook('a');
  const entry = { ...deleted('p0'), page: { id: 'p0', pdfPageImage: 'A'.repeat(4000) } };
  a.append(entry);
  assert.equal(a.getSnapshot().stack[0], entry);
  a.step('undo', entry);
  assert.equal(a.getSnapshot().stack[0], entry);
  assert.equal(a.getSnapshot().pointer, -1);
  store.clear(); assert.equal(store.getRetainedBytes(), 0);
});

test('Independent notebooks can operate while another page operation is slow', async () => {
  const store = createNotebookHistoryStore(), a = store.forNotebook('a'), b = store.forNotebook('b'), hold = defer();
  const slow = a.run(() => hold.promise);
  await b.run(() => b.append(content('b-p')));
  assert.equal(b.getSnapshot().pointer, 0);
  assert.equal(a.getSnapshot().busy, true);
  hold.resolve(); await slow;
});

test('Save/close observers wait through gaps between queued history transactions', async () => {
  const store = createNotebookHistoryStore(), a = store.forNotebook('a'), first = defer(), second = defer(), events = [];
  const off = store.subscribeOperations(() => events.push(store.getPendingOperationCount()));
  const op1 = a.run(() => first.promise);
  const op2 = a.run(() => second.promise);
  let completed = false;
  const all = store.waitForPendingOperations().then(() => { completed = true; });
  first.resolve(); await op1;
  assert.equal(completed, false);
  assert.equal(store.getPendingOperationCount(), 1);
  second.resolve(); await Promise.all([op2, all]);
  assert.equal(completed, true);
  assert.equal(events.at(-1), 0);
  off();
});

test('Large stroke buffers share history without allocating point tracking entries per snapshot', () => {
  const store = createNotebookHistoryStore({ maxBytes: 32 * 1024 * 1024 }), a = store.forNotebook('a');
  const points = Array.from({ length: 50000 }, (_, i) => ({ x: i, y: i, pressure: 0.5 }));
  const stroke = { id: 'stroke', points }, strokes = [stroke];
  a.append({ ...content('p0'), before: { strokes: [] }, after: { strokes } });
  const once = store.getRetainedBytes();
  a.append({ ...content('p0'), before: { strokes }, after: { strokes: [...strokes, { id: 'next', points: [{ x: 5, y: 5 }] }] } });
  assert.ok(store.getRetainedBytes() - once < 4096);
  store.clear();
  assert.equal(store.getRetainedBytes(), 0);
});


test('Recovery clears only imported notebook history and releases its retained media', () => {
 const store=createNotebookHistoryStore(),a=store.forNotebook('restore'),b=store.forNotebook('unrelated');
 a.append({kind:'ink',before:{images:['restored-image'.repeat(100)]}}); b.append({kind:'ink',before:{strokes:[]}});
 const bytes=store.getRetainedBytes(),prior=b.getSnapshot();store.clearNotebooks(['restore','restore','unknown']);
 assert.deepEqual(a.getSnapshot().stack,[]);assert.equal(a.getSnapshot().pointer,-1);assert.equal(b.getSnapshot(),prior);assert.ok(store.getRetainedBytes()<bytes);
});
test('Recovery refuses to clear pending history before draining the operation', async () => {
 const store=createNotebookHistoryStore(),a=store.forNotebook('a'),b=store.forNotebook('b');a.append({id:'kept'});b.append({id:'kept-too'});
 let release;const gate=new Promise(r=>release=r);const job=a.run(()=>gate);
 assert.throws(()=>store.clearNotebooks(['a','b']),/pending/);assert.equal(a.getSnapshot().stack.length,1);assert.equal(b.getSnapshot().stack.length,1);
 release();await job;store.clearNotebooks(['a']);assert.equal(a.getSnapshot().stack.length,0);assert.equal(b.getSnapshot().stack.length,1);
});

test('A faulty inactive history subscriber cannot leave other imported Undo actions behind', () => {
 const store=createNotebookHistoryStore(),a=store.forNotebook('a'),b=store.forNotebook('b');a.append({id:'a'});b.append({id:'b'});
 a.subscribe(()=>{throw Error('stale view');});store.clearNotebooks(['a','b']);assert.equal(a.getSnapshot().stack.length,0);assert.equal(b.getSnapshot().stack.length,0);
});
