// Worker PDF fidelity, atomic snapshot and pause/resume checks using synthetic data only.
const fs=require('node:fs'),disk=fs.promises,path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const {pathToFileURL}=require('node:url'),{chromium}=require(process.env.BETTERNOTE_PLAYWRIGHT_PATH||'playwright');
const {setupRecoveryWorker}=require('./helpers/recovery-worker.cjs');
const root=fs.realpathSync(path.resolve(__dirname,'..')),qaRoot=process.env.BETTERNOTE_QA_TEMP;
if(!qaRoot||!path.isAbsolute(qaRoot)||process.env.BETTERNOTE_QA_BUILT_WORKER!=='1')throw Error('Use isolated QA storage and production workers');
const entry=String.raw`
import * as db from './src/services/db.js';import {createBackupPreparationService} from './src/services/backupPreparationService.js';
import {generateVerifiedBackupPdf} from './src/utils/backupPdf.js';import {prepareBackup} from './electron/backupValidation.js';
import * as pdfjs from 'pdfjs-dist';import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';pdfjs.GlobalWorkerOptions.workerSrc=pdfWorker;
import {generateVectorShapePoints} from './src/utils/inkingEngine.js';
const service=createBackupPreparationService();window.qa={db,service};
qa.seed=async()=>{
 const c=document.createElement('canvas');c.width=c.height=24;const ctx=c.getContext('2d');ctx.fillStyle='#22c55e';ctx.fillRect(0,0,24,24);const png=c.toDataURL();
 const pages=['dotted','blank','whiteboard'].map((templateId,i)=>({id:'p'+i,notebookId:'n',pageIndex:i,updatedAt:10,templateId,pageWidth:480,pageHeight:620,
  strokes:[{id:'sharp-shape',tool:'pen',color:'#ef2222',width:4,isTapered:false,shapeType:'rectangle',points:generateVectorShapePoints({type:'rectangle',startPt:{x:220,y:50},endPt:{x:400,y:160}})},
   {id:'ink',tool:'pen',color:'#ef2222',width:8,points:[{x:i===2?-80:20,y:30,pressure:.6},{x:180,y:150,pressure:.6}]},
   {id:'round-highlight',tool:'highlighter',highlighterTip:'round',color:'#0044ff',width:8,points:[{x:40,y:330,pressure:.6},{x:150,y:330,pressure:.6}]},
   {id:'square-highlight',tool:'highlighter',highlighterTip:'square',color:'#ffff00',width:8,points:[{x:40,y:390,pressure:.6}]}],
  imageElements:[{id:'green',src:png,x:30,y:240,width:80,height:60,locked:true},{id:'over',src:png,x:130,y:100,width:35,height:35,layer:'over'}],
  textElements:[{id:'thai',text:'BetterNote ทดสอบภาษาไทย\nEngineering notes',x:20,y:180,fontSize:20,fontFamily:'Segoe UI',color:'#111111'}],
  ...(i===1?{pdfPageImage:png}:{})}));
 await db.restoreBackupAtomic(prepareBackup({folders:[],notebooks:[{id:'n',name:'Synthetic',pageCount:3,updatedAt:10,templateId:'dotted',pages}]}),'seed');
};
qa.renderComparison=async()=>{
 const descriptor=await service.getNotebook('n',{pdf:true}),bytes=await service.makePdf(descriptor,()=>{}),note=await db.getBackupNotebookSnapshot('n');
 const oldUri=await generateVerifiedBackupPdf(note),oldBytes=Uint8Array.from(atob(oldUri.split(',')[1]),c=>c.charCodeAt(0));
 const a=await pdfjs.getDocument({data:new Uint8Array(bytes)}).promise,b=await pdfjs.getDocument({data:oldBytes}).promise,comparisons=[];
 for(let i=1;i<=a.numPages;i++){
  const canvases=[],dims=[];for(const doc of[a,b]){const page=await doc.getPage(i),viewport=page.getViewport({scale:.8}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;canvases.push(canvas);dims.push([viewport.width,viewport.height]);}
  const [x,y]=canvases.map(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data);let difference=0,redA=0,redB=0,greenA=0,greenB=0;
  for(let p=0;p<x.length;p+=4){difference+=Math.abs(x[p]-y[p])+Math.abs(x[p+1]-y[p+1])+Math.abs(x[p+2]-y[p+2]);
   if(x[p]>150&&x[p+1]<100&&x[p+2]<100)redA++;if(y[p]>150&&y[p+1]<100&&y[p+2]<100)redB++;
   if(x[p]<100&&x[p+1]>120&&x[p+2]<160)greenA++;if(y[p]<100&&y[p+1]>120&&y[p+2]<160)greenB++;}
  comparisons.push({dims,meanDifference:difference/(x.length/4*3),redA,redB,greenA,greenB});
  if(i===1){qa.workerPreview=canvases[0].toDataURL();qa.legacyPreview=canvases[1].toDataURL();}
 }
 const result={pages:a.numPages,oldPages:b.numPages,comparisons};await a.destroy();await b.destroy();return result;
};
`;
(async()=>{let browser;const fixture=await disk.mkdtemp(path.join(qaRoot,'betternote-backup-preparation-')),passed=[];try{
 const assets=path.join(root,'dist/assets'),pdf=fs.readdirSync(assets).find(n=>/^pdf\.worker\.min-.*\.mjs$/.test(n));
 await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'js'},bundle:true,outfile:path.join(fixture,'app.js'),format:'iife',platform:'browser',logLevel:'silent',plugins:[{name:'workers',setup(build){setupRecoveryWorker(build);
 build.onResolve({filter:/pdf\.worker\.min\.mjs\?url$/},()=>({path:'pdf',namespace:'qa-url'}));build.onLoad({filter:/.*/,namespace:'qa-url'},()=>({contents:'export default '+JSON.stringify(pathToFileURL(path.join(assets,pdf)).href),loader:'js'}));}}]});
 await disk.writeFile(path.join(fixture,'index.html'),'<!doctype html><meta charset="utf-8"><script src="app.js"></script>');
 browser=await chromium.launch({headless:true,...(process.env.BETTERNOTE_QA_BROWSER?{executablePath:process.env.BETTERNOTE_QA_BROWSER}:{}),args:['--allow-file-access-from-files'],env:{...process.env,TEMP:qaRoot,TMP:qaRoot}});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>r.abort());await page.goto(pathToFileURL(path.join(fixture,'index.html')).href);await page.waitForFunction(()=>window.qa);await page.evaluate(()=>qa.seed());
 const check=async(name,fn)=>{await fn();passed.push(name);console.log('PASS '+name);};
 await check('Snapshot bytes preserve exact stored content while UI receives only page headers',async()=>{
  assert.equal(await page.evaluate(async()=>{const description=await qa.service.getNotebook('n'),raw=await qa.db.getBackupNotebookSnapshot('n');
   const decoded=JSON.parse(new TextDecoder().decode(description.backupEncoded));return JSON.stringify(decoded)===JSON.stringify(raw)&&description.pages.every(p=>!p.strokes&&!p.textElements&&!p.imageElements&&!p.pdfPageImage);}),true);
 });
 await check('Metadata refresh queues safely while the PDF worker is paused',async()=>{
  assert.equal(await page.evaluate(async()=>{const descriptor=await qa.service.getNotebook('n',{pdf:true});let metadata;
   const bytes=await qa.service.makePdf(descriptor,p=>{if(p?.page===1)metadata=qa.service.getMetadata();});
   return bytes.byteLength>1000&&(await metadata).notebooks[0].id==='n';}),true);
 });
 let comparison;await check('Worker PDF keeps handwriting, images, text, PDF backgrounds and cropped whiteboard layout',async()=>{
  comparison=await page.evaluate(()=>qa.renderComparison());assert.equal(comparison.pages,3);assert.equal(comparison.oldPages,3);
  for(const item of comparison.comparisons){assert.deepEqual(item.dims[0],item.dims[1]);assert.ok(item.meanDifference<8,JSON.stringify(item));assert.ok(item.redA>0&&item.redA/item.redB>.7&&item.redA/item.redB<1.3);assert.ok(item.greenA>0&&item.greenA/item.greenB>.85&&item.greenA/item.greenB<1.15);}
  for(const[key,name]of[['workerPreview','worker.png'],['legacyPreview','legacy.png']])await disk.writeFile(path.join(fixture,name),Buffer.from((await page.evaluate(key=>qa[key],key)).split(',')[1],'base64'));
 });
 await check('Actual worker pauses on page two then resumes without rebuilding page one',async()=>{
  const result=await page.evaluate(async()=>{const note=await qa.service.getNotebook('n',{pdf:true});let failed=false;
   try{await qa.service.makePdf(note,p=>{if(p?.page===2)throw Error('pdf-backup-deferred');},{force:true});}catch(e){failed=e.message==='pdf-backup-deferred';}
   const seen=[];const bytes=await qa.service.makePdf(note,p=>{if(p?.page)seen.push(p.page);});return{failed,first:seen[0],size:bytes.byteLength};});
  assert.equal(result.failed,true);assert.equal(result.first,2);assert.ok(result.size>1000);
 });
 await check('SVG image elements remain supported in automatic PDF backups',async()=>{
  assert.equal(await page.evaluate(async()=>{const p=await qa.db.getPage('p0');const svg='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="green"/></svg>');
   await qa.db.savePage({...p,imageElements:[{id:'svg',src:svg,x:20,y:240,width:30,height:30}]});
   const descriptor=await qa.service.getNotebook('n',{pdf:true});return (await qa.service.makePdf(descriptor,()=>{})).byteLength>1000;}),true);
 });
 await check('Writing changed after description prevents generating a PDF for the old revision',async()=>{
  assert.equal(await page.evaluate(async()=>{const descriptor=await qa.service.getNotebook('n',{pdf:true}),p=await qa.db.getPage('p0');await qa.db.savePage({...p,textElements:[]});
   try{await qa.service.makePdf(descriptor,()=>{});return false;}catch(e){return e.message==='pdf-backup-deferred';}}),true);
 });
 await check('Corrupt image refuses the PDF while editable snapshot remains available',async()=>{
  assert.equal(await page.evaluate(async()=>{const p=await qa.db.getPage('p0');await qa.db.savePage({...p,pdfPageImage:'data:image/png;base64,broken'});const descriptor=await qa.service.getNotebook('n');
   try{await qa.service.makePdf(descriptor,()=>{});return false;}catch(e){return /image/.test(e.message)&&JSON.parse(new TextDecoder().decode(descriptor.backupEncoded)).pages.length===3;}}),true);
 });
 await check('Worker reports no unhandled renderer errors offline',async()=>assert.deepEqual(errors,[]));await page.evaluate(()=>qa.service.close());
 const report={passed:passed.length,failed:0,fixture,comparison,offline:true,syntheticOnly:true};await disk.writeFile(path.join(fixture,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
