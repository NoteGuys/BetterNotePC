import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerBroker } from '../server/googleOAuthWorker.js';
const id='1234567890-synthetic.apps.googleusercontent.com',secret='fixture-secret-not-real-registration';
const env={GOOGLE_OAUTH_CLIENT_ID:id,GOOGLE_OAUTH_CLIENT_SECRET:secret};
const grant={client_id:id,code:'synthetic-code',code_verifier:'A'.repeat(64),redirect_uri:'http://127.0.0.1:43123/oauth2/callback',grant_type:'authorization_code'};
const scope='openid email https://www.googleapis.com/auth/drive.file';
const request=(body=grant,options={})=>new Request('https://accounts.betternote.invalid/v1/google/token',
 {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),...options});
const fixture=(options={})=>{
 const calls=[];const broker=createWorkerBroker({fetchImpl:async(url,options)=>{
 calls.push({url,options});return{ok:true,json:async()=>({access_token:'synthetic-token',token_type:'Bearer',expires_in:3600,scope,refresh_token:'synthetic-unused',client_secret:secret})};
 },...options});return{broker,calls};
};
test('Worker keeps app credentials in server bindings and returns no registration or refresh secret',async()=>{
 const f=fixture(),response=await f.broker.fetch(request(),env),data=await response.json();
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal(data.access_token,'synthetic-token');assert.equal('client_secret'in data,false);assert.equal('refresh_token'in data,false);
 assert.equal(f.calls[0].url,'https://oauth2.googleapis.com/token');assert.equal(new URLSearchParams(f.calls[0].options.body).get('client_secret'),secret);
 assert.equal(f.calls[0].options.redirect,'error');
});
test('Wrong app, remote callbacks, weak PKCE and extra fields never reach Google',async()=>{
 const f=fixture();
 for(const changes of [{client_id:'999999-other.apps.googleusercontent.com'},{redirect_uri:'https://untrusted.invalid/callback'},
 {code_verifier:'short'},{client_secret:'must-not-accept'},{grant_type:'refresh_token'},{notebooks:[]}]){
 assert.equal((await f.broker.fetch(request({...grant,...changes}),env)).status,400);}
 assert.equal(f.calls.length,0);
});
test('Worker refuses malformed, oversized, HTTP, wrong-path, wrong-method and non-JSON requests',async()=>{
 const f=fixture();
 assert.equal((await f.broker.fetch(request(grant,{body:'{not-json'}),env)).status,400);
 assert.equal((await f.broker.fetch(request({...grant,code:'A'.repeat(9000)}),env)).status,413);
 assert.equal((await f.broker.fetch(new Request('http://accounts.invalid/v1/google/token'),env)).status,400);
 assert.equal((await f.broker.fetch(new Request('https://accounts.invalid/unexpected'),env)).status,404);
 assert.equal((await f.broker.fetch(new Request('https://accounts.invalid/v1/google/token'),env)).status,405);
 assert.equal((await f.broker.fetch(request(grant,{headers:{'Content-Type':'text/plain'}}),env)).status,415);
 assert.equal(f.calls.length,0);
});
test('Worker missing registration fails closed without showing binding values',async()=>{
 const f=fixture(),response=await f.broker.fetch(request(),{});
 assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'app_not_configured'});assert.equal(f.calls.length,0);
});
test('Worker provider errors and network exceptions are sanitized',async()=>{
 for(const upstream of [async()=>({ok:false,json:async()=>({error_description:secret})}),async()=>{throw Error(secret);}]) {
 const f=fixture({fetchImpl:upstream}),response=await f.broker.fetch(request(),env);
 assert.ok([400,502].includes(response.status));assert.equal((await response.text()).includes(secret),false);
 }
});
test('Worker refuses tokens without Drive scope or a finite lifetime',async()=>{
 for(const token of [{access_token:'synthetic-token',token_type:'Bearer',expires_in:3600,scope:'openid email'},
 {access_token:'synthetic-token',token_type:'Bearer',expires_in:null,scope}]) {
 const f=fixture({fetchImpl:async()=>({ok:true,json:async()=>token})});
 assert.equal((await f.broker.fetch(request(),env)).status,502);
 }
});
test('Worker limits calls per isolate and releases exchange slots',async()=>{
 const f=fixture({rateLimit:1});
 assert.equal((await f.broker.fetch(request(),env)).status,200);
 assert.equal((await f.broker.fetch(request(grant,{headers:{'Content-Type':'application/json','CF-Connecting-IP':'spoofed'}}),env)).status,429);
 assert.equal(f.calls.length,1);
});
test('Worker bounds concurrent exchanges without exposing account data',async()=>{
 let complete,called;const reached=new Promise(resolve=>{called=resolve;});
 const f=fixture({maxConcurrent:1,fetchImpl:async()=>{called();return new Promise(resolve=>{complete=()=>resolve({ok:true,json:async()=>({access_token:'synthetic-token',token_type:'Bearer',expires_in:3600,scope})});});}});
 const first=f.broker.fetch(request(),env);await reached;
 assert.equal((await f.broker.fetch(request(),env)).status,429);complete();assert.equal((await first).status,200);
});
