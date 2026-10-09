const http = require('node:http');
const { readRegistration } = require('../electron/googleTokenExchange.cjs');
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const keys = new Set(['client_id', 'code', 'code_verifier', 'redirect_uri', 'grant_type']);
function validPayload(body, clientId) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !keys.has(key))) return false;
  if (body.client_id !== clientId || body.grant_type !== 'authorization_code' ||
    typeof body.code !== 'string' || !body.code || body.code.length > 2048 || /[\s\x00-\x1f]/.test(body.code) ||
    typeof body.code_verifier !== 'string' || !/^[a-zA-Z0-9._~-]{43,128}$/.test(body.code_verifier)) return false;
  try {
    const callback = new URL(body.redirect_uri);
    return callback.protocol === 'http:' && callback.hostname === '127.0.0.1' &&
      Number(callback.port) >= 1024 && Number(callback.port) <= 65535 && callback.pathname === '/oauth2/callback' &&
      !callback.username && !callback.password && !callback.search && !callback.hash;
  } catch (_) { return false; }
}
function createGoogleOAuthBroker({ clientId, clientSecret, fetchImpl = globalThis.fetch,
  maxConcurrent = 8, rateLimit = 60, globalRateLimit = 600, clock = Date.now } = {}) {
  if (!/^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId || '') ||
    typeof clientSecret !== 'string' || clientSecret.length < 10 || clientSecret.length > 1024 ||
    /[\s\x00-\x1f]/.test(clientSecret)) throw Error('Google app registration is not configured.');
  let inFlight = 0, globalWindow = 0, globalCount = 0;
  const clients = new Map();
  const respond = (response, status, body) => {
    if (response.destroyed || response.writableEnded) return;
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store', Pragma: 'no-cache', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      ...(status === 429 ? { 'Retry-After': '60' } : {}) });
    response.end(JSON.stringify(body));
  };
  const allow = address => {
    const now = clock(), window = Math.floor(now / 60000);
    if (globalWindow !== window) { globalWindow = window; globalCount = 0; clients.clear(); }
    if (globalCount >= globalRateLimit) return false;
    globalCount++;
    if (!clients.has(address) && clients.size >= 1024) return false;
    const count = (clients.get(address) || 0) + 1;
    clients.set(address, count); return count <= rateLimit;
  };
  return async (request, response) => {
    if (request.url === '/health' && request.method === 'GET') { respond(response, 200, { ready: true }); return; }
    if (request.url !== '/v1/google/token') { respond(response, 404, { error: 'not_found' }); return; }
    if (request.method !== 'POST') { respond(response, 405, { error: 'method_not_allowed' }); return; }
    // Ignore caller-supplied forwarding headers. Configure rate limits at the HTTPS ingress too.
    if (!allow(request.socket.remoteAddress || 'unknown') || inFlight >= maxConcurrent) {
      respond(response, 429, { error: 'rate_limited' }); request.resume(); return;
    }
    if (!(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
      respond(response, 415, { error: 'invalid_content_type' }); request.resume(); return;
    }
    inFlight++;
    const controller = new AbortController();
    const disconnected = () => { if (!response.writableEnded) controller.abort(); };
    response.once('close', disconnected);
    try {
      let length = 0; const chunks = [];
      for await (const chunk of request) {
        length += chunk.length;
        if (length > 8192) { respond(response, 413, { error: 'request_too_large' }); request.resume(); return; }
        chunks.push(chunk);
      }
      let body; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch (_) { respond(response, 400, { error: 'invalid_request' }); return; }
      if (!validPayload(body, clientId)) { respond(response, 400, { error: 'invalid_request' }); return; }
      const provider = await fetchImpl(TOKEN_URL, { method: 'POST', redirect: 'error',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ ...body, client_secret: clientSecret }).toString() });
      if (!provider.ok) { respond(response, 400, { error: 'authorization_failed' }); return; }
      const token = await provider.json();
      if (typeof token.access_token !== 'string' || !token.access_token || token.access_token.length > 16384 ||
        !/^Bearer$/i.test(token.token_type || '') || !Number.isFinite(Number(token.expires_in)) ||
        Number(token.expires_in) <= 0 || !String(token.scope || '').split(/\s+/).includes(DRIVE_SCOPE)) {
        respond(response, 502, { error: 'invalid_provider_response' }); return;
      }
      // No account database, notebook payloads, refresh-token persistence or provider-error logging.
      respond(response, 200, { access_token: token.access_token, token_type: 'Bearer',
        expires_in: Number(token.expires_in), scope: token.scope });
    } catch (_) { respond(response, 502, { error: 'provider_unavailable' }); }
    finally { response.removeListener('close', disconnected); inFlight--; }
  };
}
async function start() {
  const publicOrigin = process.env.BETTERNOTE_GOOGLE_PUBLIC_ORIGIN || '';
  let parsed; try { parsed = new URL(publicOrigin); } catch (_) {}
  if (!parsed || parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search ||
    parsed.hash || parsed.pathname !== '/') throw Error('Configure the public HTTPS origin before starting the account service.');
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
  const clientSecret = await readRegistration(process.env.GOOGLE_OAUTH_CREDENTIALS_FILE || '', clientId);
  const handler = createGoogleOAuthBroker({ clientId, clientSecret });
  const server = http.createServer(handler);
  server.maxHeadersCount = 24; server.headersTimeout = 10000; server.requestTimeout = 20000;
  server.maxConnections = 64;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(Number(process.env.PORT) || 8080, process.env.BETTERNOTE_GOOGLE_BIND_HOST || '127.0.0.1', resolve);
  });
  console.log('BetterNote Google account service is ready behind its HTTPS ingress.');
}
if (require.main === module) start().catch(() => {
  console.error('BetterNote Google account service could not start. Check registration and HTTPS configuration.');
  process.exitCode = 1;
});
module.exports = { createGoogleOAuthBroker, validPayload };
