import test from 'node:test';import assert from 'node:assert/strict';
import {createUpdateChecker,compareVersions,openUpdateDestination,STORE_URL,STORE_WEB_URL,RELEASES_URL,UPDATE_FEED_URL,LAST_UPDATE_CHECK_DATE_KEY} from '../src/services/updateCore.js';
const fixture=(fetchImpl,options={})=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 return{data,checker:createUpdateChecker({currentVersion:'1.2.1',fetchImpl,storage,...options})};
};
const response=data=>new Response(JSON.stringify(data));
test('Versions distinguish stable/prerelease and do not treat malformed versions as newer',()=>{
 assert.equal(compareVersions('1.2.1','1.2.0'),1);assert.equal(compareVersions('1.2.1','1.2.1-beta'),1);
 assert.equal(compareVersions('1.2.1-beta.2','1.2.1-beta.11'),-1);assert.equal(compareVersions('bad','1.0.0'),0);
});
test('Store builds defer to the correct BetterNote Store product without fetching an installer feed',async()=>{
 let calls=0;const f=fixture(async(url)=>{assert.equal(url,UPDATE_FEED_URL);calls++;return response({version:'1.2.3',storeUrl:'https://evil.test/',features:['Actual release'],bugFixes:[]});},{getAppInfo:async()=>({version:'1.2.2',distribution:'store'})});
 const r=await f.checker.check();assert.equal(r.status,'store-managed');assert.equal(r.currentVersion,'1.2.2');assert.equal(r.updateUrl,STORE_URL);assert.equal(STORE_URL,'ms-windows-store://pdp/?productid=9N9NH9GHFV8J');assert.equal(STORE_WEB_URL,'https://apps.microsoft.com/detail/9N9NH9GHFV8J');assert.equal(f.data.has(LAST_UPDATE_CHECK_DATE_KEY),true);
 assert.equal((await f.checker.check()).throttled,true);assert.equal(calls,0);
});
test('Offline and HTTP failure are unavailable, never current, and manual retry bypasses failure throttle',async()=>{
 let ok=false,calls=0;const f=fixture(async()=>{calls++;if(!ok)throw Error('offline');return response({version:'1.2.1'});});
 assert.equal((await f.checker.check()).status,'unavailable');assert.equal(f.data.size,0);
 await f.checker.check();assert.equal(calls,1);ok=true;assert.equal((await f.checker.check({force:true})).status,'current');
});
test('Concurrent manual/automatic checks share one bounded network request',async()=>{
 let release,calls=0;const f=fixture(()=>{calls++;return new Promise(r=>release=r);});
 const p=f.checker.check(),q=f.checker.check({force:true});assert.equal(p,q);
 await new Promise(r=>setImmediate(r));release(response({version:'1.3.0'}));assert.equal((await p).updateUrl,RELEASES_URL);assert.equal(calls,1);
});
test('Bad JSON, missing version, oversized feed and failed response never announce newest',async()=>{
 for(const fetcher of [async()=>response({}),async()=>new Response('bad'),async()=>new Response('x'.repeat(70000)),async()=>new Response('',{status:404}),async()=>response({version:'999bad'}),...['01.2.3','1.2.3-01','1.2.3-alpha..x','1.2.3+..'].map(version=>async()=>response({version}))]){
  const f=fixture(fetcher);assert.equal((await f.checker.check({force:true})).status,'unavailable');assert.equal(f.data.size,0);
 }
});
test('Timeout covers a stalled response body and releases the shared check',async()=>{
 const f=fixture(async()=>new Response(new ReadableStream({start(){}})),{timeoutMs:20});
 assert.equal((await f.checker.check({force:true})).status,'unavailable');
 assert.equal((await f.checker.check({force:true})).status,'unavailable');
});
test('Store failure triggers web fallback, and both failures return false',async()=>{
 const opened=[];assert.equal(await openUpdateDestination(STORE_URL,{native:async u=>{opened.push(u);return{success:u===STORE_WEB_URL};}}),true);assert.deepEqual(opened,[STORE_URL,STORE_WEB_URL]);
 assert.equal(await openUpdateDestination(STORE_URL,{native:async()=>({success:false})}),false);
 assert.equal(await openUpdateDestination('https://evil.test/',{native:async()=>{throw Error();}}),false);
});
test('Release text is used only when shaped as bounded text arrays',async()=>{
 const f=fixture(async()=>response({version:'2.0.0',features:[{}],bugFixes:['real'],title:{bad:1}}));
 const r=await f.checker.check();assert.deepEqual(r.features,[]);assert.deepEqual(r.bugFixes,['real']);assert.equal(r.title,'');
});

test('A missing published manifest is distinguishable from offline failure',async()=>{
 const f=fixture(async()=>new Response('',{status:404}));const r=await f.checker.check({force:true});assert.equal(r.status,'unavailable');assert.equal(r.reason,'feed-not-configured');
});
