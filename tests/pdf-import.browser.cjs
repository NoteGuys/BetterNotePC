// Real PDF.js import, synthetic PDF, isolated file-origin database. No external requests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const {pathToFileURL}=require('node:url'),{chromium}=require(process.env.BETTERNOTE_PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),base=process.env.BETTERNOTE_QA_TEMP;
if(!base||!path.isAbsolute(base))throw Error('An isolated QA directory is required');
(async()=>{
 const dir=fs.mkdtempSync(path.join(base,'pdf-import-')),html=path.join(dir,'fixture.html');fs.writeFileSync(html,'<!doctype html><div>Isolated PDF import</div>');
 const worker=path.join(root,'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
 const entry=String.raw`
 import { jsPDF } from 'jspdf';import * as pdf from './src/services/pdfService.js';
 import * as db from './src/services/db.js';
 import * as editorPages from './src/services/editorPagesService.js';import { prepareBackup } from './electron/backupValidation.js';
 window.qa={pdf,db,editorPages,prepareBackup,encodes:0};const encode=HTMLCanvasElement.prototype.toDataURL;
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
 const browser=await chromium.launch({headless:true,args:['--allow-file-access-from-files'],executablePath:process.env.BETTERNOTE_QA_BROWSER,env:{...process.env,TEMP:base,TMP:base}});
 try{
  const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await context.route(/^https?:\/\//,route=>route.abort());
  await page.goto(pathToFileURL(html).href);await page.addScriptTag({content:compiled.outputFiles[0].text});const result=await page.evaluate(()=>qa.import());
  assert.equal(result.count,3);assert.equal(result.images,true);assert.equal(result.sources,1);assert.deepEqual(result.hash,result.originalHash);
  assert.equal(result.encodes,0);assert.deepEqual(result.progress,[[1,3],[2,3],[3,3]]);assert.ok(result.widths[0][1]>result.widths[0][0]);assert.ok(result.widths[1][0]>result.widths[1][1]);
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
  assert.deepEqual(restored,{same:true,remaining:2,sources:1,bytes:true});assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:12,failed:0,originalBytesPreserved:true,asyncEncoding:true,portableRestore:true,fileOriginWorker:true,rendererErrors:errors,syntheticOnly:true,dir}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
