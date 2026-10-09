const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { createDriveDesktopLauncher, registerDriveDesktop } = require('../electron/driveDesktop.cjs');
const root = 'C:\\Program Files', install = path.join(root, 'Google', 'Drive File Stream');
const fixture = ({ files = [], versions = [], launch = async () => '' } = {}) => {
  const calls = [], opened = [];
  const fileSystem = {
    async stat(file) { calls.push(['stat', file]); return { isFile: () => files.includes(file) }; },
    async readdir(directory) {
      calls.push(['readdir', directory]);
      if (directory !== install) throw Error('outside-installation-directory');
      return versions.map(name => ({ name, isDirectory: () => true }));
    }
  };
  const launcher = createDriveDesktopLauncher({ platform: 'win32', programRoots: [root, root],
    fileSystem, openPath: async file => { opened.push(file); return launch(file); } });
  return { launcher, calls, opened, fileSystem };
};
test('Drive Desktop launcher opens the installed application without claiming login or upload', async () => {
  const file = path.join(install, 'GoogleDriveFS.exe'), f = fixture({ files: [file] });
  const result = await f.launcher.open();
  assert.equal(result.success, true); assert.equal(result.opened, true);
  assert.equal(result.connected, false); assert.equal(result.cloudUploadVerified, false);
  assert.deepEqual(f.opened, [file]);
});
test('Drive Desktop launcher selects the newest installed numeric version', async () => {
  const old = path.join(install, '99.0.0.0', 'GoogleDriveFS.exe'), current = path.join(install, '100.2.0.0', 'GoogleDriveFS.exe');
  const f = fixture({ files: [old, current], versions: ['99.0.0.0', '100.2.0.0', '..', 'not-a-version'] });
  assert.equal((await f.launcher.open()).success, true); assert.deepEqual(f.opened, [current]);
});
test('Missing Drive app cannot be reported as connected', async () => {
  const f = fixture(); const result = await f.launcher.open();
  assert.equal(result.success, false); assert.equal(result.reason, 'not-installed'); assert.deepEqual(f.opened, []);
});
test('Launch failure returns a sanitized reason without exposing an OS message', async () => {
  const f = fixture({ files: [path.join(install, 'GoogleDriveFS.exe')], launch: async () => 'synthetic-private-os-message' });
  const result = await f.launcher.open(); assert.equal(result.reason, 'open-failed');
  assert.equal(JSON.stringify(result).includes('synthetic-private-os-message'), false);
});
test('Concurrent clicks share one launch and never read note or Drive folders', async () => {
  let release; const f = fixture({ files: [path.join(install, 'GoogleDriveFS.exe')], launch: () => new Promise(resolve => { release = resolve; }) });
  const first = f.launcher.open(), second = f.launcher.open(); assert.equal(first, second);
  await new Promise(resolve => setImmediate(resolve)); release('');
  await first; assert.equal(f.opened.length, 1);
  assert.ok(f.calls.every(([, file]) => file.startsWith(install)));
});
test('Unsupported platform performs no filesystem access or launch', async () => {
  let accesses = 0; const launcher = createDriveDesktopLauncher({ platform: 'linux',
    fileSystem: { stat: async () => { accesses++; } }, openPath: async () => { accesses++; } });
  assert.equal((await launcher.open()).reason, 'unsupported-platform'); assert.equal(accesses, 0);
});
test('Drive app IPC rejects an unrelated window or iframe', async () => {
  let handler, launches = 0; const webContents = { mainFrame: {} };
  registerDriveDesktop({ ipcMain: { handle: (_name, callback) => { handler = callback; } },
    shell: { openPath: async () => { launches++; return ''; } },
    getWindow: () => ({ webContents, isDestroyed: () => false }),
    platform: 'win32', programRoots: [root], fileSystem: fixture().fileSystem });
  assert.equal((await handler({ sender: {}, senderFrame: webContents.mainFrame })).reason, 'untrusted-window');
  assert.equal((await handler({ sender: webContents, senderFrame: {} })).reason, 'untrusted-window');
  assert.equal(launches, 0);
});
test('Trusted main window can request an application launch', async () => {
  let handler, launches = 0; const webContents = { mainFrame: {} }, file = path.join(install, 'GoogleDriveFS.exe');
  registerDriveDesktop({ ipcMain: { handle: (_name, callback) => { handler = callback; } },
    shell: { openPath: async () => { launches++; return ''; } },
    getWindow: () => ({ webContents, isDestroyed: () => false }),
    platform: 'win32', programRoots: [root], fileSystem: fixture({ files: [file] }).fileSystem });
  assert.equal((await handler({ sender: webContents, senderFrame: webContents.mainFrame })).opened, true);
  assert.equal(launches, 1);
});
