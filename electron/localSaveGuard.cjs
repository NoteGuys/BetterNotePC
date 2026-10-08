// This module has no Electron startup or backup I/O. It only guards normal
// window close until the trusted renderer acknowledges local persistence.
const installLocalSaveGuard = ({ window, ipcMain, dialog, timeoutMs = 15000,
  schedule = setTimeout, cancel = clearTimeout }) => {
  let ready = false, allowed = false, pending = null, sequence = 0, showingDialog = false, readyLabels;
  const trusted = event => event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame;
  const defaults = {
    title: 'BetterNote',
    message: 'Saving has not finished. Your window will stay open to protect your work.',
    keepOpen: 'Keep open',
    retry: 'Retry saving'
  };
  const labels = supplied => Object.fromEntries(Object.entries(defaults).map(([key, fallback]) =>
    [key, typeof supplied?.[key] === 'string' && supplied[key].length <= 500 ? supplied[key] : fallback]));
  const fail = async supplied => {
    if (!pending || showingDialog) return;
    cancel(pending.timer);
    pending = null;
    showingDialog = true;
    if (window.isDestroyed()) return;
    window.webContents.send('local-save-close-cancelled');
    const text = labels(supplied || readyLabels);
    try {
      const result = await dialog.showMessageBox(window, {
        type: 'warning', title: text.title, message: text.message,
        buttons: [text.keepOpen, text.retry], defaultId: 0, cancelId: 0, noLink: true
      });
      showingDialog = false;
      if (!window.isDestroyed()) {
        if (result.response === 1) window.close();
        else window.focus();
      }
    } catch (_) { showingDialog = false; }
  };
  const onClose = event => {
    if (allowed || !ready) return;
    event.preventDefault();
    if (pending || showingDialog) return;
    const requestId = ++sequence;
    pending = { requestId, timer: schedule(() => { void fail(); }, timeoutMs) };
    window.webContents.send('local-save-before-close', { requestId });
  };
  const onReady = (event, state) => { if (trusted(event)) { ready = true; readyLabels = state?.labels; } };
  const onResult = (event, result) => {
    if (!trusted(event) || !pending || result?.requestId !== pending.requestId) return;
    if (result.success === true) {
      cancel(pending.timer);
      pending = null;
      allowed = true;
      window.close();
    } else void fail(result.labels);
  };
  const dispose = () => {
    if (pending) cancel(pending.timer);
    pending = null;
    ipcMain.removeListener('local-save-ready', onReady);
    ipcMain.removeListener('local-save-close-result', onResult);
    window.removeListener('close', onClose);
  };
  window.on('close', onClose);
  window.once('closed', dispose);
  ipcMain.on('local-save-ready', onReady);
  ipcMain.on('local-save-close-result', onResult);
  return dispose;
};
module.exports = { installLocalSaveGuard };
