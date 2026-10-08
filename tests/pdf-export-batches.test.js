import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PDFDocument } from 'pdf-lib';
const { registerPdfExport } = createRequire(import.meta.url)('../electron/pdfExport.cjs');
const base=path.resolve(import.meta.dirname,'../scratch/phase5-qa');
const fixture=async work=>{
 await fs.mkdir(base,{recursive:true});const root=await fs.mkdtemp(path.join(base,'pdf-batch-unit-')),sender={},windows=[];
 let handler,fail=false,wrongCount=false;
 class Window {
  constructor(options){this.options=options;windows.push(this);this.destroyed=false;
   this.webContents={setWindowOpenHandler:()=>{},session:{webRequest:{onBeforeRequest:()=>{}}},printToPDF:async()=>{
    if(fail)throw Error('Synthetic print failure');
    const pdf=await PDFDocument.create(),count=wrongCount?1:(this.html.match(/<section/g)||[]).length;
    for(let i=0;i<count;i++)pdf.addPage([400+(Number(this.html.match(/data-first="(\d+)"/)?.[1])||0)+i,600]);
    return Buffer.from(await pdf.save());
   }};
  }
  async loadURL(url){return this.loadFile((await import('node:url')).fileURLToPath(url));}
  async loadFile(file){this.html=await fs.readFile(file,'utf8');}
  isDestroyed(){return this.destroyed;}destroy(){this.destroyed=true;}
 }
 registerPdfExport({handle:(_,fn)=>handler=fn},Window,()=>({webContents:sender}),{getTempRoot:()=>root,timeoutMs:5000});
 const invoke=request=>handler({sender},request),parts=async(id,start,n)=>invoke({action:'append',id,start,pages:n,
  html:'<!doctype html><body data-first="'+start+'">'+Array.from({length:n},()=>'<section>PRIVATE SENTINEL</section>').join('')+'</body>'});
 let id;
 try{await work({invoke,parts,root,windows,setFailure:x=>fail=x,setWrongCount:x=>wrongCount=x,begin:async pages=>{
  const result=await invoke({action:'begin',pages});id=result.id;return result;
 },unauthorized:request=>handler({sender:{}},request)});}
 finally{if(id)await invoke({action:'cancel',id});assert.equal(path.dirname(root),base);await fs.rm(root,{recursive:true,force:true});}
};
test('Batch protocol copies ordered pages in a worker, validates final count and cleans temporary documents',()=>fixture(async({invoke,parts,begin,root,windows})=>{
 const capabilities=await invoke({action:'capabilities'});assert.equal(capabilities.protocol,2);
 const {id}=await begin(7);assert.equal((await parts(id,0,4)).pages,4);assert.equal((await parts(id,4,3)).pages,7);
 const result=await invoke({action:'finish',id}),pdf=await PDFDocument.load(result.bytes);
 assert.equal(result.pages,7);assert.deepEqual(pdf.getPages().map(p=>p.getWidth()),[400,401,402,403,404,405,406]);
 assert.ok(windows.every(w=>w.destroyed));assert.ok(!(await fs.readdir(root)).some(n=>n.startsWith('betternote-pdf-')&&n.endsWith('.html')));
 const records=(await fs.readFile(path.join(root,'betternote-pdf-diagnostics.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
 assert.ok(records.length>=3);assert.ok(records.every(r=>!JSON.stringify(r).includes('PRIVATE SENTINEL')));
 assert.deepEqual(await fs.readdir(root),['betternote-pdf-diagnostics.jsonl']);
}));
test('Failed print leaves the session unchanged so smaller batches can retry',()=>fixture(async({invoke,parts,begin,setFailure})=>{
 const {id}=await begin(3);setFailure(true);const error=await parts(id,0,3);
 assert.equal(error.error,'pdf-print-failed');assert.equal(error.retry,true);
 setFailure(false);assert.equal((await parts(id,0,1)).pages,1);assert.equal((await parts(id,1,2)).pages,3);
 assert.equal((await invoke({action:'finish',id})).pages,3);
}));
test('Missing or mismatched PDF pages cannot produce a downloaded incomplete file',()=>fixture(async({invoke,parts,begin,setWrongCount})=>{
 const {id}=await begin(3);assert.equal((await parts(id,1,1)).error,'pdf-invalid-request');
 setWrongCount(true);assert.equal((await parts(id,0,3)).error,'pdf-page-count');
 assert.equal((await invoke({action:'finish',id})).error,'pdf-session-expired');
}));
test('A session rejects concurrent exports, forged owners and out-of-order appends',()=>fixture(async({invoke,parts,begin,unauthorized,root})=>{
 const {id}=await begin(2);assert.equal((await invoke({action:'begin',pages:1})).error,'pdf-export-busy');
 await assert.rejects(unauthorized({action:'cancel',id}),/ไม่สามารถเริ่ม/);
 assert.equal((await parts(id,0,5)).error,'pdf-invalid-request');
 assert.equal((await invoke({action:'cancel',id})).cancelled,true);
 assert.deepEqual(await fs.readdir(root),[]);
}));
