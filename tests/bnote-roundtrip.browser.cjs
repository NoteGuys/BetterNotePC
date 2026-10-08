const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const {chromium}=require(process.env.BETTERNOTE_PLAYWRIGHT_PATH||'playwright');
const {createBnoteSaver}=require('../electron/bnoteSave.cjs');
const root=path.resolve(__dirname,'..'),base=process.env.BETTERNOTE_QA_TEMP;if(!base)throw Error('Isolated QA root required');
(async()=>{
 const dir=fs.mkdtempSync(path.join(base,'bnote-roundtrip-')),file=path.join(dir,'สมุด 91 หน้า % #.bnote');
 const saver=createBnoteSaver({dialog:{showSaveDialog:async()=>({filePath:file})},getWindow:()=>null});
 const entry=String.raw`import{PDFDocument}from'pdf-lib';import React from 'react';import{createRoot}from'react-dom/client';import{ExportModal}from'./src/components/Common/ExportModal.jsx';import * as db from './src/services/db.js';import{exportPortableNotebook}from'./src/services/editorPagesService.js';import{importBnoteFile}from'./src/services/fileSystemService.js';import{TRANSLATIONS,setAppLanguage}from'./src/services/i18n.js';setAppLanguage('en');
 window.qa={db,importBnoteFile,word:k=>TRANSLATIONS.en[k],alerts:[]};window.alert=s=>qa.alerts.push(s);
 window.electronAPI={isElectron:true,saveBnote:async command=>{if(command.bytes){const bytes=new Uint8Array(command.bytes);command={...command,bytes:Array.from(bytes)};}return window.nativeSave(command);}};
 qa.seed=async()=>{const pdf=await PDFDocument.create();for(let i=0;i<91;i++)pdf.addPage(i%2?[800,600]:[600,800]);const source=new Uint8Array(await pdf.save()),original={id:'qa-original',dataUrl:'data:application/pdf;base64,'+btoa(String.fromCharCode(...source))};const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',source))].map(b=>b.toString(16).padStart(2,'0')).join('');const canvas=document.createElement('canvas');canvas.width=16;canvas.height=16;const ctx=canvas.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,16,16);const background=canvas.toDataURL('image/jpeg');const notebook=await db.saveNotebook({id:'qa-export',name:'Portable ทดสอบ',pageCount:91,templateId:'blank'});for(let i=0;i<91;i++)await db.savePage({id:'qa-page-'+i,notebookId:notebook.id,pageIndex:i,pageWidth:i%2?1600:1200,pageHeight:i%2?1200:1600,strokes:[{color:'#ff0000',points:[{x:i,y:10,pressure:.6}]}],textElements:[{text:'ไทย '+i}],imageElements:[],pdfPageImage:background,pdfLazyRaster:1,pdfOriginalId:original.id,pdfOriginalDigest:digest,pdfPageNumber:i+1,...(i===0?{pdfOriginal:original}:{})});qa.notebook=notebook;return notebook;};
 qa.mount=()=>createRoot(document.getElementById('root')).render(<ExportModal isOpen onClose={()=>{}} notebook={qa.notebook} pages={[]} currentPageIndex={0} loadBNote={()=>exportPortableNotebook(qa.notebook.id)}/>);
 qa.importSelected=async()=>{try{qa.imported=await importBnoteFile(document.querySelector('input').files[0]);qa.error=null;}catch(e){qa.error=e.code;}};
 `;
 const code=await esbuild.build({stdin:{resolveDir:root,loader:'jsx',contents:entry},bundle:true,write:false,platform:'browser',format:'iife',logLevel:'silent',plugins:[{name:'workers',setup:require('./helpers/recovery-worker.cjs').setupRecoveryWorker}]});
 const browser=await chromium.launch({executablePath:process.env.BETTERNOTE_QA_BROWSER,headless:true});
 try{
  const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.exposeFunction('nativeSave',command=>{if(command.bytes)command.bytes=Uint8Array.from(command.bytes).buffer;return saver.execute(command);});
  await context.route('**/*',route=>route.request().url()==='https://bnote.invalid/'?route.fulfill({contentType:'text/html',body:'<div id="root"></div><input type="file">'}):route.abort());
  await page.goto('https://bnote.invalid/');await page.addScriptTag({content:code.outputFiles[0].text});await page.evaluate(()=>qa.seed());await page.evaluate(()=>qa.mount());
  await page.getByRole('button',{name:await page.evaluate(()=>qa.word('exportDialogDownloadEditable')),exact:true}).click();
  await page.getByText(await page.evaluate(()=>qa.word('exportDialogEditableSuccess')),{exact:true}).waitFor();
  const raw=fs.readFileSync(file),document=JSON.parse(raw);assert.equal(document.pages.length,91);assert.equal(document.pages[90].textElements[0].text,'ไทย 90');
  await page.locator('input').setInputFiles(file);await page.evaluate(()=>qa.importSelected());assert.equal(await page.evaluate(()=>qa.error),null);
  const imported=await page.evaluate(async()=>qa.db.getPagesByNotebookId(qa.imported.id));assert.equal(imported.length,91);
  for(let i=0;i<91;i++){assert.deepEqual(imported[i].strokes,document.pages[i].strokes);assert.deepEqual(imported[i].textElements,document.pages[i].textElements);assert.equal(imported[i].pdfPageImage,document.pages[i].pdfPageImage);assert.equal(imported[i].pageWidth,document.pages[i].pageWidth);assert.equal(imported[i].pageHeight,document.pages[i].pageHeight);}
  assert.deepEqual(imported[0].pdfOriginal,document.pages[0].pdfOriginal);assert.equal(imported[90].pdfOriginalDigest,document.pages[90].pdfOriginalDigest);
  const count=await page.evaluate(async()=>(await qa.db.getAllNotebooks()).length);
  for(const [name,buffer,error]of [['empty.bnote',Buffer.alloc(0),'bnote-empty'],['truncated.bnote',raw.subarray(0,raw.length-1),'bnote-invalid']]){
   await page.locator('input').setInputFiles({name,mimeType:'application/json',buffer});await page.evaluate(()=>qa.importSelected());assert.equal(await page.evaluate(()=>qa.error),error);assert.equal(await page.evaluate(async()=>(await qa.db.getAllNotebooks()).length),count);
  }
  const legacy={...document.notebook,folderId:'foreign-folder',pages:document.pages};await page.locator('input').setInputFiles({name:'legacy.bnote',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});await page.evaluate(()=>qa.importSelected());assert.equal(await page.evaluate(()=>qa.error),null);assert.equal(await page.evaluate(()=>qa.imported.folderId),null);assert.notEqual(await page.evaluate(()=>qa.imported.name),document.notebook.name);
  await page.locator('input').setInputFiles(file);
  const countBeforeMissing=await page.evaluate(async()=>(await qa.db.getAllNotebooks()).length);
  const missing=await page.evaluate(async()=>{try{await qa.importBnoteFile(document.querySelector('input').files[0],'missing-folder');}catch(e){return e.code;}});assert.equal(missing,'bnote-folder-missing');assert.equal(await page.evaluate(async()=>(await qa.db.getAllNotebooks()).length),countBeforeMissing);
  assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>qa.alerts),[]);console.log(JSON.stringify({passed:7,pages:91,bytes:raw.length,errors,dir,syntheticOnly:true}));
 }finally{saver.dispose();await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});