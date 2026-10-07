// Real React/IndexedDB/UI + native worker; synthetic data and isolated browser origin only.
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),assert=require('node:assert/strict');
const esbuild=require('esbuild');
const {chromium}=require(process.env.BETTERNOTE_PLAYWRIGHT_PATH||'playwright');
const {createBackupWorkerClient}=require('../electron/backupWorkerClient.cjs');
const root=fs.realpathSync(path.resolve(__dirname,'..')),preview=process.env.BETTERNOTE_QA_TEMP;
if(!preview||!path.isAbsolute(preview)||!fs.statSync(preview).isDirectory())throw Error('Set BETTERNOTE_QA_TEMP to the isolated QA folder.');
const origin='https://betternote-phase2.invalid/';
const results=[],screenshots=[];
const entry="\nimport React,{useState} from 'react';import{createRoot}from'react-dom/client';\nimport * as db from './src/services/db.js';import * as local from './src/services/localSaveService.js';\nimport * as lang from './src/services/i18n.js';import{autoBackupService as backup}from'./src/services/autoBackupService.js';\nimport{DocumentTabBar}from'./src/components/Common/DocumentTabBar.jsx';\nimport{LibraryView}from'./src/components/Library/LibraryView.jsx';\nimport BackupStatusModal from'./src/components/Library/BackupStatusModal.jsx';\nimport{googleDrive}from'./src/services/googleDriveService.js';\nimport{createVerifiedBackupPdfRenderer,getBackupPdfCacheStats}from'./src/utils/backupPdf.js';\nwindow.qa={db,local,lang,backup,googleDrive,createVerifiedBackupPdfRenderer,getBackupPdfCacheStats,calls:[],clicks:[],closed:[],notes:[],renderCount:0,alerts:[],progressEvents:[]};\nwindow.electronAPI={isElectron:true,\n saveBackup:async command=>{qa.calls.push(command.action);return window.backupBridge(command);},\n onBackupProgress:handler=>{qa.nativeProgress=event=>{qa.progressEvents.push({stage:event.stage,totalBytes:event.totalBytes});handler(event);};return()=>{qa.nativeProgress=null;};},\n openDriveDesktop:async()=>{qa.desktopOpenCount=(qa.desktopOpenCount||0)+1;return{success:true,opened:true,connected:false,cloudUploadVerified:false};},\n connectGoogleAccount:async clientId=>{qa.lastNativeClientId=clientId;qa.nativeAuthCalls=(qa.nativeAuthCalls||0)+1;\n  if(qa.authHold)return new Promise(resolve=>{qa.authResolver=resolve;});\n  return qa.authResponse||{success:false,authorized:false,reason:'access-denied'};},\n cancelGoogleAccountConnection:async()=>{qa.authResolver?.({success:false,authorized:false,reason:'cancelled'});qa.authResolver=null;return{success:true};},\n selectFolder:async()=>qa.nextFolder||null,openBackupFolder:async()=>({success:true}),revealBackupFile:async()=>({success:true}),openExternal:async url=>{qa.externalUrl=url;return{success:true};}};\nwindow.alert=message=>qa.alerts.push(message);window.confirm=()=>true;\nconst originalBlob=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(...args){qa.renderCount++;return originalBlob.apply(this,args);};\nconst renderer=createRoot(document.getElementById('root'));\nfunction Harness(){\n const[mode,setMode]=useState('tabs'),[open,setOpen]=useState(false),[hubTab,setHubTab]=useState('local');\n const[active,setActive]=useState('tab-1'),[tabs,setTabs]=useState(Array.from({length:9},(_,i)=>({id:'tab-'+(i+1),title:'Synthetic notebook '+(i+1),pageIndex:i})));\n qa.resetTabs=()=>{setTabs(Array.from({length:9},(_,i)=>({id:'tab-'+(i+1),title:'Synthetic notebook '+(i+1),pageIndex:i})));setActive('tab-1');setMode('tabs');};\n qa.showLibrary=()=>setMode('library');qa.openHub=(tab='local')=>{setHubTab(tab);setOpen(true);};qa.openGoogle=()=>qa.openHub('drive');qa.closeGoogle=()=>setOpen(false);qa.closeDetails=()=>setOpen(false);\n return <><DocumentTabBar tabs={tabs} activeTabId={active}\n onSelectTab={id=>{qa.clicks.push(id);setActive(id);}}onCloseTab={id=>{qa.closed.push(id);setTabs(old=>old.filter(tab=>tab.id!==id));setActive(old=>old===id?null:old);}}\n onGoHome={()=>setMode('library')}onOpenBackupStatus={()=>qa.openHub('local')}/>\n {mode==='library'?<LibraryView notebooks={qa.notes}folders={[]}currentTheme=\"dark\"currentFolderId={null}folderChain={[]}\n onTriggerAutoSync={options=>backup.runAutoBackup(options)} onOpenBackupStatus={tab=>qa.openHub(tab)} onOpenDriveModal={()=>qa.openHub('drive')}\n onNavigateFolder={()=>{}}onOpenNotebook={()=>{}}onUpdateNotebook={()=>{}}/>:<canvas id=\"qa-writing-surface\"width=\"480\"height=\"100\"style={{margin:24,background:'#fff'}}/>}\n <BackupStatusModal isOpen={open}onClose={()=>setOpen(false)}initialTab={hubTab}notebooks={qa.notes}onTriggerSync={options=>backup.runAutoBackup(options)}/>\n </>;\n}\nrenderer.render(<Harness/>);\nqa.fixture=async()=>{const tiny=document.createElement('canvas');tiny.width=40;tiny.height=30;const ctx=tiny.getContext('2d');ctx.fillStyle='#22c55e';ctx.fillRect(0,0,40,30);qa.image=tiny.toDataURL();\n for(const[id,count,template]of[['a',2,'dotted'],['b',1,'whiteboard']]){\n  await db.saveNotebook({id,name:'Same name',pageCount:count,templateId:template,pdfBase64:'synthetic-original-file',updatedAt:1});\n  for(let i=0;i<count;i++)await db.savePage({id:id+'-p'+i,notebookId:id,pageIndex:i,templateId:template,pageWidth:480,pageHeight:620,updatedAt:1,\n   strokes:[{id:'stroke-'+i,tool:'pen',color:'#2563eb',width:3,points:[{x:template==='whiteboard'?-100:20,y:20,pressure:.6},{x:180,y:170,pressure:.8}]}],\n   textElements:[{id:'text-'+i,text:'Synthetic notes ทดสอบ',x:30,y:190,fontSize:18,color:'#111827'}],\n   imageElements:[{id:'image-'+i,src:qa.image,x:30,y:250,width:100,height:75,locked:true}]});\n }qa.notes=await db.getAllNotebooks();};\nqa.edit=async(id='a-p0',extra={})=>{const page=await db.getPage(id);await db.savePage({...page,...extra,strokes:[...page.strokes,{id:'edit-'+Date.now(),tool:'pen',color:'#ef4444',width:3,points:[{x:210,y:30,pressure:.5},{x:290,y:110,pressure:.5}]}]});};\nqa.start=async(path)=>{await db.saveSetting('local_backup_path',path);backup.startScheduledSync();await backup.controller.initialize();backup.controller.stop();};\n\nqa.abortPageSave=async()=>{\n const connection=await db.openDB(),original=connection.transaction.bind(connection);let armed=true;\n connection.transaction=(...args)=>{const tx=original(...args),getStore=tx.objectStore.bind(tx);tx.objectStore=name=>{\n  const store=getStore(name);if(name==='pages'&&args[1]==='readwrite'){const put=store.put.bind(store);store.put=value=>{\n   const request=put(value);if(armed){armed=false;request.addEventListener('success',()=>tx.abort(),{once:true});}return request;};}return store;};return tx;};\n qa.restorePageSave=()=>{connection.transaction=original;};\n};\nconst originalNative=window.electronAPI.saveBackup;\nwindow.electronAPI.saveBackup=async command=>{\n if(command.action==='notebook'&&qa.editDuringBackup){qa.editDuringBackup=false;await qa.edit();}\n if(command.action==='pdf'&&qa.holdPdf){qa.holdPdf=false;qa.holdingPdf=true;await new Promise(resolve=>{qa.releaseHeldPdf=resolve;});qa.holdingPdf=false;}\n return originalNative(command);\n};\nqa.stop=()=>{backup.stopScheduledSync();renderer.unmount();};\n\n";
(async()=>{
 const fixture=await fsp.mkdtemp(path.join(preview,'betternote-phase2-browser-')),localDir=path.join(fixture,'unused-default'),driveDir=path.join(fixture,'chosen-local'),cloudDir=process.env.BETTERNOTE_QA_DRIVE_DIR||path.join(fixture,'My Drive','BetterNote.AppPC'),blocked=path.join(fixture,'unwritable');
 if(process.env.BETTERNOTE_QA_DRIVE_DIR){assert.ok(path.isAbsolute(cloudDir));assert.match(path.basename(cloudDir),/^BetterNote-Phase2-Test-[a-zA-Z0-9]+$/);assert.equal((await fsp.readdir(cloudDir)).length,0,'Real Drive QA folder must be empty');}
 await fsp.writeFile(blocked,'synthetic blocking file');
 const client=createBackupWorkerClient({localDir,driveCandidates:[]});
 let browser;
 try{
  const assets=path.join(root,'dist/assets'),worker=fs.readdirSync(assets).find(name=>/^notebookCover\.worker-.*\.js$/.test(name));
  if(!worker)throw Error('Run npm run build before the browser checks.');
  const plugin={name:'qa-inline-cover-worker',setup(build){
    require('./helpers/recovery-worker.cjs').setupRecoveryWorker(build);
   build.onResolve({filter:/pdf\.worker\.min\.mjs\?url$/},()=>({path:'pdf-worker-url',namespace:'qa-url'}));
   build.onLoad({filter:/.*/,namespace:'qa-url'},()=>({contents:"export default '/qa-unused-pdf-worker.mjs';",loader:'js'}));
   build.onResolve({filter:/notebookCover\.worker\.js\?worker&inline$/},()=>({path:'cover-factory',namespace:'qa-cover-worker'}));
   build.onLoad({filter:/.*/,namespace:'qa-cover-worker'},()=>({contents:fs.readFileSync(path.join(assets,worker),'utf8'),loader:'js'}));
  }};
  const compiled=await esbuild.build({stdin:{contents:entry,resolveDir:root,sourcefile:'phase2-synthetic.jsx',loader:'jsx'},
   bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},plugins:[plugin],logLevel:'silent'});
  browser=await chromium.launch({headless:true,...(process.env.BETTERNOTE_QA_BROWSER?{executablePath:process.env.BETTERNOTE_QA_BROWSER}:{}),env:{...process.env,TEMP:preview,TMP:preview}});
  const context=await browser.newContext({viewport:{width:1360,height:1000},acceptDownloads:false});
  await context.route('**/*',route=>route.request().url()===origin?route.fulfill({status:200,contentType:'text/html',
   body:'<!doctype html><html><head></head><body><div id="root" style="height:100vh"></div></body></html>'}):route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.exposeFunction('backupBridge',command=>{
   for(const key of ['customBackupPath','localBackupPath','driveBackupPath'])if(command[key]&&!path.resolve(command[key]).toLowerCase().startsWith(fixture.toLowerCase()+path.sep)&&path.resolve(command[key]).toLowerCase()!==path.resolve(cloudDir).toLowerCase())throw Error('Refusing non-QA backup folder');
   return client.execute(command,event=>{page.evaluate(event=>qa.nativeProgress?.(event),event).catch(()=>{});});
  });
  await page.goto(origin);assert.equal(page.url(),origin);
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'src/index.css'),'utf8')});
  await page.addScriptTag({content:compiled.outputFiles[0].text});
  const check=async(name,work)=>{let timer;try{await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Timed out: '+name)),25000);})]);}catch(error){console.log(JSON.stringify({failedCheck:name,diagnostic:await page.evaluate(()=>({status:qa.backup.getSnapshot().status,targets:qa.backup.getSnapshot().targets.map(t=>({kind:t.kind,error:t.error,current:t.current,editableCount:t.editableCount,pdfCount:t.pdfCount,fullCurrent:t.fullCurrent})),nativeActions:qa.calls,renderCount:qa.renderCount})).catch(()=>null),rendererErrors:errors}));throw error;}finally{clearTimeout(timer);}results.push({name,passed:true});console.log('PASS '+name);};
  const state=()=>page.evaluate(()=>qa.backup.getSnapshot());
  const run=()=>page.evaluate(()=>qa.backup.runAutoBackup());
  const waitState=expected=>page.waitForFunction(expected=>qa.backup.getSnapshot().status===expected,expected);
  const openDetails=async()=>{await page.locator('.bn-document-tab-bar .bn-backup-indicator').click();await page.locator('.bn-backup-dialog').waitFor();};
  const closeDetails=async()=>{await page.locator('.bn-backup-btn-close').click();await page.locator('.bn-backup-dialog').waitFor({state:'detached'});};
  const choose=async destination=>{await page.evaluate(async destination=>{await qa.db.saveSetting('local_backup_path',destination);await qa.backup.destinationChanged();qa.backup.controller.stop();},destination);};
  await check('Unverified backup never starts as a green Drive badge',async()=>{
   await page.locator('.bn-backup-indicator').waitFor();assert.equal(await page.locator('.bn-backup-indicator').getAttribute('data-backup-state'),'unknown');
   assert.match(await page.locator('.bn-local-save-status').innerText(),/Saved on this device/);
  });
  await check('Backup metadata reads omit page and media payloads',async()=>{
   await page.evaluate(()=>qa.fixture());const metadata=await page.evaluate(()=>qa.db.getBackupMetadata());
   assert.equal(metadata.notebooks.length,2);assert.ok(metadata.notebooks.every(n=>!('pages'in n)&&!('pdfBase64'in n)));
  });
  await check('Native IndexedDB snapshot cannot mix page counts and reordering transactions',async()=>{
   const result=await page.evaluate(async()=>{
    const before=qa.db.getBackupNotebookSnapshot('a'),original=await qa.db.getPage('a-p1');
    const changed=qa.db.mutateNotebookPages('a',{kind:'insert',atIndex:0,page:{...original,id:'a-p-extra'}});
    const snapshot=await before;await changed;const next=await qa.db.getBackupNotebookSnapshot('a');
    return{snapshotCount:snapshot.pageCount,pages:snapshot.pages.map(p=>p.pageIndex),nextCount:next.pageCount,nextPages:next.pages.map(p=>p.pageIndex)};
   });
   assert.equal(result.snapshotCount,result.pages.length);assert.deepEqual(result.pages,[0,1]);
   assert.equal(result.nextCount,3);assert.deepEqual(result.nextPages,[0,1,2]);
  });
  await check('Backup readers reject an aborted real IndexedDB transaction',async()=>{
   assert.equal(await page.evaluate(async()=>{
    const connection=await qa.db.openDB(),original=connection.transaction.bind(connection);let armed=true;
    connection.transaction=(...args)=>{const tx=original(...args);if(armed&&args[1]==='readonly'){armed=false;tx.abort();}return tx;};
    try{await qa.db.getBackupMetadata();return false;}catch{return true;}finally{connection.transaction=original;}
   }),true);
  });
  await check('Missing backup files display pending rather than a fabricated recent timestamp',async()=>{
   await page.evaluate(destination=>qa.start(destination),driveDir);assert.equal((await state()).status,'pending');assert.equal((await state()).lastSuccess,null);
  });
  await check('Recovery data completes before the PDF queue and only one selected Local folder is written',async()=>{
   await openDetails();await page.evaluate(()=>{qa.holdPdf=true;});await page.locator('.bn-backup-btn-sync-now').click();
   await page.waitForFunction(()=>qa.holdingPdf===true);
   const dataReady=await state();assert.equal(dataReady.status,'current');assert.equal(dataReady.pdfStatus,'working');
   assert.equal(dataReady.targets.length,1);assert.equal(dataReady.targets[0].editableCount,2);assert.equal(dataReady.targets[0].fullCurrent,true);
   assert.equal(fs.existsSync(path.join(driveDir,'Full_System','BetterNote_Latest_Backup.json')),true);assert.equal(fs.existsSync(localDir),false);
   assert.match(await page.locator('.bn-backup-destination-summary').innerText(),/Recovery data is backed up/);
   await page.evaluate(()=>qa.releaseHeldPdf());await page.waitForFunction(()=>qa.backup.getSnapshot().pdfStatus==='current'&&!qa.backup.getSnapshot().syncing);
   await page.locator('.bn-backup-hub-notice.is-success').waitFor();
   const current=await state();assert.equal(current.targets.length,1);assert.ok(current.targets.every(t=>t.dataCurrent&&t.pdfCurrent&&t.editableCount===2&&t.pdfCount===2&&t.fullCurrent));
   assert.equal(current.cloudUploadVerified,false);
   const inspected=await client.execute({action:'inspect',localBackupPath:driveDir,includeFiles:true});assert.equal(inspected.files.length,5);
   for(const file of inspected.files.filter(f=>f.kind==='pdf')){
    const raw=await fsp.readFile(file.fullPath);assert.match(raw.toString('latin1'),/^%PDF-/);
    assert.equal((raw.toString('latin1').match(/\/Type \/Page(?=\s|\/)/g)||[]).length,file.notebookId==='a'?3:1);
   }
   const backed=JSON.parse(await fsp.readFile(path.join(driveDir,'Full_System','BetterNote_Latest_Backup.json')));
   assert.ok(backed.notebooks.every(n=>n.pdfBase64==='synthetic-original-file'&&n.pages.every(p=>p.imageElements[0].locked===true)));
   assert.ok(await page.evaluate(()=>qa.progressEvents.some(event=>event.totalBytes>0)));
  });
  await check('Local table reports real file count, size and completion times without duplicate Local cards',async()=>{
   const summary=page.locator('.bn-backup-destination-summary');assert.equal(await summary.locator('.bn-backup-destination.is-current').count(),1);
   assert.match(await summary.innerText(),/Editable notes: 2\/2/);assert.match(await summary.innerText(),/Full library snapshot: Current version/);
   assert.equal(await page.locator('.bn-backup-hub-table tbody tr').count(),5);
   assert.equal(await page.locator('.bn-backup-hub-metrics strong').nth(1).innerText(),'5');
   assert.ok((await state()).lastSuccess>0);
  });
  await check('Changing only a notebook name does not rerender its unchanged PDF',async()=>{
   await closeDetails();const before=await page.evaluate(()=>qa.renderCount);
   await page.evaluate(async()=>{const note=await qa.db.getNotebookById('a');await qa.db.saveNotebook({...note,name:'Renamed',updatedAt:note.updatedAt+1});});
   assert.notEqual((await state()).status,'current');assert.equal((await run()).success,true);assert.equal(await page.evaluate(()=>qa.renderCount),before);
  });
  await check('A committed edit invalidates backup immediately without native disk polling or repeated metadata reads',async()=>{
   await page.evaluate(async()=>{
    qa.calls=[];qa.metadataReads=0;const connection=await qa.db.openDB(),original=connection.transaction.bind(connection);
    connection.transaction=(...args)=>{if(args[1]==='readonly'&&Array.isArray(args[0])&&args[0].includes('folders')&&args[0].includes('notebooks'))qa.metadataReads++;return original(...args);};
    qa.restoreMetadataReads=()=>{connection.transaction=original;};
   });
   await page.evaluate(()=>qa.edit());assert.notEqual((await state()).status,'current');
   await new Promise(resolve=>setTimeout(resolve,250));assert.deepEqual(await page.evaluate(()=>qa.calls),[]);
   assert.equal(await page.evaluate(()=>qa.metadataReads),0);await page.evaluate(()=>qa.restoreMetadataReads());
  });
  await check('A failed local save blocks native backup until the real retry button commits it',async()=>{
   const before=await fsp.readFile(path.join(driveDir,'Full_System','BetterNote_Latest_Backup.json'));
   await page.evaluate(async()=>{
    await qa.abortPageSave();const page=await qa.db.getPage('a-p0');
    await qa.local.pageSaveQueue.enqueue({...page,strokes:[...page.strokes,{id:'queued-local-failure',tool:'pen',color:'#ef4444',width:2,points:[{x:50,y:80,pressure:.5},{x:100,y:100,pressure:.5}]}]}).catch(()=>{});
    qa.restorePageSave();qa.calls=[];
   });
   assert.equal((await run()).success,false);assert.deepEqual(await page.evaluate(()=>qa.calls),[]);
   assert.deepEqual(await fsp.readFile(path.join(driveDir,'Full_System','BetterNote_Latest_Backup.json')),before);
   await page.locator('.bn-local-save-status-error button').click();
   await page.waitForFunction(()=>qa.local.getLocalSaveSnapshot().status==='saved');
   assert.equal((await run()).success,true);
  });
  await check('An edit committed during the actual native round stays pending and survives the next round',async()=>{
   await page.evaluate(async()=>{await qa.edit();qa.editDuringBackup=true;});
   const result=await run();assert.equal(result.success,false);assert.equal(result.newerEditsPending,true);
   assert.equal((await state()).status,'pending');
   const latest=await page.evaluate(()=>qa.db.getBackupNotebookSnapshot('a'));
   const earlier=JSON.parse(await fsp.readFile(path.join(driveDir,'Full_System','BetterNote_Latest_Backup.json'))).notebooks.find(n=>n.id==='a');
   assert.ok(latest.updatedAt>earlier.updatedAt);
   assert.equal((await run()).success,true);
   const caughtUp=JSON.parse(await fsp.readFile(path.join(driveDir,'Full_System','BetterNote_Latest_Backup.json'))).notebooks.find(n=>n.id==='a');
   assert.deepEqual(caughtUp.pages,latest.pages);
  });
  await check('Rapid edits coalesce and a manual backup takes the newest committed page',async()=>{
   await page.evaluate(async()=>{for(let i=0;i<4;i++)await qa.edit();});assert.equal((await run()).success,true);
   const snapshot=await page.evaluate(()=>qa.db.getBackupNotebookSnapshot('a'));
   const backed=JSON.parse(await fsp.readFile(path.join(driveDir,'Full_System','BetterNote_Latest_Backup.json'))).notebooks.find(n=>n.id==='a');
   assert.equal(backed.updatedAt,snapshot.updatedAt);assert.equal(backed.pages.find(p=>p.id==='a-p0').strokes.length,snapshot.pages.find(p=>p.id==='a-p0').strokes.length);
  });
  await check('Unavailable Local folder never falls back silently to the default folder',async()=>{
   await choose(blocked);assert.equal((await run()).success,false);assert.equal((await state()).status,'error');
   const current=await state();assert.equal(current.targets.length,1);assert.ok(current.targets[0].error);assert.equal(current.lastSuccess,null);
   assert.equal(fs.existsSync(localDir),false);
   await openDetails();await page.locator('.bn-backup-btn-sync-now').click();await page.locator('.bn-backup-hub-notice.is-error').waitFor();
   assert.equal(await page.locator('.bn-backup-destination.is-current').count(),0);
   assert.match(await page.locator('.bn-backup-problem').first().innerText(),/could not be written/);
   await closeDetails();await choose(driveDir);assert.equal((await run()).success,true);
  });
  await check('Corrupt embedded image keeps editable backups and cannot silently pass PDF backup',async()=>{
   await page.evaluate(()=>qa.edit('a-p0',{imageElements:[{id:'bad',src:'data:image/png;base64,YmFk',x:30,y:250,width:100,height:75}]}));
   assert.equal((await run()).success,true);assert.equal((await state()).status,'current');assert.equal((await state()).pdfStatus,'error');
   assert.ok((await state()).targets.every(t=>t.editableCount===2&&t.pdfCount===1&&t.fullCurrent&&t.dataCurrent));
   await openDetails();assert.equal(await page.locator('tr[data-notebook-id="a"][data-file-kind="pdf"] .bn-backup-file-state.is-error').count(),1);await closeDetails();
   await page.evaluate(()=>qa.edit('a-p0',{imageElements:[{id:'image-fixed',src:qa.image,x:30,y:250,width:100,height:75,locked:true}]}));
   assert.equal((await run()).success,true);
  });
  await check('Active pen contact defers PDF work without losing the editable snapshot',async()=>{
   await page.evaluate(()=>qa.edit());const before=await page.evaluate(()=>qa.renderCount);
   await page.evaluate(()=>document.getElementById('qa-writing-surface').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:12,pointerType:'pen',buttons:1})));
   assert.equal((await run()).success,true);assert.equal(await page.evaluate(()=>qa.renderCount),before);assert.equal((await state()).status,'current');assert.equal((await state()).pdfStatus,'pending');
   await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:12,pointerType:'pen',buttons:0})));
   await new Promise(resolve=>setTimeout(resolve,800));assert.equal((await run()).success,true);
  });
  await check('Interrupted PDF resumes at its unfinished page and keeps a bounded cache',async()=>{
   const result=await page.evaluate(async()=>{
    const note=await qa.db.getBackupNotebookSnapshot('a'),renderer=qa.createVerifiedBackupPdfRenderer({maxCacheBytes:2000000,maxCachedPages:1});
    const before=qa.renderCount;let deferred=false;
    try{await renderer.render(note,event=>{if(event?.page===2)throw Error('pdf-backup-deferred');});}catch(error){deferred=error.message==='pdf-backup-deferred';}
    const retained=renderer.getStats(),afterFirst=qa.renderCount;const raw=await renderer.render(note);
    const done=renderer.getStats();renderer.clear();
    return{deferred,retained,done,rendersBefore:before,firstRenders:afterFirst-before,resumedRenders:qa.renderCount-afterFirst,
      pages:(atob(raw.split(',')[1]).match(/\/Type \/Page(?=\s|\/)/g)||[]).length};
   });
   assert.equal(result.deferred,true);assert.equal(result.retained.retainedPages,1);assert.equal(result.firstRenders,1);
   assert.equal(result.resumedRenders,2);assert.equal(result.pages,3);assert.ok(result.done.cachedPages<=1&&result.done.cachedBytes<=2000000);
  });
  await check('Desktop is recommended first; direct connection is unavailable and cannot invoke OAuth',async()=>{
   await page.evaluate(()=>qa.openGoogle());await page.locator('.bn-backup-drive-panel').waitFor();
   assert.equal(await page.locator('[data-drive-choice]').first().getAttribute('data-drive-choice'),'desktop');
   assert.match(await page.locator('[data-drive-choice="desktop"]').innerText(),/Recommended/);
   assert.match(await page.locator('[data-drive-choice="direct"]').innerText(),/Coming soon/);
   assert.equal(await page.locator('[data-drive-choice="direct"]').getAttribute('aria-disabled'),'true');
   assert.equal(await page.getByRole('button',{name:'Connect with Google',exact:true}).count(),0);
   await page.getByRole('button',{name:'Connect Google Drive',exact:true}).click();
   await page.getByText('Google Drive is open.',{exact:false}).waitFor();
   assert.equal(await page.evaluate(()=>qa.desktopOpenCount),1);
   assert.equal(await page.evaluate(()=>qa.nativeAuthCalls||0),0);
   assert.equal((await state()).cloudUploadVerified,false);
  });
  await check('Download guidance opens only the official Google download page',async()=>{
   const link=page.getByRole('link',{name:'Download from Google',exact:true});
   assert.equal(await link.getAttribute('rel'),'noopener noreferrer');
   await link.click();assert.equal(await page.evaluate(()=>qa.externalUrl),'https://www.google.com/intx/en/drive/download/');
   await closeDetails();
  });
  for(const language of ['en','th','zh','ru'])await check('Both hub tabs immediately follow the selected '+language+' language',async()=>{
   await page.evaluate(language=>qa.lang.setAppLanguage(language),language);await openDetails();
   const expected=await page.evaluate(()=>{const language=qa.lang.getAppLanguage();return{title:qa.lang.TRANSLATIONS[language].backupHubTitle,
    local:qa.lang.TRANSLATIONS[language].backupLocalTab,drive:qa.lang.TRANSLATIONS[language].backupDriveTab};});
   assert.equal(await page.locator('.bn-backup-hub-title h3').innerText(),expected.title);
   assert.equal(await page.locator('.bn-backup-hub').getByRole('tab').nth(0).innerText(),expected.local);assert.equal(await page.locator('.bn-backup-hub').getByRole('tab').nth(1).innerText(),expected.drive);
   await page.locator('.bn-backup-hub').getByRole('tab').nth(1).click();assert.equal(await page.locator('.bn-backup-drive-panel').count(),1);
   assert.equal(await page.locator('.bn-backup-hub').count(),1);await closeDetails();
  });
  await page.evaluate(()=>qa.lang.setAppLanguage('en'));
  for(const width of [700,900,1024,1360,1920])await check('Nine tabs remain selectable and closable with backup status at '+width+'px',async()=>{
   await page.setViewportSize({width,height:1000});await page.evaluate(()=>qa.resetTabs());await page.waitForFunction(()=>document.querySelectorAll('.bn-tab-item').length===9);
   for(let i=1;i<=9;i++){const tab=page.locator('.bn-tab-item[data-notebook-id="tab-'+i+'"]');await tab.scrollIntoViewIfNeeded();await tab.click({position:{x:24,y:18}});
    await page.waitForFunction(id=>document.querySelector('.bn-tab-item-active')?.dataset.notebookId===id,'tab-'+i);}
   assert.equal(await page.locator('.bn-document-tab-bar .bn-backup-indicator').count(),1);
   assert.ok(await page.evaluate(()=>document.querySelector('.bn-backup-indicator').getBoundingClientRect().right<=innerWidth));
   for(let i=9;i>=1;i--){const button=page.locator('.bn-tab-item[data-notebook-id="tab-'+i+'"] .bn-tab-close-btn');await button.scrollIntoViewIfNeeded();await button.click();}
   assert.equal(await page.locator('.bn-tab-item').count(),0);
  });
  await check('Keyboard can switch tabs and activate the backup details button',async()=>{
   await page.setViewportSize({width:1360,height:1000});await page.evaluate(()=>qa.resetTabs());
   const first=page.locator('.bn-tab-item[data-notebook-id="tab-1"]');await first.focus();await first.press('End');
   assert.equal(await page.locator('.bn-tab-item-active').getAttribute('data-notebook-id'),'tab-9');
   const badge=page.locator('.bn-document-tab-bar .bn-backup-indicator');await badge.focus();await badge.press('Enter');
   await page.locator('.bn-backup-dialog').waitFor();await closeDetails();
  });
  await check('Documents uses the same verified state and opens its existing details window',async()=>{
   await page.evaluate(()=>qa.showLibrary());await page.locator('.bn-backup-indicator').nth(1).waitFor();
   assert.equal(await page.locator('.bn-backup-indicator').nth(1).getAttribute('data-backup-state'),'current');
   await page.locator('.bn-backup-indicator').nth(1).click();await page.locator('.bn-backup-dialog').waitFor();
   assert.equal(await page.locator('.bn-backup-destination').count(),1);
   if(process.env.BETTERNOTE_QA_SCREENSHOTS==='1'){const file=path.join(fixture,'phase2-backup-details.png');await page.screenshot({path:file});screenshots.push(file);}
   await closeDetails();
  });
  for(const width of [700,900,1024,1360,1920])await check('Backup details keep long paths and all summary cards inside '+width+'px',async()=>{
   await page.setViewportSize({width,height:1000});await openDetails();
   const geometry=await page.evaluate(()=>{
    const dialog=document.querySelector('.bn-backup-dialog').getBoundingClientRect(),cards=[...document.querySelectorAll('.bn-backup-hub-card')].map(node=>node.getBoundingClientRect());
    const body=document.querySelector('.bn-backup-hub-body'),footer=document.querySelector('.bn-backup-hub-footer').getBoundingClientRect();
    return{left:dialog.left,right:dialog.right,width:innerWidth,cards:cards.map(card=>({left:card.left,right:card.right})),
     bodyWidth:body.clientWidth,bodyScrollWidth:body.scrollWidth,footerBottom:footer.bottom,height:innerHeight};
   });
   assert.ok(geometry.left>=0&&geometry.right<=geometry.width);assert.ok((geometry.right-geometry.left)>=geometry.width*.90);
   assert.ok(geometry.cards.every(card=>card.left>=geometry.left&&card.right<=geometry.right));
   assert.ok(geometry.bodyScrollWidth<=geometry.bodyWidth+1);assert.ok(geometry.footerBottom<=geometry.height);
   await closeDetails();
  });
  await page.setViewportSize({width:1360,height:1000});
  await check('Light theme retains readable backup text and keyboard focus',async()=>{
   await page.evaluate(()=>document.documentElement.dataset.theme='light');
   const badge=page.locator('.bn-document-tab-bar .bn-backup-indicator');await badge.focus();await badge.press('Tab');await page.keyboard.press('Shift+Tab');
   const colors=await badge.evaluate(node=>{const style=getComputedStyle(node);return{color:style.color,background:style.backgroundColor,outline:style.outlineStyle};});
   assert.equal(colors.color,'rgb(4, 120, 87)');assert.notEqual(colors.color,colors.background);assert.equal(colors.outline,'solid');
   await page.evaluate(()=>document.documentElement.dataset.theme='dark');
  });
  await check('One hub switches by keyboard and legacy connection flags cannot fabricate Google authorization',async()=>{
   await page.evaluate(async()=>{await qa.db.saveSetting('gdrive_backup_method','direct');await qa.db.saveSetting('gdrive_connected',true);await qa.db.saveSetting('gdrive_backup_path','obsolete-local-setting');qa.openGoogle();});
   await page.locator('.bn-backup-drive-panel').waitFor();assert.equal(await page.getByRole('dialog').count(),1);
   assert.equal(await page.locator('.bn-backup-drive-panel').getAttribute('data-drive-method'),'desktop');
   assert.equal(await page.getByRole('button',{name:'Connect with Google',exact:true}).count(),0);
   assert.ok(!(await page.locator('.bn-backup-drive-panel').innerText()).includes('obsolete-local-setting'));
   assert.match(await page.locator('.bn-backup-hub-footer-state').innerText(),/not been confirmed/);
   const tab=page.locator('.bn-backup-hub').getByRole('tab').nth(1);await tab.focus();await tab.press('ArrowLeft');
   assert.equal(await page.locator('.bn-backup-hub').getAttribute('data-active-tab'),'local');await page.locator('.bn-backup-hub').getByRole('tab').nth(0).press('End');
   assert.equal(await page.locator('.bn-backup-hub').getAttribute('data-active-tab'),'drive');
  });
  await check('Desktop Drive requires its own folder and reports prepared files separately from Local',async()=>{
   await page.locator('.bn-backup-drive-panel').waitFor();
   await page.evaluate(destination=>{qa.nextFolder=destination;},cloudDir);
   await page.getByRole('button',{name:'Choose Drive sync folder',exact:true}).click();
   await page.waitForFunction(()=>qa.backup.getSnapshot().targets.length===2);await page.evaluate(()=>qa.backup.controller.stop());
   assert.equal((await state()).targets.find(t=>t.kind==='drive').targetDir,path.resolve(cloudDir));
   assert.equal(await page.locator('.bn-backup-drive-panel .bn-backup-destination').count(),1);
   await page.getByRole('button',{name:'Prepare files for Drive',exact:true}).click();
   await page.waitForFunction(()=>qa.backup.getSnapshot().allPdfsCurrent&&!qa.backup.getSnapshot().syncing);
   assert.equal((await state()).cloudUploadVerified,false);
   assert.equal(await page.locator('.bn-backup-drive-panel .bn-backup-hub-table tbody tr').count(),5);
   assert.match(await page.locator('.bn-backup-hub-footer-state').innerText(),/not been confirmed/);
   assert.ok(!(await page.locator('.bn-backup-drive-panel').innerText()).includes(driveDir));
   if(process.env.BETTERNOTE_QA_SCREENSHOTS==='1'){const file=path.join(fixture,'unified-backup-drive-desktop.png');await page.screenshot({path:file});screenshots.push(file);}
   await page.evaluate(async()=>{await qa.db.saveSetting('gdrive_backup_path',null);await qa.backup.destinationChanged();qa.backup.controller.stop();});
   assert.equal(await page.locator('.bn-backup-drive-panel .bn-backup-destination').count(),0);
   await closeDetails();
  });
  await check('A failed Drive folder reports failure in its own tab while the Local backup remains current',async()=>{
   await page.evaluate(()=>qa.openGoogle());await page.locator('.bn-backup-drive-panel').waitFor();
   await page.locator('.bn-backup-drive-panel').waitFor();
   await page.evaluate(destination=>{qa.nextFolder=destination;},blocked);
   await page.getByRole('button',{name:'Choose Drive sync folder',exact:true}).click();await page.waitForFunction(()=>qa.backup.getSnapshot().targets.some(t=>t.kind==='drive'&&t.error));
   await page.getByRole('button',{name:'Prepare files for Drive',exact:true}).click();
   await page.locator('.bn-backup-hub-notice.is-error').waitFor();assert.equal((await state()).status,'current');
   assert.equal(await page.locator('.bn-backup-hub-notice.is-success').count(),0);
   await page.evaluate(async()=>{await qa.db.saveSetting('gdrive_backup_path',null);await qa.backup.destinationChanged();qa.backup.controller.stop();});await closeDetails();
  });

  await check('One conflicting Drive notebook shows its name and edit times while healthy files complete',async()=>{
   const conflictDir=path.join(fixture,'conflicting-drive');
   const originals=await page.evaluate(async()=>[await qa.db.getBackupNotebookSnapshot('a'),await qa.db.getBackupNotebookSnapshot('b')]);
   originals[0].updatedAt+=60000;
   await fsp.mkdir(path.join(conflictDir,'Full_System'),{recursive:true});
   const original=Buffer.from(JSON.stringify({notebooks:originals,folders:[]}));
   const savedFile=path.join(conflictDir,'Full_System','BetterNote_Latest_Backup.json');
   await fsp.writeFile(savedFile,original);
   await page.evaluate(()=>qa.openGoogle());await page.locator('.bn-backup-drive-panel').waitFor();
   await page.locator('.bn-backup-drive-panel').waitFor();
   await page.evaluate(destination=>{qa.nextFolder=destination;},conflictDir);
   await page.getByRole('button',{name:'Choose Drive sync folder',exact:true}).click();
   await page.waitForFunction(()=>qa.backup.getSnapshot().hasDriveFolder);await page.evaluate(()=>qa.backup.controller.stop());
   await page.getByRole('button',{name:'Prepare files for Drive',exact:true}).click();
   await page.locator('.bn-backup-hub-notice.is-error').waitFor();
   const snapshot=await state(),target=snapshot.targets.find(t=>t.kind==='drive');
   assert.equal(snapshot.status,'current');assert.equal(target.editableCount,1);assert.equal(target.pdfCount,1);
   assert.equal(target.notebookIssues.a.name,originals[0].name);assert.equal(target.notebookIssues.a.backupUpdatedAt,originals[0].updatedAt);
   assert.equal(target.fatalError,null);assert.equal(target.dataCurrent,false);
   const issue=page.locator('[data-backup-conflict-id="a"]');assert.match(await issue.innerText(),/A newer backup already exists/);
   assert.ok((await issue.innerText()).includes(originals[0].name));
   assert.match(await issue.innerText(),/Last edit on this device/);assert.match(await issue.innerText(),/Last edit in the backup/);
   const table=page.locator('.bn-backup-drive-panel .bn-backup-hub-table');
   assert.equal(await table.locator('tr[data-notebook-id="b"] .bn-backup-file-state.is-current').count(),2);
   assert.equal(await table.locator('tr[data-notebook-id="a"] .bn-backup-file-state.is-error').count(),2);
   assert.equal(await table.locator('tr[data-notebook-id="a"][data-file-kind="pdf"] .bn-backup-file-state').innerText(),'Waiting for notebook review');
   assert.equal(await table.locator('tr[data-notebook-id="a"] button').filter({hasText:'Retry PDF'}).count(),0);
   assert.deepEqual(await fsp.readFile(savedFile),original);
   if(process.env.BETTERNOTE_QA_SCREENSHOTS==='1'){const file=path.join(fixture,'desktop-backup-conflict-details.png');await page.screenshot({path:file});screenshots.push(file);}
   for(const language of ['th','zh','ru','en']){
    await page.evaluate(language=>qa.lang.setAppLanguage(language),language);
    const expected=await page.evaluate(()=>qa.lang.TRANSLATIONS[qa.lang.getAppLanguage()].backupConflictNewer);
    await page.getByText(expected,{exact:true}).waitFor();
   }
   await page.evaluate(async()=>{await qa.db.saveSetting('gdrive_backup_path',null);await qa.backup.destinationChanged();qa.backup.controller.stop();});await closeDetails();
  });

  await check('Settings has one Backup and Sync entry and closes before opening the same hub',async()=>{
   const tooltip=await page.evaluate(()=>qa.lang.TRANSLATIONS.en.librarySettingsBtnTooltip);
   await page.getByRole('button',{name:tooltip,exact:true}).click();await page.locator('.bn-settings-title').waitFor();
   assert.equal(await page.locator('.bn-settings-btn-sync').count(),1);
   assert.equal(await page.locator('.bn-settings-body .bn-settings-card').count(),1);
   await page.locator('.bn-settings-btn-sync').click();await page.locator('.bn-backup-hub').waitFor();
   assert.equal(await page.getByRole('dialog').count(),1);assert.equal(await page.locator('.bn-settings-title').count(),0);
   await page.waitForFunction(()=>document.querySelector('.bn-backup-hub')?.dataset.activeTab==='local');assert.equal(await page.locator('.bn-backup-hub').getAttribute('data-active-tab'),'local');await closeDetails();
  });
  await check('Closing the synthetic UI stops observers and produces no renderer exception',async()=>{
   await page.evaluate(()=>qa.stop());assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>qa.alerts),[]);
  });
  console.log(JSON.stringify({total:results.length,passed:results.length,failed:0,results,screenshots,fixtureDirectory:fixture},null,2));
 }finally{if(browser)await browser.close();await client.close();}
})().catch(error=>{console.error(error.stack);console.log(JSON.stringify({passed:results.length,results,screenshots},null,2));process.exitCode=1;});
