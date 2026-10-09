const fs = require('node:fs').promises;
const path = require('node:path');
const INSTALL_DIRECTORY = ['Google', 'Drive File Stream'];
const versionCompare = (a, b) => {
  const first = a.split('.').map(Number), second = b.split('.').map(Number);
  for (let index = 0; index < Math.max(first.length, second.length); index++) {
    const difference = (second[index] || 0) - (first[index] || 0);
    if (difference) return difference;
  }
  return 0;
};
function createDriveDesktopLauncher({ platform = process.platform, programRoots = [
  process.env.ProgramW6432, process.env.ProgramFiles, process.env['ProgramFiles(x86)']
], fileSystem = fs, openPath, timeoutMs = 8000 } = {}) {
  let pending = null;
  const isFile = async file => {
    try { return (await fileSystem.stat(file)).isFile(); } catch (_) { return false; }
  };
  const findExecutable = async () => {
    for (const root of [...new Set(programRoots.filter(value => typeof value === 'string' && path.isAbsolute(value)))]) {
      const directory = path.join(root, ...INSTALL_DIRECTORY);
      const direct = path.join(directory, 'GoogleDriveFS.exe');
      if (await isFile(direct)) return direct;
      let versions;
      try { versions = await fileSystem.readdir(directory, { withFileTypes: true }); } catch (_) { continue; }
      const names = versions.filter(entry => entry.isDirectory() && /^\d+(?:\.\d+){1,3}$/.test(entry.name))
        .map(entry => entry.name).sort(versionCompare).slice(0, 32);
      for (const version of names) {
        const candidate = path.join(directory, version, 'GoogleDriveFS.exe');
        if (await isFile(candidate)) return candidate;
      }
    }
    return null;
  };
  const open = () => {
    if (pending) return pending;
    if (platform !== 'win32' || typeof openPath !== 'function') {
      return Promise.resolve({ success: false, reason: 'unsupported-platform', cloudUploadVerified: false });
    }
    const work = (async () => {
      try {
        const executable = await findExecutable();
        if (!executable) return { success: false, reason: 'not-installed', cloudUploadVerified: false };
        const error = await openPath(executable);
        if (error) return { success: false, reason: 'open-failed', cloudUploadVerified: false };
        // Opening the app is never evidence of account authorization or uploaded files.
        return { success: true, opened: true, connected: false, cloudUploadVerified: false };
      } catch (_) { return { success: false, reason: 'open-failed', cloudUploadVerified: false }; }
    })();
    let timer;
    pending = Promise.race([work, new Promise(resolve => {
      timer = setTimeout(() => resolve({ success: false, reason: 'open-timeout', cloudUploadVerified: false }), timeoutMs);
      timer.unref?.();
    })]).finally(() => clearTimeout(timer));
    work.finally(() => { pending = null; }).catch(() => {});
    return pending;
  };
  return { open };
}
function registerDriveDesktop({ ipcMain, shell, getWindow, ...options }) {
  const launcher = createDriveDesktopLauncher({ ...options, openPath: file => shell.openPath(file) });
  ipcMain.handle('open-drive-desktop', event => {
    const window = getWindow();
    if (!window || window.isDestroyed() || event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame) {
      return { success: false, reason: 'untrusted-window', cloudUploadVerified: false };
    }
    return launcher.open();
  });
}
module.exports = { createDriveDesktopLauncher, registerDriveDesktop };
