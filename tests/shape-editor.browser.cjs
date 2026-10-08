// Actual NoteEditor/Whiteboard, synthetic IndexedDB and independent shape history.
const assert=require('node:assert/strict');
module.exports=async({page,fixture,mount,flush,check})=>{
 for(const whiteboard of [false,true])for(const shape of ['line','rectangle','circle','triangle','arrow'])await check((whiteboard?'Whiteboard ':'Notebook ')+shape+' saves, Undo/Redo and reopen keep exact shape data',async()=>{
  const id='shape-editor-'+(whiteboard?'wb-':'page-')+shape,nb=await fixture(id,1);
  if(whiteboard)await page.evaluate(async id=>{const p=await qa.db.getPage(id+'-p0');await qa.db.savePage({...p,templateId:'whiteboard',sizeId:'whiteboard'});},id);
  await mount(nb);await page.evaluate(shape=>{qa.toolbar.setActiveTool('shape');qa.toolbar.setActiveShape(shape);},shape);
  await page.waitForFunction(shape=>qa.toolbar.activeTool==='shape'&&qa.toolbar.activeShape===shape,shape);
  await page.evaluate(id=>{
   const board=qa.boards.get(id+'-p0'),c=document.querySelector('.bn-layer-active'),r=c.getBoundingClientRect();
   const emit=(type,x,y)=>c.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'pen',pointerId:88,button:0,buttons:type==='pointerup'?0:1,pressure:type==='pointerup'?0:.6,
    clientX:r.left+x*r.width/board.page.pageWidth,clientY:r.top+y*r.height/board.page.pageHeight}));
   emit('pointerdown',60,70);emit('pointermove',260,230);emit('pointerup',260,230);
  },id);await flush();
  const saved=await page.evaluate(async id=>(await qa.db.getPage(id+'-p0')).strokes,id);
  assert.equal(saved.length,1);assert.equal(saved[0].isTapered,false);assert.equal(saved[0].shapeType,shape);assert.ok(saved[0].points.length>2);
  await page.evaluate(()=>qa.toolbar.onUndo());await flush();assert.equal(await page.evaluate(async id=>(await qa.db.getPage(id+'-p0')).strokes.length,id),0);
  await page.evaluate(()=>qa.toolbar.onRedo());await flush();assert.deepEqual(await page.evaluate(async id=>(await qa.db.getPage(id+'-p0')).strokes,id),saved);
  await mount(nb);await page.waitForFunction(id=>qa.boards.get(id+'-p0')?.page.strokes.length===1,id);
  assert.deepEqual(await page.evaluate(async id=>(await qa.db.getPage(id+'-p0')).strokes,id),saved);
 });
};
