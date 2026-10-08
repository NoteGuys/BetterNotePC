// Real PDF.js import, synthetic PDF, isolated file-origin database. No external requests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const {pathToFileURL}=require('node:url'),{chromium,_electron}=require(process.env.BETTERNOTE_PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),base=process.env.BETTERNOTE_QA_TEMP;
if(!base||!path.isAbsolute(base))throw Error('An isolated QA directory is required');
(async()=>{
 const dir=fs.mkdtempSync(path.join(base,'pdf-import-')),html=path.join(dir,'fixture.html');fs.writeFileSync(html,'<!doctype html><div id="root">Isolated PDF import</div>');
 const worker=path.join(root,'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
 const entry=String.raw`
 import { jsPDF } from 'jspdf';import * as pdf from './src/services/pdfService.js';
 import * as db from './src/services/db.js';
 import * as raster from './src/services/pdfRasterService.js';import {appCacheService as cache} from './src/services/appCacheService.js';
 import * as engine from './src/utils/pdfExportEngine.js';import * as preparation from './src/services/backupPreparationService.js';
 import React from 'react';import {createRoot} from 'react-dom/client';import {ExportModal} from './src/components/Common/ExportModal.jsx';import * as i18n from './src/services/i18n.js';import {CanvasBoard} from './src/components/Editor/CanvasBoard.jsx';
 import * as editorPages from './src/services/editorPagesService.js';import { prepareBackup } from './electron/backupValidation.js';
 window.qa={pdf,db,editorPages,prepareBackup,raster,cache,engine,preparation,jsPDF,i18n,encodes:0};
 qa.mountExportError=language=>{
  i18n.setAppLanguage(language);qa.exportAlert=null;qa.previousAlert=window.alert;window.alert=message=>qa.exportAlert=message;
  window.electronAPI={exportPdfDocument:async request=>request.action==='capabilities'?{protocol:2,batchPages:4,batchBytes:8000000}:request.action==='begin'?{id:'qa-error'}:request.action==='cancel'?{cancelled:true}:{error:'pdf-load-failed',retry:false}};
  const element=document.createElement('div');element.id='qa-export-error';document.body.appendChild(element);qa.exportRoot=createRoot(element);
  qa.exportRoot.render(React.createElement(ExportModal,{isOpen:true,onClose:()=>{},notebook:{name:'QA',templateId:'blank'},pages:Array.from({length:3},()=>({pageWidth:800,pageHeight:1200,strokes:[],textElements:[]})),currentPageIndex:0}));
 };
 qa.unmountExportError=()=>{qa.exportRoot.unmount();document.getElementById('qa-export-error').remove();window.alert=qa.previousAlert;delete window.electronAPI;i18n.setAppLanguage('en');};let renderer;
 qa.mountCanvas=page=>{renderer=createRoot(document.getElementById('root'));renderer.render(React.createElement(CanvasBoard,{page,templateId:'blank',activeTool:'pen',activeColor:'#0000ff',activeWidth:4,zoom:1}));};qa.unmountCanvas=()=>{renderer?.unmount();renderer=null;};const encode=HTMLCanvasElement.prototype.toDataURL;
 HTMLCanvasElement.prototype.toDataURL=function(...args){qa.encodes++;return encode.apply(this,args);};
 qa.import=async()=>{
  const doc=new jsPDF({unit:'pt',format:[400,600]});doc.setTextColor(255,0,0);doc.text('Synthetic PDF page one',40,80);
  doc.addPage([600,400],'landscape');doc.text('Synthetic PDF page two',40,80);doc.addPage([400,600]);doc.text('Synthetic PDF page three',40,80);
  const bytes=doc.output('arraybuffer'),file=new File([bytes],'synthetic.pdf',{type:'application/pdf'});
  const hash=async input=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',input)));
  qa.originalHash=await hash(bytes);qa.progress=[];qa.nb=await pdf.importPdfAsNotebook(file,null,(n,total)=>qa.progress.push([n,total]));
  const snapshot=await db.getBackupNotebookSnapshot(qa.nb.id);qa.snapshot=snapshot;
  const original=snapshot.pages.find(p=>p.pdfOriginal).pdfOriginal.dataUrl;
  return{count:snapshot.pages.length,images:snapshot.pages.every(p=>p.pdfPageImage.startsWith('data:image/jpeg')),sources:snapshot.pages.filter(p=>p.pdfOriginal).length,
    hash:await hash(await(await fetch(original)).arrayBuffer()),originalHash:qa.originalHash,encodes:qa.encodes,progress:qa.progress,widths:snapshot.pages.map(p=>[p.pageWidth,p.pageHeight])};
 };
 `;
 const compiled=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'js'},bundle:true,write:false,format:'iife',platform:'browser',logLevel:'silent',plugins:[{name:'editor-worker',setup:require('./helpers/recovery-worker.cjs').setupRecoveryWorker},{name:'local-pdf-worker',setup(build){build.onResolve({filter:/pdf\.worker\.min\.mjs\?url$/},()=>({path:'pdf',namespace:'url'}));build.onLoad({filter:/.*/,namespace:'url'},()=>({contents:'export default '+JSON.stringify(pathToFileURL(worker).href),loader:'js'}));}}]});
 const native=process.env.BETTERNOTE_QA_PDF_ELECTRON==='1';let browser,application,context,page;
 if(native){
  const main=path.join(dir,'main.cjs');
  fs.writeFileSync(main,"const {app,BrowserWindow}=require('electron'),path=require('node:path');const dir=process.argv.at(-1);app.setPath('userData',path.join(dir,'profile'));app.setPath('sessionData',path.join(dir,'session'));app.whenReady().then(()=>{const win=new BrowserWindow({show:false,width:1360,height:1000,webPreferences:{nodeIntegration:false,contextIsolation:true,webSecurity:false,backgroundThrottling:false}});win.loadFile(path.join(dir,'fixture.html'));});app.on('window-all-closed',()=>app.quit());");
  const env={...process.env,TEMP:base,TMP:base};delete env.ELECTRON_RUN_AS_NODE;
  application=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[main,dir],env});
  context=application.context();page=await application.firstWindow();
 }else{
  browser=await chromium.launch({headless:true,args:['--allow-file-access-from-files'],executablePath:process.env.BETTERNOTE_QA_BROWSER,env:{...process.env,TEMP:base,TMP:base}});
  context=await browser.newContext();page=await context.newPage();
 }
 try{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await context.route(/^https?:\/\//,route=>route.abort());
  await page.goto(pathToFileURL(html).href);if(native)await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>false}));await page.evaluate(()=>{const Original=window.Worker;window.Worker=class extends Original{constructor(...args){super(...args);this.addEventListener('error',e=>console.log('QA_WORKER_ERROR',e.message));}};});page.on('console',m=>{if(m.text().startsWith('QA_WORKER_ERROR'))console.log(m.text());});await page.evaluate(font=>{window.__pdfThaiFont=font;},fs.readFileSync(process.env.BETTERNOTE_QA_THAI_FONT||'C:/Windows/Fonts/LeelawUI.ttf').toString('base64'));await page.addStyleTag({content:fs.readFileSync(path.join(root,'src/index.css'),'utf8')});await page.addScriptTag({content:compiled.outputFiles[0].text});const result=await page.evaluate(()=>qa.import());
  assert.equal(result.count,3);assert.equal(result.images,true);assert.equal(result.sources,1);assert.deepEqual(result.hash,result.originalHash);
  assert.equal(result.encodes,0);assert.deepEqual(result.progress,[[1,3],[2,3],[3,3]]);assert.ok(result.widths[0][1]>result.widths[0][0]);assert.ok(result.widths[1][0]>result.widths[1][1]);
  const extra=await require('./pdf-raster.browser.cjs')({page})+await require('./pdf-export-flow.browser.cjs')({page})+await require('./pdf-export-error.browser.cjs')({page});
  const ownerWorker=await page.evaluate(async()=>{
   const id=qa.snapshot.pages[0].id,page=await qa.editorPages.loadPdfOwnerPage(qa.nb.id,id);
   const hidden=!page.pdfOriginal&&page.__pdfOriginalOmitted===true;
   await qa.editorPages.savePdfOwnerPage({...page,strokes:[{tool:'pen',color:'#123456',width:4,points:[{x:20,y:30,pressure:.5},{x:40,y:50,pressure:.6}]}]});
   const saved=await qa.db.getPage(id),portable=JSON.parse(new TextDecoder().decode(await qa.editorPages.exportPortableNotebook(qa.nb.id)));
   return {hidden,preserved:saved.pdfOriginal.dataUrl===qa.snapshot.pages[0].pdfOriginal.dataUrl,portable:portable.pages[0].strokes.length===1&&portable.pages[0].pdfOriginal.dataUrl===saved.pdfOriginal.dataUrl};
  });
  assert.deepEqual(ownerWorker,{hidden:true,preserved:true,portable:true});
  const restored=await page.evaluate(async()=>{
   const before=qa.snapshot.pages.find(p=>p.pdfOriginal).pdfOriginal.dataUrl;
   const payload=qa.prepareBackup({folders:[],notebooks:[JSON.parse(JSON.stringify(qa.snapshot))]});
   await qa.db.restoreBackupAtomic(payload,'synthetic-pdf-restore');
   const after=await qa.db.getBackupNotebookSnapshot(qa.nb.id);
   await qa.db.mutateNotebookPages(qa.nb.id,{kind:'delete',pageId:after.pages[0].id});
   const final=await qa.db.getBackupNotebookSnapshot(qa.nb.id);
   return{same:after.pages.find(p=>p.pdfOriginal).pdfOriginal.dataUrl===before,remaining:final.pages.length,sources:final.pages.filter(p=>p.pdfOriginal).length,bytes:final.pages.find(p=>p.pdfOriginal).pdfOriginal.dataUrl===before};
  });
  assert.deepEqual(restored,{same:true,remaining:2,sources:1,bytes:true});
  const afterRecovery=await page.evaluate(async()=>{
    qa.cache.clearAll();
    const other=(await qa.db.getPagesByNotebookId(qa.largePdf.id))[0];await qa.raster.loadPdfRaster(other);
    const p=(await qa.db.getPagesByNotebookId(qa.nb.id))[0],url=await qa.raster.loadPdfRaster(p);
    const bitmap=await createImageBitmap(await(await fetch(url)).blob()),size=[bitmap.width,bitmap.height];bitmap.close();
    return{size,source:!!(await qa.db.getPdfOriginalSource(qa.nb.id,p.pdfOriginalId))};
  });
  assert.equal(afterRecovery.source,true);assert.ok(Math.max(...afterRecovery.size)>960);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:13+extra,failed:0,originalBytesPreserved:true,asyncEncoding:true,portableRestore:true,fileOriginWorker:true,rendererErrors:errors,syntheticOnly:true,electron:native,dir}));
 }finally{if(application)await application.close();else await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
