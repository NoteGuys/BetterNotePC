// Real App, native reader, recovery worker and IndexedDB; synthetic data only.
const fs=require('node:fs'),disk=fs.promises,path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const {chromium}=require(process.env.BETTERNOTE_PLAYWRIGHT_PATH||'playwright');
const {createBackupWriter}=require('../electron/backupWriter.cjs'),{createBackupReaderClient}=require('../electron/backupReaderClient.cjs');
const qaRoot=process.env.BETTERNOTE_QA_TEMP,root=path.resolve(__dirname,'..');if(!qaRoot||!path.isAbsolute(qaRoot))throw Error('Use isolated QA');
const note=(id,pages=1)=>({id,name:id,updatedAt:40,pageCount:pages,folderId:'class',pages:Array.from({length:pages},(_,i)=>({id:id+'-p'+i,notebookId:id,pageIndex:i,strokes:[{tool:'pen',color:'#dd2222',width:3,points:[{x:-20,y:15},{x:120,y:45}]}],textElements:[{id:'t',text:'QA page '+i,x:2,y:3}],imageElements:[{id:'img',src:'data:image/jpeg;base64,'+'A'.repeat(pages>1?128*1024:1024),locked:true}],pageWidth:1200,pageHeight:1697}))});
const entry=String.raw`
import React from 'react';import{createRoot}from'react-dom/client';import{App}from'./src/App.jsx';
import*as db from'./src/services/db.js';import*as recovery from'./src/services/backupRecoveryService.js';import{autoBackupService as backup}from'./src/services/autoBackupService.js';import{prepareBackup}from'./electron/backupValidation.js';
window.qa={db,recovery,backup,pulses:[],progress:null};window.alert=()=>{};window.confirm=()=>true;
window.electronAPI={isElectron:true,getAppInfo:async()=>({deviceName:'Desktop QA'}),saveBackup:async()=>({success:true,targets:[]}),
onRecoveryProgress:handler=>{qa.progress=handler;return()=>qa.progress=null;},cancelRecoveryRead:id=>cancelBridge(id),
scanBackupFolder:async(folder,options)=>{if(qa.holdRead)return new Promise(resolve=>{qa.heldResolve=resolve;});const result=await readBridge(folder,options);if(result.base64){const text=atob(result.base64);result.encoded=Uint8Array.from(text,c=>c.charCodeAt(0));delete result.base64;}return result;},
onCloseSaveRequest:()=>()=>{},onCloseSaveCancelled:()=>()=>{},setLocalSaveGuardReady:()=>{}};
qa.mount=async seed=>{await db.saveSetting('initialDataSeeded',true);await db.restoreBackupAtomic(prepareBackup(seed),'seed');createRoot(document.getElementById('root')).render(<App/>);};
qa.run=folder=>{qa.done=false;qa.job=backup.restoreFromCloudBackup(folder).then(result=>{qa.done=true;return result;});};
recovery.backupRecovery.subscribe(()=>{const snap=recovery.backupRecovery.getSnapshot();if(snap.progress)qa.pulses.push(snap.progress);if(qa.cancelPlanning&&snap.progress?.stage==='planning'&&snap.progress.notebooksDone>=1)recovery.backupRecovery.cancel();});
`;
(async()=>{
 const fixture=await disk.mkdtemp(path.join(qaRoot,'betternote-large-browser-')),device={id:'surface-large-qa',name:'Surface QA'},folder=path.join(fixture,'Devices',device.id),notes=[note('shared',91),...Array.from({length:10},(_,i)=>note('n'+i))];
 const writer=createBackupWriter({localDir:fixture}),metadata={folders:[{id:'class',name:'Lecture Notes',parentId:null}],notebooks:notes.map(({pages,...header})=>header)};
 assert.equal((await writer.execute({action:'begin',jobId:'large',metadata,metadataRevision:'large',backupDevice:device,phase:'data'})).success,true);
 for(const n of notes)assert.equal((await writer.execute({action:'notebook',jobId:'large',notebook:n})).success,true);
 assert.equal((await writer.execute({action:'finish',jobId:'large',metadataRevision:'large'})).success,true);
 const assets=path.join(root,'dist/assets'),cover=fs.readdirSync(assets).find(n=>/^notebookCover\.worker-.*\.js$/.test(n));
 const plugin={name:'large-recovery',setup(build){require('./helpers/recovery-worker.cjs').setupRecoveryWorker(build);
 build.onResolve({filter:/pdf\.worker\.min\.mjs\?url$/},()=>({path:'pdf',namespace:'qa-url'}));build.onLoad({filter:/.*/,namespace:'qa-url'},()=>({contents:"export default '/unused-worker'",loader:'js'}));
 build.onResolve({filter:/notebookCover\.worker\.js\?worker&inline$/},()=>({path:'cover',namespace:'qa-cover'}));build.onLoad({filter:/.*/,namespace:'qa-cover'},()=>({contents:fs.readFileSync(path.join(assets,cover),'utf8'),loader:'js'}));
 build.onLoad({filter:/\.jsx$/},args=>{if(args.path.endsWith(path.join('Editor','NoteEditor.jsx')))return{contents:'export const NoteEditor=()=>null;',loader:'jsx'};if(args.path.endsWith(path.join('Common','DocumentTabBar.jsx')))return{contents:'export const DocumentTabBar=()=>null;',loader:'jsx'};});}};
 const bundle=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},plugins:[plugin],logLevel:'silent'});
 const browser=await chromium.launch({headless:true,executablePath:process.env.BETTERNOTE_QA_BROWSER,env:{...process.env,TEMP:qaRoot,TMP:qaRoot}}),errors=[];let reader;
 try{
 for(const mode of ['cancel-read','cancel-plan','complete']){
  const context=await browser.newContext({viewport:{width:1360,height:900}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));reader=createBackupReaderClient();
  await context.route('**/*',r=>r.request().url()==='https://betternote-large-qa.invalid/'?r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><div id="root"></div>'}):r.abort());
  await page.exposeFunction('readBridge',async(p,options)=>{assert.equal(p,folder);let chain=Promise.resolve();const result=await reader.execute({folderPath:p,...options},progress=>{chain=chain.then(()=>page.evaluate(p=>qa.progress?.(p),{...progress,recoveryId:options.recoveryId}));});await chain;if(result.encoded){result.base64=Buffer.from(result.encoded).toString('base64');delete result.encoded;}return result;});
  await page.exposeFunction('cancelBridge',async()=>{await reader.cancel();await page.evaluate(()=>qa.heldResolve?.({success:false,reason:'backup-recovery-cancelled'}));return true;});
  await page.goto('https://betternote-large-qa.invalid/');await page.addScriptTag({content:bundle.outputFiles[0].text});const old=note('shared');old.name='My local original';old.pages[0].textElements[0].text='Keep local writing';
  await page.evaluate(source=>qa.mount(source),{folders:[{id:'class',name:'Lecture Notes',parentId:null}],notebooks:[old,{...note('unrelated'),folderId:null}]});await page.waitForFunction(()=>document.querySelectorAll('button').length>5);await page.evaluate(()=>qa.backup.stopScheduledSync());
  await page.evaluate(mode=>{qa.holdRead=mode==='cancel-read';qa.cancelPlanning=mode==='cancel-plan';},mode);await page.evaluate(folder=>qa.run(folder),folder);
  if(mode==='cancel-read'){await page.locator('[data-cancel-recovery]').waitFor();await page.locator('[data-cancel-recovery]').click();}
  await page.waitForFunction(()=>qa.done,{},{timeout:90000});const result=await page.evaluate(()=>qa.job),state=await page.evaluate(async()=>({notes:await qa.db.getAllNotebooks(),active:qa.recovery.backupRecovery.getSnapshot().active}));assert.equal(state.active,false);
  if(mode!=='complete'){assert.equal(result.reason,'backup-recovery-cancelled');assert.equal(state.notes.length,2);assert.equal(state.notes.find(n=>n.id==='shared').name,'My local original');console.log('PASS '+mode+' preserves all local work and releases recovery UI');}
  else{assert.equal(result.success,true,JSON.stringify(result));assert.equal(result.count,12);assert.equal(state.notes.length,13);assert.ok(state.notes.some(n=>n.name.startsWith('My local original (')));const restored=await page.evaluate(async()=>{const n=await qa.db.getBackupNotebookSnapshot('shared');return{pages:n.pages.length,first:n.pages[0].imageElements[0],last:n.pages.at(-1).textElements[0].text,ink:n.pages[0].strokes[0],folder:n.folderId};});
   assert.equal(restored.pages,91);assert.equal(restored.first.src.length,notes[0].pages[0].imageElements[0].src.length);assert.equal(restored.first.locked,true);assert.equal(restored.last,'QA page 90');assert.equal(restored.folder,'class');assert.deepEqual(restored.ink,notes[0].pages[0].strokes[0]);const pulses=await page.evaluate(()=>qa.pulses);assert.ok(pulses.some(p=>p.stage==='reading'&&p.bytesDone>1048576));assert.ok(pulses.some(p=>p.stage==='planning'&&p.notebooksDone===11));console.log('PASS 11-notebook / 91-page restore preserves complete rich data, conflict copy and real progress');
  }
  assert.equal(await page.locator('.bn-backup-recovery-overlay').count(),0);await reader.close();reader=null;await context.close();
 }
 assert.deepEqual(errors,[]);console.log('Large recovery browser: 3/3 passed; '+fixture);
 }finally{await reader?.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
