const test = require('node:test'), assert = require('node:assert/strict'), http = require('node:http');
const { createGoogleOAuthBroker } = require('../server/googleOAuthBroker.cjs');
const id = '1234567890-synthetic.apps.googleusercontent.com', secret = 'fixture-secret-not-real-registration';
const payload = { client_id: id, code: 'synthetic-code', code_verifier: 'A'.repeat(64),
  redirect_uri: 'http://127.0.0.1:43123/oauth2/callback', grant_type: 'authorization_code' };
const scope = 'openid email https://www.googleapis.com/auth/drive.file';
async function fixture(options = {}) {
  const calls = [];
  const handler = createGoogleOAuthBroker({ clientId: id, clientSecret: secret, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ access_token: 'synthetic-token', token_type: 'Bearer', expires_in: 3600,
      scope, refresh_token: 'synthetic-refresh-not-returned', client_secret: secret }) };
  }, ...options });
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const send = (body = payload, overrides = {}) => fetch(origin + '/v1/google/token',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), ...overrides });
  return { calls, send, origin, close: () => new Promise(resolve => {
    server.close(resolve); server.closeAllConnections();
  }) };
}
test('HTTPS-ingress broker exchanges only the app grant and returns no registration or refresh secret', async () => {
  const f = await fixture();
  try {
    const response = await f.send(), data = await response.json();
    assert.equal(response.status, 200); assert.equal(data.access_token, 'synthetic-token');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal('client_secret' in data, false); assert.equal('refresh_token' in data, false);
    assert.equal(f.calls[0].url, 'https://oauth2.googleapis.com/token');
    const body = new URLSearchParams(f.calls[0].options.body);
    assert.equal(body.get('client_secret'), secret); assert.equal(body.get('code_verifier'), payload.code_verifier);
    assert.equal(f.calls[0].options.redirect, 'error');
  } finally { await f.close(); }
});
test('Wrong app, arbitrary callback, weak verifier and extra fields cannot invoke Google', async () => {
  const f = await fixture();
  try {
    for (const changes of [
      {client_id:'999999-unrelated.apps.googleusercontent.com'}, {redirect_uri:'https://untrusted.invalid/callback'},
      {redirect_uri:'http://localhost:43123/oauth2/callback'}, {redirect_uri:'http://127.0.0.1:43123/oauth2/callback?code=secret'},
      {redirect_uri:'http://127.0.0.1:80/oauth2/callback'}, {code_verifier:'weak'},
      {grant_type:'refresh_token'}, {code:'bad code'}, {client_secret:'must-not-accept'}, {notebooks:[]}
    ]) assert.equal((await f.send({...payload,...changes})).status,400);
    assert.equal(f.calls.length,0);
  } finally { await f.close(); }
});
test('Invalid JSON, oversized bodies, unsupported methods and content types return safe errors', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.send(payload,{body:'{not json'})).status,400);
    assert.equal((await f.send({...payload,code:'A'.repeat(10000)})).status,413);
    assert.equal((await f.send(payload,{headers:{'Content-Type':'text/plain'}})).status,415);
    assert.equal((await fetch(f.origin+'/v1/google/token')).status,405);
    assert.equal((await fetch(f.origin+'/unexpected')).status,404);
    assert.equal(f.calls.length,0);
  } finally { await f.close(); }
});
test('Google provider error details never reach client responses', async () => {
  const f = await fixture({fetchImpl:async()=>({ok:false,json:async()=>({error_description:secret})})});
  try {
    const response = await f.send(); assert.equal(response.status,400);
    assert.deepEqual(await response.json(),{error:'authorization_failed'});
  } finally { await f.close(); }
});
test('A token without Drive permission cannot be presented as a usable connection', async () => {
  const f = await fixture({fetchImpl:async()=>({ok:true,json:async()=>({access_token:'synthetic-token',token_type:'Bearer',expires_in:3600,scope:'openid email'})})});
  try {const response=await f.send();assert.equal(response.status,502);assert.deepEqual(await response.json(),{error:'invalid_provider_response'});}
  finally {await f.close();}
});
test('Rate limiting bounds calls and ignores spoofed forwarding addresses', async () => {
  const f = await fixture({rateLimit:1});
  try {
    assert.equal((await f.send()).status,200);
    const response=await f.send(payload,{headers:{'Content-Type':'application/json','X-Forwarded-For':'203.0.113.100'}});
    assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'60');assert.equal(f.calls.length,1);
  } finally {await f.close();}
});
test('Concurrent account exchanges are bounded and release the slot after completion', async () => {
  let complete,called; const reached=new Promise(resolve=>{called=resolve;});
  const f = await fixture({maxConcurrent:1,fetchImpl:async()=>{called();return new Promise(resolve=>{complete=()=>resolve({ok:true,json:async()=>({access_token:'synthetic-token',token_type:'Bearer',expires_in:3600,scope})});});}});
  try {
    const first=f.send();await reached;assert.equal((await f.send()).status,429);
    complete();assert.equal((await first).status,200);
  } finally {await f.close();}
});
test('Network exceptions are sanitized and the health endpoint contains no credentials', async () => {
  const f=await fixture({fetchImpl:async()=>{throw Error(secret);}});
  try {
    const response=await f.send();assert.equal(response.status,502);assert.deepEqual(await response.json(),{error:'provider_unavailable'});
    assert.deepEqual(await (await fetch(f.origin+'/health')).json(),{ready:true});
  } finally {await f.close();}
});
