const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { createGoogleDesktopAuth, registerGoogleDesktopAuth, validClientId } = require('../electron/googleDesktopAuth.cjs');
const clientId = '1234567890-synthetic.apps.googleusercontent.com', driveScope = 'https://www.googleapis.com/auth/drive.file';
const fixture = ({ token, account, failedEndpoint, failBrowser = false, exchangeToken = null, onComplete = null } = {}) => {
  const calls = [], urls = []; let callback, server;
  const auth = createGoogleDesktopAuth({
    exchangeToken, onComplete,
    openExternal: async url => { urls.push(new URL(url)); if (failBrowser) throw Error('synthetic-private-error'); },
    createServer: handler => {
      callback = handler; server = new EventEmitter();
      Object.assign(server, { listen: (_port, host, ready) => { assert.equal(host, '127.0.0.1'); queueMicrotask(ready); },
        address: () => ({ port: 43123 }), close: () => { server.closed = true; }, closeIdleConnections: () => {} });
      return server;
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: url !== failedEndpoint, json: async () => url.includes('/token')
        ? token || { access_token: 'synthetic-token', token_type: 'Bearer', expires_in: 3600, scope: 'openid email ' + driveScope }
        : account || { sub: 'synthetic-account', email: 'synthetic@example.invalid' } };
    }
  });
  const send = (params = {}, overrides = {}) => {
    let status, text; const response = { writeHead: code => { status = code; }, end: value => { text = value; } };
    callback({ method: 'GET', headers: { host: '127.0.0.1:43123' }, url: '/oauth2/callback?' +
      new URLSearchParams({ state: urls[0].searchParams.get('state'), code: 'synthetic-code', ...params }).toString(), ...overrides }, response);
    return { get status() { return status; }, get text() { return text; } };
  };
  return { auth, calls, urls, send, get server() { return server; } };
};
const started = async f => { const promise = f.auth.connect(clientId); await new Promise(resolve => setImmediate(resolve)); return { promise }; };
test('Missing Client ID cannot open a browser, access Drive or claim authorization', async () => {
  const f = fixture(); assert.equal((await f.auth.connect('')).reason, 'client-not-configured');
  assert.equal(f.urls.length, 0); assert.equal(f.calls.length, 0);
  assert.equal(validClientId('javascript:synthetic'), false);
});
test('Native login opens only the system Google authorization page with PKCE and account selection', async () => {
  const f = fixture(), { promise } = await started(f), url = f.urls[0];
  assert.equal(url.origin, 'https://accounts.google.com'); assert.equal(url.pathname, '/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.match(url.searchParams.get('code_challenge'), /^[a-zA-Z0-9_-]{43}$/);
  assert.match(url.searchParams.get('prompt'), /select_account/); assert.match(url.searchParams.get('scope'), /drive\.file/);
  f.auth.cancel(); assert.equal((await promise).reason, 'cancelled');
});
test('Only Google token exchange and account verification confirm authorization; no note or Drive endpoint is called', async () => {
  const f = fixture(), { promise } = await started(f), response = f.send(); const result = await promise;
  assert.equal(response.status, 200); assert.equal(result.authorized, true); assert.equal(result.email, 'synthetic@example.invalid');
  assert.equal(result.cloudUploadVerified, false); assert.equal(f.calls.length, 2);
  assert.ok(f.calls.every(call => !call.url.includes('/drive/')));
  const body = new URLSearchParams(f.calls[0].options.body), verifier = body.get('code_verifier');
  assert.ok(verifier.length >= 43 && verifier.length <= 128);
  assert.equal(crypto.createHash('sha256').update(verifier).digest('base64url'), f.urls[0].searchParams.get('code_challenge'));
  assert.match(response.text, /connection confirmed/);
  assert.equal(response.text.includes('synthetic-code'), false); assert.equal(response.text.includes('synthetic-token'), false);
  assert.equal(f.server.closed, true);
});
test('Wrong callback state and spoofed host cannot exchange a code or finish the legitimate request', async () => {
  const f = fixture(), { promise } = await started(f);
  assert.equal(f.send({ state: 'wrong-state' }).status, 400);
  assert.equal(f.send({}, { headers: { host: 'untrusted.invalid' } }).status, 400);
  assert.equal(f.send({}, { method: 'POST' }).status, 400);
  assert.equal(f.calls.length, 0);
  f.send(); assert.equal((await promise).authorized, true);
});
test('Declining permissions closes the listener and never creates a connected flag', async () => {
  const f = fixture(), { promise } = await started(f); f.send({ error: 'access_denied' });
  assert.equal((await promise).reason, 'access-denied'); assert.equal(f.calls.length, 0); assert.equal(f.server.closed, true);
});
test('Opening a browser alone never confirms login', async () => {
  const f = fixture(), { promise } = await started(f); let settled = false; promise.then(() => { settled = true; });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(settled, false); assert.equal(f.calls.length, 0);
  f.auth.cancel(); await promise;
});
test('Browser-open failure and cancellation return safe reasons without provider messages', async () => {
  const f = fixture({ failBrowser: true }); const result = await f.auth.connect(clientId);
  assert.equal(result.reason, 'browser-open-failed'); assert.equal(JSON.stringify(result).includes('synthetic-private-error'), false);
});
test('Failed token exchange, invalid token or missing Drive consent cannot authorize the account', async () => {
  for (const configuration of [
    { failedEndpoint: 'https://oauth2.googleapis.com/token' },
    { token: { access_token: '', token_type: 'Bearer', expires_in: 3600 } },
    { token: { access_token: 'synthetic', token_type: 'Bearer', expires_in: 3600, scope: 'openid email' } }
  ]) {
    const f = fixture(configuration), { promise } = await started(f); f.send();
    assert.equal((await promise).authorized, false);
  }
});
test('Account verification failure cannot produce a successful connection', async () => {
  const f = fixture({ account: { email: 'synthetic@example.invalid' } }), { promise } = await started(f); f.send();
  assert.equal((await promise).reason, 'account-verification-failed');
});
test('Concurrent requests for one app share one browser; a different client cannot replace it', async () => {
  const f = fixture(), first = f.auth.connect(clientId); assert.equal(f.auth.connect(clientId), first);
  assert.equal((await f.auth.connect('999999-other.apps.googleusercontent.com')).reason, 'authentication-busy');
  await new Promise(resolve => setImmediate(resolve)); assert.equal(f.urls.length, 1);
  f.auth.cancel(); await first;
});


test('Actual loopback callback binds locally, verifies PKCE and closes without calling Google or reading Drive', async () => {
  const realFetch = globalThis.fetch;
  let browserResponse;
  const auth = createGoogleDesktopAuth({
    openExternal: async address => {
      const request = new URL(address), callback = new URL(request.searchParams.get('redirect_uri'));
      assert.equal(callback.hostname, '127.0.0.1');
      callback.search = new URLSearchParams({ state: request.searchParams.get('state'), code: 'synthetic-loopback-code' });
      browserResponse = realFetch(callback, { redirect: 'error' });
      await browserResponse;
    },
    fetchImpl: async address => ({ ok: true, json: async () => address.includes('/token')
      ? { access_token: 'synthetic-loopback-token', token_type: 'Bearer', expires_in: 3600, scope: driveScope }
      : { sub: 'synthetic-local-account', email: 'loopback@example.invalid' } })
  });
  const result = await auth.connect(clientId);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(result.authorized, true); assert.equal(result.cloudUploadVerified, false);
  assert.equal((await browserResponse).status, 200);
});
test('Native Google IPC refuses a different window and any iframe', async () => {
  const handlers = new Map(), window = new EventEmitter(), webContents = { mainFrame: {} };
  Object.assign(window, { webContents, isDestroyed: () => false });
  registerGoogleDesktopAuth({ ipcMain: { handle: (name, callback) => handlers.set(name, callback) },
    shell: { openExternal: async () => { throw Error('must-not-open'); } }, getWindow: () => window });
  assert.equal((await handlers.get('connect-google-account')({ sender: {}, senderFrame: webContents.mainFrame }, { clientId })).reason, 'untrusted-window');
  assert.equal((await handlers.get('connect-google-account')({ sender: webContents, senderFrame: {} }, { clientId })).reason, 'untrusted-window');
});
test('Closing the BetterNote window cancels its unfinished sign-in listener', async () => {
  const handlers = new Map(), window = new EventEmitter(), webContents = { mainFrame: {} };
  Object.assign(window, { webContents, isDestroyed: () => false });
  let server;
  registerGoogleDesktopAuth({ ipcMain: { handle: (name, callback) => handlers.set(name, callback) },
    shell: { openExternal: async () => {} }, getWindow: () => window,
    createServer: () => {
      server = new EventEmitter(); Object.assign(server, { listen: (_port, _host, ready) => queueMicrotask(ready),
        address: () => ({ port: 43123 }), close: () => { server.closed = true; } }); return server;
    } });
  const promise = handlers.get('connect-google-account')({ sender: webContents, senderFrame: webContents.mainFrame }, { clientId });
  await new Promise(resolve => setImmediate(resolve)); window.emit('closed');
  assert.equal((await promise).reason, 'cancelled'); assert.equal(server.closed, true);
});
test('An unfinished sign-in times out instead of leaving the Connect button permanently busy', async () => {
  const keepAlive = setTimeout(() => {}, 100);
  let server;
  const auth = createGoogleDesktopAuth({ openExternal: async () => {}, timeoutMs: 5,
    createServer: () => {
      server = new EventEmitter(); Object.assign(server, { listen: (_port, _host, ready) => queueMicrotask(ready),
        address: () => ({ port: 43123 }), close: () => { server.closed = true; } }); return server;
    } });
  try { assert.equal((await auth.connect(clientId)).reason, 'authentication-timeout'); assert.equal(server.closed, true); }
  finally { clearTimeout(keepAlive); }
});

test('Native account exchange verifies identity and completion callback contains no credentials', async () => {
  const completion = [], f = fixture({
    exchangeToken: async request => {
      assert.equal(request.clientId, clientId); assert.equal(request.code, 'synthetic-code');
      assert.ok(request.signal instanceof AbortSignal);
      return { access_token: 'synthetic-provider-token', token_type: 'Bearer', expires_in: 3600, scope: driveScope };
    }, onComplete: result => completion.push(result)
  });
  const { promise } = await started(f); f.send(); const result = await promise;
  assert.equal(result.authorized, true); assert.equal(f.calls.length, 1);
  assert.deepEqual(completion, [{ authorized: true }]);
  assert.equal(f.urls[0].toString().includes('client_secret'), false);
});
test('Missing owner registration produces a safe setup reason without false authorization', async () => {
  const f = fixture({ exchangeToken: async () => { throw Error('client-registration-unavailable'); } });
  const { promise } = await started(f); const response = f.send();
  assert.equal((await promise).reason, 'client-registration-unavailable'); assert.equal(f.calls.length, 0);
  assert.match(response.text, /not completed/); assert.equal(response.text.includes('client-registration-unavailable'), false);
});
test('Cancelling while the account service responds cannot revive the connection', async () => {
  let finishExchange;
  const f = fixture({ exchangeToken: () => new Promise(resolve => { finishExchange = resolve; }) });
  const { promise } = await started(f); f.send(); f.auth.cancel();
  finishExchange({ access_token: 'synthetic-late-token', token_type: 'Bearer', expires_in: 3600 });
  assert.equal((await promise).reason, 'cancelled');
  await new Promise(resolve => setImmediate(resolve)); assert.equal(f.calls.length, 0);
});
