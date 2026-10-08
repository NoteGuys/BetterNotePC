const path = require('node:path');
const fs = require('node:fs/promises');
const { fileURLToPath, pathToFileURL } = require('node:url');
const ASSET_SCHEME = 'betternote-assets';
const pathKey = value => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
const isAppUrl = (value, appFile, devUrl) => {
  try {
    const url = new URL(value);
    if (devUrl && url.origin === new URL(devUrl).origin) return true;
    return url.protocol === 'file:' && pathKey(fileURLToPath(url)) === pathKey(appFile);
  } catch (_) { return false; }
};
const trustedSender = (event, window, appFile, devUrl) => Boolean(window && !window.isDestroyed() &&
  event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame &&
  isAppUrl(event.senderFrame.url, appFile, devUrl));
const validPath = value => value == null || (typeof value === 'string' && value.length <= 32767 &&
  !value.includes('\0') && path.isAbsolute(value) && !/^\\\\[.?]\\/.test(value));
const validRequest = (channel, args) => {
  const value = args[0];
  if(channel==='save-bnote-file')return value && typeof value==='object' && (
    value.action==='begin' ? typeof value.name==='string' && value.name.length<=512 && Number.isInteger(value.size) && value.size>0 && value.size<=272*1048576 :
    ['chunk','finish','abort'].includes(value.action) && typeof value.id==='string' && value.id.length<=64 &&
    (value.action!=='chunk' || Number.isInteger(value.offset) && value.offset>=0 && value.bytes instanceof ArrayBuffer && value.bytes.byteLength>0 && value.bytes.byteLength<=2*1048576));
  if (['scan-backup-folder','restore-backup-from-folder','get-backup-status-details','open-backup-folder','reveal-backup-file'].includes(channel)) return validPath(value);
  if (channel === 'save-auto-backup') return value && typeof value === 'object' &&
    ['begin','reuse','notebook','finish','pdf','abort','inspect','prune'].includes(value.action) && validPath(value.customBackupPath) && validPath(value.localBackupPath) && validPath(value.driveBackupPath);
  if (channel.startsWith('prune-backup-')) return value && validPath(value.customBackupPath) &&
    (channel === 'prune-backup-notebook' ? typeof value.notebookId === 'string' :
      Array.isArray(value.notebookIds) && value.notebookIds.every(id => typeof id === 'string'));
  return true;
};
function createGuardedIpc(ipcMain, getWindow, appFile, devUrl) {
  return { handle(channel, handler) {
    ipcMain.handle(channel, (event, ...args) => {
      if (!trustedSender(event, getWindow(), appFile, devUrl)) return { success:false, reason:'untrusted-window' };
      if (!validRequest(channel,args)) return { success:false, reason:'invalid-request' };
      return handler(event,...args);
    });
  } };
}
function protectWindow(window, appFile, devUrl) {
  const prevent = (event, url) => { if (!isAppUrl(url, appFile, devUrl)) event.preventDefault(); };
  window.webContents.on('will-navigate', prevent);
  window.webContents.on('will-redirect', prevent);
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  const permitted = (contents, permission, details) => contents === window.webContents &&
    ['clipboard-read','clipboard-sanitized-write'].includes(permission) && details?.isMainFrame !== false &&
    isAppUrl(details?.requestingUrl || contents.getURL(),appFile,devUrl);
  window.webContents.session.setPermissionRequestHandler((contents, permission, callback, details) => callback(permitted(contents,permission,details)));
  window.webContents.session.setPermissionCheckHandler((contents, permission, origin, details) => permitted(contents,permission,details));
}
// Keep the main page's existing file URL: changing it would hide existing IndexedDB notes.
function registerAssetProtocol(protocol, net, distRoot) {
  protocol.handle(ASSET_SCHEME, async request => {
    try {
      const url = new URL(request.url);
      if (request.method !== 'GET' || url.host !== 'app' || url.search || url.hash) throw Error();
      const relative = decodeURIComponent(url.pathname).replace(/^\//,'');
      if (!/^assets\/[\w.-]+\.(?:mjs|js|pfb|ttf|bcmap)$/.test(relative)) throw Error();
      const root = await fs.realpath(distRoot), file = await fs.realpath(path.join(root,relative));
      const inside = path.relative(root,file);
      if (inside.startsWith('..') || path.isAbsolute(inside)) throw Error();
      const response = await net.fetch(pathToFileURL(file).href);
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin','*');
      headers.set('Content-Type',/\.(?:mjs|js)$/.test(file)?'text/javascript':'application/octet-stream');
      return new Response(response.body,{status:response.status,headers});
    } catch (_) { return new Response('Asset unavailable',{status:404}); }
  });
}
module.exports = { ASSET_SCHEME, isAppUrl, trustedSender, validPath, validRequest, createGuardedIpc, protectWindow, registerAssetProtocol };
