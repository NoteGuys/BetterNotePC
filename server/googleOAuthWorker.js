const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const fields = new Set(['client_id','code','code_verifier','redirect_uri','grant_type']);
function validGrant(body, clientId) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !fields.has(key)) ||
    body.client_id !== clientId || body.grant_type !== 'authorization_code' ||
    typeof body.code !== 'string' || !body.code || body.code.length > 2048 || /[\s\x00-\x1f]/.test(body.code) ||
    typeof body.code_verifier !== 'string' || !/^[a-zA-Z0-9._~-]{43,128}$/.test(body.code_verifier)) return false;
  try {
    const url = new URL(body.redirect_uri);
    return url.protocol === 'http:' && url.hostname === '127.0.0.1' && Number(url.port) >= 1024 &&
      Number(url.port) <= 65535 && url.pathname === '/oauth2/callback' &&
      !url.username && !url.password && !url.search && !url.hash;
  } catch (_) { return false; }
}
const respond = (status, body) => new Response(JSON.stringify(body), { status, headers: {
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',Pragma:'no-cache',
  'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",
  ...(status === 429 ? {'Retry-After':'60'} : {})
}});
export function createWorkerBroker({ fetchImpl = globalThis.fetch, clock = Date.now, rateLimit = 60,
  globalRateLimit = 600, maxConcurrent = 8 } = {}) {
  let currentWindow = -1, count = 0, active = 0; const clients = new Map();
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.protocol !== 'https:') return respond(400,{error:'https_required'});
      if (url.pathname === '/health' && request.method === 'GET') return respond(200,{ready:true});
      if (url.pathname !== '/v1/google/token' || url.search) return respond(404,{error:'not_found'});
      if (request.method !== 'POST') return respond(405,{error:'method_not_allowed'});
      const id = env?.GOOGLE_OAUTH_CLIENT_ID, secret = env?.GOOGLE_OAUTH_CLIENT_SECRET;
      if (!/^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(id || '') ||
        typeof secret !== 'string' || secret.length < 10 || secret.length > 1024 || /[\s\x00-\x1f]/.test(secret))
        return respond(503,{error:'app_not_configured'});
      const window = Math.floor(clock()/60000);
      if (window !== currentWindow) { currentWindow=window;count=0;clients.clear(); }
      // In production Cloudflare supplies request.cf and the connecting IP header.
      const address = request.cf ? request.headers.get('CF-Connecting-IP') || 'unknown' : 'local-test';
      if (active >= maxConcurrent || count >= globalRateLimit ||
        (!clients.has(address) && clients.size >= 1024) || (clients.get(address)||0) >= rateLimit)
        return respond(429,{error:'rate_limited'});
      count++;clients.set(address,(clients.get(address)||0)+1);
      if (!(request.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))
        return respond(415,{error:'invalid_content_type'});
      active++;
      try {
        if (!request.body) return respond(400,{error:'invalid_request'});
        const reader=request.body.getReader(),chunks=[];let bytes=0;
        try {
          while (true) {
            const next=await reader.read();if(next.done)break;
            bytes+=next.value.byteLength;
            if(bytes>8192){await reader.cancel();return respond(413,{error:'request_too_large'});}
            chunks.push(next.value);
          }
        } finally { reader.releaseLock(); }
        const bodyBytes=new Uint8Array(bytes);let offset=0;
        for(const chunk of chunks){bodyBytes.set(chunk,offset);offset+=chunk.byteLength;}
        let body;try{body=JSON.parse(new TextDecoder().decode(bodyBytes));}catch(_){return respond(400,{error:'invalid_request'});}
        if(!validGrant(body,id))return respond(400,{error:'invalid_request'});
        const provider=await fetchImpl(TOKEN_URL,{method:'POST',redirect:'error',
          signal:AbortSignal.any([request.signal,AbortSignal.timeout(15000)]),
          headers:{'Content-Type':'application/x-www-form-urlencoded'},
          body:new URLSearchParams({...body,client_secret:secret}).toString()});
        if(!provider.ok)return respond(400,{error:'authorization_failed'});
        const token=await provider.json();
        if(typeof token.access_token!=='string'||!token.access_token||token.access_token.length>16384||
          !/^Bearer$/i.test(token.token_type||'')||!Number.isFinite(Number(token.expires_in))||Number(token.expires_in)<=0||
          !String(token.scope||'').split(/\s+/).includes(DRIVE_SCOPE))
          return respond(502,{error:'invalid_provider_response'});
        return respond(200,{access_token:token.access_token,token_type:'Bearer',expires_in:Number(token.expires_in),scope:token.scope});
      } catch(_){return respond(502,{error:'provider_unavailable'});}
      finally{active--;}
    }
  };
}
export default createWorkerBroker();
