// Manual exports only. All paths are generated here, never supplied by the renderer.
const fs = require('node:fs/promises');
const path = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { Worker } = require('node:worker_threads');
const PROTOCOL = 2;
const MAX_HTML_BYTES = 64 * 1024 * 1024;
const validHtml = html => typeof html === 'string' && html.startsWith('<!doctype html>') && Buffer.byteLength(html) <= MAX_HTML_BYTES;
const coded = code => Object.assign(new Error(code), { code });
const registerPdfExport = (ipcMain, BrowserWindow, getMainWindow, {
  getTempRoot = () => require('electron').app.getPath('temp'), timeoutMs = 180000,
  getLogRoot = getTempRoot, idleMs = 300000
} = {}) => {
  const sessions = new Map();
  // Strict metadata allowlist: no HTML, notebook names, paths or raw error messages.
  const diagnostic = async (stage, status, count, bytes, started, reason = '') => {
    const record = { protocol: PROTOCOL, time: new Date().toISOString(), stage, status,
      pages: count || 0, bytes: bytes || 0, elapsedMs: Date.now() - started, reason,
      memoryMiB: Math.round(process.memoryUsage().rss / 1048576) };
    const file = path.join(path.resolve(getLogRoot()), 'betternote-pdf-diagnostics.jsonl');
    try {
      if ((await fs.stat(file).catch(() => ({ size: 0 }))).size > 512 * 1024) await fs.unlink(file);
      await fs.appendFile(file, JSON.stringify(record) + '\n', { mode: 0o600 });
    } catch (_) {} // Diagnostics must not cause an export failure.
  };
  const removeOwned = async dir => {
    if (dir && path.dirname(path.resolve(dir)) === path.resolve(getTempRoot()) && path.basename(dir).startsWith('betternote-pdf-')) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  };
  const printHtml = async (html, dir, count) => {
    let win, timer, stage = 'temporary-file'; const started = Date.now();
    const controller = new AbortController(); let stopped = false;
    try {
      const work = async () => {
        const file = path.join(dir, 'document.html');
        await fs.writeFile(file, html, { encoding: 'utf8', mode: 0o600, signal: controller.signal });
        if (stopped) throw coded('pdf-export-timeout');
        stage = 'load-document';
        // Chromium webRequest may serialize Thai paths differently from Node URLs.
        // Match only this generated file after URL decoding; keep all other files blocked.
        const documentPath = await fs.realpath(file);
        const pathKey = value => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
        const ownPaths = new Set([pathKey(file), pathKey(documentPath)]);
        const isOwnDocument = value => {
          try {
            const url = new URL(value);
            return url.protocol === 'file:' && !url.search && !url.hash && ownPaths.has(pathKey(fileURLToPath(url)));
          } catch (_) { return false; }
        };
        win = new BrowserWindow({ show: false, width: 1200, height: 900, webPreferences: {
          nodeIntegration: false, contextIsolation: true, sandbox: true, javascript: false,
          backgroundThrottling: false, partition: 'betternote-pdf-' + randomUUID()
        } });
        win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
          callback({ cancel: !details.url.startsWith('data:') && !isOwnDocument(details.url) && details.url !== 'about:blank' });
        });
        await win.loadURL(pathToFileURL(documentPath).href); if (stopped) throw coded('pdf-export-timeout');
        stage = 'print';
        return win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true,
          displayHeaderFooter: false, margins: { top: 0, bottom: 0, left: 0, right: 0 }, scale: 1,
          generateTaggedPDF: true });
      };
      const bytes = await Promise.race([work(), new Promise((_, reject) => {
        timer = setTimeout(() => { stopped = true; controller.abort(); reject(coded('pdf-export-timeout')); }, timeoutMs);
      })]);
      await diagnostic(stage, 'ok', count, bytes.length, started); return bytes;
    } catch (error) {
      const code = error.code === 'pdf-export-timeout' ? error.code :
        ['ENOSPC','EACCES','EPERM','ENOENT'].includes(error.code) ? 'pdf-temp-unavailable' :
        stage === 'load-document' ? 'pdf-load-failed' : 'pdf-print-failed';
      await diagnostic(stage, 'failed', count, Buffer.byteLength(html), started, code);
      throw coded(code);
    } finally {
      stopped = true; controller.abort(); clearTimeout(timer);
      if (win && !win.isDestroyed()) win.destroy();
      await fs.unlink(path.join(dir, 'document.html')).catch(() => {});
    }
  };
  const dispose = async s => {
    sessions.delete(s.id); clearTimeout(s.timer); s.sender.removeListener?.('destroyed', s.onDestroyed);
    s.rejectPending?.(coded('pdf-session-expired'));
    if (s.worker) await s.worker.terminate();
    await removeOwned(s.dir);
  };
  const touch = s => {
    clearTimeout(s.timer);
    s.timer = setTimeout(() => { if (!s.busy) void dispose(s); else touch(s); }, idleMs);
    s.timer.unref?.();
  };
  const merge = (s, action, file, expectedPages) => new Promise((resolve, reject) => {
    const id = randomUUID(); let timer;
    const finish = (error, value) => {
      clearTimeout(timer); s.worker.off('message', receive); s.worker.off('error', failed);
      s.worker.off('exit', exited); s.rejectPending = null;
      error ? reject(error) : resolve(value);
    };
    const receive = message => { if (message.id === id) finish(message.error ? coded(message.error) : null, message); };
    const failed = () => finish(coded('pdf-merge-failed'));
    const exited = () => finish(coded('pdf-merge-failed'));
    s.rejectPending = error => finish(error);
    s.worker.on('message', receive); s.worker.once('error', failed); s.worker.once('exit', exited);
    timer = setTimeout(() => finish(coded('pdf-export-timeout')), timeoutMs);
    s.worker.postMessage({ id, action, file, expectedPages });
  });
  ipcMain.handle('export-pdf-document', async (event, request) => {
    if (event.sender !== getMainWindow()?.webContents) throw new Error('ไม่สามารถเริ่มส่งออก PDF ได้');
    // Keep single-page/older frontend compatibility; whole notebooks use sessions.
    if (typeof request === 'string') {
      if (!validHtml(request)) throw new Error('ไม่สามารถเริ่มส่งออก PDF ได้');
      const dir = await fs.mkdtemp(path.join(path.resolve(getTempRoot()), 'betternote-pdf-'));
      try { return await printHtml(request, dir, 1); }
      catch (error) {
        if (error.code === 'pdf-export-timeout') throw Object.assign(new Error('ส่งออก PDF ใช้เวลานานเกินไป กรุณาลองส่งออกทีละหน้า'), { code: error.code });
        throw new Error('สร้าง PDF ไม่สำเร็จ กรุณาลองส่งออกทีละหน้า');
      } finally { await removeOwned(dir); }
    }
    if (request?.action === 'capabilities') return { protocol: PROTOCOL, batchPages: 4, batchBytes: 8 * 1024 * 1024 };
    if (request?.action === 'begin') {
      if (!Number.isInteger(request.pages) || request.pages < 1 || request.pages > 10000) return { error: 'pdf-invalid-request' };
      if ([...sessions.values()].some(s => s.sender === event.sender)) return { error: 'pdf-export-busy' };
      let dir;
      try {
        dir = await fs.mkdtemp(path.join(path.resolve(getTempRoot()), 'betternote-pdf-'));
        const s = { id: randomUUID(), dir, sender: event.sender, pages: request.pages, done: 0, busy: false,
          worker: new Worker(path.join(__dirname, 'pdfMerge.worker.cjs')) };
        // The worker starts lazily parsing; capture a startup failure before first append.
        s.worker.on('error', () => { s.workerFailed = true; });
        s.worker.on('exit', () => { s.workerFailed = true; });
        s.onDestroyed = () => { void dispose(s); };
        s.sender.once?.('destroyed', s.onDestroyed); sessions.set(s.id, s); touch(s);
        return { id: s.id, protocol: PROTOCOL };
      } catch (_) { await removeOwned(dir); return { error: 'pdf-temp-unavailable' }; }
    }
    const s = sessions.get(request?.id);
    if (!s || s.sender !== event.sender) return { error: 'pdf-session-expired' };
    if (s.busy) return { error: 'pdf-export-busy' };
    s.busy = true; touch(s);
    try {
      if (request.action === 'cancel') { await dispose(s); return { cancelled: true }; }
      if (s.workerFailed) throw coded('pdf-merge-failed');
      if (request.action === 'append') {
        if (!validHtml(request.html) || !Number.isInteger(request.pages) || request.pages < 1 || request.pages > 4 ||
            request.start !== s.done || s.done + request.pages > s.pages) return { error: 'pdf-invalid-request' };
        const bytes = await printHtml(request.html, s.dir, request.pages);
        const file = path.join(s.dir, 'part.pdf');
        await fs.writeFile(file, bytes, { mode: 0o600 });
        s.mergeStarted = true;
        const result = await merge(s, 'append', file, request.pages);
        s.mergeStarted = false;
        s.done += request.pages; await fs.unlink(file); return { pages: result.pages };
      }
      if (request.action === 'finish') {
        if (s.done !== s.pages) throw coded('pdf-page-count');
        const started = Date.now(), file = path.join(s.dir, 'result.pdf');
        await merge(s, 'finish', file, s.pages); const bytes = await fs.readFile(file);
        await diagnostic('merge', 'ok', s.pages, bytes.length, started); await dispose(s);
        return { bytes, pages: s.done };
      }
      throw coded('pdf-invalid-request');
    } catch (error) {
      const safe = ['pdf-print-failed','pdf-load-failed','pdf-export-timeout','pdf-temp-unavailable','pdf-page-count','pdf-merge-failed'];
      const code = safe.includes(error.code) ? error.code : 'pdf-temp-unavailable';
      // A print/load failure can retry a smaller batch. Never reuse a partially merged session.
      const retry = !s.mergeStarted && ['pdf-print-failed','pdf-load-failed','pdf-export-timeout'].includes(code) && request.action === 'append';
      if (!retry) await dispose(s);
      return { error: code, start: s.done, pages: request.pages || 0, retry };
    } finally { s.busy = false; if (sessions.has(s.id)) touch(s); }
  });
};
module.exports = { registerPdfExport };
