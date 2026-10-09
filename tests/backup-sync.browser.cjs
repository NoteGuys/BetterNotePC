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
window.electronAPI={isElectron:true,getAppInfo:async()=>({deviceName:qa.deviceName||'Synthetic PC'}),getDriveSyncCapabilities:async()=>({protocol:1}),saveBackup:async command=>{qa.native.push(command.action);return writeBridge(await qaEncodeBackupCommand(command));},
 scanBackupFolder:async(folder,options)=>{qa.reads.push(options);if(qa.holdRead&&options?.syncMode==='note')await qa.readGate;
 const result=await readBridge(folder,options);if(result.encoded)result.encoded=Uint8Array.from(result.encoded);return result;},
 onCloseSaveRequest:()=>()=>{},onCloseSaveCancelled:()=>()=>{},setLocalSaveGuardReady:()=>{},completeCloseSaveRequest:()=>{}};
qa.seed=async(source,paths)=>{qa.deviceName=paths.local.endsWith('A')?'Desktop QA':'Surface QA';await db.saveSetting('initialDataSeeded',true);if(source.notebooks.length)await db.restoreBackupAtomic(prepareBackup(source),'seed');
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
    if(args.path.endsWith(path.join('Library','LibraryView.jsx')))return{contents:fs.readFileSync(args.path,'utf8').replace("  const { t, language } = useLanguage();","  window.qa.library={onDeleteNotebook,onUpdateNotebook,onOpenBackupStatus,notebooks}; const { t, language } = useLanguage();"),loader:'jsx'};
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
   await page.exposeFunction('readBridge',async(folder,options)=>{assert.ok(path.resolve(folder).startsWith(fixture+path.sep));const result=await reader.execute({folderPath:folder,...options});if(result.encoded)result.encoded=Array.from(result.encoded);return result;});
   await page.goto(origin);await page.addScriptTag({content:bundle.outputFiles[0].text});pages.push(page);
  }
  const[a,b]=pages,state=p=>p.evaluate(()=>qa.state()),get=(p,id)=>p.evaluate(id=>qa.db.getBackupNotebookSnapshot(id),id),run=p=>p.evaluate(()=>qa.run());
  for(const [page,local,notebooks]of [[a,localA,[note('shared'),note('unrelated')]],[b,localB,[]]]){
   await page.evaluate(async input=>{await qa.seed(input.source,input.paths);qa.mount();},{source:{folders:[],notebooks},paths:{local,drive}});
   await page.waitForFunction(()=>qa.library);await page.evaluate(()=>qa.backup.stopScheduledSync());
  }

  let ownA,ownB;
  await check('Empty second machine backs up without receiving anything from Drive',async()=>{
   assert.equal((await run(a)).success,true);assert.equal((await run(b)).success,true);
   assert.equal((await state(b)).notes.length,0);assert.equal(await get(b,'shared'),null);
   ownA=(await state(a)).status.targets.find(t=>t.kind==='drive').targetDir;ownB=(await state(b)).status.targets.find(t=>t.kind==='drive').targetDir;
   assert.notEqual(ownA,ownB);assert.equal((await state(a)).status.targets.find(t=>t.kind==='drive').selectedRoot,drive);
  });
  await check('Two machines can write different content with the same notebook ID without a restore prerequisite',async()=>{
   await b.evaluate(source=>qa.edit(source),{folders:[],notebooks:[note('shared',1,'Surface own writing')]});const result=await run(b);assert.equal(result.success,true,JSON.stringify(result));
   const ar=await reader.execute({folderPath:ownA}),br=await reader.execute({folderPath:ownB});assert.equal(ar.success,true);assert.equal(br.success,true);
   assert.equal(ar.data.notebooks.find(n=>n.id==='shared').pages[0].textElements[0].text,'initial');assert.equal(br.data.notebooks[0].pages[0].textElements[0].text,'Surface own writing');
  });
  await check('A failed permanent deletion rolls back notebook, pages and tombstone together',async()=>{
   const result=await b.evaluate(async()=>{
    const original=IDBObjectStore.prototype.delete;let rejected=false;
    IDBObjectStore.prototype.delete=function(key){if(this.name==='pages'&&key==='shared-p')return this.add({id:key});return original.call(this,key);};
    try{await qa.db.deleteNotebook('shared');}catch(_){rejected=true;}finally{IDBObjectStore.prototype.delete=original;}
    return {rejected,exists:!!await qa.db.getNotebookById('shared'),pages:(await qa.db.getPagesByNotebookId('shared')).length,deleted:(await qa.db.getBackupMetadata()).deletedNotebooks.some(n=>n.id==='shared')};
   });assert.deepEqual(result,{rejected:true,exists:true,pages:1,deleted:false});
  });
  await check('Permanent deletion through the app publishes its tombstone; startup and backup do not resurrect it',async()=>{
   // Reload App state from the same persistent profile, then use its actual deletion handler.
   await b.evaluate(()=>{qa.renderer.unmount();qa.mount();});await b.waitForFunction(()=>qa.library.notebooks.some(n=>n.id==='shared'));await b.evaluate(()=>qa.library.onDeleteNotebook('shared'));
   assert.equal((await run(b)).success,true);assert.equal((await state(b)).notes.length,0);
   const meta=await b.evaluate(()=>qa.db.getBackupMetadata());assert.equal(meta.deletedNotebooks[0].id,'shared');
   assert.equal((await reader.execute({folderPath:ownB})).data.notebooks.length,0);assert.ok((await reader.execute({folderPath:ownA})).data.notebooks.length);
   await b.evaluate(()=>{qa.renderer.unmount();qa.mount();});await b.waitForTimeout(22000);assert.equal((await state(b)).notes.length,0);
   assert.equal((await b.evaluate(()=>qa.reads)).some(r=>r?.syncMode||r?.encodedRecovery),false);
   await b.evaluate(()=>qa.backup.stopScheduledSync());
  });
  await check('An empty new-library hint can be dismissed permanently across app remounts',async()=>{
   await b.evaluate(async()=>{await qa.db.saveSetting('backup_deleted_notebooks_v2',[]);qa.renderer.unmount();qa.mount();});
   const hint=b.locator('.bn-cloud-migration-banner');await hint.waitFor({timeout:10000});await hint.getByRole('button',{name:'Close',exact:true}).click();
   await b.evaluate(()=>{qa.renderer.unmount();qa.mount();});await b.waitForTimeout(1800);assert.equal(await hint.count(),0);assert.equal((await state(b)).notes.length,0);await b.evaluate(()=>qa.backup.stopScheduledSync());
  });
  await check('Restore UI lists computer names and dates, and cancellation never imports data',async()=>{
   await b.locator('.bn-backup-indicator').first().click();await b.getByRole('tab',{name:'Google Drive',exact:true}).click();
   await b.getByRole('button',{name:'Restore from Folder',exact:true}).click();const choice=b.locator('[data-recovery-device-trigger]');await choice.waitFor();await choice.click();
   const options=await b.getByRole('option').allTextContents();assert.ok(options.some(s=>s.includes('Desktop QA')),JSON.stringify(options));assert.ok(options.some(s=>s.includes('Surface QA')),JSON.stringify(options));
   await b.getByRole('option').first().press('Escape');assert.equal((await state(b)).notes.length,0);await b.locator('[data-recovery-choices]').getByRole('button',{name:'Close',exact:true}).click();assert.equal((await state(b)).notes.length,0);
  });
  await check('Explicitly chosen other-machine backup restores rich content without changing the source',async()=>{
   const file=path.join(ownA,'Full_System','backup_manifest.json'),before=await disk.readFile(file);
   await b.getByRole('button',{name:'Restore from Folder',exact:true}).click();await b.locator('[data-recovery-device-trigger]').click();await b.locator('[data-recovery-device-option]').filter({hasText:'Desktop QA'}).click();
   await b.locator('[data-recovery-choices]').getByRole('button',{name:'Restore from Folder',exact:true}).click();
   await b.waitForFunction(()=>qa.library.notebooks.some(n=>n.id==='shared'),{},{timeout:15000}).catch(async error=>{console.error('Recovery diagnostics',await b.evaluate(()=>({errors:qa.errors,recovery:qa.recovery.backupRecovery.getSnapshot(),notebooks:qa.library.notebooks.map(n=>n.id)})));throw error;});assert.deepEqual((await get(b,'shared')).pages,(await get(a,'shared')).pages);
   assert.deepEqual(await disk.readFile(file),before);assert.deepEqual(await b.evaluate(()=>qa.errors),[]);assert.equal((await b.evaluate(()=>qa.db.getBackupMetadata())).deletedNotebooks.some(n=>n.id==='shared'),false);
   await check('Device menu reopens after consecutive restores with mouse, native pen, touch and keyboard',async()=>{
    const cdp=await b.context().newCDPSession(b);
    const tap=async(locator,type)=>{const bounds=await locator.boundingBox();assert.ok(bounds);const x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
      if(type==='touch'){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
      else {await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1,pointerType:'pen',force:.5});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',buttons:0,clickCount:1,pointerType:'pen',force:0});}
    };
    for(const input of ['mouse','pen','touch','keyboard']){
      await b.getByRole('button',{name:'Restore from Folder',exact:true}).click();
      const trigger=b.locator('[data-recovery-device-trigger]');await trigger.waitFor();
      if(input==='mouse')await trigger.click();else if(input==='keyboard'){await trigger.focus();await trigger.press('ArrowDown');}else await tap(trigger,input);
      await b.getByRole('listbox').waitFor();assert.equal(await b.getByRole('option').count(),2);
      const destination=b.locator('[data-recovery-device-option]').filter({hasText:'Desktop QA'});
      if(input==='mouse')await destination.click();else if(input==='keyboard'){await destination.focus();await destination.press('Enter');}else await tap(destination,input);
      await b.getByRole('listbox').waitFor({state:'hidden'});assert.ok((await trigger.innerText()).includes('Desktop QA'));
      // Reopen the same menu and close it with Escape without closing the backup dialog.
      await trigger.click();await b.getByRole('listbox').waitFor();await b.getByRole('option').first().press('Escape');
      assert.equal(await b.getByRole('listbox').count(),0);assert.equal(await b.locator('.bn-backup-dialog').count(),1);
      await b.locator('[data-recovery-choices]').getByRole('button',{name:'Restore from Folder',exact:true}).click();
      await b.locator('[data-recovery-choices]').waitFor({state:'hidden',timeout:30000});
      assert.deepEqual((await get(b,'shared')).pages,(await get(a,'shared')).pages);assert.deepEqual(await b.evaluate(()=>qa.errors),[]);
    }
    await b.getByRole('button',{name:'Restore from Folder',exact:true}).click();await b.locator('[data-recovery-device-trigger]').click();
    assert.equal(await b.getByRole('option').count(),2);await b.getByRole('option').first().press('Escape');await b.locator('[data-recovery-choices]').getByRole('button',{name:'Close',exact:true}).click();
   });
   await b.locator('.bn-backup-btn-close').click();assert.equal((await run(b)).success,true);
  });
  await check('One-sided PC updates replace unchanged Surface work; independent Surface ink is preserved',async()=>{
   const original=await get(a,'shared'),count=(await state(b)).notes.length;
   // Upgrade from Fix8: no content receipt yet, but PC adds ink to the exact original pages.
   await b.evaluate(async()=>{const key='backup_restore_content_base_v1',base=await qa.db.getSetting(key);delete base.entries.shared;await qa.db.saveSetting(key,base);});
   const additive=structuredClone(original);additive.pages[0].strokes.push({id:'first-pc-ink',points:[{x:80,y:15},{x:95,y:25}]});additive.updatedAt=original.updatedAt+1;
   await a.evaluate(source=>qa.edit(source),{folders:[],notebooks:[additive]});assert.equal((await run(a)).success,true);
   assert.equal((await b.evaluate(folder=>qa.backup.restoreFromCloudBackup(folder),ownA)).success,true);
   assert.equal((await state(b)).notes.length,count);assert.deepEqual((await get(b,'shared')).pages,additive.pages);
   const changed=structuredClone(original);changed.updatedAt=1;
   changed.pages[0].textElements[0].text='PC revised text';changed.pages[0].strokes.push({id:'pc-added',points:[{x:85,y:90},{x:110,y:120}]});
   await a.evaluate(source=>qa.edit(source),{folders:[],notebooks:[changed]});assert.equal((await run(a)).success,true);
   assert.equal((await b.evaluate(folder=>qa.backup.restoreFromCloudBackup(folder),ownA)).success,true);
   assert.equal((await state(b)).notes.length,count);assert.deepEqual((await get(b,'shared')).pages,changed.pages);
   assert.equal((await b.evaluate(folder=>qa.backup.restoreFromCloudBackup(folder),ownA)).success,true);assert.equal((await state(b)).notes.length,count);
   const local=await get(b,'shared'),peer=structuredClone(changed);local.pages[0].strokes.push({id:'surface-added',points:[{x:500,y:100},{x:530,y:120}]});
   // Simulate an unchanged clock: detection must depend on actual content.
   await b.evaluate(source=>qa.edit(source),{folders:[],notebooks:[local]});peer.pages[0].strokes.push({id:'pc-second',points:[{x:300,y:100},{x:330,y:120}]});peer.updatedAt=2;
   await a.evaluate(source=>qa.edit(source),{folders:[],notebooks:[peer]});assert.equal((await run(a)).success,true);
   const result=await b.evaluate(folder=>qa.backup.restoreFromCloudBackup(folder),ownA);assert.equal(result.success,true);
   const notes=(await state(b)).notes;assert.equal(notes.length,count+1);const copy=notes.find(n=>n.syncConflictOf==='shared');assert.ok(copy);
   assert.deepEqual((await get(b,copy.id)).pages[0].strokes,local.pages[0].strokes);assert.deepEqual((await get(b,'shared')).pages,peer.pages);
   assert.equal((await b.evaluate(folder=>qa.backup.restoreFromCloudBackup(folder),ownA)).success,true);assert.equal((await state(b)).notes.length,count+1);
  });
  await check('Deleting local work in a populated library does not display a repeated Restore banner',async()=>{
   await b.evaluate(()=>qa.library.onDeleteNotebook('unrelated'));await b.waitForTimeout(1800);assert.equal(await b.locator('.bn-cloud-migration-banner').count(),0);
   await b.evaluate(()=>{qa.renderer.unmount();qa.mount();});await b.waitForTimeout(1800);assert.equal(await b.locator('.bn-cloud-migration-banner').count(),0);
  });
  await check('Unchanged device data keeps all source files and timestamps untouched',async()=>{
   const files=await disk.readdir(ownA,{recursive:true}),before=new Map();for(const file of files){const full=path.join(ownA,file),st=await disk.stat(full);if(st.isFile())before.set(file,{mtime:st.mtimeMs,bytes:await disk.readFile(full)});}
   assert.equal((await run(a)).success,true);for(const[file,value]of before){const full=path.join(ownA,file);assert.equal((await disk.stat(full)).mtimeMs,value.mtime,file);assert.deepEqual(await disk.readFile(full),value.bytes,file);}
  });
  await check('No renderer errors or false cloud confirmation',async()=>{assert.deepEqual(errors,[]);for(const page of pages)assert.equal((await state(page)).status.cloudUploadVerified,false);});
  for(const page of pages)await page.evaluate(()=>{qa.renderer.unmount();qa.backup.stopScheduledSync();});
  console.log(JSON.stringify({passed:passed.length,failed:0,fixture,syntheticOnly:true,realDriveAccess:false}));
 }finally{await reader.close();for(const client of clients)await client.close();await browser?.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
