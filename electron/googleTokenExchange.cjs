const fs = require('node:fs/promises');
const path = require('node:path');
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const validId = value => typeof value === 'string' && /^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(value);
const failure = reason => Object.assign(new Error(reason), { safeReason: reason });
const validBroker = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash &&
      url.pathname === '/v1/google/token';
  } catch (_) { return false; }
};
async function readRegistration(file, clientId, readFile = fs.readFile, stat = fs.stat) {
  if (!file || !path.isAbsolute(file) || !validId(clientId)) throw failure('client-registration-unavailable');
  try {
    const info = await stat(file);
    if (!info.isFile() || info.size > 16384) throw failure('client-registration-unavailable');
    const registration = JSON.parse(await readFile(file, 'utf8')).installed;
    if (!registration || registration.client_id !== clientId ||
      registration.token_uri !== TOKEN_URL || typeof registration.client_secret !== 'string' ||
      registration.client_secret.length < 10 || registration.client_secret.length > 1024 ||
      /[\s\x00-\x1f]/.test(registration.client_secret)) throw failure('client-registration-unavailable');
    return registration.client_secret;
  } catch (_) { throw failure('client-registration-unavailable'); }
}
function createGoogleTokenExchange({ credentialFile = '', brokerUrl = '', fetchImpl = globalThis.fetch,
  readFile, stat } = {}) {
  // Paths and endpoint come only from the native app configuration, never from a renderer IPC request.
  return async ({ clientId, code, verifier, redirectUri, signal }) => {
    const parameters = { client_id: clientId, code, code_verifier: verifier, redirect_uri: redirectUri,
      grant_type: 'authorization_code' };
    let endpoint, options;
    if (brokerUrl) {
      if (!validBroker(brokerUrl)) throw failure('client-registration-unavailable');
      endpoint = brokerUrl;
      options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parameters) };
    } else {
      const secret = await readRegistration(credentialFile, clientId, readFile, stat);
      if (signal?.aborted) throw failure('cancelled');
      endpoint = TOKEN_URL;
      options = { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ ...parameters, client_secret: secret }).toString() };
    }
    let result;
    try { result = await fetchImpl(endpoint, { ...options, signal, redirect: 'error' }); }
    catch (_) { throw failure(signal?.aborted ? 'cancelled' : 'network-error'); }
    if (!result.ok) throw failure('token-exchange-failed');
    try { return await result.json(); }
    catch (_) { throw failure('invalid-token-response'); }
  };
}
module.exports = { createGoogleTokenExchange, readRegistration, validBroker };
