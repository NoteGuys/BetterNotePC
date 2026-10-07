import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBackupReadFolder, backupReadErrorKey } from '../src/services/backupReadStatus.js';
const settings = entries => async key => entries[key];
test('An explicit recovery folder takes priority over every saved setting', async () => {
  assert.equal(await resolveBackupReadFolder(() => { throw Error('Must not read settings'); }, 'X:/Chosen'), 'X:/Chosen');
});
test('Configured Drive desktop folder is selected without guessing other destinations', async () => {
  assert.equal(await resolveBackupReadFolder(settings({ gdrive_backup_method: 'desktop', gdrive_backup_path: ' I:/My Drive/Notes ', local_backup_path: 'C:/Old' })), 'I:/My Drive/Notes');
});
test('Inactive direct Google connection does not select its old backup path', async () => {
  assert.equal(await resolveBackupReadFolder(settings({ gdrive_backup_method: 'oauth', gdrive_backup_path: 'I:/Old', local_backup_path: 'C:/Chosen' })), 'C:/Chosen');
});
test('Without a configured folder discovery is explicit in the native layer', async () => {
  assert.equal(await resolveBackupReadFolder(settings({})), null);
});
test('Settings read failures propagate instead of falling back to an unrelated backup', async () => {
  await assert.rejects(resolveBackupReadFolder(async () => { throw Error('Settings unavailable'); }), /Settings unavailable/);
});
test('Recovery failures map to translation keys without exposing raw paths or native errors', () => {
  assert.equal(backupReadErrorKey('backup-incomplete'), 'backupReadIncomplete');
  assert.equal(backupReadErrorKey('backup-conflict'), 'backupReadConflict');
  assert.equal(backupReadErrorKey('C:/private/file'), 'backupReadUnavailable');
});

test('Reserved object key names cannot escape the recovery error mapping', () => {
  for (const reason of ['toString', 'constructor', '__proto__']) assert.equal(backupReadErrorKey(reason), 'backupReadUnavailable');
});
