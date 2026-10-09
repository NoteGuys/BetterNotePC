// Phase 4.2: real editor, IndexedDB, history, page navigation and whiteboard.
const assert=require('node:assert/strict');
module.exports=async({page,fixture,mount,flush,check})=>{
 const start=async(id)=>{
  await page.evaluate(id=>{
   const board=qa.boards.get(id),c=[...document.querySelectorAll('.bn-layer-active')].find(el=>el.closest('[data-page-id]')?.dataset.pageId===id)||document.querySelector('.bn-layer-active');
   const r=c.getBoundingClientRect();
   qa.sessionCanvas=c;
   qa.sessionEvent=(type,x,y)=>c.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:81,pointerType:'pen',button:0,
    buttons:type==='pointerup'?0:1,pressure:type==='pointerup'?0:.6,clientX:r.left+x*r.width/board.page.pageWidth,clientY:r.top+y*r.height/board.page.pageHeight}));
   qa.sessionEvent('pointerdown',40,50);qa.sessionEvent('pointermove',120,140);
  },id);
 };
 const init=async(id,count=2)=>{
  const nb=await fixture(id,count);await mount(nb);
  await page.evaluate(()=>{qa.toolbar.setActiveTool('pen');qa.toolbar.setScrollDirection('horizontal');qa.toolbar.setShowThumbnails(true);});
  await page.waitForFunction(()=>qa.thumbnails&&qa.toolbar.activeTool==='pen'&&qa.toolbar.scrollDirection==='horizontal');return nb;
 };
 const read=id=>page.evaluate(id=>qa.db.getPage(id),id);
 await check('Interrupted real editor stroke persists once and Undo/Redo restores its exact points',async()=>{
  await init('ink-session-blur');await start('ink-session-blur-p0');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await flush();
  const saved=(await read('ink-session-blur-p0')).strokes;assert.equal(saved.length,1);assert.equal(saved[0].points.length,2);
  await page.evaluate(()=>{qa.sessionEvent('pointerup',300,300);qa.toolbar.onUndo();});await flush();assert.equal((await read('ink-session-blur-p0')).strokes.length,0);
  await page.evaluate(()=>qa.toolbar.onRedo());await flush();assert.deepEqual((await read('ink-session-blur-p0')).strokes,saved);
 });
 for(const direction of ['horizontal','vertical'])await check(direction+' page navigation keeps interrupted ink on its original page and stays on the requested page',async()=>{
  const id='ink-session-'+direction;await init(id);
  await page.evaluate(direction=>qa.toolbar.setScrollDirection(direction),direction);await page.waitForFunction(direction=>qa.toolbar.scrollDirection===direction,direction);
  await start(id+'-p0');await page.evaluate(()=>qa.thumbnails.onSelectPage(1));await page.waitForFunction(()=>qa.thumbnails.currentPageIndex===1);await flush();
  assert.equal((await read(id+'-p0')).strokes.length,1);assert.equal((await read(id+'-p1')).strokes.length,0);
  await page.evaluate(()=>qa.sessionEvent('pointerup',300,300));await flush();
  assert.equal((await read(id+'-p0')).strokes.length,1);assert.equal(await page.evaluate(()=>qa.thumbnails.currentPageIndex),1);assert.equal(await page.evaluate(()=>!!window.__bn_pen_active),false);
 });
 await check('Switching tools while writing keeps the old stroke settings and permits new highlighter ink',async()=>{
  await init('ink-session-tool');await start('ink-session-tool-p0');await page.evaluate(()=>qa.toolbar.setActiveTool('highlighter'));
  await page.waitForFunction(()=>qa.toolbar.activeTool==='highlighter');await flush();assert.equal((await read('ink-session-tool-p0')).strokes[0].tool,'pen');
  await start('ink-session-tool-p0');await page.evaluate(()=>qa.sessionEvent('pointerup',160,170));await flush();
  assert.deepEqual((await read('ink-session-tool-p0')).strokes.map(s=>s.tool),['pen','highlighter']);
 });
 await check('Editor unmount and remount retains interrupted ink and one Undo action',async()=>{
  const nb=await init('ink-session-unmount');await start('ink-session-unmount-p0');await page.evaluate(()=>qa.unmount());await flush();
  const saved=(await read('ink-session-unmount-p0')).strokes;assert.equal(saved.length,1);
  await mount(nb);await page.waitForFunction(()=>qa.toolbar.canUndo);await page.evaluate(()=>qa.toolbar.onUndo());await flush();assert.equal((await read('ink-session-unmount-p0')).strokes.length,0);
  await page.evaluate(()=>qa.toolbar.onRedo());await flush();assert.deepEqual((await read('ink-session-unmount-p0')).strokes,saved);
 });
 await check('Switching notebook tabs during a stroke persists to the original notebook only',async()=>{
  const a=await fixture('ink-session-tab-a',1),b=await fixture('ink-session-tab-b',1);
  await page.evaluate(async([a,b])=>{
   qa.unmount();await qa.db.saveNotebook({...a,name:'Ink session A'});await qa.db.saveNotebook({...b,name:'Ink session B'});qa.mountApp();
  },[a,b]);await page.waitForFunction(()=>qa.library);
  await page.evaluate(()=>qa.library.onOpenNotebook('ink-session-tab-a'));await page.waitForFunction(()=>qa.toolbar?.notebookTitle==='Ink session A');
  await page.evaluate(()=>qa.tabs.onGoHome());await page.waitForFunction(()=>qa.library);
  await page.evaluate(()=>qa.library.onOpenNotebook('ink-session-tab-b'));await page.waitForFunction(()=>qa.toolbar?.notebookTitle==='Ink session B');
  await page.getByRole('tab',{name:/Ink session A/}).click();await page.waitForFunction(()=>qa.toolbar?.notebookTitle==='Ink session A');
  await page.evaluate(()=>qa.toolbar.setActiveTool('pen'));await start('ink-session-tab-a-p0');
  // Programmatic selection exercises unmount without a preparatory pointerdown.
  await page.evaluate(()=>qa.tabs.onSelectTab('ink-session-tab-b'));await page.waitForFunction(()=>qa.toolbar?.notebookTitle==='Ink session B');await flush();
  assert.equal((await read('ink-session-tab-a-p0')).strokes.length,1);assert.equal((await read('ink-session-tab-b-p0')).strokes.length,0);
 });
 await check('Whiteboard blur keeps world coordinates and releases its separate wheel contact lock',async()=>{
  const nb=await fixture('ink-session-whiteboard',1);
  await page.evaluate(async()=>{const p=await qa.db.getPage('ink-session-whiteboard-p0');await qa.db.savePage({...p,templateId:'whiteboard',sizeId:'whiteboard'});});
  await mount(nb);await page.waitForSelector('.bn-whiteboard-viewport');await page.evaluate(()=>qa.toolbar.setActiveTool('pen'));
  await start('ink-session-whiteboard-p0');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await flush();
  const saved=(await read('ink-session-whiteboard-p0')).strokes;assert.equal(saved.length,1);assert.equal(saved[0].points.length,2);
  const before=await page.locator('.bn-whiteboard-viewport').getAttribute('data-origin-y');
  await page.locator('.bn-whiteboard-viewport').dispatchEvent('wheel',{deltaY:80,bubbles:true,cancelable:true});
  await page.waitForFunction(before=>document.querySelector('.bn-whiteboard-viewport').dataset.originY!==before,before);
  await page.evaluate(()=>qa.toolbar.onUndo());await flush();assert.equal((await read('ink-session-whiteboard-p0')).strokes.length,0);
  await page.evaluate(()=>qa.toolbar.onRedo());await flush();assert.deepEqual((await read('ink-session-whiteboard-p0')).strokes,saved);
 });
};
