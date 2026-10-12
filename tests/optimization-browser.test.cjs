const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process'),esbuild=require('esbuild');
const {setupRecoveryWorker}=require('./helpers/recovery-worker.cjs');
const qa=process.env.BETTERNOTE_QA_TEMP;
test('Real Chromium ink pixels, snapshot export, metadata reads and capture failures remain correct', {timeout:180000}, async()=>{
 assert.ok(qa,'Isolated QA folder required');const root=await fs.mkdtemp(path.join(qa,'optimization-browser-'));
 const bundle=await esbuild.build({stdin:{contents:
  "import React from 'react';import {createRoot} from 'react-dom/client';import {CanvasBoard} from './src/components/Editor/CanvasBoard.jsx';window.mountInk=(node,initial)=>{let update;const root=createRoot(node);function Harness(){const [page,setPage]=React.useState(initial);update=setPage;window.inkPage=page;return React.createElement(CanvasBoard,{page,templateId:'blank',activeTool:'pen',activeColor:'#124fa7',activeWidth:4,penNib:'fountain',scribbleToErase:false,onStrokesChange:strokes=>setPage(previous=>({...previous,strokes}))});}root.render(React.createElement(Harness));return {unmount:()=>root.unmount(),setPage:page=>update(page)};};"+
  "import {renderStroke} from './src/utils/inkingEngine.js';import {createInkPreview} from './src/utils/inkPreview.js';"+
  "import {openDB,getBackupNotebookDescription,getBackupNotebookSnapshot} from './src/services/db.js';"+
  "import {exportLibraryBlob} from './src/services/fullBackup.worker.js';import {prepareFullBackupBlob} from './src/services/fullBackupService.js';"+
  "import {renderPageToCanvasDataUrl} from './src/utils/pdfExportEngine.js';window.qa={renderStroke,createInkPreview,openDB,getBackupNotebookDescription,getBackupNotebookSnapshot,exportLibraryBlob,prepareFullBackupBlob,renderPageToCanvasDataUrl};",
  resolveDir:path.resolve(__dirname,'..')},bundle:true,format:'iife',write:false,logLevel:'silent',plugins:[{name:'offline-workers',setup:setupRecoveryWorker}]});
 await fs.writeFile(path.join(root,'fixture.js'),bundle.outputFiles[0].text);await fs.writeFile(path.join(root,'fixture.html'),'<script src="fixture.js"></script>');
 const runBrowser=async()=>{
  const {renderStroke,createInkPreview,openDB,getBackupNotebookDescription,getBackupNotebookSnapshot,exportLibraryBlob,prepareFullBackupBlob,renderPageToCanvasDataUrl}=window.qa;
  const canvas=(scale=1)=>{const c=document.createElement('canvas');c.width=512*scale;c.height=384*scale;c.getContext('2d').scale(scale,scale);return c;};
  const composited=(base,active)=>{const c=canvas(base.width/512),ctx=c.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(base,0,0);ctx.drawImage(active,0,0);return c;};
  const stroke=(count,nibType='fountain',isTapered=true,usePressure=true)=>({tool:'pen',color:'#124fa7',width:4,nibType,isTapered,usePressure,points:Array.from({length:count},(_,i)=>({x:220+Math.sin(i/37)*140,y:170+Math.cos(i/23)*110,pressure:.1+(i%17)/20}))});
  const comparisons=[];let visual;
  for(const scale of [1,2])for(const nibType of ['fountain','brush','ballpoint'])for(const isTapered of [true,false])for(const usePressure of [true,false]){
   const b=canvas(scale),a=canvas(scale),ref=canvas(scale),overlay=canvas(scale),s=stroke(1100,nibType,isTapered,usePressure);
   const old={...stroke(100),color:'#9b4934'};renderStroke(b.getContext('2d'),old);renderStroke(ref.getContext('2d'),old);
   const p=createInkPreview(()=>{});const full=s.points;s.points=full.slice(0,99);
   p.draw(b.getContext('2d'),a.getContext('2d'),s);
   for(const n of [100,120,250,500,1100]){s.points.push(...full.slice(s.points.length,n));a.getContext('2d').clearRect(0,0,512,384);p.draw(b.getContext('2d'),a.getContext('2d'),s);}
   renderStroke(overlay.getContext('2d'),s);
   const actual=composited(b,a),expected=composited(ref,overlay),x=actual.getContext('2d').getImageData(0,0,actual.width,actual.height).data,y=expected.getContext('2d').getImageData(0,0,expected.width,expected.height).data;
   let max=0,changed=0,large=0;for(let i=0;i<x.length;i++){const d=Math.abs(x[i]-y[i]);max=Math.max(max,d);if(d)changed++;if(d>3)large++;}
   comparisons.push({scale,nibType,isTapered,usePressure,max,changed,large});
   if(scale===2&&nibType==='fountain'&&isTapered&&usePressure)visual={actual:actual.toDataURL(),expected:expected.toDataURL()};
   for(const c of [b,a,ref,overlay,actual,expected])c.width=c.height=1;
  }
  const benchStroke=stroke(5000),fullCtx=canvas().getContext('2d'),stableCtx=canvas().getContext('2d'),tailCtx=canvas().getContext('2d'),preview=createInkPreview(()=>{});
  preview.draw(stableCtx,tailCtx,benchStroke);
  const durations={full:[],incremental:[]};
  for(let i=0;i<80;i++){
   benchStroke.points.push({x:200+Math.sin(i)*100,y:180+Math.cos(i)*100,pressure:.6});
   let start=performance.now();fullCtx.clearRect(0,0,512,384);renderStroke(fullCtx,benchStroke);durations.full.push(performance.now()-start);
   start=performance.now();tailCtx.clearRect(0,0,512,384);preview.draw(stableCtx,tailCtx,benchStroke);durations.incremental.push(performance.now()-start);
  }
  const summarize=a=>{a.sort((x,y)=>x-y);return {p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)]};};
  const db=await openDB(),tx=db.transaction(['folders','notebooks','pages'],'readwrite');
  const folders=[{id:'f',name:'QA folder',updatedAt:1},{id:'gone',name:'Retired',permanentlyDeleted:true,updatedAt:2}];
  const notes=[{id:'n',name:'QA Thai ทดสอบ',folderId:'f',pageCount:2,updatedAt:10},{id:'trash',name:'Trash',isDeleted:true,pageCount:1,updatedAt:5}];
  const tiny=document.createElement('canvas');tiny.width=tiny.height=4;const src=tiny.toDataURL();
  const pages=[{id:'z',notebookId:'n',pageIndex:0,updatedAt:10,strokes:[stroke(10)],imageElements:[{id:'i',src,x:10,y:10,width:50,height:50}],pageWidth:1200,pageHeight:1600},
   {id:'a',notebookId:'n',pageIndex:1,updatedAt:10,strokes:[],pdfOriginal:{id:'pdf',dataUrl:'data:application/pdf;base64,JVBERi0xLjQ='}},
   {id:'t',notebookId:'trash',pageIndex:0,updatedAt:5,strokes:[]}];
  for(const f of folders)tx.objectStore('folders').put(f);for(const n of notes)tx.objectStore('notebooks').put(n);for(const p of pages)tx.objectStore('pages').put(p);
  await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=reject;});
  const description=await getBackupNotebookDescription('n'),snapshot=await getBackupNotebookSnapshot('n');
  const parsed=JSON.parse(await(await exportLibraryBlob()).text()),workerParsed=JSON.parse(await(await prepareFullBackupBlob()).text());
  let limitRejected=false;try{await exportLibraryBlob(100);}catch(_){limitRejected=true;}
  let invalidCaptureRejected=false;try{await renderPageToCanvasDataUrl({pageWidth:1200,pageHeight:1600,strokes:[],imageElements:[{src:'data:image/png;base64,broken',x:0,y:0,width:10,height:10}]},'blank');}catch(_){invalidCaptureRejected=true;}
  const capture=await renderPageToCanvasDataUrl(pages[0],'blank');const capturedImage=new Image();capturedImage.src=capture;await capturedImage.decode();
  const savedRAF=window.requestAnimationFrame,savedCancel=window.cancelAnimationFrame;
  window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),0);window.cancelAnimationFrame=clearTimeout;
  const node=document.createElement('div');document.body.appendChild(node);const initial={id:'board',notebookId:'n',pageWidth:512,pageHeight:384,strokes:[],imageElements:[],textElements:[]};
  const board=window.mountInk(node,initial);await new Promise(resolve=>setTimeout(resolve,30));
  const layer=node.querySelector('.bn-layer-active'),rect=layer.getBoundingClientRect();
  const pointer=(type,x,y,buttons=1)=>layer.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:7,pointerType:'pen',isPrimary:true,button:0,buttons,clientX:rect.left+x/512*rect.width,clientY:rect.top+y/384*rect.height,pressure:buttons?.6:0}));
  const draw=async end=>{pointer('pointerdown',50,100);for(let i=1;i<230;i++){pointer('pointermove',50+i*.8,100+Math.sin(i/12)*30);if(i%40===0)await new Promise(requestAnimationFrame);}pointer(end,240,110,0);await new Promise(resolve=>setTimeout(resolve,20));};
  await draw('pointerup');await draw('pointercancel');
  const pointerResult={strokes:window.inkPage.strokes.length,counts:window.inkPage.strokes.map(s=>s.points.length),locked:!!window.__bn_pen_active};
  const actualInk=node.querySelector('.bn-layer-static'),referenceInk=canvas(actualInk.width/512);for(const ink of window.inkPage.strokes)renderStroke(referenceInk.getContext('2d'),ink);
  const pixelsA=actualInk.getContext('2d').getImageData(0,0,actualInk.width,actualInk.height).data,pixelsB=referenceInk.getContext('2d').getImageData(0,0,referenceInk.width,referenceInk.height).data;
  pointerResult.finalPixelsExact=pixelsA.every((v,i)=>v===pixelsB[i]);board.unmount();pointerResult.released=node.querySelector('canvas')===null;node.remove();window.requestAnimationFrame=savedRAF;window.cancelAnimationFrame=savedCancel;
  return {pointerResult,comparisons,visual,benchmark:{full:summarize(durations.full),incremental:summarize(durations.incremental)},description,snapshot,parsed,workerParsed,limitRejected,invalidCaptureRejected,captureDimensions:[capturedImage.width,capturedImage.height]};
 };
 const helper=path.join(root,'run.cjs'),output=path.join(root,'result.json');
 await fs.writeFile(helper,`const {app,BrowserWindow}=require('electron');const fs=require('node:fs');
const profile=require(${JSON.stringify(path.resolve(__dirname,'../electron/gpuProfile.cjs'))}).configureGpuProfile(app);
app.setPath('userData',${JSON.stringify(path.join(root,'profile'))});app.setPath('sessionData',${JSON.stringify(path.join(root,'session'))});
app.whenReady().then(async()=>{const w=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,webSecurity:false,backgroundThrottling:false}});try{await w.loadFile(${JSON.stringify(path.join(root,'fixture.html'))});const result=await w.webContents.executeJavaScript('('+${JSON.stringify(runBrowser.toString())}+')()');fs.writeFileSync(${JSON.stringify(output)},JSON.stringify({...result,gpuProfile:profile,gpu:app.getGPUFeatureStatus()}));app.exit(0);}catch(error){console.error(error);app.exit(1);}});setTimeout(()=>app.exit(2),120000).unref();`);
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 await new Promise((resolve,reject)=>{const child=spawn(require('electron'),[helper],{env,windowsHide:true});let stderr='';child.stderr.on('data',d=>stderr+=d);child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Browser QA '+code+': '+stderr.slice(-2500))));});
 const result=JSON.parse(await fs.readFile(output,'utf8'));const maximum=Math.max(...result.comparisons.map(x=>x.max));
 assert.ok(result.comparisons.every(x=>x.large===0),'Ink pixel differences exceed 3/255: '+JSON.stringify(result.comparisons));
 assert.equal(result.pointerResult.strokes,2);assert.ok(result.pointerResult.counts.every(n=>n>=230));assert.equal(result.pointerResult.locked,false);assert.equal(result.pointerResult.finalPixelsExact,true);assert.equal(result.pointerResult.released,true);
 assert.equal(result.description.pages.length,2);assert.equal(result.description.pages[0].strokes,undefined);assert.equal(result.description.pages[0].imageElements,undefined);assert.equal(result.description.pages[1].pdfOriginal,undefined);
 assert.deepEqual(result.parsed.notebooks.find(n=>n.id==='n').pages,result.snapshot.pages);assert.deepEqual(result.parsed.folders.map(f=>f.id),['f','gone']);assert.equal(result.parsed.notebooks.length,2);
 assert.deepEqual(result.workerParsed.notebooks,result.parsed.notebooks);assert.equal(result.limitRejected,true);assert.equal(result.invalidCaptureRejected,true);assert.ok(result.captureDimensions[0]*result.captureDimensions[1]<=16000000);
 for(const [name,url]of Object.entries(result.visual))await fs.writeFile(path.join(root,name+'.png'),Buffer.from(url.split(',')[1],'base64'));
 const summary={gpuProfile:result.gpuProfile,gpu:result.gpu,maximumPixelDifference:maximum,cases:result.comparisons.length,benchmark:result.benchmark,captureDimensions:result.captureDimensions,root};await fs.writeFile(path.join(qa,'optimization-browser-summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
});
