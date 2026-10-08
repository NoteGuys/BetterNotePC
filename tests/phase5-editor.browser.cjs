const assert=require('node:assert/strict');
module.exports=async({page,fixture,mount,flush,check,reload})=>{
 const openSidebar=async()=>{await page.evaluate(()=>qa.toolbar.setShowThumbnails(true));await page.waitForFunction(()=>qa.thumbnails);};
 const pixel=async()=>page.evaluate(async()=>{const c=document.querySelector('.bn-layer-static');return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',c.getContext('2d').getImageData(0,0,c.width,c.height).data)));});
 await check('Phase 5: large notebook retains only a nearby page window and bounded sidebar cards',async()=>{
  const nb=await fixture('phase5-large',180);
  await page.evaluate(async()=>{
   for(let i=0;i<180;i++){const p=await qa.db.getPage('phase5-large-p'+i);await qa.db.savePage({...p,strokes:[{tool:'pen',color:'#ff0000',width:4,isTapered:false,points:Array.from({length:1600},(_,j)=>({x:20+(j%400),y:20+(j%500),pressure:.6}))}]});}
  });
  const before=Date.now();await mount(nb);await openSidebar();
  await page.waitForTimeout(400);
  const info=await page.evaluate(()=>({loaded:qa.thumbnails.pages.filter(p=>!p.__unloaded).length,
   retainedPoints:qa.thumbnails.pages.reduce((sum,p)=>sum+(p.strokes||[]).reduce((n,s)=>n+s.points.length,0),0),
   cards:document.querySelectorAll('.bn-thumbnail-item').length,paths:document.querySelectorAll('.bn-thumbnail-card > svg:not(.lucide) path').length}));
  console.log('PHASE5_BENCH '+JSON.stringify({...info,openAndSidebarMs:Date.now()-before}));
  if(process.env.BETTERNOTE_QA_PHASE5_BASELINE==='1')return;
  assert.ok(info.loaded<=5);assert.ok(info.cards<=12);assert.equal(info.paths,0);assert.ok(info.retainedPoints<=8000);
  await page.waitForFunction(()=>document.querySelector('.bn-thumbnail-img')?.src.startsWith('data:image/png'));
  await page.screenshot({path:require('node:path').join(process.env.BETTERNOTE_QA_TEMP,'phase5-thumbnails.png')});
 });
 if(process.env.BETTERNOTE_QA_PHASE5_BASELINE==='1')return;
 await check('Phase 5: jumping far loads the right page and releases old rich records',async()=>{
  await page.evaluate(()=>qa.thumbnails.onSelectPage(179));
  await page.waitForFunction(()=>qa.boards.get('phase5-large-p179')?.page.strokes.length===1);
  await page.waitForTimeout(300);
  const result=await page.evaluate(()=>({index:qa.thumbnails.currentPageIndex,loaded:qa.thumbnails.pages.filter(p=>!p.__unloaded).length,first:qa.thumbnails.pages[0].__unloaded,active:!!document.querySelector('.bn-thumbnail-item-active')}));
  assert.equal(result.index,179);assert.ok(result.loaded<=5);assert.equal(result.first,true);assert.equal(result.active,true);
 });
 await check('Phase 5: favorite and duplication of an unloaded rich page keep all its content',async()=>{
  await page.evaluate(()=>qa.thumbnails.onToggleFavoritePage(50));await flush();
  assert.equal(await page.evaluate(async()=>(await qa.db.getPage('phase5-large-p50')).strokes[0].points.length),1600);
  await page.evaluate(()=>qa.thumbnails.onDuplicatePage(50));await flush();
  const copy=await page.evaluate(async()=>{const p=(await qa.db.getPagesByNotebookId('phase5-large'))[51];return{points:p.strokes[0].points.length,favorite:p.isFavorite,marker:p.__unloaded};});
  assert.equal(copy.points,1600);assert.equal(copy.favorite,true);assert.equal(copy.marker,undefined);
  await page.evaluate(()=>qa.toolbar.onUndo());await flush();
  assert.equal(await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('phase5-large')).length),180);
 });
 await check('Phase 5: an edited page still gets its latest preview after its rich record is released',async()=>{
  await page.evaluate(()=>qa.thumbnails.onSelectPage(50));await page.waitForFunction(()=>qa.boards.get('phase5-large-p50')?.page.strokes.length===1);
  await page.evaluate(()=>{const b=qa.boards.get('phase5-large-p50');return b.onStrokesChange(b.page.strokes.map(s=>({...s,color:'#00ff00'})));});await flush();
  await page.evaluate(()=>qa.thumbnails.onSelectPage(179));await page.waitForFunction(()=>qa.thumbnails.pages[50].__unloaded);
  await page.evaluate(()=>{qa.cache.clearAll();const list=document.querySelector('.bn-thumbnail-list');list.scrollTop=50*276;list.dispatchEvent(new Event('scroll'));});
  await page.waitForFunction(()=>document.querySelector('[data-page-index="50"] .bn-thumbnail-img'));
  const green=await page.evaluate(async()=>{
   const img=document.querySelector('[data-page-index="50"] .bn-thumbnail-img');await img.decode();
   const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
   const pixels=ctx.getImageData(0,0,c.width,c.height).data;let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+1]>180&&pixels[i]<100&&pixels[i+2]<100)count++;return count;
  });assert.ok(green>0);
 });
 await check('Phase 5: rapid metadata commands on loaded and unloaded pages preserve ordering and ink',async()=>{
  const result=await page.evaluate(async()=>{
   await Promise.all([qa.thumbnails.onToggleFavoritePage(120),qa.thumbnails.onToggleFavoritePage(120)]);
   await Promise.all([qa.thumbnails.onToggleFavoritePage(179),qa.thumbnails.onToggleFavoritePage(179)]);
   await qa.local.flushLocalSaves();
   const far=await qa.db.getPage('phase5-large-p120'),near=await qa.db.getPage('phase5-large-p179');
   return {far:far.isFavorite||false,near:near.isFavorite||false,farPoints:far.strokes[0].points.length,nearPoints:near.strokes[0].points.length};
  });
  assert.deepEqual(result,{far:false,near:false,farPoints:1600,nearPoints:1600});
 });
 await check('Phase 5: append rendering exactly matches a full redraw including overlapping highlighters and eraser',async()=>{
  const nb=await fixture('phase5-pixels',1);await mount(nb);
  for(const stroke of [
   {tool:'pen',color:'#ff0000',width:8,points:[{x:50,y:70,pressure:.8},{x:260,y:240,pressure:.6}]},
   {tool:'highlighter',highlighterTip:'round',color:'#ffff00',width:10,points:[{x:30,y:180,pressure:.6},{x:280,y:180,pressure:.6}]},
   {tool:'highlighter',highlighterTip:'square',color:'#ff8800',width:10,points:[{x:160,y:40,pressure:.6},{x:160,y:290,pressure:.6}]},
   {tool:'eraser',width:8,points:[{x:150,y:50,pressure:.6},{x:150,y:280,pressure:.6}]}]){
   await page.evaluate(async stroke=>{const p=await qa.db.getPage('phase5-pixels-p0');await qa.boards.get(p.id).onStrokesChange([...p.strokes,stroke]);},stroke);await flush();
  }
  const appended=await pixel();
  const nb2=await page.evaluate(()=>qa.db.getNotebookById('phase5-pixels'));await mount(nb2);await page.waitForTimeout(100);
  assert.deepEqual(await pixel(),appended);
  await page.evaluate(()=>qa.toolbar.onUndo());await flush();const undo=await pixel();
  await mount(nb2);await page.waitForTimeout(100);assert.deepEqual(await pixel(),undo);
 });
 await check('Phase 5: duplicating selected highlighter ink paints it once and matches reopening',async()=>{
  const nb=await page.evaluate(()=>qa.db.getNotebookById('phase5-pixels'));await mount(nb);
  await page.evaluate(()=>qa.toolbar.setActiveTool('lasso'));
  await page.waitForFunction(()=>qa.boards.get('phase5-pixels-p0').activeTool==='lasso');
  await page.evaluate(()=>{
   const c=document.querySelector('.bn-layer-active'),r=c.getBoundingClientRect(),board=qa.boards.get('phase5-pixels-p0');
   const emit=(type,x,y)=>c.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:93,pointerType:'pen',button:0,buttons:type==='pointerup'?0:1,pressure:.6,clientX:r.left+x*r.width/board.page.pageWidth,clientY:r.top+y*r.height/board.page.pageHeight}));
   emit('pointerdown',10,10);for(const p of [[150,10],[320,10],[320,170],[320,330],[150,330],[10,330],[10,170],[10,10]])emit('pointermove',...p);emit('pointerup',10,10);
  });
  await page.locator('.bn-lasso-action-btn').filter({hasText:'Duplicate'}).click();await flush();
  const duplicated=await pixel();await mount(nb);await page.waitForTimeout(100);assert.deepEqual(await pixel(),duplicated);
 });
 await check('Phase 5: original PDF bytes survive owner deletion, Undo and portable backup snapshots',async()=>{
  const nb=await fixture('phase5-original',3);
  await page.evaluate(async()=>{
   for(let i=0;i<3;i++){const p=await qa.db.getPage('phase5-original-p'+i);await qa.db.savePage({...p,pdfOriginalId:'synthetic-source',...(i===0?{pdfOriginal:{id:'synthetic-source',name:'synthetic.pdf',dataUrl:'data:application/pdf;base64,c3ludGhldGlj'}}:{})});}
  });
  await mount(nb);await openSidebar();
  assert.equal(await page.evaluate(()=>qa.boards.get('phase5-original-p0').page.pdfOriginal),undefined);
  const uiSourceReads=await page.evaluate(async()=>{
   const original=IDBObjectStore.prototype.get;let reads=0;
   IDBObjectStore.prototype.get=function(key){if(this.name==='pages'&&key==='phase5-original-p0')reads++;return original.call(this,key);};
   try{await qa.boards.get('phase5-original-p0').onStrokesChange(qa.ink(1));await qa.local.flushLocalSaves();return reads;}
   finally{IDBObjectStore.prototype.get=original;}
  });assert.equal(uiSourceReads,0);
  assert.equal(await page.evaluate(async()=>!!(await qa.db.getPage('phase5-original-p0')).pdfOriginal),true);
  const failedOwner=await page.evaluate(async()=>{
   const stored=await qa.db.getPage('phase5-original-p0');await qa.db.deletePage(stored.id);
   await qa.boards.get(stored.id).onStrokesChange(qa.ink(2));
   const failed=qa.local.pageSaveQueue.getSnapshot().failed;
   await qa.db.savePage(stored);await qa.local.pageSaveQueue.retry('phase5-original');
   const recovered=await qa.db.getPage(stored.id);
   return {failed,strokes:recovered.strokes.length,original:recovered.pdfOriginal.dataUrl};
  });assert.deepEqual(failedOwner,{failed:1,strokes:2,original:'data:application/pdf;base64,c3ludGhldGlj'});
  await page.evaluate(()=>qa.thumbnails.onDeletePage(0));await flush();
  const source=await page.evaluate(async()=>{const note=await qa.db.getBackupNotebookSnapshot('phase5-original');return note.pages.filter(p=>p.pdfOriginal).map(p=>p.pdfOriginal.dataUrl);});
  assert.deepEqual(source,['data:application/pdf;base64,c3ludGhldGlj']);
  await page.evaluate(()=>qa.toolbar.onUndo());await flush();
  assert.equal(await page.evaluate(async()=>(await qa.db.getBackupNotebookSnapshot('phase5-original')).pages.filter(p=>p.pdfOriginal).length),1);
 });
 await check('Phase 5: single-page exports hydrate an unloaded page and refuse read failures',async()=>{
  const nb=await page.evaluate(()=>qa.db.getNotebookById('phase5-large'));await mount(nb);
  const result=await page.evaluate(async()=>{
   const rich=await qa.export.loadPage(90);
   const restore=await qa.fault({store:'pages',throwRead:true});
   let rejected=false;
   try{await qa.export.loadPage(120);}catch(_){rejected=true;}finally{restore();}
   return {points:rich.strokes[0].points.length,id:rich.id,rejected};
  });
  assert.deepEqual(result,{points:1600,id:'phase5-large-p90',rejected:true});
 });
 await check('Phase 5: full exports include unloaded pages and worker encoding keeps the portable format',async()=>{
  const nb=await page.evaluate(()=>qa.db.getNotebookById('phase5-large'));await mount(nb);await openSidebar();
  const result=await page.evaluate(async()=>{
   const pages=await qa.export.loadPages(),bytes=await qa.export.loadBNote(),portable=JSON.parse(new TextDecoder().decode(bytes));
   return {count:pages.length,points:pages.reduce((n,p)=>n+(p.strokes?.[0]?.points.length||0),0),markers:pages.some(p=>p.__unloaded),format:portable.format,portableCount:portable.pages.length};
  });
  assert.deepEqual(result,{count:180,points:288000,markers:false,format:'BetterNote_Document',portableCount:180});
 });
 await check('Phase 5: cache clear releases real previews and visible cards regenerate',async()=>{
  await page.waitForFunction(()=>document.querySelector('.bn-thumbnail-img'));
  const empty=await page.evaluate(()=>{qa.cache.clearAll();return qa.cache.getCacheStats().totalBytes;});assert.equal(empty,0);
  await page.waitForFunction(()=>document.querySelector('.bn-thumbnail-img')?.src.startsWith('data:image/png'));
  assert.ok(await page.evaluate(()=>qa.cache.getCacheStats().totalBytes>0));
 });
 await check('Phase 5: failed pending saves prevent exporting a stale notebook',async()=>{
  const nb=await fixture('phase5-export-fail',1);await mount(nb);
  const result=await page.evaluate(async()=>{
   const restore=await qa.fault({store:'pages',key:'phase5-export-fail-p0'});
   const p=await qa.db.getPage('phase5-export-fail-p0');await qa.local.pageSaveQueue.enqueue({...p,strokes:qa.ink(1)}).catch(()=>{});
   let blocked=false;try{await qa.export.loadBNote();}catch(_){blocked=true;}
   restore();await qa.local.pageSaveQueue.retry('phase5-export-fail');return blocked;
  });assert.equal(result,true);
 });
 await check('Phase 5: large vertical pages keep the three-layer raster allocation within the shared budget',async()=>{
  const nb=await fixture('phase5-budget',5);
  await page.evaluate(async()=>{
   for(let i=0;i<5;i++){const p=await qa.db.getPage('phase5-budget-p'+i);await qa.db.savePage({...p,pageWidth:4000,pageHeight:6000});}
  });
  await mount(nb);await page.evaluate(()=>qa.toolbar.setScrollDirection('vertical'));await page.waitForTimeout(400);
  const bytes=await page.evaluate(()=>[...document.querySelectorAll('canvas.bn-layer-background,canvas.bn-layer-static,canvas.bn-layer-active')].reduce((sum,c)=>sum+c.width*c.height*4,0));
  assert.ok(bytes>0);assert.ok(bytes<=144*1048576, String(bytes));
 });
 await check('Phase 5: leaving an editor releases its actual canvas backing stores',async()=>{
  const result=await page.evaluate(()=>{const canvases=[...document.querySelectorAll('.bn-layer-background,.bn-layer-static,.bn-layer-active')];qa.unmount();return canvases.map(c=>[c.width,c.height]);});
  assert.ok(result.length>=2);assert.ok(result.every(([w,h])=>w===1&&h===1));
 });
 await require('./thumbnail-navigation.browser.cjs')({page,fixture,mount,flush,check,reload});
 await require('./pdf-navigation.browser.cjs')({page,mount,flush,check});
};
