// Focused Phase 3.4 performance check using Electron's real preload/IPC, not an automation data bridge.
const fs=require('node:fs'),disk=fs.promises,path=require('node:path'),assert=require('node:assert/strict');
const esbuild=require('esbuild'),{pathToFileURL}=require('node:url');
const {_electron}=require(process.env.BETTERNOTE_PLAYWRIGHT_PATH||'playwright');
const {setupRecoveryWorker}=require('./helpers/recovery-worker.cjs');
const root=fs.realpathSync(path.resolve(__dirname,'..')),qaRoot=process.env.BETTERNOTE_QA_TEMP;
if(!qaRoot||!path.isAbsolute(qaRoot)||process.env.BETTERNOTE_QA_BUILT_WORKER!=='1')throw Error('Use isolated QA storage and production workers');
const entry=String.raw`
import React from'react';import{createRoot}from'react-dom/client';import{App}from'./src/App.jsx';
import*as db from'./src/services/db.js';import{autoBackupService as backup}from'./src/services/autoBackupService.js';
import{prepareBackup}from'./electron/backupValidation.js';import{syncContent}from'./electron/backupSyncProtocol.js';
window.qa={db,backup,alerts:[]};window.alert=message=>qa.alerts.push(message);window.confirm=()=>true;
const getAll=IDBObjectStore.prototype.getAll;IDBObjectStore.prototype.getAll=function(...args){if(this.name==='pages')throw Error('Forbidden whole-pages-store load');return getAll.apply(this,args);};
qa.seed=async({local,drive,large})=>{await db.saveSetting('initialDataSeeded',true);await db.saveSetting('local_backup_path',local);
 await db.saveSetting('gdrive_backup_method','desktop');await db.saveSetting('gdrive_backup_path',drive);
 if(large){const pages=Array.from({length:24},(_,i)=>({id:'native-p'+i,notebookId:'native-large',pageIndex:i,templateId:'dotted',pageWidth:480,pageHeight:620,updatedAt:20,
 strokes:[{id:'s'+i,tool:'pen',color:'#2563eb',width:2,points:Array.from({length:6000},(_,j)=>({x:20+(j%400),y:20+(j%500),pressure:.5}))}],textElements:[],imageElements:[]}));
 const note={id:'native-large',name:'Native IPC synthetic course',folderId:null,pageCount:24,templateId:'dotted',coverId:'deep-ocean',updatedAt:20,pages};
 qa.payloadBytes=new TextEncoder().encode(JSON.stringify(note)).byteLength;await db.restoreBackupAtomic(prepareBackup({folders:[],notebooks:[note]}),'native-qa-seed');}
 qa.renderer=createRoot(document.getElementById('root'));qa.renderer.render(<App/>);};
qa.measure=()=>{qa.measureData={started:performance.now(),ticks:0,maxGap:0,longTasks:[]};let prior=performance.now();
 qa.timer=setInterval(()=>{const now=performance.now();qa.measureData.ticks++;qa.measureData.maxGap=Math.max(qa.measureData.maxGap,now-prior);prior=now;},20);
 qa.observer=new PerformanceObserver(list=>qa.measureData.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration}))));qa.observer.observe({type:'longtask'});};
qa.endMeasure=()=>{clearInterval(qa.timer);qa.observer.disconnect();return{...qa.measureData,duration:performance.now()-qa.measureData.started};};
qa.hash=async()=>{const note=await db.getBackupNotebookSnapshot('native-large');if(!note)return null;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(syncContent(note)));return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');};
`;
(async()=>{
 const fixture=await disk.mkdtemp(path.join(qaRoot,'betternote-native-migration-')),drive=path.join(fixture,'shared'),apps=[],errors=[],passed=[],metrics={};
 let timeout;const watchdog=new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Native migration test exceeded three minutes')),180000);});
 const work=async()=>{
  const assets=path.join(root,'dist/assets'),files=await disk.readdir(assets),cover=files.find(n=>/^notebookCover\.worker-.*\.js$/.test(n));
  const pdf=files.find(n=>/^pdf\.worker\.min-.*\.mjs$/.test(n));assert.ok(cover&&pdf);
  const plugin={name:'native-migration',setup(build){setupRecoveryWorker(build);
   build.onResolve({filter:/notebookCover\.worker\.js\?worker&inline$/},()=>({path:'cover',namespace:'qa-cover'}));
   build.onLoad({filter:/.*/,namespace:'qa-cover'},()=>({contents:fs.readFileSync(path.join(assets,cover),'utf8'),loader:'js'}));
   build.onResolve({filter:/pdf\.worker\.min\.mjs\?url$/},()=>({path:'pdf',namespace:'qa-url'}));
   build.onLoad({filter:/.*/,namespace:'qa-url'},()=>({contents:'export default '+JSON.stringify(pathToFileURL(path.join(assets,pdf)).href),loader:'js'}));
   build.onResolve({filter:/^qa-original:/},args=>({path:args.path.slice(12),namespace:'qa-original'}));
   build.onLoad({filter:/.*/,namespace:'qa-original'},args=>({contents:fs.readFileSync(args.path,'utf8'),loader:'jsx',resolveDir:path.dirname(args.path)}));
   build.onLoad({filter:/LibraryView\.jsx$/},args=>({contents:'import React from"react";import{LibraryView as Actual}from '+JSON.stringify('qa-original:'+args.path)+';export const LibraryView=props=>{qa.library=props;return React.createElement(Actual,props);};',loader:'jsx',resolveDir:path.dirname(args.path)}));
  }};
  await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'jsx',sourcefile:'native-migration.jsx'},bundle:true,outfile:path.join(fixture,'app.js'),
   platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},plugins:[plugin],logLevel:'silent'});
  await disk.copyFile(path.join(root,'electron/preload.cjs'),path.join(fixture,'preload.cjs'));
  await disk.writeFile(path.join(fixture,'index.html'),'<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="'+pathToFileURL(path.join(root,'src/index.css')).href+'"><div id="root"></div><script src="app.js"></script>');
  const main=String.raw`
const{app,BrowserWindow,ipcMain}=require('electron'),path=require('node:path'),assert=require('node:assert/strict');
const config=JSON.parse(process.argv.at(-1));for(const value of[config.profile,config.local,config.drive])assert.ok(path.resolve(value).startsWith(config.fixture+path.sep));
app.setPath('userData',config.profile);app.setPath('sessionData',path.join(config.profile,'session'));
const{createBackupWorkerClient}=require(path.join(config.root,'electron/backupWorkerClient.cjs'));
const{createBackupReaderClient}=require(path.join(config.root,'electron/backupReaderClient.cjs'));
const writer=createBackupWorkerClient({localDir:config.local}),reader=createBackupReaderClient();global.qaTelemetry={reads:[],actions:[],preloadErrors:[]};let win;
app.whenReady().then(async()=>{
 win=new BrowserWindow({show:false,width:1440,height:1000,webPreferences:{preload:path.join(config.fixture,'preload.cjs'),nodeIntegration:false,contextIsolation:true,webSecurity:false}});
 win.webContents.on('preload-error',(_,file,error)=>global.qaTelemetry.preloadErrors.push(error.message));
 win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_,done)=>done({cancel:true}));
 const trusted=event=>assert.equal(event.senderFrame,win.webContents.mainFrame);
 ipcMain.handle('drive-sync-capabilities',event=>{trusted(event);return{protocol:1};});
 ipcMain.handle('save-auto-backup',(event,command)=>{trusted(event);for(const folder of[command.localBackupPath,command.driveBackupPath].filter(Boolean))assert.ok(folder===config.local||folder===config.drive);
  global.qaTelemetry.actions.push(command.action);return writer.execute(command,progress=>{if(!win.isDestroyed())win.webContents.send('backup-progress',progress);});});
 ipcMain.handle('scan-backup-folder',(event,folder,options)=>{trusted(event);assert.equal(folder,config.drive);global.qaTelemetry.reads.push(options?.syncMode||'discovery');return reader.execute({folderPath:folder,...options});});
 app.on('window-all-closed',()=>app.quit());await win.loadFile(path.join(config.fixture,'index.html'));
});
app.on('will-quit',()=>{writer.close();reader.close();});
`;
  const mainFile=path.join(fixture,'main.cjs');await disk.writeFile(mainFile,main);
  const launch=async name=>{const profile=path.join(fixture,'profile-'+name),local=path.join(fixture,'local-'+name);await disk.mkdir(profile,{recursive:true});
   const env={...process.env,TEMP:qaRoot,TMP:qaRoot,NODE_DISABLE_COMPILE_CACHE:'1'};delete env.ELECTRON_RUN_AS_NODE;
   const application=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[mainFile,JSON.stringify({root,fixture,profile,local,drive})],env,timeout:30000});apps.push(application);
   const page=await application.firstWindow();page.on('pageerror',e=>errors.push(name+': '+e.message));await page.waitForFunction(()=>window.qa);
   if(!await page.evaluate(()=>!!window.electronAPI)){await page.reload();await page.waitForFunction(()=>window.qa);}
   const api=await page.evaluate(()=>({present:!!window.electronAPI,keys:Object.keys(window.electronAPI||{})}));if(!api.present)throw Error('Native preload unavailable: '+JSON.stringify(await application.evaluate(({BrowserWindow})=>({telemetry:global.qaTelemetry,windows:BrowserWindow.getAllWindows().map(w=>({url:w.webContents.getURL(),preload:w.webContents.getLastWebPreferences().preload,preferences:w.webContents.getLastWebPreferences(),version:process.versions.electron}))}))));
   assert.equal(await page.evaluate(async()=>(await window.electronAPI.getDriveSyncCapabilities()).protocol),1);
   return{application,page,profile,local};};
  const seed=async(d,large)=>{await d.page.evaluate(paths=>qa.seed(paths),{local:d.local,drive,large});await d.page.waitForFunction(()=>qa.library);await d.page.evaluate(()=>qa.backup.stopScheduledSync());};
  const check=async(name,fn)=>{console.log('CHECK '+name);await fn();passed.push(name);console.log('PASS '+name);};
  const a=await launch('A');await seed(a,true);metrics.payloadBytes=await a.page.evaluate(()=>qa.payloadBytes);let b;let sourceHash;
  await check('Native preload and writer publish a synthetic 24-page notebook through actual IPC',async()=>{const result=await a.page.evaluate(()=>qa.backup.runAutoBackup({notebookIds:[]}));assert.equal(result.success,true,JSON.stringify(result));sourceHash=await a.page.evaluate(()=>qa.hash());await a.page.evaluate(()=>{qa.backup.stopScheduledSync();qa.renderer.unmount();});await a.application.close();});
  b=await launch('B');await seed(b,false);
  await check('Native receiver uses typed binary IPC and restores identical writing without an automation data bridge',async()=>{
   const session=await b.page.context().newCDPSession(b.page);await session.send('Profiler.enable');await session.send('Profiler.start');
   await b.page.evaluate(()=>qa.measure());const result=await b.page.evaluate(()=>qa.backup.runAutoBackup({notebookIds:[]}));metrics.receiveAndSave=await b.page.evaluate(()=>qa.endMeasure());
   const {profile}=await session.send('Profiler.stop');await disk.writeFile(path.join(fixture,'receive-cpu-profile.json'),JSON.stringify(profile));
   const nodes=new Map(profile.nodes.map(n=>[n.id,n.callFrame])),hot=new Map();profile.samples.forEach((id,i)=>{const node=nodes.get(id),key=node.functionName||('(anonymous) '+node.url.split('/').at(-1)+':'+(node.lineNumber+1));hot.set(key,(hot.get(key)||0)+(profile.timeDeltas[i]||0)/1000);});
   metrics.receiveHotFunctions=Array.from(hot,([name,sampledMs])=>({name,sampledMs})).sort((a,b)=>b.sampledMs-a.sampledMs).slice(0,10);await session.detach();
   assert.equal(result.success,true,JSON.stringify(result));assert.equal(await b.page.evaluate(()=>qa.hash()),sourceHash);
   assert.ok(metrics.receiveAndSave.ticks>0);assert.ok(metrics.receiveAndSave.maxGap<150);assert.equal((await b.page.evaluate(()=>qa.backup.getSnapshot())).cloudUploadVerified,false);
  });
  await check('Native PDF backup is measured separately after the editable data is confirmed',async()=>{
   await b.page.evaluate(()=>qa.measure());const result=await b.page.evaluate(()=>qa.backup.runAutoBackup());metrics.pdfBackup=await b.page.evaluate(()=>qa.endMeasure());
   assert.equal(result.success,true,JSON.stringify(result));assert.equal((await b.page.evaluate(()=>qa.backup.getSnapshot())).allPdfsCurrent,true);assert.ok(metrics.pdfBackup.maxGap<150);
  });
  await check('Native receiver remains on disk after closing Electron and relaunching its isolated profile',async()=>{
   const hash=await b.page.evaluate(()=>qa.hash());await b.page.evaluate(()=>{qa.backup.stopScheduledSync();qa.renderer.unmount();});await b.application.close();
   const reopened=await launch('B');b=reopened;assert.equal(await reopened.page.evaluate(()=>qa.hash()),hash);assert.equal(await reopened.page.evaluate(async()=>(await qa.db.getBackupNotebookSnapshot('native-large')).pages.length),24);
  });
  await check('Native idle sync reads only metadata and performs no disk writes',async()=>{
   await b.application.evaluate(()=>{global.qaTelemetry={reads:[],actions:[]};});await b.page.evaluate(()=>qa.backup.runAutoBackup({checkDriveOnly:true}));
   const seen=await b.application.evaluate(()=>global.qaTelemetry);assert.deepEqual(seen.actions,[]);assert.deepEqual(seen.reads.filter(x=>x!=='discovery'),['preview']);
  });
  await check('Native renderer has no unhandled errors',async()=>assert.deepEqual(errors,[]));
  const report={passed:passed.length,failed:0,fixture,metrics,syntheticOnly:true,realDriveAccess:false,realElectron:true,actualPreload:true,offlineFileOrigin:true};
  await disk.writeFile(path.join(fixture,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 };
 try{await Promise.race([work(),watchdog]);}finally{clearTimeout(timeout);for(const application of apps)await application.close().catch(()=>{});}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
