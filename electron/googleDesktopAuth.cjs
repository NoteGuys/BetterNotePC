const http = require('node:http');
const crypto = require('node:crypto');
const AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USER_INFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const validClientId = value => typeof value === 'string' && /^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(value);
const failure = reason => ({ success: false, authorized: false, reason, cloudUploadVerified: false });
function createGoogleDesktopAuth({ openExternal, fetchImpl = globalThis.fetch,
  createServer = http.createServer, randomBytes = crypto.randomBytes, timeoutMs = 120000,
  requestTimeoutMs = 15000, clock = Date.now, exchangeToken = null, onComplete = null } = {}) {
  let active = null;
  const connect = clientId => {
    if (!validClientId(clientId)) return Promise.resolve(failure('client-not-configured'));
    if (active) return active.clientId === clientId ? active.promise : Promise.resolve(failure('authentication-busy'));
    const verifier = randomBytes(48).toString('base64url'), state = randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    let resolve, finished = false, exchanging = false, timer, server, redirectUri;
    const promise = new Promise(done => { resolve = done; });
    const session = { clientId, promise, cancel: null };
    active = session;
    const controller = new AbortController();
    const finish = result => {
      if (finished) return;
      finished = true; clearTimeout(timer); controller.abort();
      try {
        server?.close(); server?.closeIdleConnections?.();
        // Let the callback response reach the browser before terminating remaining sockets.
        const closingServer = server;
        const forceClose = setTimeout(() => { try { closingServer?.closeAllConnections?.(); } catch (_) {} }, 250);
        forceClose.unref?.();
      } catch (_) {}
      if (active === session) active = null;
      resolve(result);
      try { onComplete?.({ authorized: result.authorized === true }); } catch (_) {}
    };
    session.cancel = () => finish(failure('cancelled'));
    const respond = (response, status, message) => {
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", 'X-Content-Type-Options': 'nosniff',
        Connection: 'close' });
      response.end(message);
    };
    const requestJson = async (url, options) => {
      const result = await fetchImpl(url, { ...options, redirect: 'error',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(requestTimeoutMs)]) });
      if (!result.ok) throw new Error(url === TOKEN_URL ? 'token-exchange-failed' : 'account-verification-failed');
      return result.json();
    };
    const handleCallback = async (request, response) => {
      if (finished) { respond(response, 410, 'This sign-in request has ended. Return to BetterNote.'); return; }
      const expectedHost = new URL(redirectUri).host;
      if (request.method !== 'GET' || request.headers.host !== expectedHost || !request.url || request.url.length > 8192) {
        respond(response, 400, 'Invalid sign-in callback.'); return;
      }
      let url;
      try { url = new URL(request.url, redirectUri); } catch (_) { respond(response, 400, 'Invalid sign-in callback.'); return; }
      if (url.origin !== new URL(redirectUri).origin || url.pathname !== '/oauth2/callback') { respond(response, 404, 'Not found.'); return; }
      const received = url.searchParams.get('state') || '';
      const supplied = Buffer.from(received), expected = Buffer.from(state);
      if (url.searchParams.getAll('state').length !== 1 || supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
        respond(response, 400, 'This callback does not match your sign-in request.'); return;
      }
      if (url.searchParams.has('error')) {
        respond(response, 200, 'Sign-in was not completed. Return to BetterNote.');
        finish(failure(url.searchParams.get('error') === 'access_denied' ? 'access-denied' : 'authorization-failed')); return;
      }
      const code = url.searchParams.get('code');
      if (exchanging || url.searchParams.getAll('code').length !== 1 || !code || code.length > 2048) {
        respond(response, 400, 'Invalid sign-in callback.'); return;
      }
      exchanging = true;
      try {
        const token = exchangeToken
          ? await exchangeToken({ clientId, code, verifier, redirectUri,
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(requestTimeoutMs)]) })
          : await requestJson(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: clientId, code, code_verifier: verifier, redirect_uri: redirectUri, grant_type: 'authorization_code' }).toString() });
        if (finished) return;
        if (typeof token.access_token !== 'string' || !token.access_token || !/^Bearer$/i.test(token.token_type || '') ||
          !Number.isFinite(Number(token.expires_in)) || Number(token.expires_in) <= 0) throw new Error('invalid-token-response');
        if (token.scope && !String(token.scope).split(/\s+/).includes(DRIVE_SCOPE)) throw new Error('drive-permission-missing');
        const info = await requestJson(USER_INFO_URL, { headers: { Authorization: 'Bearer ' + token.access_token } });
        if (finished) return;
        if (!info || typeof info.sub !== 'string' || !info.sub) throw new Error('account-verification-failed');
        respond(response, 200, 'BetterNote Google connection confirmed. You can close this tab and return to BetterNote.');
        finish({ success: true, authorized: true, accessToken: token.access_token, email: typeof info.email === 'string' ? info.email : '',
          expiresAt: clock() + Number(token.expires_in) * 1000, cloudUploadVerified: false });
      } catch (error) {
        if (!finished) {
          respond(response, 200, 'Google connection was not completed. Return to BetterNote for details.');
          finish(failure(['token-exchange-failed','account-verification-failed','invalid-token-response','drive-permission-missing','client-registration-unavailable','cancelled'].includes(error.message)
            ? error.message : controller.signal.aborted ? 'cancelled' : 'network-error'));
        }
      }
    };
    try {
      server = createServer((request, response) => { handleCallback(request, response).catch(() => finish(failure('callback-failed'))); });
      server.maxConnections = 8; server.maxHeadersCount = 24; server.headersTimeout = 15000; server.requestTimeout = 15000;
      server.on('error', () => finish(failure('callback-unavailable')));
      timer = setTimeout(() => finish(failure('authentication-timeout')), timeoutMs);
      timer.unref?.();
      server.listen(0, '127.0.0.1', () => {
        if (finished) { try { server.close(); } catch (_) {} return; }
        redirectUri = 'http://127.0.0.1:' + server.address().port + '/oauth2/callback';
        const url = new URL(AUTHORIZATION_URL);
        url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
          scope: 'openid email ' + DRIVE_SCOPE, state, code_challenge: challenge, code_challenge_method: 'S256',
          prompt: 'select_account consent' }).toString();
        Promise.resolve().then(() => openExternal(url.toString())).catch(() => finish(failure('browser-open-failed')));
      });
    } catch (_) { finish(failure('callback-unavailable')); }
    return promise;
  };
  return { connect, cancel: () => { active?.cancel(); return { success: true }; } };
}
function registerGoogleDesktopAuth({ ipcMain, shell, getWindow, ...options }) {
  const auth = createGoogleDesktopAuth({ ...options, openExternal: url => shell.openExternal(url) });
  const trusted = event => {
    const window = getWindow();
    return window && !window.isDestroyed() && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame;
  };
  ipcMain.handle('connect-google-account', (event, request) => trusted(event) ? auth.connect(request?.clientId) : failure('untrusted-window'));
  ipcMain.handle('cancel-google-account-connection', event => trusted(event) ? auth.cancel() : failure('untrusted-window'));
  getWindow()?.once('closed', () => auth.cancel());
}
module.exports = { createGoogleDesktopAuth, registerGoogleDesktopAuth, validClientId };
