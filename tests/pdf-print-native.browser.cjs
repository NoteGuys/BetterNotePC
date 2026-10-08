// Real native printToPDF, first operation is an entire 91-page notebook export.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const {pathToFileURL}=require('node:url'),{_electron}=require(process.env.BETTERNOTE_PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),base=process.env.BETTERNOTE_QA_TEMP;
const count=Number(process.env.BETTERNOTE_QA_NATIVE_PAGES||91);if(!Number.isInteger(count)||count<46||count>500)throw Error('Invalid synthetic page count');
if(!base||!path.isAbsolute(base))throw Error('An isolated QA directory is required');
(async()=>{
 const dir=fs.mkdtempSync(path.join(base,'pdf-print-')),html=path.join(dir,'fixture.html'),main=path.join(dir,'main.cjs'),preload=path.join(dir,'preload.cjs');
 const osTempRoot=process.env.BETTERNOTE_QA_NATIVE_OS_TEMP==='1'?fs.mkdtempSync(path.join(require('node:os').tmpdir(),'betternote-pdf-path-qa-')):null;
 const nativeTemp=osTempRoot?path.join(osTempRoot,'ทดสอบ PDF % #'):process.env.BETTERNOTE_QA_NATIVE_TEMP_ROOT||path.join(dir,'tmp');fs.mkdirSync(nativeTemp,{recursive:true});fs.writeFileSync(html,'<!doctype html><div>Isolated native export</div>');
 fs.writeFileSync(preload,"const{contextBridge,ipcRenderer}=require('electron');let bytes;contextBridge.exposeInMainWorld('electronAPI',{exportPdfDocument:async html=>{const result=await ipcRenderer.invoke('export-pdf-document',html);if(result?.bytes)bytes=result.bytes;else if(result instanceof Uint8Array)bytes=result;return result;},lastPdfBytes:()=>bytes});");
 fs.writeFileSync(main,"const{app,BrowserWindow,ipcMain}=require('electron'),path=require('node:path');const dir=process.argv.at(-1);app.setPath('userData',path.join(dir,'profile'));app.setPath('sessionData',path.join(dir,'session'));app.setPath('temp',process.env.BETTERNOTE_QA_NATIVE_TEMP_ROOT||path.join(dir,'tmp'));let win;global.printTrace=[];global.preloadErrors=[];global.qaDir=dir;class TracedWindow extends BrowserWindow{constructor(options){super(options);const load=this.loadURL.bind(this);this.loadURL=async url=>{global.printTrace.push({stage:'loadURL',length:url.length});try{return await load(url);}catch(e){global.printTrace.push({stage:'loadURL-error',code:e.code,message:e.message.slice(0,100)});throw e;}};const register=this.webContents.session.webRequest.onBeforeRequest.bind(this.webContents.session.webRequest);this.webContents.session.webRequest.onBeforeRequest=fn=>register((details,callback)=>fn(details,result=>{if(result.cancel)global.printTrace.push({stage:'blocked',url:details.url.slice(-400)});callback(result);}));const loadFile=this.loadFile.bind(this);this.loadFile=async file=>{try{return await loadFile(file);}catch(e){global.printTrace.push({stage:'loadFile-error',code:e.code,errno:e.errno});throw e;}};const print=this.webContents.printToPDF.bind(this.webContents);this.webContents.printToPDF=async options=>{global.printTrace.push({stage:'print'});if(process.env.BETTERNOTE_QA_NATIVE_RETRY==='1'&&!global.forcedPrintFailure){global.forcedPrintFailure=true;throw Error('Synthetic first-batch failure');}try{return await print(options);}catch(e){global.printTrace.push({stage:'print-error',message:e.message.slice(0,100)});throw e;}};}}require("+JSON.stringify(path.join(root,'electron/pdfExport.cjs'))+").registerPdfExport(ipcMain,TracedWindow,()=>win);app.whenReady().then(()=>{win=new BrowserWindow({show:false,width:1360,height:1000,webPreferences:{preload:path.join(dir,'preload.cjs'),sandbox:false,nodeIntegration:false,contextIsolation:true,webSecurity:false,backgroundThrottling:false}});win.webContents.on('preload-error',(_e,p,e)=>global.preloadErrors.push({message:e.message,stack:e.stack}));win.webContents.session.on('will-download',e=>e.preventDefault());win.loadFile(path.join(dir,'fixture.html'));});app.on('window-all-closed',()=>app.quit());");
 const entry=String.raw`
 import * as engine from './src/utils/pdfExportEngine.js';import {loadPdfFromFile,renderPageToImage,importPdfAsNotebook} from './src/services/pdfService.js';
 import {getBackupNotebookSnapshot} from './src/services/db.js';import {jsPDF} from 'jspdf';
 window.qa={engine};
 qa.fixture=async (count,lazy)=>{
  const pages=[];let seed=12345;
  for(let i=0;i<count;i++){
   const canvas=new OffscreenCanvas(256,384),ctx=canvas.getContext('2d'),pixels=ctx.createImageData(256,384);
   for(let n=0;n<pixels.data.length;n+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;pixels.data[n]=seed&255;pixels.data[n+1]=(seed>>>8)&255;pixels.data[n+2]=(seed>>>16)&255;pixels.data[n+3]=255;}
   ctx.putImageData(pixels,0,0);ctx.fillStyle=i%2?'#00aa00':'#ff0000';ctx.fillRect(0,0,256,30);
   const blob=await canvas.convertToBlob({type:'image/jpeg',quality:.88});
   const src=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob);});
   pages.push({id:'qa-'+i,pageIndex:i,pageWidth:i%2?1200:800,pageHeight:i%2?800:1200,pdfPageImage:src,
    strokes:[{tool:'pen',width:6,color:'#0000ff',points:[{x:20,y:90,pressure:1},{x:200,y:90,pressure:1}]}],
    textElements:[{text:'QA PAGE '+(i+1)+' / '+count+'\nทดสอบภาษาไทย',x:40,y:140,fontSize:22,color:'#000000'}]});
  }
  qa.pages=pages;qa.nb={id:'qa-native',name:'Synthetic 91 pages',templateId:'blank'};
  if(lazy){const doc=new jsPDF({unit:'pt',format:[400,600],compress:true});for(let i=0;i<pages.length;i++){const p=pages[i];if(i)doc.addPage([p.pageWidth/2,p.pageHeight/2],i%2?'landscape':'portrait');doc.addImage(p.pdfPageImage,'JPEG',0,0,p.pageWidth/2,p.pageHeight/2);}qa.nb=await importPdfAsNotebook(new File([doc.output('arraybuffer')],'cold-lazy.pdf',{type:'application/pdf'}));const stored=await getBackupNotebookSnapshot(qa.nb.id);qa.pages=stored.pages.map((p,i)=>({...p,strokes:pages[i].strokes,textElements:pages[i].textElements}));}
 };
 qa.inspect=async()=>{
  const bytes=await electronAPI.lastPdfBytes(),{pdfDoc}=await loadPdfFromFile(new Blob([bytes],{type:'application/pdf'}));
  try{
   const first=await pdfDoc.getPage(1),second=await pdfDoc.getPage(2),middle=await pdfDoc.getPage(46),last=await pdfDoc.getPage(pdfDoc.numPages);
   const image=await renderPageToImage(pdfDoc,1,1),bitmap=await createImageBitmap(await(await fetch(image.dataUrl)).blob()),canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();
   const sample=(x,y)=>Array.from(ctx.getImageData(Math.floor(x*canvas.width),Math.floor(y*canvas.height),1,1).data);
   return{bytes:bytes.byteLength,pages:pdfDoc.numPages,first:(await first.getTextContent()).items.map(i=>i.str).join(' '),last:(await last.getTextContent()).items.map(i=>i.str).join(' '),firstBox:first.view,secondBox:second.view,lastBox:last.view,middle:(await middle.getTextContent()).items.map(i=>i.str).join(' '),topPixel:sample(.5,.015),inkPixel:sample(80/800,90/1200)};
  }finally{await pdfDoc.destroy();}
 };
 `;
 const compiled=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'js'},bundle:true,write:false,format:'iife',platform:'browser',logLevel:'silent',plugins:[{name:'offline-workers',setup:require('./helpers/recovery-worker.cjs').setupRecoveryWorker}]});
 const env={...process.env,TEMP:base,TMP:base,BETTERNOTE_QA_NATIVE_TEMP_ROOT:nativeTemp};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[main,dir],env,timeout:30000});
 try{
  const page=await app.firstWindow(),errors=[];page.on('console',m=>{if(m.type()==='error')console.log('NATIVE_CONSOLE',m.text());});page.on('pageerror',e=>errors.push(e.message));await app.context().route(/^https?:\/\//,r=>r.abort());
  await page.waitForURL(pathToFileURL(html).href);await page.waitForLoadState('load');await page.waitForFunction(()=>typeof window.electronAPI?.exportPdfDocument==='function').catch(async e=>{console.log('MAIN_STATE',await app.evaluate(({BrowserWindow})=>({dir:global.qaDir,preloads:BrowserWindow.getAllWindows()[0].webContents.session.getPreloadScripts(),url:BrowserWindow.getAllWindows()[0].webContents.getURL()})));console.log('PRELOAD_ERRORS',await app.evaluate(()=>global.preloadErrors));console.log('PREFS',await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences()));console.log('BRIDGE_STATE',await page.evaluate(()=>({url:location.href,api:typeof window.electronAPI,ready:document.readyState})));throw e;});
  await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>false}));await page.addScriptTag({content:compiled.outputFiles[0].text});await page.evaluate(({count,lazy})=>qa.fixture(count,lazy),{count,lazy:process.env.BETTERNOTE_QA_NATIVE_LAZY_PDF==='1'});
  const bridge=await page.evaluate(()=>({type:typeof window.electronAPI?.exportPdfDocument,keys:Object.keys(window.electronAPI||{}),pages:qa.pages.length}));console.log('BRIDGE',bridge);assert.equal(bridge.type,'function');
  try{await page.evaluate(async()=>{qa.exportStages=[];qa.exportStarted=performance.now();qa.timerTicks=0;const tick=setInterval(()=>qa.timerTicks++,10);try{await qa.engine.exportNotebookToPdf(qa.nb,qa.pages,(n,total,stage)=>qa.exportStages.push({n,total,stage}));}finally{clearInterval(tick);qa.exportElapsed=performance.now()-qa.exportStarted;}});}catch(error){console.log('PRINT_TRACE',await app.evaluate(()=>global.printTrace));throw error;}
  const result=await page.evaluate(()=>qa.inspect());assert.equal(result.pages,count);assert.ok(result.first.includes('ทดสอบ'));assert.ok(result.first.includes('QA PAGE 1 / '+count));assert.ok(result.last.includes('QA PAGE '+count+' / '+count));assert.ok(result.bytes>1000000);assert.ok(result.middle.includes('QA PAGE 46 / '+count));assert.ok(result.firstBox[2]<result.firstBox[3]);assert.ok(result.secondBox[2]>result.secondBox[3]);assert.ok(result.topPixel[0]>230&&result.topPixel[1]<40);assert.ok(result.inkPixel[2]>200&&result.inkPixel[0]<50);assert.deepEqual(errors,[]);
  assert.ok((await app.evaluate(()=>global.printTrace.filter(e=>e.stage==='print').length))>=Math.ceil(count/4));
  console.log('PASS entire '+count+'-page notebook exports on a fresh Electron process without a prior single-page export');
  const trace=await app.evaluate(()=>global.printTrace);
  const progress=await page.evaluate(()=>({elapsedMs:Math.round(qa.exportElapsed),ticks:qa.timerTicks,stages:[...new Set(qa.exportStages.map(s=>s.stage))]}));assert.ok(progress.ticks>10);assert.deepEqual(progress.stages,['prepare','print','merge','save']);console.log('EXPORT_PROGRESS',progress);
  assert.ok(trace.every(t=>t.stage!=='loadURL'||t.length<2000));
  assert.deepEqual(fs.readdirSync(nativeTemp).filter(n=>n.startsWith('betternote-pdf-')&&fs.statSync(path.join(nativeTemp,n)).isDirectory()),[]);
  const live=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length);assert.equal(live,1);
  console.log(JSON.stringify({result,dir,syntheticOnly:true,actualPrintToPDF:true,lazy:process.env.BETTERNOTE_QA_NATIVE_LAZY_PDF==='1',temporaryFilesRemoved:true}));
 }finally{await app.close();if(osTempRoot){const checked=fs.realpathSync(osTempRoot),expected=fs.realpathSync(require('node:os').tmpdir());assert.equal(path.dirname(checked),expected);assert.ok(path.basename(checked).startsWith('betternote-pdf-path-qa-'));fs.rmSync(checked,{recursive:true,force:true,maxRetries:3,retryDelay:100});}}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
