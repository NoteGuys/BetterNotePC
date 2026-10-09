// Phase 3.4: real App/editor, production offline workers and persistent synthetic devices.
// All fixtures live in BETTERNOTE_QA_TEMP. No installed BetterNote profile is opened.
const fs = require('node:fs'), disk = fs.promises, path = require('node:path');
const assert = require('node:assert/strict'), {pathToFileURL} = require('node:url');
const esbuild = require('esbuild'), {jsPDF} = require('jspdf');
const {chromium} = require(process.env.BETTERNOTE_PLAYWRIGHT_PATH || 'playwright');
const {createBackupReaderClient} = require('../electron/backupReaderClient.cjs');
const {createBackupWorkerClient} = require('../electron/backupWorkerClient.cjs');
const {setupRecoveryWorker} = require('./helpers/recovery-worker.cjs');
const root = fs.realpathSync(path.resolve(__dirname, '..')), qaRoot = process.env.BETTERNOTE_QA_TEMP;
if (!qaRoot || !path.isAbsolute(qaRoot)) throw Error('An isolated QA directory is required');
if (process.env.BETTERNOTE_QA_BUILT_WORKER !== '1') throw Error('Build production workers before this check');
const passed = [], metrics = {}, errors = [];
const entry = "const qaEncodeBackupCommand = " + require('./helpers/recovery-worker.cjs').encodeBinaryCommand.toString() + ";" + String.raw`
import React from 'react'; import {createRoot} from 'react-dom/client'; import {App} from './src/App.jsx';
import * as db from './src/services/db.js'; import * as local from './src/services/localSaveService.js';
import {autoBackupService as backup} from './src/services/autoBackupService.js';
import * as recovery from './src/services/backupRecoveryService.js'; import * as lang from './src/services/i18n.js';
import {prepareBackup} from './electron/backupValidation.js'; import {syncContent} from './electron/backupSyncProtocol.js';
window.qa = {db, local, backup, recovery, lang, prepareBackup, syncContent, boards:new Map(), alerts:[], actions:[], reads:[]};
window.alert = message => qa.alerts.push(message); window.confirm = () => true;
const getAll = IDBObjectStore.prototype.getAll;
IDBObjectStore.prototype.getAll = function(...args) {if(this.name === 'pages') throw Error('A migration must not load the entire pages store');return getAll.apply(this,args);};
window.electronAPI = {isElectron:true, getDriveSyncCapabilities:async()=>({protocol:1}),
 saveBackup:async command=>{qa.actions.push(command.action);return writeBridge(JSON.stringify(await qaEncodeBackupCommand(command)));},
 scanBackupFolder:async(folder,options)=>{qa.reads.push(options);if(qa.holdRead && options?.syncMode === 'note') await qa.readGate;
  const result=await readBridge(folder,options);if(result.encodedBase64){const raw=atob(result.encodedBase64);result.encoded=Uint8Array.from(raw,x=>x.charCodeAt(0));delete result.encodedBase64;}return result;},
 onCloseSaveRequest:f=>{qa.closeRequest=f;return()=>{qa.closeRequest=null;};},onCloseSaveCancelled:()=>()=>{},
 setLocalSaveGuardReady:()=>{},completeCloseSaveRequest:r=>qa.closeResults.push(r),onBackupProgress:()=>()=>{},
 openExternal:async()=>({success:true}),openBackupFolder:async()=>({success:true})};
qa.closeResults=[];
qa.setup=async(paths,source)=>{await db.saveSetting('initialDataSeeded',true);if(source)await db.restoreBackupAtomic(prepareBackup(source),'seed');
 await db.saveSetting('local_backup_path',paths.local);await db.saveSetting('gdrive_backup_method','desktop');await db.saveSetting('gdrive_backup_path',paths.drive);};
qa.mount=()=>{qa.lang.setAppLanguage('en');qa.renderer=createRoot(document.getElementById('root'));qa.renderer.render(<App/>);};
qa.stop=()=>{qa.backup.stopScheduledSync();qa.renderer?.unmount();};
qa.run=options=>backup.runAutoBackup(options);
qa.state=async()=>({metadata:await db.getBackupMetadata(),journal:await db.getSetting('drive_sync_base_v1'),device:await db.getSetting('drive_sync_device_id'),sync:backup.getDriveSyncSnapshot(),status:backup.getSnapshot()});
qa.hash=async id=>{const value=await db.getBackupNotebookSnapshot(id);if(!value)return null;
 const bytes=new TextEncoder().encode(syncContent(value));const hash=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');};
qa.source=pdf=>{const canvas=document.createElement('canvas');canvas.width=120;canvas.height=160;const c=canvas.getContext('2d');
 c.fillStyle='#fff';c.fillRect(0,0,120,160);c.fillStyle='#16a34a';c.fillRect(20,30,50,60);const image=canvas.toDataURL();
 const stroke=(id,x=40)=>({id,tool:'pen',color:'#ef4444',width:4,points:[{x,y:45,pressure:.5},{x:x+70,y:90,pressure:.7}]});
 const make=(id,count,templateId)=>({id,name:id==='whiteboard'?'Board':'Same notebook name',folderId:id==='whiteboard'?'parent':'child',
  pageCount:count,templateId,coverId:'thumbnail',isFavorite:true,createdAt:10,updatedAt:20,...(id==='pdf'?{pdfBase64:pdf,pdfFileName:'QA-source.pdf'}:{}),
  pages:Array.from({length:count},(_,i)=>({id:id+'-p'+i,notebookId:id,pageIndex:i,templateId,pageWidth:480,pageHeight:620,createdAt:10,updatedAt:20,
   isFavorite:i===1,strokes:[stroke(id+'-ink'+i,templateId==='whiteboard'?-100:40)],
   textElements:[{id:id+'-text'+i,text:'Migration ทดสอบ '+i,x:20,y:150,fontSize:18,color:'#111827',width:240,height:30}],
   imageElements:[{id:id+'-image'+i,src:image,x:30,y:220,width:90,height:120,locked:true}],
   ...(id==='pdf'?{pdfPageImage:image,pdfPageIndex:i}:{} )}))});
 return {folders:[{id:'parent',name:'Teaching',parentId:null,color:'#2563eb',createdAt:10,updatedAt:20},
 {id:'child',name:'Engineering',parentId:'parent',color:'#16a34a',createdAt:10,updatedAt:20}],notebooks:[make('written',3,'dotted'),make('pdf',2,'blank'),make('whiteboard',1,'whiteboard')]};};
qa.editText=async(id,text)=>{const p=await db.getPage(id);await db.savePage({...p,textElements:[{...p.textElements[0],text}]});};
qa.gate=()=>{qa.holdRead=true;qa.readGate=new Promise(resolve=>qa.releaseRead=()=>{qa.holdRead=false;resolve();});};
qa.measure=()=>{qa.measureData={ticks:0,maxGap:0,longTasks:[],started:performance.now()};let prev=performance.now();
 qa.measureTimer=setInterval(()=>{const now=performance.now();qa.measureData.ticks++;qa.measureData.maxGap=Math.max(qa.measureData.maxGap,now-prev);prev=now;},20);
 qa.observer=new PerformanceObserver(list=>qa.measureData.longTasks.push(...list.getEntries().map(x=>({start:x.startTime,duration:x.duration}))));qa.observer.observe({type:'longtask'});};
qa.endMeasure=()=>{clearInterval(qa.measureTimer);qa.observer.disconnect();return {...qa.measureData,duration:performance.now()-qa.measureData.started};};
`;
(async()=>{
 const fixture=await disk.mkdtemp(path.join(qaRoot,'betternote-migration-'));
 const drive=path.join(fixture,'shared'),html=path.join(fixture,'offline.html'),reader=createBackupReaderClient();
 const devices=[],check=async(name,fn)=>{console.log('CHECK '+name);let timer;try{await Promise.race([fn(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Timed out: '+name)),120000);})]);passed.push(name);console.log('PASS '+name);}finally{clearTimeout(timer);}};
 try {
  const assets=path.join(root,'dist/assets'),files=await disk.readdir(assets);
  const cover=files.find(n=>/^notebookCover\.worker-.*\.js$/.test(n));
  const pdfWorker=files.find(n=>/^pdf\.worker\.min-.*\.mjs$/.test(n));assert.ok(cover&&pdfWorker,'Production workers required');
  const captures=new Map([
   ['Editor/CanvasBoard','qa.boards.set(props.page.id,props)'],['Editor/WhiteboardBoard','qa.boards.set(props.page.id,props)'],
   ['Editor/EditorToolbar','qa.toolbar=props'],['Editor/ThumbnailSidebar','qa.thumbnails=props'],
   ['Editor/PageNavigation','qa.navigation=props'],['Common/DocumentTabBar','qa.tabs=props'],['Library/LibraryView','qa.library=props']
  ].map(([file,capture])=>[path.join(root,'src/components',file+'.jsx'),{name:path.basename(file),capture}]));
  const plugin={name:'migration-real-ui',setup(build){setupRecoveryWorker(build);
   build.onResolve({filter:/^qa-original:/},args=>({path:args.path.slice(12),namespace:'qa-original'}));
   build.onLoad({filter:/.*/,namespace:'qa-original'},args=>({contents:fs.readFileSync(args.path,'utf8'),loader:'jsx',resolveDir:path.dirname(args.path)}));
   build.onResolve({filter:/notebookCover\.worker\.js\?worker&inline$/},()=>({path:'cover',namespace:'qa-cover'}));
   build.onLoad({filter:/.*/,namespace:'qa-cover'},()=>({contents:fs.readFileSync(path.join(assets,cover),'utf8'),loader:'js'}));
   build.onResolve({filter:/pdf\.worker\.min\.mjs\?url$/},()=>({path:'pdf-worker',namespace:'qa-url'}));
   build.onLoad({filter:/.*/,namespace:'qa-url'},()=>({contents:'export default '+JSON.stringify(pathToFileURL(path.join(assets,pdfWorker)).href),loader:'js'}));
   build.onLoad({filter:/\.jsx$/},args=>{const item=captures.get(args.path);if(item)return {
    contents:'import React from "react";import {'+item.name+' as Actual} from '+JSON.stringify('qa-original:'+args.path)+';export const '+item.name+'=props=>{'+item.capture+';return React.createElement(Actual,props);};',loader:'jsx',resolveDir:path.dirname(args.path)};});
  }};
  const bundle=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'jsx',sourcefile:'migration-qa.jsx'},bundle:true,write:false,
   platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},plugins:[plugin],logLevel:'silent'});
  await disk.writeFile(html,'<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="'+pathToFileURL(path.join(root,'src/index.css')).href+'"><div id="root"></div>');
  const allowed=new Set([path.resolve(drive)]);
  const newDevice=async(name)=>{
   const device={name,local:path.join(fixture,'local-'+name),profile:path.join(fixture,'profile-'+name),client:createBackupWorkerClient({localDir:path.join(fixture,'local-'+name)})};devices.push(device);return reopen(device);
  };
  const reopen=async device=>{
   const context=await chromium.launchPersistentContext(device.profile,{headless:true,executablePath:process.env.BETTERNOTE_QA_BROWSER,
    viewport:{width:1440,height:1000},env:{...process.env,TEMP:qaRoot,TMP:qaRoot}});device.context=context;
   await context.route(/^https?:\/\//,route=>route.abort());
   await context.exposeBinding('writeBridge',async(_,text)=>{const command=require('./helpers/recovery-worker.cjs').decodeBinaryCommand(JSON.parse(text));
    for(const target of [command.localBackupPath,command.driveBackupPath].filter(Boolean))assert.ok(target===device.local||allowed.has(path.resolve(target)),'Outside QA destinations');
    return device.client.execute(command);
   });
   await context.exposeBinding('readBridge',async(_,folder,options)=>{assert.ok(allowed.has(path.resolve(folder)),'Outside QA source');const result=await reader.execute({folderPath:folder,...options});
    if(result.encoded){result.encodedBase64=Buffer.from(result.encoded).toString('base64');delete result.encoded;}return result;});
   device.page=context.pages()[0]||await context.newPage();device.page.setDefaultTimeout(30000);device.page.on('pageerror',e=>errors.push(device.name+': '+e.message));
   await device.page.goto(pathToFileURL(html).href);await device.page.addScriptTag({content:bundle.outputFiles[0].text});return device;
  };
  const mount=async d=>{await d.page.evaluate(()=>qa.mount());await d.page.waitForFunction(()=>qa.library&&qa.tabs);await d.page.evaluate(()=>qa.backup.stopScheduledSync());};
  const state=d=>d.page.evaluate(()=>qa.state()),hash=(d,id)=>d.page.evaluate(id=>qa.hash(id),id);
  const get=(d,id)=>d.page.evaluate(id=>qa.db.getBackupNotebookSnapshot(id),id),run=(d,options)=>d.page.evaluate(options=>qa.run(options),options);
  const stop=async d=>{await d.page.evaluate(async()=>{await qa.local.flushLocalSaves();await qa.backup.controller.waitForRunning();qa.stop();});await d.context.close();d.context=null;await d.client.close();};
  const home=async d=>{await d.page.evaluate(()=>qa.tabs.onGoHome());await d.page.waitForFunction(()=>qa.tabs.activeTabId===null);await d.page.evaluate(()=>qa.backup.stopScheduledSync());};
  const open=async(d,id)=>{await d.page.evaluate(id=>qa.library.onOpenNotebook(id,0),id);await d.page.waitForSelector('.bn-layer-active');await d.page.waitForFunction(id=>qa.tabs.activeTabId===id,id);};
  const a=await newDevice('A'),b=await newDevice('B'),c=await newDevice('C');
  const pdf=new jsPDF();pdf.text('Phase 3.4 synthetic PDF page one',20,30);pdf.addPage();pdf.text('Synthetic page two',20,30);
  const source=await a.page.evaluate(pdf=>qa.source(pdf),pdf.output('datauristring').split(',')[1]);
  for(const d of devices){await d.page.evaluate(({paths,source})=>qa.setup(paths,source),{paths:{local:d.local,drive},source:d===a?source:null});await mount(d);}
  await check('Fresh persistent device receives all notebook IDs and exact canonical contents',async()=>{
   assert.equal((await run(a)).success,true);assert.equal((await run(b)).success,true);
   for(const note of source.notebooks)assert.equal(await hash(b,note.id),await hash(a,note.id));assert.equal((await state(b)).metadata.notebooks.length,3);
  });
  await check('Nested folder names, parents and colors survive migration',async()=>assert.deepEqual((await b.page.evaluate(()=>qa.db.getAllFolders())).sort((a,b)=>a.id.localeCompare(b.id)),[...source.folders].sort((a,b)=>a.id.localeCompare(b.id))));
  await check('Identical names retain distinct IDs, ordered pages and favorites',async()=>{
   const first=await get(b,'written'),second=await get(b,'pdf');assert.equal(first.name,second.name);assert.notEqual(first.id,second.id);
   assert.deepEqual(first.pages.map(p=>p.pageIndex),[0,1,2]);assert.equal(first.pages[1].isFavorite,true);assert.equal(first.isFavorite,true);
  });
  await check('Locked images, original PDF bytes, backgrounds, text and negative board coordinates survive',async()=>{
   const first=await get(b,'written'),copy=await get(b,'pdf'),board=await get(b,'whiteboard');
   assert.equal(first.pages[0].imageElements[0].locked,true);assert.equal(copy.pdfBase64,source.notebooks[1].pdfBase64);
   assert.deepEqual(copy.pages,source.notebooks[1].pages);assert.ok(board.pages[0].strokes[0].points[0].x<0);
  });
  await check('Fresh device can also use explicit Restore from Folder without changing preferences',async()=>{
   const result=await c.page.evaluate(folder=>qa.backup.restoreFromCloudBackup(folder),drive);assert.equal(result.success,true);assert.equal(result.count,3);
   for(const note of source.notebooks)assert.equal(await hash(c,note.id),await hash(a,note.id));
   assert.equal(await c.page.evaluate(()=>qa.db.getSetting('local_backup_path')),c.local);
  });
  await check('Actual migrated editor opens every page and PDF/board without renderer errors',async()=>{
   await open(b,'written');await b.page.evaluate(()=>qa.toolbar.setShowThumbnails(true));await b.page.waitForFunction(()=>qa.thumbnails);
   for(const i of [2,1,0]){await b.page.evaluate(i=>qa.thumbnails.onSelectPage(i),i);await b.page.waitForFunction(i=>qa.thumbnails.currentPageIndex===i,i);}
   await home(b);await open(b,'pdf');await b.page.screenshot({path:path.join(fixture,'migrated-pdf.png')});await home(b);
   await open(b,'whiteboard');await home(b);assert.deepEqual(errors,[]);
  });
  await check('Real pen events append writing through the actual editor and persist locally',async()=>{
   await open(b,'written');await b.page.evaluate(()=>{
    const canvas=document.querySelector('.bn-layer-active'),r=canvas.getBoundingClientRect();
    for(const[type,x,y]of[['pointerdown',150,100],['pointermove',230,140],['pointermove',260,180],['pointerup',260,180]])
     canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'pen',pointerId:71,button:0,buttons:type==='pointerup'?0:1,pressure:type==='pointerup'?0:.6,clientX:r.left+x,clientY:r.top+y}));
   });await b.page.waitForFunction(async()=>(await qa.db.getPage('written-p0')).strokes.length===2);
   await b.page.evaluate(()=>qa.local.flushLocalSaves());await b.page.screenshot({path:path.join(fixture,'continued-writing.png')});await home(b);
  });
  await check('Closing the entire browser and reopening the same device preserves pages and sync ancestry',async()=>{
   const before=await hash(b,'written'),journal=(await state(b)).journal;await stop(b);await reopen(b);await mount(b);
   assert.equal(await hash(b,'written'),before);assert.deepEqual((await state(b)).journal,journal);assert.equal((await get(b,'written')).pages[0].strokes.length,2);
  });
  await check('Writing added after migration returns to the original device by notebook ID',async()=>{
   assert.equal((await run(b)).success,true);assert.equal((await run(a)).success,true);assert.equal(await hash(a,'written'),await hash(b,'written'));
   assert.equal((await get(a,'written')).pages[0].strokes.length,2);
  });
  await check('Concurrent edits preserve both copies and survive a complete device restart',async()=>{
   await a.page.evaluate(()=>qa.editText('written-p0','A concurrent lesson'));await b.page.evaluate(()=>qa.editText('written-p0','B concurrent lesson'));
   await run(a);await run(b);const copies=(await state(b)).metadata.notebooks.filter(n=>n.id!=='written'&&n.name.includes('Copy from this device'));
   assert.equal(copies.length,1);const saved=await get(b,copies[0].id);assert.equal(saved.syncConflictOf,'written');assert.equal(saved.pages[0].textElements[0].text,'B concurrent lesson');
   assert.equal((await get(b,'written')).pages[0].textElements[0].text,'A concurrent lesson');const copyHash=await hash(b,saved.id);
   await stop(b);await reopen(b);await mount(b);assert.equal(await hash(b,saved.id),copyHash);await run(a);assert.equal(await hash(a,saved.id),copyHash);
  });
  await check('Repeated sync is idempotent and idle polling performs metadata reads without writes',async()=>{
   await run(a);await run(b);const before=(await state(b)).metadata.notebooks.length;await run(a);await run(b);assert.equal((await state(b)).metadata.notebooks.length,before);
   await b.page.evaluate(()=>{qa.actions=[];qa.reads=[];});const result=await run(b,{checkDriveOnly:true});assert.equal(result.checkOnly,true);
   assert.deepEqual(await b.page.evaluate(()=>qa.actions),[]);assert.deepEqual(await b.page.evaluate(()=>qa.reads.filter(x=>x?.syncMode).map(x=>x.syncMode)),['preview']);
  });
  await check('Missing required file refuses Restore and retains every existing device notebook',async()=>{
   const manifest=JSON.parse(await disk.readFile(path.join(drive,'Full_System/backup_manifest.json'))),relative=manifest.notebooks.pdf.editable.path;
   assert.ok(relative&&!path.isAbsolute(relative));const file=path.resolve(drive,relative);assert.ok(file.startsWith(drive+path.sep));const bytes=await disk.readFile(file);
   const before=await hash(c,'pdf');await disk.unlink(file);
   try{const result=await c.page.evaluate(folder=>qa.backup.restoreFromCloudBackup(folder),drive);assert.equal(result.success,false);assert.equal(await hash(c,'pdf'),before);}
   finally{await disk.writeFile(file,bytes);}
  });
  await check('Corrupt bytes block incoming writes, preserve the shared backup and keep Local backup working',async()=>{
   const manifestFile=path.join(drive,'Full_System/backup_manifest.json'),before=await disk.readFile(manifestFile),manifest=JSON.parse(before),fullBefore=await disk.readFile(path.join(drive,'Full_System/BetterNote_Latest_Backup.json'));
   const file=path.resolve(drive,manifest.notebooks.written.editable.path);assert.ok(file.startsWith(drive+path.sep));const bytes=await disk.readFile(file);
   await a.page.evaluate(()=>qa.editText('written-p0','unpublished A work'));await disk.writeFile(file,'corrupt synthetic file');
   try{await run(a);const observed=await state(a);assert.equal(observed.status.allDestinationsCurrent,false);assert.equal(observed.status.status,'current');assert.deepEqual(await disk.readFile(path.join(drive,'Full_System/BetterNote_Latest_Backup.json')),fullBefore);assert.equal(await disk.readFile(file,'utf8'),'corrupt synthetic file');}
   finally{await disk.writeFile(file,bytes);}await run(a);
  });
  await check('Closing during an incoming read leaves prior committed contents intact and retries on reopen',async()=>{
   const before=await hash(b,'written');await b.page.evaluate(()=>{qa.gate();qa.pending=qa.run();});await b.page.waitForFunction(()=>qa.holdRead&&qa.recovery.backupRecovery.getSnapshot().active);
   await b.context.close();b.context=null;await b.client.close();await reopen(b);await mount(b);assert.equal(await hash(b,'written'),before);
   await run(b);assert.equal(await hash(b,'written'),await hash(a,'written'));
  });
  await check('A larger synthetic notebook migrates while the UI heartbeat remains responsive',async()=>{
   // Valid PNGs, 6000-point strokes and 24 pages. Repeated base64 is preserved on disk, not allocated as giant canvases.
   const big=JSON.parse(JSON.stringify(source.notebooks[0]));big.id='large';big.folderId=null;big.name='Large synthetic course';big.updatedAt=Date.now();big.pageCount=24;
   big.pages=Array.from({length:24},(_,i)=>({...big.pages[0],id:'large-p'+i,notebookId:'large',pageIndex:i,
    strokes:[{id:'large-ink'+i,tool:'pen',color:'#2563eb',width:2,points:Array.from({length:6000},(_,j)=>({x:20+(j%400),y:20+(j%500),pressure:.5}))}]}));
   metrics.largePayloadBytes=Buffer.byteLength(JSON.stringify(big));await a.page.evaluate(data=>qa.db.restoreBackupAtomic(qa.prepareBackup({folders:[],notebooks:[data]}),'large-seed'),big);await run(a);
   await b.page.evaluate(()=>qa.measure());const result=await run(b);metrics.largeReceive=await b.page.evaluate(()=>qa.endMeasure());assert.equal(result.success,true);
   assert.equal(await hash(b,'large'),await hash(a,'large'));assert.equal((await get(b,'large')).pages.length,24);assert.ok(metrics.largeReceive.ticks>0);
   assert.ok(metrics.largeReceive.maxGap<5000,'Renderer heartbeat stalled for five seconds');
  });
  await check('Unavailable selected folder cannot fall back to a different backup or mutate device contents',async()=>{
   const absent=path.join(fixture,'unavailable');allowed.add(path.resolve(absent));const before=await hash(c,'pdf');
   const result=await c.page.evaluate(folder=>qa.backup.restoreFromCloudBackup(folder),absent);assert.equal(result.success,false);assert.equal(await hash(c,'pdf'),before);assert.equal(await disk.stat(absent).catch(()=>null),null);
  });
  await check('No renderer exception, whole-pages-store getAll or false cloud-upload confirmation',async()=>{
   assert.deepEqual(errors,[]);for(const d of devices)assert.equal((await state(d)).status.cloudUploadVerified,false);
  });
  if(process.env.BETTERNOTE_QA_DRIVE_PARENT){
   const parent=path.resolve(process.env.BETTERNOTE_QA_DRIVE_PARENT);
   assert.equal(parent.toLowerCase(),path.resolve('I:/My Drive/BetterNote.AppPC').toLowerCase(),'Only the user-approved Drive parent is allowed');
   const canonical=await disk.realpath(parent);
   const prefix=path.resolve(canonical,'BetterNote-Phase3-Test-');assert.equal(path.dirname(prefix),canonical);
   const testDrive=await disk.mkdtemp(prefix),resolved=await disk.realpath(testDrive);
   assert.equal(path.dirname(resolved),canonical);assert.match(path.basename(resolved),/^BetterNote-Phase3-Test-[A-Za-z0-9]+$/);
   allowed.add(path.resolve(testDrive));metrics.realDrive={folder:testDrive,cloudUploadVerified:false};
   await check('Drive Desktop mount prepares a NEW synthetic child folder and passes native full verification',async()=>{
    const started=Date.now();await c.page.evaluate(async folder=>{await qa.db.saveSetting('gdrive_backup_path',folder);await qa.backup.destinationChanged();qa.backup.stopScheduledSync();},testDrive);
    const result=await run(c);assert.equal(result.success,true);
    const target=(await state(c)).status.targets.find(t=>t.roles.includes('drive'));assert.equal(target.dataCurrent,true);
    const verified=await reader.execute({folderPath:testDrive});assert.equal(verified.success,true);assert.equal(verified.data.notebooks.length,3);
    metrics.realDrive.notebooks=3;metrics.realDrive.editableFiles=(await disk.readdir(path.join(testDrive,'Editable_Notes'))).filter(f=>f.endsWith('.bnote')).length;
    metrics.realDrive.pdfFiles=(await disk.readdir(path.join(testDrive,'PDF_Documents'))).filter(f=>f.endsWith('.pdf')).length;
    assert.equal(metrics.realDrive.editableFiles,3);assert.equal(metrics.realDrive.pdfFiles,3);metrics.realDrive.prepareAndVerifyMs=Date.now()-started;
   });
   await check('Another fresh isolated device receives the synthetic notes from the actual Drive mount',async()=>{
    const d=await newDevice('DriveReceiver');await d.page.evaluate(paths=>qa.setup(paths),{local:d.local,drive:testDrive});await mount(d);
    const result=await run(d);assert.equal(result.success,true);for(const note of source.notebooks)assert.equal(await hash(d,note.id),await hash(c,note.id));
    assert.equal((await state(d)).status.cloudUploadVerified,false);metrics.realDrive.freshDeviceReceive=true;
   });
  }
  assert.deepEqual(errors,[]);
  for(const d of devices)await stop(d);
  const report={passed:passed.length,failed:0,fixture,metrics,syntheticOnly:true,realDriveAccess:!!metrics.realDrive,persistentDevices:devices.length,offlineFileOrigin:true,realEditor:true};
  await disk.writeFile(path.join(fixture,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await reader.close();for(const d of devices){await d.context?.close();await d.client.close();}}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
