const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createStoreUpdateChecker,IDENTITY}=require('../electron/storeUpdates.cjs');
test('No native helper is launched for installer builds or other platforms',async()=>{
 for(const options of [{isStore:()=>false,platform:'win32'},{isStore:()=>true,platform:'linux'}]){
  const checker=createStoreUpdateChecker({...options,run:()=>{throw Error('Must not launch');}});assert.equal((await checker.check()).hasUpdate,false);
 }
});
test('Trusted helper returns only same-app verified updates and runs hidden with bounded output/time',async()=>{
 for(const count of [0,1]){
  const checker=createStoreUpdateChecker({isStore:()=>true,platform:'win32',readScript:async()=>'# fixed test script',run:(exe,args,options,done)=>{
   assert.ok(exe.endsWith('powershell.exe'));assert.ok(args.includes('-NonInteractive'));assert.equal(options.windowsHide,true);assert.equal(options.timeout,16000);assert.equal(options.maxBuffer,8192);
   const body=Buffer.from(args.at(-1),'base64').toString('utf16le');assert.ok(body.includes(IDENTITY));
   queueMicrotask(()=>done(null,JSON.stringify({status:count?'available':'current',hasUpdate:!!count,count,packageName:IDENTITY})));return new EventEmitter();
  }});const r=await checker.check();assert.equal(r.success,true);assert.equal(r.hasUpdate,!!count);assert.equal(r.source,'microsoft-store');
 }
});
test('Wrong app, corrupt output, invalid counts and child failure never mean an available update',async()=>{
 for(const result of [{status:'available',hasUpdate:true,count:1,packageName:'other-app'},{status:'current',hasUpdate:true,count:0,packageName:IDENTITY},{status:'available',hasUpdate:true,count:-1,packageName:IDENTITY},'bad',null]){
  const checker=createStoreUpdateChecker({isStore:()=>true,platform:'win32',readScript:async()=>'',run:(_exe,_args,_options,done)=>{queueMicrotask(()=>done(result===null?Error('timeout'):null,typeof result==='string'?result:JSON.stringify(result)));return new EventEmitter();}});
  assert.equal((await checker.check()).hasUpdate,false);assert.equal((await checker.check()).status,'unavailable');
 }
});
test('Concurrent requests share a single helper and closing the app kills that helper',async()=>{
 let done,launched=0,killed=0;const checker=createStoreUpdateChecker({isStore:()=>true,platform:'win32',readScript:async()=>'',run:(_e,_a,_o,callback)=>{launched++;done=callback;return{kill:()=>{killed++;done(Error('closed'));}};}});
 const a=checker.check(),b=checker.check();assert.equal(a,b);await new Promise(r=>setImmediate(r));assert.equal(launched,1);checker.dispose();assert.equal(killed,1);assert.equal((await a).success,false);
});

test('Disposing while reading the script never launches a helper after close',async()=>{
 let release,calls=0;const checker=createStoreUpdateChecker({isStore:()=>true,platform:'win32',readScript:()=>new Promise(r=>release=r),run:()=>{calls++;}});
 const pending=checker.check();checker.dispose();release('script');assert.equal((await pending).success,false);assert.equal(calls,0);
});

test('Main can register the exported Store IPC and dispose it with its window',async()=>{
 const {registerStoreUpdates}=require('../electron/storeUpdates.cjs');let handler,close;const checker=registerStoreUpdates({ipcMain:{handle:(channel,callback)=>{assert.equal(channel,'check-store-update');handler=callback;}},getWindow:()=>({on:(event,callback)=>{assert.equal(event,'closed');close=callback;}}),isStore:()=>false});
 assert.equal((await handler()).status,'unavailable');assert.equal(typeof close,'function');close();assert.equal((await checker.check()).hasUpdate,false);
});
