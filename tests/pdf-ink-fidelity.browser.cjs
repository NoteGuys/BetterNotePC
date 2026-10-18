const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const {_electron}=require(process.env.BETTERNOTE_PLAYWRIGHT_PATH || '../scratch/optimize-test-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),base=path.resolve(process.env.BETTERNOTE_QA_TEMP || path.join(root,'scratch/pdf-ink-review'));
fs.mkdirSync(base,{recursive:true});const dir=fs.mkdtempSync(path.join(base,'fidelity-'));
console.log('QA artifacts:',dir);
const {pathToFileURL}=require('node:url');
(async()=>{
fs.mkdirSync(dir,{recursive:true});
const html=path.join(dir,'fixture.html'),main=path.join(dir,'main.cjs'),preload=path.join(dir,'preload.cjs');
fs.writeFileSync(html,'<!doctype html><body>PDF ink regression</body>');
fs.writeFileSync(preload,"const{contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('electronAPI',{exportPdfDocument:html=>ipcRenderer.invoke('export-pdf-document',html)});");
fs.writeFileSync(main,`const{app,BrowserWindow,ipcMain}=require('electron'),path=require('node:path');const dir=process.argv.at(-1);app.setPath('userData',path.join(dir,'profile'));app.setPath('sessionData',path.join(dir,'session'));let w;require(${JSON.stringify(path.join(root,'electron/pdfExport.cjs'))}).registerPdfExport(ipcMain,BrowserWindow,()=>w,{getTempRoot:()=>dir});app.whenReady().then(()=>{w=new BrowserWindow({show:false,webPreferences:{preload:path.join(dir,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});w.loadFile(path.join(dir,'fixture.html'));});app.on('window-all-closed',()=>app.quit());`);
const entry=`import{renderExportPageSvg,documentFromSections}from './src/utils/exportDocument.js';import{renderStroke}from './src/utils/inkingEngine.js';import * as pdfjs from 'pdfjs-dist';pdfjs.GlobalWorkerOptions.workerSrc=${JSON.stringify(pathToFileURL(path.join(root,'node_modules/pdfjs-dist/build/pdf.worker.min.mjs')).href)};
window.qa={renderExportPageSvg,documentFromSections,renderStroke,pdfjs};`;
const bundle=await esbuild.build({stdin:{contents:entry,resolveDir:root},bundle:true,write:false,format:'iife',platform:'browser',logLevel:'silent'});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[main,dir],env});
try{const page=await app.firstWindow();await page.waitForLoadState();await page.addScriptTag({content:bundle.outputFiles[0].text});
const result=await page.evaluate(async()=>{
const strokes=[];for(let row=0;row<6;row++){const points=[];for(let i=0;i<180;i++){const t=i/179;points.push({x:25+350*t,y:35+row*55+18*Math.sin(t*Math.PI*8),pressure:.15+.8*(.5+.5*Math.sin(t*11))});}strokes.push({tool:'pen',width:row===5?1:7,color:['#1e293b','#2563eb','#b94e50'][row%3],nibType:['fountain','ballpoint','brush'][row%3],usePressure:row!==4,isTapered:row!==3,points});}
strokes.push({tool:'pen',width:8,color:'#111111',points:[{x:30,y:370},{x:50,y:390},{x:30,y:390},{x:50,y:370},{x:30,y:370}].map(p=>({...p,pressure:.6}))});
strokes.push({tool:'pen',width:5,color:'#111111',shapeType:'rectangle',points:[{x:90,y:370},{x:140,y:370},{x:140,y:400},{x:90,y:400},{x:90,y:370}].map(p=>({...p,pressure:.6}))});
strokes.push({tool:'pen',width:5,color:'#2563eb',points:[{x:170,y:380,pressure:.6}]});
strokes.push({tool:'pen',width:5,color:'#2563eb',points:[{x:190,y:380,pressure:.6},{x:220,y:390,pressure:.6}]});
for(const tip of ['round','square'])strokes.push({tool:'highlighter',color:'#ffff00',width:8,highlighterTip:tip,points:[{x:240,y:375},{x:280,y:390},{x:330,y:375},{x:360,y:390}].map(p=>({...p,pressure:.5}))});
const pg={pageWidth:400,pageHeight:420,templateId:'blank',strokes,imageElements:[],textElements:[]};
const before=JSON.stringify(strokes),{svg}=await qa.renderExportPageSvg(pg,'blank');if(before!==JSON.stringify(strokes))throw Error('Mutated strokes');
// Remove only the new explicit cap paths for the before control.
const legacy=svg.replace(/<path data-ink-caps="true"[^>]+\/>/g,'');
if(legacy===svg)throw Error('No caps in fixture');
const scale=4,w=1600,h=1680;
const canvas=()=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const reference=canvas(),ctx=reference.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,w,h);ctx.scale(scale,scale);for(const s of strokes)qa.renderStroke(ctx,s);
const ref=ctx.getImageData(0,0,w,h).data;
const compare=c=>{const a=c.getContext('2d').getImageData(0,0,w,h).data;let total=0,bad=0,inside=0,holes=0;for(let i=0;i<a.length;i+=4){let d=0;for(let j=0;j<3;j++)d+=Math.abs(a[i+j]-ref[i+j]);total+=d;bad+=d>100;if(ref[i]<80&&ref[i+1]<100&&ref[i+2]<130){inside++;if(a[i]>200&&a[i+1]>200&&a[i+2]>200)holes++;}}return{mean:total/(w*h*3),bad,inside,holes};};
const raster=async text=>{const c=canvas(),im=new Image();im.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(text.replace('width="100%" height="100%"','width="400" height="420"'))));await im.decode();c.getContext('2d').drawImage(im,0,0,w,h);return c;};
const outputs={reference:reference.toDataURL()},metrics={};
for(const [name,text]of Object.entries({legacy,fixed:svg,legacyButt:legacy.replaceAll('stroke-linecap="round"','stroke-linecap="butt"'),fixedButt:svg.replaceAll('stroke-linecap="round"','stroke-linecap="butt"')})){const c=await raster(text);metrics[name]=compare(c);outputs[name]=c.toDataURL();}
const pdfs={};for(const [name,text]of Object.entries({legacy,fixed:svg})){const html=qa.documentFromSections({name:'Ink regression'},[{style:'@page bn0{size:400pt 420pt;margin:0}',body:'<section class="page" style="page:bn0;width:400pt;height:420pt">'+text+'</section>'}]);const t=performance.now();const b=await electronAPI.exportPdfDocument(html);pdfs[name]=Array.from(b);const doc=await qa.pdfjs.getDocument({data:new Uint8Array(b)}).promise;const p=await doc.getPage(1),c=canvas();await p.render({canvasContext:c.getContext('2d'),viewport:p.getViewport({scale})}).promise;metrics[name+'Pdf']={...compare(c),bytes:b.length,ms:Math.round(performance.now()-t)};outputs[name+'Pdf']=c.toDataURL();await doc.destroy();}
return{metrics,outputs,pdfs,strokes:strokes.length};});
for(const[name,url]of Object.entries(result.outputs))fs.writeFileSync(path.join(dir,name+'.png'),Buffer.from(url.split(',')[1],'base64'));
for(const[name,b]of Object.entries(result.pdfs))fs.writeFileSync(path.join(dir,name+'.pdf'),Buffer.from(b));
fs.writeFileSync(path.join(dir,'metrics.json'),JSON.stringify(result.metrics,null,2));console.log(JSON.stringify(result.metrics,null,2));
assert.ok(result.metrics.fixed.mean<0.3);assert.ok(result.metrics.fixedPdf.mean<0.5);assert.ok(result.metrics.fixedPdf.bytes<result.metrics.legacyPdf.bytes*2.5);assert.ok(result.metrics.fixedButt.holes<result.metrics.legacyButt.holes/5);assert.equal(result.metrics.fixedButt.holes,0);
console.log('PASS real native PDF, exact source preservation, pressure/nibs/taper/shapes/dots/highlighter, degraded-cap reader resilience');
// Dense page exercises the real native exporter with classroom-scale point counts.
const dense=await page.evaluate(async()=>{const strokes=[];for(let r=0;r<100;r++)strokes.push({tool:'pen',color:'#1e293b',width:3,points:Array.from({length:220},(_,i)=>({x:20+i*2.5,y:20+r*7+3*Math.sin(i/7),pressure:.2+.7*(i%23)/23}))});const start=performance.now();const {svg}=await qa.renderExportPageSvg({pageWidth:600,pageHeight:740,strokes},'blank');const prepared=performance.now();const bytes=await electronAPI.exportPdfDocument(qa.documentFromSections({name:'Dense ink'},[{style:'@page bn0{size:600pt 740pt;margin:0}',body:'<section class="page" style="page:bn0;width:600pt;height:740pt">'+svg+'</section>'}]));return{points:22000,prepareMs:Math.round(prepared-start),printMs:Math.round(performance.now()-prepared),bytes:bytes.length};});
fs.writeFileSync(path.join(dir,'dense-metrics.json'),JSON.stringify(dense,null,2));console.log('DENSE',dense);
assert.ok(dense.bytes>0);
// Optional supplied PDF: read only, rendered in the actual bundled PDF.js.
if(process.env.BETTERNOTE_INK_REVIEW_PDF){const bytes=fs.readFileSync(process.env.BETTERNOTE_INK_REVIEW_PDF);const png=await page.evaluate(async bytes=>{const d=await qa.pdfjs.getDocument({data:new Uint8Array(bytes)}).promise,p=await d.getPage(1),v=p.getViewport({scale:3}),c=document.createElement('canvas');c.width=v.width;c.height=v.height;await p.render({canvasContext:c.getContext('2d'),viewport:v}).promise;const out=c.toDataURL();await d.destroy();return out;},Array.from(bytes));fs.writeFileSync(path.join(dir,'supplied-pdfjs.png'),Buffer.from(png.split(',')[1],'base64'));}
}finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
