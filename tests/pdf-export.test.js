import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const { registerPdfExport } = createRequire(import.meta.url)('../electron/pdfExport.cjs');
const base=path.resolve(process.env.BETTERNOTE_QA_TEMP || path.join(import.meta.dirname,'../scratch/phase5-qa'));
const fixture=async (work,prefix='pdf-export-unit-')=>{
 await fs.mkdir(base,{recursive:true});
 const root=await fs.mkdtemp(path.join(base,prefix)),sender={},windows=[];
 let handler;
 class Window {
  constructor(options){this.options=options;windows.push(this);this.destroyed=false;
   this.webContents={setWindowOpenHandler:fn=>{this.openWindow=fn;},session:{webRequest:{onBeforeRequest:fn=>{this.filter=fn;}}},printToPDF:async options=>{this.printOptions=options;if(this.failure)throw Error('Synthetic print failure');return Buffer.from('%PDF-SYNTHETIC');}};
  }
  async loadURL(url){return this.loadFile((await import('node:url')).fileURLToPath(url));}
  async loadFile(file){this.file=file;this.html=await fs.readFile(file,'utf8');}
  isDestroyed(){return this.destroyed;}destroy(){this.destroyed=true;}
 }
 const ipcMain={handle:(name,fn)=>{assert.equal(name,'export-pdf-document');handler=fn;}};
 registerPdfExport(ipcMain,Window,()=>({webContents:sender}),{getTempRoot:()=>root,timeoutMs:500});
 try{await work({invoke:html=>handler({sender},html),unauthorized:html=>handler({sender:{}},html),windows,root,Window});}
 finally{assert.equal(path.dirname(root),base);assert.ok(path.basename(root).startsWith('pdf-export-unit-'));await fs.rm(root,{recursive:true,force:true});}
};
test('Native PDF export uses a local document, denies other files/network and removes its private temporary file',()=>fixture(async({invoke,windows,root})=>{
 const html='<!doctype html><body>synthetic</body>',bytes=await invoke(html),win=windows[0];
 assert.equal(bytes.toString(),'%PDF-SYNTHETIC');assert.equal(win.html,html);assert.equal(win.options.webPreferences.javascript,false);assert.equal(win.options.webPreferences.sandbox,true);assert.equal(win.destroyed,true);
 const allowed=url=>{let result;win.filter({url},r=>result=!r.cancel);return result;};
 const ownUrl=(await import('node:url')).pathToFileURL(win.file).href;
 assert.equal(allowed(ownUrl),true);assert.equal(allowed('data:image/png;base64,cWE='),true);
 assert.equal(allowed('file:///private-notes.html'),false);assert.equal(allowed('https://example.invalid'),false);assert.deepEqual(win.openWindow(),{action:'deny'});
 assert.deepEqual((await fs.readdir(root)).filter(n=>n!=='betternote-pdf-diagnostics.jsonl'),[]);
}));
test('A failed PDF print closes its hidden window and removes the temporary document',()=>fixture(async({invoke,windows,root,Window})=>{
 Window.prototype.loadFile=async function(file){this.file=file;this.failure=true;};
 await assert.rejects(invoke('<!doctype html><body>synthetic</body>'),/สร้าง PDF ไม่สำเร็จ/);
 assert.equal(windows[0].destroyed,true);assert.deepEqual((await fs.readdir(root)).filter(n=>n!=='betternote-pdf-diagnostics.jsonl'),[]);
}));
test('A PDF print timeout keeps its distinct message and cleans the temporary document',()=>fixture(async({invoke,windows,root,Window})=>{
 Window.prototype.loadFile=async function(file){this.file=file;this.webContents.printToPDF=()=>new Promise(()=>{});};
 await assert.rejects(invoke('<!doctype html><body>synthetic</body>'),/ส่งออก PDF ใช้เวลานานเกินไป/);
 assert.equal(windows[0].destroyed,true);assert.deepEqual((await fs.readdir(root)).filter(n=>n!=='betternote-pdf-diagnostics.jsonl'),[]);
}));
test('Unauthorized PDF IPC senders cannot create temporary documents or export windows',()=>fixture(async({unauthorized,windows,root})=>{
 await assert.rejects(unauthorized('<!doctype html><body>synthetic</body>'),/ไม่สามารถเริ่มส่งออก PDF ได้/);
 assert.equal(windows.length,0);assert.deepEqual((await fs.readdir(root)).filter(n=>n!=='betternote-pdf-diagnostics.jsonl'),[]);
}));

test('Thai and reserved-character paths allow only the exact generated document after URL decoding',()=>fixture(async({invoke,windows})=>{
 await invoke('<!doctype html><body>synthetic</body>');const win=windows[0];
 const {pathToFileURL}=await import('node:url');const own=pathToFileURL(win.file).href;
 const allowed=url=>{let result;win.filter({url},r=>result=!r.cancel);return result;};
 const rawUnicode=own.replace(/(?:%[89a-f][0-9a-f])+/gi,part=>decodeURIComponent(part));
 assert.equal(allowed(own),true);assert.equal(allowed(rawUnicode),true);
 assert.equal(allowed(own+'?other=file'),false);assert.equal(allowed(own+'#other'),false);
 assert.equal(allowed(pathToFileURL(path.join(path.dirname(win.file),'private.html')).href),false);
 assert.equal(allowed('https://example.invalid/document.html'),false);
 assert.equal(allowed(own.replace('document.html','..%2fprivate.html')),false);
},'pdf-export-unit-ไทย % #-'));
