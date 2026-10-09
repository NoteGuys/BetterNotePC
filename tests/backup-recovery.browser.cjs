// Phase 3.2: real App, IndexedDB and bundled worker; synthetic data only.
const fs=require('node:fs'),disk=fs.promises,path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const {chromium}=require(process.env.BETTERNOTE_PLAYWRIGHT_PATH||'playwright');
const {createBackupReaderClient}=require('../electron/backupReaderClient.cjs');
const {setupRecoveryWorker}=require('./helpers/recovery-worker.cjs');
const root=fs.realpathSync(path.resolve(__dirname,'..')),qaRoot=process.env.BETTERNOTE_QA_TEMP;
if(!qaRoot||!path.isAbsolute(qaRoot))throw Error('Use isolated QA storage.');
const origin='https://betternote-recovery-atomic.invalid/',passed=[];
const note=(id,count=1)=>({id,name:id,updatedAt:40,pageCount:count,coverId:'deep-ocean',pages:Array.from({length:count},(_,index)=>({id:id+'-p'+index,notebookId:id,pageIndex:index,updatedAt:30+index,strokes:[{id:'ink-'+index,points:[{x:-15,y:21},{x:180,y:40}]}],imageElements:[{id:'image',src:'data:image/png;base64,c3ludGhldGlj',x:2,y:3,width:100,height:80,locked:true}],textElements:[{id:'text',text:'Keep me',x:20,y:30}],pdfPageImage:'data:image/png;base64,c3ludGhldGlj',pageWidth:1200,pageHeight:1697,templateId:index===0?'whiteboard':'dotted',whiteboardBounds:{x:-100,y:-80,width:500,height:400}}))});
const seed={folders:[{id:'existing-folder',name:'Original folder'}],notebooks:[note('a',3),note('b')]};
const incoming={folders:[{id:'existing-folder',name:'Restored folder'}],notebooks:[{...note('a'),name:'Restored A',updatedAt:75}]};
const entry=String.raw`
import React from 'react';import{createRoot}from'react-dom/client';import{App}from'./src/App.jsx';
import * as db from './src/services/db.js';import * as files from './src/services/fileSystemService.js';
import * as recovery from './src/services/backupRecoveryService.js';import * as local from './src/services/localSaveService.js';
import{notebookHistoryStore as history}from'./src/services/notebookHistoryService.js';
import{autoBackupService as backup}from'./src/services/autoBackupService.js';import * as lang from './src/services/i18n.js';
import{prepareBackup}from'./electron/backupValidation.js';
window.qa={db,files,recovery,local,history,backup,lang,prepareBackup,alerts:[],native:[],scans:[],closeResults:[],workerResults:0};
window.alert=text=>qa.alerts.push(text);window.confirm=()=>true;
window.electronAPI={isElectron:true,saveBackup:async command=>{qa.native.push(command.action);return command.action==='inspect'?{success:true,targets:[]}:{success:false,reason:'unsupported-environment'};},
scanBackupFolder:async(folder,options)=>{qa.scans.push({folder,options});if(qa.scanGate)await qa.scanGate;return scanBridge(folder,options);},
onCloseSaveRequest:callback=>{qa.closeRequest=callback;return()=>{qa.closeRequest=null;};},onCloseSaveCancelled:()=>()=>{},setLocalSaveGuardReady:()=>{},completeCloseSaveRequest:result=>qa.closeResults.push(result)};
const NativeWorker=window.Worker;
window.Worker=class extends NativeWorker{constructor(...args){super(...args);this.addEventListener('message',event=>{if(event.data?.result){qa.workerResults++;if(qa.dropAck){qa.dropAck=false;event.stopImmediatePropagation();queueMicrotask(()=>this.dispatchEvent(new ErrorEvent('error',{message:'Synthetic crash after commit'})));}}});}};
let renderer;
qa.reset=async source=>{renderer?.unmount();renderer=null;backup.stopScheduledSync();await recovery.backupRecovery.waitForPending();await local.flushLocalSaves({retry:true});history.clear();
 const connection=await db.openDB();await new Promise((resolve,reject)=>{const tx=connection.transaction(['folders','notebooks','pages','settings'],'readwrite');for(const key of ['folders','notebooks','pages','settings'])tx.objectStore(key).clear();tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
 await db.saveSetting('initialDataSeeded',true);await db.restoreBackupAtomic(prepareBackup(source),'qa-seed');
 localStorage.setItem('betternote_open_tabs',JSON.stringify([{id:'a',title:'a',pageIndex:2},{id:'b',title:'b',pageIndex:0}]));localStorage.setItem('betternote_notebook_page_cache',JSON.stringify({a:2,b:0}));
 qa.alerts=[];qa.native=[];qa.scans=[];qa.closeResults=[];qa.scanGate=null;qa.dropAck=false;qa.library=null;lang.setAppLanguage('en');
 renderer=createRoot(document.getElementById('root'));renderer.render(<App/>);};
qa.holdScan=()=>{qa.scanGate=new Promise(resolve=>qa.releaseScan=resolve);};qa.stop=()=>{renderer?.unmount();backup.stopScheduledSync();};
`;
(async()=>{
 const fixture=await disk.mkdtemp(path.join(qaRoot,'betternote-recovery-atomic-')),folder=path.join(fixture,'selected'),file=path.join(folder,'Full_System','BetterNote_Latest_Backup.json');
 await disk.mkdir(path.dirname(file),{recursive:true});const write=async data=>disk.writeFile(file,JSON.stringify(data));await write(incoming);
 const reader=createBackupReaderClient();let browser;const check=async(name,fn)=>{await fn();passed.push(name);console.log('PASS '+name);};
 try{
  const assets=path.join(root,'dist/assets'),cover=fs.readdirSync(assets).find(name=>/^notebookCover\.worker-.*\.js$/.test(name));
  const plugin={name:'qa-recovery-app',setup(build){setupRecoveryWorker(build);
   build.onResolve({filter:/pdf\.worker\.min\.mjs\?url$/},()=>({path:'pdf',namespace:'qa-url'}));build.onLoad({filter:/.*/,namespace:'qa-url'},()=>({contents:"export default '/unused-worker';",loader:'js'}));
   build.onResolve({filter:/notebookCover\.worker\.js\?worker&inline$/},()=>({path:'cover',namespace:'qa-cover'}));build.onLoad({filter:/.*/,namespace:'qa-cover'},()=>({contents:fs.readFileSync(path.join(assets,cover),'utf8'),loader:'js'}));
   build.onLoad({filter:/\.jsx$/},args=>{
    if(args.path.endsWith(path.join('Library','LibraryView.jsx')))return{contents:'export const LibraryView=props=>{window.qa.library=props;return null;};',loader:'jsx'};
    if(args.path.endsWith(path.join('Editor','NoteEditor.jsx')))return{contents:'export const NoteEditor=props=>{window.qa.editor=props;return null;};',loader:'jsx'};
    if(args.path.endsWith(path.join('Common','DocumentTabBar.jsx')))return{contents:'export const DocumentTabBar=props=>{window.qa.tabs=props;return null;};',loader:'jsx'};
   });
  }};
  const bundle=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'jsx',sourcefile:'recovery-qa.jsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},plugins:[plugin],logLevel:'silent'});
  browser=await chromium.launch({headless:true,executablePath:process.env.BETTERNOTE_QA_BROWSER,env:{...process.env,TEMP:qaRoot,TMP:qaRoot}});
  const context=await browser.newContext({viewport:{width:1360,height:900}});await context.route('**/*',route=>route.request().url()===origin?route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><div id="root"></div>'}):route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.exposeFunction('scanBridge',(selected,options)=>{assert.equal(path.resolve(selected),path.resolve(folder));return reader.execute({folderPath:selected,previewOnly:options?.previewOnly===true});});
  await page.goto(origin);await page.addStyleTag({content:fs.readFileSync(path.join(root,'src/index.css'),'utf8')});await page.addScriptTag({content:bundle.outputFiles[0].text});
  const reset=async()=>{await page.evaluate(source=>qa.reset(source),seed);await page.waitForFunction(()=>qa.library&&qa.closeRequest);await page.evaluate(()=>qa.backup.stopScheduledSync());};
  const state=()=>page.evaluate(async()=>({folders:await qa.db.getAllFolders(),notes:await qa.db.getAllNotebooks(),a:await qa.db.getBackupNotebookSnapshot('a'),b:await qa.db.getBackupNotebookSnapshot('b'),receipt:await qa.db.getBackupRecoveryReceipt(),contentBase:await qa.db.getSetting('backup_restore_content_base_v1')}));
  await check('Folder recovery updates rich content and removes old pages without reloading App',async()=>{
   await reset();const prior=await state(),time=await page.evaluate(()=>performance.timeOrigin);await page.evaluate(()=>{qa.history.forNotebook('a').append({id:'old-a'});qa.history.forNotebook('b').append({id:'old-b'});});
   const result=await page.evaluate(folder=>qa.backup.restoreFromCloudBackup(folder),folder);assert.equal(result.success,true);const after=await state();
   assert.equal(after.a.name,'Restored A');assert.equal(after.a.pageCount,1);assert.deepEqual(after.a.pages,incoming.notebooks[0].pages);assert.equal(after.a.updatedAt,75);assert.deepEqual(after.b,prior.b);
   await page.waitForFunction(()=>qa.library.notebooks.some(n=>n.name==='Restored A'));assert.equal(await page.evaluate(()=>performance.timeOrigin),time);
   assert.deepEqual(await page.evaluate(()=>[qa.history.forNotebook('a').getSnapshot().stack.length,qa.history.forNotebook('b').getSnapshot().stack.length]),[0,1]);
   assert.deepEqual(await page.evaluate(()=>qa.tabs.tabs.map(t=>({id:t.id,title:t.title,pageIndex:t.pageIndex}))),[{id:'a',title:'Restored A',pageIndex:0},{id:'b',title:'b',pageIndex:0}]);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('betternote_notebook_page_cache')).a),0);assert.equal(after.a.pages[0].imageElements[0].locked,true);
  });
  await check('Late page-ID conflict rolls back all folders, notes, deleted pages and prior writes',async()=>{
   await reset();const before=await state();await write({folders:incoming.folders,notebooks:[incoming.notebooks[0],{...note('new'),pages:[{...note('new').pages[0],id:'b-p0'}]}]});const bytes=await disk.readFile(file,'utf8');
   await page.evaluate(()=>qa.history.forNotebook('a').append({id:'kept'}));const result=await page.evaluate(folder=>qa.backup.restoreFromCloudBackup(folder),folder);
   assert.equal(result.success,false);assert.equal(result.reason,'backup-recovery-id-conflict');assert.deepEqual(await state(),before);assert.equal(await disk.readFile(file,'utf8'),bytes);assert.equal(await page.evaluate(()=>qa.history.forNotebook('a').getSnapshot().stack.length),1);
  });
  await check('Native IndexedDB abort after request success rolls back the complete restore',async()=>{
   await reset();const before=await state();const result=await page.evaluate(async input=>{const connection=await qa.db.openDB(),original=connection.transaction.bind(connection);let aborted=false;
    connection.transaction=(...args)=>{const tx=original(...args),get=tx.objectStore.bind(tx);tx.objectStore=name=>{const store=get(name);if(name==='pages'&&args[1]==='readwrite'){const put=store.put.bind(store);store.put=value=>{const request=put(value);if(!aborted){aborted=true;request.addEventListener('success',()=>tx.abort(),{once:true});}return request;};}return store;};return tx;};
    try{await qa.db.restoreBackupAtomic(qa.prepareBackup(input),'should-rollback');return false;}catch(_){return aborted;}finally{connection.transaction=original;}
   },incoming);assert.equal(result,true);assert.deepEqual(await state(),before);
  });
  await check('Invalid JSON cannot mutate the database and uses all four selected languages',async()=>{
   await reset();const before=await state();for(const language of ['en','th','zh','ru']){await page.evaluate(async language=>{qa.lang.setAppLanguage(language);await qa.library.onImportBackup(new File(['{"notebooks":[{"id":"a","pages":[]}]}'],'broken.json'));},language);
    assert.equal(await page.evaluate(()=>qa.alerts.at(-1)),await page.evaluate(()=>qa.lang.t('backupReadInvalid')));assert.deepEqual(await state(),before);}
  });
  await check('Manual JSON is parsed in the local worker and refreshes the real App',async()=>{
   await reset();await page.evaluate(async input=>{const file=new File([JSON.stringify(input)],'restore.json');file.text=()=>{throw Error('UI must not parse this file');};await qa.library.onImportBackup(file);},incoming);
   assert.equal((await state()).a.name,'Restored A');assert.equal(await page.evaluate(()=>qa.alerts.at(-1)),await page.evaluate(()=>qa.lang.t('backupReadRestored','',{count:2})));
  });
  await check('Recovery blocks navigation and closing waits for commit and refresh',async()=>{
   await reset();await write(incoming);await page.evaluate(folder=>{qa.holdScan();qa.restoreJob=qa.backup.restoreFromCloudBackup(folder);},folder);await page.waitForFunction(()=>qa.scans.length===1);
   await page.locator('.bn-app-root [inert]').waitFor({state:'attached'});assert.equal(await page.locator('.bn-app-root [inert]').count(),1);await page.getByRole('status').filter({hasText:'Keep BetterNote open'}).waitFor();await page.screenshot({path:path.join(fixture,'recovery-progress.png')});
   await page.evaluate(()=>{qa.closeJob=qa.closeRequest({requestId:'close-during-restore'});});await page.waitForTimeout(60);assert.equal(await page.evaluate(()=>qa.closeResults.length),0);
   await page.evaluate(()=>qa.releaseScan());const result=await page.evaluate(async()=>{const result=await qa.restoreJob;await qa.closeJob;return result;});assert.equal(result.success,true);assert.equal(await page.evaluate(()=>qa.closeResults[0].success),true);assert.equal((await state()).a.name,'Restored A');
  });
  await check('Second recovery and manual backup cannot run within a restore',async()=>{
   await reset();await page.evaluate(folder=>{qa.holdScan();qa.restoreJob=qa.backup.restoreFromCloudBackup(folder);},folder);await page.waitForFunction(()=>qa.scans.length===1);const count=await page.evaluate(()=>qa.native.length);
   assert.equal((await page.evaluate(folder=>qa.backup.restoreFromCloudBackup(folder),folder)).reason,'backup-recovery-busy');assert.equal((await page.evaluate(()=>qa.backup.runAutoBackup())).reason,'backup-recovery-busy');assert.equal(await page.evaluate(()=>qa.native.length),count);
   await page.evaluate(()=>qa.releaseScan());assert.equal((await page.evaluate(()=>qa.restoreJob)).success,true);
  });
  await check('Worker failure after commit is confirmed using the atomic receipt',async()=>{
   await reset();await page.evaluate(()=>qa.dropAck=true);const result=await page.evaluate(folder=>qa.backup.restoreFromCloudBackup(folder),folder);assert.equal(result.success,true);assert.equal((await state()).a.name,'Restored A');assert.equal(await page.evaluate(()=>qa.recovery.backupRecovery.getSnapshot().active),false);
  });
  await check('Unsaved handwriting blocks import and stays queued for retry',async()=>{
   await reset();const before=await state();await page.evaluate(async()=>{const connection=await qa.db.openDB(),original=connection.transaction.bind(connection);qa.restoreTransaction=()=>connection.transaction=original;
    connection.transaction=(...args)=>{const tx=original(...args);if(args[1]==='readwrite'&&[...tx.objectStoreNames].includes('pages')){const get=tx.objectStore.bind(tx);tx.objectStore=name=>{const store=get(name);if(name==='pages'){const put=store.put.bind(store);store.put=value=>{const request=put(value);request.addEventListener('success',()=>tx.abort(),{once:true});return request;};}return store;};}return tx;};
    const page=(await qa.db.getBackupNotebookSnapshot('a')).pages[0];try{await qa.local.pageSaveQueue.enqueue({...page,strokes:[{points:[{x:44,y:55}]}]});}catch(_){}
   });const result=await page.evaluate(folder=>qa.backup.restoreFromCloudBackup(folder),folder);assert.equal(result.reason,'backup-recovery-unsaved');assert.deepEqual(await state(),before);assert.equal(await page.evaluate(()=>qa.scans.length),0);assert.equal(await page.evaluate(()=>qa.local.getLocalSaveSnapshot().status),'error');
   await page.evaluate(async()=>{qa.restoreTransaction();await qa.local.flushLocalSaves({retry:true});});assert.equal((await state()).a.pages[0].strokes[0].points[0].x,44);
  });
  await check('Open editor cannot be replaced until the user returns to Documents',async()=>{
   await reset();await page.evaluate(()=>qa.library.onOpenNotebook('a',0));await page.waitForFunction(()=>qa.tabs.activeTabId==='a');const before=await state();
   const result=await page.evaluate(folder=>qa.backup.restoreFromCloudBackup(folder),folder);assert.equal(result.reason,'backup-recovery-editor-open');assert.equal(await page.evaluate(()=>qa.scans.length),0);assert.deepEqual(await state(),before);
   await page.evaluate(()=>qa.tabs.onGoHome());await page.waitForFunction(()=>qa.tabs.activeTabId===null);assert.equal((await page.evaluate(folder=>qa.backup.restoreFromCloudBackup(folder),folder)).success,true);
  });
  await check('Valid page reordering preserves timestamps without unique-index collisions',async()=>{
   await reset();const reversed={folders:[],notebooks:[{...seed.notebooks[0],pages:[...seed.notebooks[0].pages].reverse().map((p,i)=>({...p,pageIndex:i}))}]};
   await page.evaluate(input=>qa.files.restoreFullBackup(input),reversed);const after=await state();assert.deepEqual(after.a.pages,reversed.notebooks[0].pages);assert.equal(after.a.updatedAt,40);
  });
  await check('Refresh failure reports restored data with a refresh warning',async()=>{
   await reset();await page.evaluate(()=>{qa.refreshGate=new Promise(resolve=>qa.releaseRefresh=resolve);qa.offSlowRefresh=qa.recovery.subscribeBackupRestored(()=>qa.refreshGate);qa.offBadRefresh=qa.recovery.subscribeBackupRestored(()=>{throw Error('Synthetic refresh failure');});});
   await page.evaluate(folder=>{qa.restoreDone=false;qa.restoreJob=qa.backup.restoreFromCloudBackup(folder).then(result=>{qa.restoreDone=true;return result;});},folder);
   await page.waitForFunction(()=>qa.recovery.backupRecovery.getSnapshot().phase==='refreshing');await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>qa.restoreDone),false);
   await page.evaluate(()=>qa.releaseRefresh());const result=await page.evaluate(()=>qa.restoreJob);assert.equal(result.success,true);assert.equal(result.refreshFailed,true);assert.equal((await state()).a.name,'Restored A');await page.evaluate(()=>{qa.offBadRefresh();qa.offSlowRefresh();});
  });
  await check('Backup settings and unrelated notebooks are retained during recovery',async()=>{
   await reset();await page.evaluate(()=>qa.db.saveSetting('local_backup_path','synthetic-preference'));await page.evaluate(input=>qa.files.restoreFullBackup({...input,settings:{local_backup_path:'not-imported'}}),incoming);
   assert.equal(await page.evaluate(()=>qa.db.getSetting('local_backup_path')),'synthetic-preference');assert.ok((await state()).b);
  });
  await check('Production recovery worker persists data from a local file origin with network disabled',async()=>{
   const offlineFile=path.join(fixture,'offline-recovery.html');await disk.writeFile(offlineFile,'<!doctype html><div id="root"></div>');
   const isolated=await browser.newContext();const offline=await isolated.newPage();offline.on('pageerror',error=>errors.push(error.message));
   try{
    await isolated.route('http*://**/*',route=>route.abort());await offline.goto(require('node:url').pathToFileURL(offlineFile).href);await offline.addScriptTag({content:bundle.outputFiles[0].text});
    await offline.evaluate(source=>qa.reset(source),seed);await offline.waitForFunction(()=>qa.library);await offline.evaluate(()=>qa.backup.stopScheduledSync());
    const result=await offline.evaluate(input=>qa.files.restoreFullBackup(input),incoming);assert.equal(result.notebooksCount,2);assert.equal(await offline.evaluate(async()=>(await qa.db.getAllNotebooks()).filter(n=>n.syncConflictOf==='a').length),1);
    assert.equal(await offline.evaluate(async()=>(await qa.db.getBackupNotebookSnapshot('a')).name),'Restored A');await offline.evaluate(()=>qa.stop());
    await offline.reload();await offline.addScriptTag({content:bundle.outputFiles[0].text});
    assert.equal(await offline.evaluate(async()=>(await qa.db.getBackupNotebookSnapshot('a')).name),'Restored A');
   }finally{await isolated.close();}
  });
  await check('Unconfirmed commit holds stale editing but permits the normal close-and-reopen path',async()=>{
   await reset();
   await page.evaluate(async()=>{const connection=await qa.db.openDB(),original=connection.transaction.bind(connection);qa.restoreReceiptRead=()=>connection.transaction=original;qa.dropAck=true;
    connection.transaction=(...args)=>{if(args[0]==='settings'&&args[1]==='readonly')throw Error('Synthetic unavailable receipt');return original(...args);};
   });
   const result=await page.evaluate(folder=>qa.backup.restoreFromCloudBackup(folder),folder);assert.equal(result.success,false);assert.equal(result.reason,'backup-recovery-unconfirmed');
   assert.equal(await page.evaluate(()=>qa.recovery.backupRecovery.getSnapshot().phase),'unconfirmed');
   assert.equal(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}),false);
   await page.evaluate(()=>qa.closeRequest({requestId:'close-unconfirmed'}));assert.equal(await page.evaluate(()=>qa.closeResults.at(-1).success),true);
   await page.evaluate(()=>qa.restoreReceiptRead());assert.equal((await state()).a.name,'Restored A');
   assert.equal((await page.evaluate(()=>qa.backup.runAutoBackup())).reason,'backup-recovery-busy');
  });
  await check('Recovery produces no renderer errors',async()=>assert.deepEqual(errors,[]));
  await page.evaluate(()=>qa.stop());console.log(JSON.stringify({passed:passed.length,failed:0,fixture,syntheticDataOnly:true,realDriveAccess:false}));
 }finally{await reader.close();await browser?.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
