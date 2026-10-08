const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {isAppUrl,trustedSender,validRequest,createGuardedIpc,registerAssetProtocol}=require('../electron/appSecurity.cjs');
const {createExternalActions,validExternalUrl,STORE_URI}=require('../electron/externalActions.cjs');
const appFile=path.resolve('dist/index.html'),contents={mainFrame:{url:pathToFileURL(appFile).href}};
const win={webContents:contents,isDestroyed:()=>false},event={sender:contents,senderFrame:contents.mainFrame};
test('Only the app entry URL is a trusted sender; local files, missing frames and subframes are refused',()=>{
 assert.ok(trustedSender(event,win,appFile));
 for(const e of [{sender:{}},{sender:contents},{sender:contents,senderFrame:{url:event.senderFrame.url}}])assert.equal(trustedSender(e,win,appFile),false);
 assert.equal(isAppUrl(pathToFileURL(path.resolve('package.json')).href,appFile),false);
 assert.equal(isAppUrl('https://example.com',appFile),false);
});
test('Guarded IPC refuses requests before disk work, with normal backup inspect/prune accepted',async()=>{
 const handlers=new Map();let count=0;
 const ipc=createGuardedIpc({handle:(n,h)=>handlers.set(n,h)},()=>win,appFile);
 ipc.handle('save-auto-backup',()=>++count);
 assert.equal(handlers.get('save-auto-backup')({sender:{}},{action:'begin'}).reason,'untrusted-window');
 assert.equal(handlers.get('save-auto-backup')(event,{action:'bogus'}).reason,'invalid-request');
 assert.equal(handlers.get('save-auto-backup')(event,{action:'begin',driveBackupPath:'relative'}).reason,'invalid-request');
 for(const action of ['inspect','prune','begin','notebook','finish','reuse','pdf','abort'])assert.ok(validRequest('save-auto-backup',[{action,driveBackupPath:path.resolve('scratch')}]));
 for(const invalid of [path.resolve('scratch')+String.fromCharCode(0),String.fromCharCode(92,92,63,92)+'C:/Windows',String.fromCharCode(92,92,46,92)+'C:/Windows'])assert.equal(validRequest('scan-backup-folder',[invalid]),false);
 assert.equal(count,0);assert.equal(handlers.get('save-auto-backup')(event,{action:'begin'}),1);
});
test('External links accept official HTTPS destinations and exact Store product only',()=>{
 for(const u of ['https://www.google.com/intl/th/drive/download/','https://github.com/NoteGuys/BetterNotePC/releases',STORE_URI])assert.ok(validExternalUrl(u));
 for(const u of ['http://www.google.com/','file:///C:/Windows','javascript:alert(1)','https://www.google.com.evil.test/','https://evil@www.google.com/','https://www.google.com:444/',STORE_URI+'evil'])assert.equal(validExternalUrl(u),false);
});
test('Folder opening checks the shell result and concurrent actions coalesce',async()=>{
 let calls=0,release;const actions=createExternalActions({shell:{openPath:()=>{calls++;return new Promise(r=>release=r);}},fileSystem:{stat:async()=>({isDirectory:()=>true})}});
 const p=actions.openFolder(path.resolve('scratch')),q=actions.openFolder(path.resolve('scratch'));assert.equal(p,q);
 await new Promise(r=>setImmediate(r));release('OS failure');assert.equal((await p).success,false);assert.equal(calls,1);
});
test('Missing folder is created asynchronously; reveal does not create missing files',async()=>{
 let made=0,revealed=0;const actions=createExternalActions({fileSystem:{stat:async()=>{throw Object.assign(Error(),{code:'ENOENT'});},mkdir:async()=>made++},shell:{openPath:async()=>'',showItemInFolder:()=>revealed++}});
 assert.equal((await actions.openFolder(path.resolve('scratch'))).success,true);assert.equal(made,1);
 assert.equal((await actions.revealFile(path.resolve('scratch','missing'))).success,false);assert.equal(revealed,0);
});
test('Timed-out OS action stays locked and never launches a second action',async()=>{
 let calls=0,release;const actions=createExternalActions({timeoutMs:10,shell:{openExternal:()=>{calls++;return new Promise(r=>release=r);}}});
 const p=actions.openExternal(STORE_URI);assert.equal((await p).reason,'open-timeout');
 assert.equal(actions.openExternal(STORE_URI),p);assert.equal(calls,1);release();await new Promise(r=>setImmediate(r));
});
test('PDF asset protocol rejects traversal, unknown hosts, non-assets and requests with query strings',async()=>{
 let handle;registerAssetProtocol({handle:(scheme,h)=>handle=h},{fetch:()=>{throw Error('must not read');}},path.resolve('dist'));
 for(const url of ['betternote-assets://evil/assets/a.js','betternote-assets://app/package.json','betternote-assets://app/assets/%2e%2e%2fsecret.js','betternote-assets://app/assets/a.js?x=1']){
  assert.equal((await handle({url,method:'GET'})).status,404);
 }
});
