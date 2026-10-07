import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackupRecovery } from '../src/services/backupRecoveryCore.js';
import { prepareBackup } from '../electron/backupValidation.js';
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
const setup = (overrides = {}) => {
  const calls = [];
  const recovery = createBackupRecovery({
    pauseBackups: () => { calls.push('pause'); return { wait: async () => calls.push('drained'), resume: value => calls.push(['resume', value.changed]) }; },
    flushLocalSaves: async () => calls.push('saved'), restore: async (input, phase) => { calls.push('commit'); phase('writing'); return input; },
    afterCommit: async () => calls.push('refresh'), ...overrides });
  return { recovery, calls };
};
test('Recovery pauses synchronously, drains backups, flushes saves, then commits and resumes', async () => {
  const { recovery, calls } = setup();
  const job = recovery.run(() => { calls.push('load'); return { notebooksCount: 1 }; });
  assert.equal(recovery.getSnapshot().active, true); assert.deepEqual(calls, ['pause']);
  assert.equal((await job).notebooksCount, 1);
  assert.deepEqual(calls, ['pause', 'drained', 'saved', 'load', 'commit', 'refresh', ['resume', true]]);
  assert.equal(recovery.getSnapshot().active, false);
});
test('Source files are not read while an earlier backup is still running', async () => {
  const gate = deferred(); let read = false;
  const { recovery } = setup({ pauseBackups: () => ({ wait: () => gate.promise, resume() {} }) });
  const job = recovery.run(() => { read = true; return {}; });
  await Promise.resolve(); assert.equal(read, false); gate.resolve(); await job; assert.equal(read, true);
});
test('Concurrent recovery is rejected without disturbing the first operation', async () => {
  const gate = deferred(); const { recovery } = setup();
  const job = recovery.run(() => gate.promise);
  await assert.rejects(recovery.run(() => ({})), { code: 'backup-recovery-busy' });
  gate.resolve({}); await job;
});
test('Unsaved local work blocks reading/import and releases the backup pause', async () => {
  const { recovery, calls } = setup({ flushLocalSaves: async () => { throw Error('disk'); } });
  await assert.rejects(recovery.run(() => { throw Error('must not read'); }), { code: 'backup-recovery-unsaved' });
  assert.deepEqual(calls, ['pause', 'drained', ['resume', false]]); assert.equal(recovery.getSnapshot().active, false);
});
test('Open editor blocks recovery before pausing or reading', async () => {
  const { recovery, calls } = setup({ canRestore: () => false });
  await assert.rejects(recovery.run(() => ({})), { code: 'backup-recovery-editor-open' }); assert.deepEqual(calls, []);
});
test('Editor opening while backup drains prevents import', async () => {
  let canRestore = true; const gate = deferred(); const { recovery } = setup({ canRestore: () => canRestore,
    pauseBackups: () => ({ wait: () => gate.promise, resume() {} }) });
  const job = recovery.run(() => { throw Error('must not load'); }); canRestore = false; gate.resolve();
  await assert.rejects(job, { code: 'backup-recovery-editor-open' });
});
test('Invalid input and commit failures preserve history and resume without marking imported data', async () => {
  for (const at of ['load', 'commit']) {
    const { recovery, calls } = setup(at === 'commit' ? { restore: async () => { throw Error('abort'); } } : {});
    await assert.rejects(recovery.run(() => { if (at === 'load') throw Error('invalid'); return {}; }));
    assert.ok(!calls.includes('refresh')); assert.deepEqual(calls.at(-1), ['resume', false]);
  }
});
test('Close waits for the transaction and the library refresh to finish', async () => {
  const gate = deferred(); let closed = false; const { recovery } = setup({ afterCommit: () => gate.promise });
  const job = recovery.run(() => ({})); const close = recovery.waitForPending().then(() => { closed = true; });
  await new Promise(resolve => setTimeout(resolve, 5)); assert.equal(closed, false); gate.resolve(); await job; await close; assert.equal(closed, true);
});
test('A committed restore with a UI refresh error is reported as restored with a refresh warning', async () => {
  const { recovery, calls } = setup({ afterCommit: async () => { throw Error('read'); } });
  const result = await recovery.run(() => ({ notebooksCount: 2 }));
  assert.equal(result.notebooksCount, 2); assert.equal(result.refreshFailed, true); assert.deepEqual(calls.at(-1), ['resume', true]);
});
test('A failed restore does not prevent closing with the retained local data', async () => {
  const { recovery } = setup(); const job = recovery.run(() => { throw Error('bad data'); });
  await assert.rejects(job); await recovery.waitForPending();
});
const note = (id = 'n') => ({ id, name: 'Same name', pageCount: 1, pages: [{ id: id + '-p', pageIndex: 0, strokes: [] }] });
test('Manual JSON uses the same strict validation as native folder recovery', () => {
  const source = { folders: [], notebooks: [note('a'), note('b')] };
  const prepared = prepareBackup(source); assert.equal(prepared.notebooks.length, 2);
  assert.equal(prepared.notebooks[0].pages[0].notebookId, 'a');
  for (const broken of [null, {}, { notebooks: [] }, { notebooks: [null] }, { notebooks: [note(), note()] },
    { notebooks: [{ ...note(), pageCount: 2 }] }, { folders: null, notebooks: [note()] },
    { notebooks: [{ ...note(), folderId: 'missing' }] }]) assert.throws(() => prepareBackup(broken));
});

test('An unconfirmed worker outcome holds navigation and backup until the app is reopened', async () => {
 const {recovery,calls}=setup({restore:async()=>{throw Object.assign(new Error(),{code:'backup-recovery-unconfirmed'});}});
 await assert.rejects(recovery.run(()=>({})),{code:'backup-recovery-unconfirmed'});
 assert.equal(recovery.getSnapshot().active,true);assert.equal(recovery.getSnapshot().phase,'unconfirmed');
 assert.ok(!calls.some(call=>Array.isArray(call)&&call[0]==='resume'));await recovery.waitForPending();
 await assert.rejects(recovery.run(()=>({})),{code:'backup-recovery-busy'});
});
