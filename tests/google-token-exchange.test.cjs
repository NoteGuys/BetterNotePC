const test=require('node:test'),assert=require('node:assert/strict');
const {createGoogleTokenExchange,readRegistration,validBroker}=require('../electron/googleTokenExchange.cjs');
const id='1234567890-synthetic.apps.googleusercontent.com',secret='fixture-value-not-a-real-credential';
const file='D:/synthetic-only/owner-registration.json';
const payload={clientId:id,code:'synthetic-code',verifier:'A'.repeat(64),redirectUri:'http://127.0.0.1:43123/oauth2/callback'};
const registration={installed:{client_id:id,client_secret:secret,token_uri:'https://oauth2.googleapis.com/token'}};
const stat=async()=>({isFile:()=>true,size:512}),readFile=async()=>JSON.stringify(registration);
test('Owner credentials stay in the Google HTTPS token request and never in its returned object',async()=>{
 let request;const exchange=createGoogleTokenExchange({credentialFile:file,readFile,stat,fetchImpl:async(url,options)=>{
 request={url,options};return{ok:true,json:async()=>({access_token:'synthetic-token',expires_in:3600,token_type:'Bearer'})};}});
 const result=await exchange(payload);assert.equal(request.url,'https://oauth2.googleapis.com/token');assert.equal(request.options.redirect,'error');
 const params=new URLSearchParams(request.options.body);assert.equal(params.get('client_secret'),secret);assert.equal(params.get('code_verifier'),payload.verifier);
 assert.equal(JSON.stringify(result).includes(secret),false);
});
test('Public app sends no Client secret to the HTTPS account service and reads no credentials',async()=>{
 const exchange=createGoogleTokenExchange({brokerUrl:'https://accounts.betternote.invalid/v1/google/token',
 readFile:async()=>{throw Error('must-not-read');},stat:async()=>{throw Error('must-not-stat');},fetchImpl:async(url,options)=>{
 assert.equal(url,'https://accounts.betternote.invalid/v1/google/token');assert.equal(options.headers['Content-Type'],'application/json');
 const body=JSON.parse(options.body);assert.equal(body.client_id,id);assert.equal(body.code_verifier,payload.verifier);assert.equal('client_secret'in body,false);
 return{ok:true,json:async()=>({access_token:'synthetic-token'})};}});assert.equal((await exchange(payload)).access_token,'synthetic-token');
});
test('HTTP, embedded credentials, query, fragment and unexpected broker paths are rejected before fetch',async()=>{
 for(const url of ['http://accounts.invalid/v1/google/token','https://user:pass@accounts.invalid/v1/google/token',
 'https://accounts.invalid/v1/google/token?key=secret','https://accounts.invalid/v1/google/token#secret','https://accounts.invalid/unexpected','file:///synthetic']){
 assert.equal(validBroker(url),false);const exchange=createGoogleTokenExchange({brokerUrl:url,fetchImpl:()=>{throw Error('must-not-fetch');}});
 await assert.rejects(exchange(payload),e=>e.message==='client-registration-unavailable');}
});
test('Missing, malformed, wrong-client, web-client and oversized credentials yield sanitized errors',async()=>{
 const samples=[{credentialFile:''},{credentialFile:'relative.json'},{readFile:async()=>'{not json'},
 {readFile:async()=>JSON.stringify({web:registration.installed})},
 {readFile:async()=>JSON.stringify({installed:{...registration.installed,client_id:'999999-other.apps.googleusercontent.com'}})},
 {readFile:async()=>JSON.stringify({installed:{...registration.installed,token_uri:'https://untrusted.invalid/token'}})},
 {stat:async()=>({isFile:()=>true,size:20000})},{stat:async()=>{throw Error('private-sensitive-path');}},
 {readFile:async()=>JSON.stringify({installed:{...registration.installed,client_secret:'bad\ncredential'}})}];
 for(const sample of samples){const exchange=createGoogleTokenExchange({credentialFile:file,readFile,stat,...sample,fetchImpl:()=>{throw Error('must-not-fetch');}});
 await assert.rejects(exchange(payload),e=>e.message==='client-registration-unavailable'&&!e.message.includes(secret));}
});
test('Provider failures never expose provider details or app credentials',async()=>{
 const exchange=createGoogleTokenExchange({credentialFile:file,readFile,stat,fetchImpl:async()=>({ok:false,json:async()=>({error_description:secret})})});
 await assert.rejects(exchange(payload),e=>e.message==='token-exchange-failed');
});
test('Network errors are sanitized and cancellation prevents sending owner credentials',async()=>{
 const exchange=createGoogleTokenExchange({credentialFile:file,readFile,stat,fetchImpl:async()=>{throw Error(secret);}});
 await assert.rejects(exchange(payload),e=>e.message==='network-error');const controller=new AbortController();controller.abort();
 await assert.rejects(exchange({...payload,signal:controller.signal}),e=>e.message==='cancelled');
});
test('Registration parser returns only the secret and refuses mismatched app identifiers',async()=>{
 assert.equal(await readRegistration(file,id,readFile,stat),secret);
 await assert.rejects(readRegistration(file,'untrusted-id',readFile,stat),e=>e.message==='client-registration-unavailable');
});
