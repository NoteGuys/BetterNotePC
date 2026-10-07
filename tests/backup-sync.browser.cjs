// Synthetic two-device integration. No real notebooks or Drive access.
const fs=require('node:fs'),disk=fs.promises,path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const {chromium}=require(process.env.BETTERNOTE_PLAYWRIGHT_PATH||'playwright');
const {createBackupReaderClient}=require('../electron/backupReaderClient.cjs');
const {createBackupWorkerClient}=require('../electron/backupWorkerClient.cjs');
const {setupRecoveryWorker}=require('./helpers/recovery-worker.cjs');
const root=fs.realpathSync(path.resolve(__dirname,'..')),qaRoot=process.env.BETTERNOTE_QA_TEMP;
if(!qaRoot||!path.isAbsolute(qaRoot))throw Error('Use isolated QA storage');
const origin='https://betternote-drive-sync.invalid/',passed=[];
const note=(id,time=10,text='initial')=>({id,name:id,updatedAt:time,pageCount:1,coverId:'deep-ocean',pages:[{id:id+'-p',notebookId:id,pageIndex:0,updatedAt:time,strokes:[{points:[{x:12,y:34},{x:40,y:56}]}],textElements:[{id:'text',text,x:2,y:3}],imageElements:[{id:'image',src:'data:image/png;base64,c3ludGhldGlj',locked:true}],pdfPageImage:'data:image/png;base64,c3ludGhldGlj',pageWidth:1200,pageHeight:1697,templateId:'dotted'}]});
const entry="const qaEncodeBackupCommand = " + require('./helpers/recovery-worker.cjs').encodeBinaryCommand.toString() + ";" + String.raw`
import React from 'react';import {createRoot}from'react-dom/client';import{App}from'./src/App.jsx';
import * as db from './src/services/db.js';import * as recovery from './src/services/backupRecoveryService.js';
import{autoBackupService as backup}from'./src/services/autoBackupService.js';import*as lang from'./src/services/i18n.js';
import{notebookHistoryStore as history}from'./src/services/notebookHistoryService.js';
import{prepareBackup}from'./electron/backupValidation.js';
window.qa={db,recovery,backup,lang,history,native:[],reads:[],errors:[]};window.alert=text=>qa.errors.push(text);window.confirm=()=>true;
window.electronAPI={isElectron:true,getDriveSyncCapabilities:async()=>({protocol:1}),saveBackup:async command=>{qa.native.push(command.action);return writeBridge(await qaEncodeBackupCommand(command));},
 scanBackupFolder:async(folder,options)=>{qa.reads.push(options);if(qa.holdRead&&options?.syncMode==='note')await qa.readGate;
 const result=await readBridge(folder,options);if(result.encoded)result.encoded=Uint8Array.from(result.encoded);return result;},
 onCloseSaveRequest:()=>()=>{},onCloseSaveCancelled:()=>()=>{},setLocalSaveGuardReady:()=>{},completeCloseSaveRequest:()=>{}};
qa.seed=async(source,paths)=>{await db.saveSetting('initialDataSeeded',true);if(source.notebooks.length)await db.restoreBackupAtomic(prepareBackup(source),'seed');
 await db.saveSetting('local_backup_path',paths.local);await db.saveSetting('gdrive_backup_method','desktop');await db.saveSetting('gdrive_backup_path',paths.drive);};
qa.mount=()=>{qa.renderer=createRoot(document.getElementById('root'));qa.renderer.render(<App/>);};
qa.edit=source=>db.restoreBackupAtomic(prepareBackup(source),'edit-'+crypto.randomUUID());
qa.run=options=>backup.runAutoBackup(options);qa.state=async()=>({notes:await db.getAllNotebooks(),journal:await db.getSetting('drive_sync_base_v1'),sync:backup.getDriveSyncSnapshot(),status:backup.getSnapshot()});
qa.gate=()=>{qa.holdRead=true;qa.readGate=new Promise(resolve=>qa.releaseRead=()=>{qa.holdRead=false;resolve();});};
`;
(async()=>{
 const fixture=await disk.mkdtemp(path.join(qaRoot,'betternote-sync-browser-')),drive=path.join(fixture,'drive'),localA=path.join(fixture,'local-A'),localB=path.join(fixture,'local-B');
 const reader=createBackupReaderClient(),clients=[createBackupWorkerClient({localDir:localA}),createBackupWorkerClient({localDir:localB})];let browser;
 const check=async(name,fn)=>{await fn();passed.push(name);console.log('PASS '+name);};
 try{
  const assets=path.join(root,'dist/assets'),cover=fs.readdirSync(assets).find(name=>/^notebookCover\.worker-.*\.js$/.test(name));
  const plugin={name:'qa-sync-app',setup(build){setupRecoveryWorker(build);
   build.onResolve({filter:/pdf\.worker\.min\.mjs\?url$/},()=>({path:'pdf',namespace:'qa-url'}));build.onLoad({filter:/.*/,namespace:'qa-url'},()=>({contents:"export default '/unused-worker';",loader:'js'}));
   build.onResolve({filter:/notebookCover\.worker\.js\?worker&inline$/},()=>({path:'cover',namespace:'qa-cover'}));build.onLoad({filter:/.*/,namespace:'qa-cover'},()=>({contents:fs.readFileSync(path.join(assets,cover),'utf8'),loader:'js'}));
   build.onLoad({filter:/autoBackupService\.js$/},args=>({contents:fs.readFileSync(args.path,'utf8').replace('canRenderPdf: () => this.pointerIds.size','canRenderPdf: () => false && this.pointerIds.size'),loader:'js'}));
   build.onLoad({filter:/\.jsx$/},args=>{
    if(args.path.endsWith(path.join('Library','LibraryView.jsx')))return{contents:'export const LibraryView=props=>{window.qa.library=props;return null;};',loader:'jsx'};
    if(args.path.endsWith(path.join('Editor','NoteEditor.jsx')))return{contents:'export const NoteEditor=props=>{window.qa.editor=props;return null;};',loader:'jsx'};
    if(args.path.endsWith(path.join('Common','DocumentTabBar.jsx')))return{contents:'export const DocumentTabBar=props=>{window.qa.tabs=props;return null;};',loader:'jsx'};
   });
  }};
  const bundle=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'jsx',sourcefile:'sync-qa.jsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},plugins:[plugin],logLevel:'silent'});
  browser=await chromium.launch({headless:true,executablePath:process.env.BETTERNOTE_QA_BROWSER,env:{...process.env,TEMP:qaRoot,TMP:qaRoot}});
  const pages=[],errors=[];
  for(let i=0;i<2;i++){
   const context=await browser.newContext({viewport:{width:1360,height:900}});await context.route('**/*',r=>r.request().url()===origin?r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><div id="root"></div>'}):r.abort());
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.exposeFunction('writeBridge',command=>{command=require('./helpers/recovery-worker.cjs').decodeBinaryCommand(command);for(const p of [command.localBackupPath,command.driveBackupPath].filter(Boolean))assert.ok(path.resolve(p).startsWith(fixture+path.sep));return clients[i].execute(command);});
   await page.exposeFunction('readBridge',async(folder,options)=>{assert.equal(path.resolve(folder),path.resolve(drive));const result=await reader.execute({folderPath:folder,...options});if(result.encoded)result.encoded=Array.from(result.encoded);return result;});
   await page.goto(origin);await page.addScriptTag({content:bundle.outputFiles[0].text});pages.push(page);
  }
  const[a,b]=pages,state=p=>p.evaluate(()=>qa.state()),get=(p,id)=>p.evaluate(id=>qa.db.getBackupNotebookSnapshot(id),id),run=p=>p.evaluate(()=>qa.run());
  for(const [page,local,notebooks]of [[a,localA,[note('shared'),note('unrelated')]],[b,localB,[]]]){
   await page.evaluate(async input=>{await qa.seed(input.source,input.paths);qa.mount();},{source:{folders:[],notebooks},paths:{local,drive}});
   await page.waitForFunction(()=>qa.library);await page.evaluate(()=>qa.backup.stopScheduledSync());
  }
  await check('Fresh device receives rich pages from the shared folder without manual import',async()=>{
   assert.equal((await run(a)).success,true);assert.equal((await run(b)).success,true);
   assert.deepEqual((await get(b,'shared')).pages,(await get(a,'shared')).pages);assert.equal((await get(b,'shared')).pages[0].imageElements[0].locked,true);
   await b.waitForFunction(()=>qa.library.notebooks.some(n=>n.id==='shared'));assert.ok((await state(b)).journal.entries.shared.remoteHash);
  });
  await check('Existing ID receives new writing even when source clock is behind',async()=>{
   await a.evaluate(source=>qa.edit(source),{folders:[],notebooks:[note('shared',2,'A new writing')]});await run(a);
   await b.evaluate(()=>qa.history.forNotebook('unrelated').append({id:'keep-undo'}));assert.equal((await run(b)).success,true);
   assert.equal((await get(b,'shared')).pages[0].textElements[0].text,'A new writing');assert.equal((await get(b,'shared')).updatedAt,2);
   assert.equal(await b.evaluate(()=>qa.history.forNotebook('unrelated').getSnapshot().stack.length),1);
  });
  await check('Both devices edit: canonical source and separate local copy survive together',async()=>{
   await a.evaluate(source=>qa.edit(source),{folders:[],notebooks:[note('shared',3,'A concurrent work')]});
   await b.evaluate(source=>qa.edit(source),{folders:[],notebooks:[note('shared',999,'B concurrent work')]});await run(a);assert.equal((await run(b)).success,true);
   const copy=(await state(b)).notes.find(n=>n.syncConflictOf==='shared');assert.ok(copy);const original=await get(b,'shared'),saved=await get(b,copy.id);
   assert.equal(original.pages[0].textElements[0].text,'A concurrent work');assert.equal(saved.pages[0].textElements[0].text,'B concurrent work');assert.notEqual(saved.pages[0].id,original.pages[0].id);
   await run(a);assert.equal((await get(a,copy.id)).pages[0].textElements[0].text,'B concurrent work');await run(a);await run(b);
   assert.equal((await state(b)).notes.filter(n=>n.syncConflictOf==='shared').length,1);
  });
  await check('Open editor waits for Documents while local backup remains current',async()=>{
   await a.evaluate(source=>qa.edit(source),{folders:[],notebooks:[note('shared',4,'A while B is open')]});await run(a);
   await b.evaluate(()=>qa.library.onOpenNotebook('shared',0));await b.waitForFunction(()=>qa.tabs.activeTabId==='shared');
   const before=await get(b,'shared');await run(b);assert.deepEqual(await get(b,'shared'),before);assert.equal((await state(b)).sync.status,'waiting');assert.equal((await state(b)).status.status,'current');
   await b.evaluate(()=>qa.tabs.onGoHome());await b.waitForFunction(()=>qa.tabs.activeTabId===null);await run(b);assert.equal((await get(b,'shared')).pages[0].textElements[0].text,'A while B is open');
  });
  await check('Destination change during receive aborts data and ancestry atomically',async()=>{
   await a.evaluate(source=>qa.edit(source),{folders:[],notebooks:[note('shared',5,'latest A')]});await run(a);
   const before=await get(b,'shared'),journal=(await state(b)).journal;
   await b.evaluate(()=>{qa.gate();qa.pending=qa.run();});await b.waitForFunction(()=>qa.holdRead&&qa.recovery.backupRecovery.getSnapshot().active);
   await b.evaluate(async()=>{await qa.db.saveSetting('gdrive_backup_method',null);qa.releaseRead();});await b.evaluate(()=>qa.pending);
   assert.deepEqual(await get(b,'shared'),before);assert.deepEqual((await state(b)).journal,journal);
   await b.evaluate(()=>qa.db.saveSetting('gdrive_backup_method','desktop'));await run(b);assert.equal((await get(b,'shared')).pages[0].textElements[0].text,'latest A');
  });
  await check('Incomplete source stays untouched while device backup remains current',async()=>{
   const file=path.join(drive,'Full_System/backup_manifest.json'),bytes=await disk.readFile(file),manifest=JSON.parse(bytes);manifest.notebooks.shared.editable.revision='bad';await disk.writeFile(file,JSON.stringify(manifest));
   const incomplete=await disk.readFile(file),before=await get(b,'shared');await run(b);assert.deepEqual(await disk.readFile(file),incomplete);assert.deepEqual(await get(b,'shared'),before);
   assert.equal((await state(b)).sync.status,'pending');assert.equal((await state(b)).status.status,'current');await disk.writeFile(file,bytes);
  });
  await check('Old native bridge never receives unguarded Drive writes',async()=>{
   await b.evaluate(()=>{qa.capabilities=window.electronAPI.getDriveSyncCapabilities;window.electronAPI.getDriveSyncCapabilities=undefined;});
   const before=await disk.readFile(path.join(drive,'Full_System/backup_manifest.json'));assert.equal((await run(b)).success,true);assert.equal((await state(b)).status.status,'current');assert.equal((await state(b)).sync.reason,'drive-sync-restart');assert.deepEqual(await disk.readFile(path.join(drive,'Full_System/backup_manifest.json')),before);
   await b.evaluate(()=>window.electronAPI.getDriveSyncCapabilities=qa.capabilities);
  });

  await check('Idle Drive polling reads metadata only and performs no backup writes',async()=>{
   await run(b);await b.evaluate(()=>{qa.reads=[];qa.native=[];});
   const result=await b.evaluate(()=>qa.run({checkDriveOnly:true}));assert.equal(result.checkOnly,true);
   const observed=await b.evaluate(()=>({reads:qa.reads,actions:qa.native}));assert.equal(observed.reads.length,1);assert.equal(observed.reads[0].syncMode,'preview');assert.deepEqual(observed.actions,[]);
  });
  await check('A local edit during a paused read survives and becomes a conflict copy',async()=>{
   await a.evaluate(source=>qa.edit(source),{folders:[],notebooks:[note('shared',6,'source during pause')]});await run(a);
   await b.evaluate(()=>{qa.gate();qa.pending=qa.run();});await b.waitForFunction(()=>qa.holdRead&&qa.recovery.backupRecovery.getSnapshot().active);
   await b.evaluate(source=>qa.edit(source),{folders:[],notebooks:[note('shared',888,'local during pause')]});await b.evaluate(()=>qa.releaseRead());await b.evaluate(()=>qa.pending);
   assert.equal((await get(b,'shared')).pages[0].textElements[0].text,'source during pause');
   let preserved=false;for(const n of (await state(b)).notes.filter(n=>n.syncConflictOf==='shared'))if((await get(b,n.id)).pages[0].textElements[0].text==='local during pause')preserved=true;assert.equal(preserved,true);
   await run(a);
  });

  await check('A stale local revision aborts both replacement pages and its ancestry receipt',async()=>{
   const before=await get(b,'shared'),journal=(await state(b)).journal;
   const rejected=await b.evaluate(async()=>{
    const current=await qa.db.getBackupNotebookSnapshot('shared');
    const replacement={...current,pages:current.pages.map(p=>({...p,textElements:[{text:'must not install'}]}))};
    try{await qa.db.restoreBackupAtomic({folders:[],notebooks:[replacement]},'stale-sync',{path:await qa.db.getSetting('gdrive_backup_path'),
     expectedRevisions:[{id:'shared',revision:'stale-token'}],settingsUpdates:[{key:'drive_sync_base_v1',value:{bad:true}}]});return false;}
    catch(error){return error.code==='drive-sync-local-changed';}
   });assert.equal(rejected,true);assert.deepEqual(await get(b,'shared'),before);assert.deepEqual((await state(b)).journal,journal);
  });
  await check('Returning to Documents wakes automatic receive without a manual backup',async()=>{
   await a.evaluate(source=>qa.edit(source),{folders:[],notebooks:[note('shared',7,'automatically received')]});await run(a);
   await b.evaluate(()=>qa.library.onOpenNotebook('shared',0));await b.waitForFunction(()=>qa.tabs.activeTabId==='shared');
   await b.evaluate(()=>{qa.backup.driveSync.start(options=>qa.run(options));qa.tabs.onGoHome();});
   await b.waitForFunction(async()=>(await qa.db.getBackupNotebookSnapshot('shared')).pages[0].textElements[0].text==='automatically received');
   await b.evaluate(async()=>{await qa.backup.controller.waitForRunning();qa.backup.driveSync.stop();});
  });
  await check('Prune cannot delete unreceived peer edits from the shared backup',async()=>{
   await a.evaluate(source=>qa.edit(source),{folders:[],notebooks:[note('unrelated',500,'peer work before deletion')]});await run(a);
   const file=path.join(drive,'Full_System/BetterNote_Latest_Backup.json'),before=await disk.readFile(file);
   await b.evaluate(()=>qa.db.deleteNotebook('unrelated'));const result=await b.evaluate(()=>qa.backup.pruneDeletedNotebook('unrelated','unrelated'));
   assert.equal(result.targets.find(t=>t.kind==='drive').error,'drive-sync-pending');assert.deepEqual(await disk.readFile(file),before);assert.equal(await get(b,'unrelated'),null);
  });
  await check('No renderer errors or false cloud-upload confirmation',async()=>{assert.deepEqual(errors,[]);for(const page of pages)assert.equal((await state(page)).status.cloudUploadVerified,false);});
  for(const page of pages)await page.evaluate(()=>{qa.renderer.unmount();qa.backup.stopScheduledSync();});
  console.log(JSON.stringify({passed:passed.length,failed:0,fixture,syntheticOnly:true,realDriveAccess:false}));
 }finally{await reader.close();for(const client of clients)await client.close();await browser?.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});