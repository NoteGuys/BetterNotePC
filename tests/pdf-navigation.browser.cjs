const assert=require('node:assert/strict');
module.exports=async({page,mount,flush,check})=>{
 let notebook;
 await check('PDF navigation: first sidebar paint already contains all visible page images',async()=>{
  notebook=await page.evaluate(()=>qa.pdfFixture(12));
  await mount(notebook);await page.evaluate(()=>qa.toolbar.setShowThumbnails(true));
  await page.waitForFunction(()=>document.querySelector('.bn-thumbnail-item'));
  const info=await page.evaluate(()=>({cards:[...document.querySelectorAll('.bn-thumbnail-item')].map(el=>!!el.querySelector('.bn-thumbnail-img')?.src),rich:qa.thumbnails.pages.filter(p=>!p.__unloaded).length}));
  assert.ok(info.cards.length>0&&info.cards.every(Boolean));assert.ok(info.rich<=5);
 });
 await check('PDF navigation: a distant read failure keeps the ready page visible with Retry instead of a loading screen',async()=>{
  await page.evaluate(async()=>{qa.pdfReadFault=await qa.fault({store:'pages',throwRead:true});qa.toolbar.setScrollDirection('horizontal');qa.thumbnails.onSelectPage(11);});
  await page.waitForSelector('.bn-pdf-ready-page');
  await page.waitForSelector('.bn-paper-sheet > button');
  assert.equal(await page.evaluate(()=>!!document.querySelector('.bn-loading-screen')),false);
  assert.equal(await page.evaluate(()=>document.querySelector('.bn-pdf-ready-page').complete&&document.querySelector('.bn-pdf-ready-page').naturalWidth>0),true);
 });
 await check('PDF navigation: Retry restores editable content without changing page size or background',async()=>{
  await page.evaluate(()=>qa.pdfReadFault());await page.click('.bn-paper-sheet > button');
  await page.waitForFunction(()=>[...qa.boards.values()].some(b=>b.page.pageIndex===11&&b.page.notebookId===qa.thumbnails.pages[0].notebookId));
  const info=await page.evaluate(()=>{const board=[...qa.boards.values()].find(b=>b.page.pageIndex===11&&b.page.notebookId===qa.thumbnails.pages[0].notebookId);return{image:!!document.querySelector('.bn-pdf-ready-background'),lazy:board.page.pdfLazyRaster,width:board.page.pageWidth,height:board.page.pageHeight};});
  assert.deepEqual(info,{image:true,lazy:1,width:800,height:1200});
 });
 await check('PDF navigation: vertical scrolling retains ready backgrounds while sharp rendering waits for pen idle',async()=>{
  await page.evaluate(()=>{window.__bn_pen_active=true;qa.toolbar.setScrollDirection('vertical');});
  await page.waitForSelector('.bn-stage-vertical');
  await page.evaluate(()=>qa.thumbnails.onSelectPage(5));
  await page.waitForFunction(()=>{const wrapper=document.querySelector('#vertical-page-5'),stage=document.querySelector('.bn-editor-canvas-stage');if(!wrapper?.querySelector('.bn-pdf-ready-background'))return false;const w=wrapper.getBoundingClientRect(),s=stage.getBoundingClientRect();return Math.abs(w.top-s.top)<100;});
  assert.equal(await page.evaluate(()=>document.querySelector('#vertical-page-5 .bn-pdf-ready-background').complete),true);
  assert.equal(await page.evaluate(()=>!!document.querySelector('.bn-loading-screen')),false);
  await page.screenshot({path:process.env.BETTERNOTE_QA_TEMP+'/pdf54-ready-scroll.png'});
  await page.evaluate(()=>window.__bn_pen_active=false);
 });
 await check('PDF navigation: opening, retrying and scrolling never rewrites the imported small backgrounds',async()=>{
  await flush();await page.evaluate(()=>qa.unmount());
  const info=await page.evaluate(async id=>{const p=await qa.db.getPagesByNotebookId(id);return{count:p.length,sources:p.filter(p=>p.pdfOriginal).length,unchanged:p.every(p=>p.pdfLazyRaster===1&&p.strokes.length===0&&p.thumbnailUrl&&p.pdfPageImage)};},notebook.id);
  assert.deepEqual(info,{count:12,sources:1,unchanged:true});
 });
};
