const assert=require('node:assert/strict');
module.exports=async({page})=>{
 const old=await page.evaluate(async()=>{
  let calls=0,reads=0;window.electronAPI={exportPdfDocument:async()=>{calls++;return new Uint8Array(1);}};
  try{await qa.engine.exportNotebookToPdf({name:'QA'},[{}],null,{loadPage:async()=>{reads++;return {};}});}
  catch(e){return {message:e.message,calls,reads};}finally{delete window.electronAPI;}
 });
 assert.deepEqual(old,{message:'pdf-restart-required',calls:1,reads:0});
 console.log('PASS PDF export flow: stale main process is detected before reading any pages');
 const ordered=await page.evaluate(async()=>{
  let done=0,failed=false,reads=0,firstReadCount=0;const order=[],stages=[],downloads=[];
  const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){downloads.push(this.download);};
  window.electronAPI={exportPdfDocument:async r=>{
   if(r.action==='capabilities')return{protocol:2,batchPages:4,batchBytes:8*1024*1024};
   if(r.action==='begin')return{id:'qa-batch'};
   if(r.action==='cancel')return{cancelled:true};
   if(r.action==='finish')return{pages:done,bytes:new Uint8Array([37,80,68,70])};
   if(!firstReadCount)firstReadCount=reads;
   if(!failed&&r.pages>2){failed=true;return{error:'pdf-print-failed',retry:true};}
   if(r.start!==done)throw Error('Out of order');
   order.push(...[...r.html.matchAll(/style="page:bn(\d+)/g)].map(m=>Number(m[1])));done+=r.pages;return{pages:done};
  }};
  try{
   await qa.engine.exportNotebookToPdf({name:'QA',templateId:'blank'},Array.from({length:7},()=>({__unloaded:true})),
    (_,__,stage)=>stages.push(stage),{loadPage:async i=>{reads++;return{pageWidth:800,pageHeight:1200,strokes:[],textElements:[{text:'QA '+i,x:20,y:20,fontSize:20}]};}});
   return{order,reads,firstReadCount,downloads,failed,stages:[...new Set(stages)]};
  }finally{delete window.electronAPI;HTMLAnchorElement.prototype.click=click;}
 });
 assert.deepEqual(ordered.order,[0,1,2,3,4,5,6]);assert.equal(ordered.reads,7);assert.equal(ordered.firstReadCount,4);
 assert.deepEqual(ordered.downloads,['QA.pdf']);assert.equal(ordered.failed,true);assert.deepEqual(ordered.stages,['prepare','print','merge','save']);
 console.log('PASS PDF export flow: first export retries smaller groups, loads pages gradually and downloads one ordered notebook');
 const missing=await page.evaluate(async()=>{
  let cancelled=0,finished=0,downloads=0;const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=()=>downloads++;
  window.electronAPI={exportPdfDocument:async r=>{
   if(r.action==='capabilities')return{protocol:2,batchPages:4,batchBytes:8000000};
   if(r.action==='begin')return{id:'qa-missing'};
   if(r.action==='cancel'){cancelled++;return{cancelled:true};}
   if(r.action==='finish')finished++;return{};
  }};
  try{await qa.engine.exportNotebookToPdf({name:'QA'},Array.from({length:4},()=>({__unloaded:true})),null,
   {loadPage:async i=>{if(i===2)throw Error('Synthetic unavailable record');return{strokes:[],textElements:[]};}});
  }catch(e){return{message:e.message,first:e.exportPage,last:e.exportEnd,cancelled:cancelled+0,finished,downloads};}
  finally{delete window.electronAPI;HTMLAnchorElement.prototype.click=click;}
 });
 assert.deepEqual(missing,{message:'pdf-page-unavailable',first:3,last:3,cancelled:1,finished:0,downloads:0});
 console.log('PASS PDF export flow: failed page read identifies the page, cancels the session and never downloads a partial notebook');
 return 3;
};
