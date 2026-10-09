const assert=require('node:assert/strict');
module.exports=async({page,fixture,mount,check})=>{
 for(const mixed of [false,true])await check('Toolbar zoom preserves page 40 in a 91-page '+(mixed?'mixed-size':'portrait')+' notebook',async()=>{
  const id='zoom-'+mixed,nb=await fixture(id,91);await page.evaluate(async([id,mixed])=>{if(mixed)for(let i=0;i<91;i++){const p=await qa.db.getPage(id+'-p'+i);await qa.db.savePage({...p,pageWidth:i%2?1600:1200,pageHeight:i%2?1200:1600});}localStorage.setItem('betternote_user_preferences',JSON.stringify({zoom:.8,scrollDirection:'vertical'}));},[id,mixed]);
  await mount(nb,39);await page.evaluate(()=>qa.toolbar.setShowThumbnails(true));await page.waitForFunction(()=>qa.thumbnails);await page.waitForTimeout(500);
  await page.evaluate(()=>qa.thumbnails.onSelectPage(39));await page.waitForFunction(()=>document.querySelector('#vertical-page-39 .bn-canvas-container'));
  await page.evaluate(()=>{const stage=document.querySelector('.bn-editor-canvas-stage'),s=stage.getBoundingClientRect(),p=document.querySelector('#vertical-page-39 .bn-canvas-container').getBoundingClientRect();stage.scrollTop+=p.top+p.height/2-(s.top+s.height/2);stage.dispatchEvent(new Event('scroll'));});await page.waitForTimeout(500);
  const read=()=>page.evaluate(()=>{const stage=document.querySelector('.bn-editor-canvas-stage'),r=stage.getBoundingClientRect(),sheet=document.querySelector('#vertical-page-39 .bn-canvas-container'),p=sheet.getBoundingClientRect();return{page:qa.thumbnails.currentPageIndex,zoom:qa.toolbar.zoom,x:(r.left+r.width/2-p.left)/qa.toolbar.zoom,y:(r.top+r.height/2-p.top)/qa.toolbar.zoom};});
  const before=await read();
  for(const action of ['onZoomIn','onZoomIn','onZoomOut','onResetZoom','onZoomOut']){
   await page.evaluate(action=>qa.toolbar[action](),action);await page.waitForTimeout(380);const after=await read();assert.equal(after.page,39);assert.ok(Math.abs(after.y-before.y)<3,JSON.stringify({before,after}));
  }
 });
 await check('Toolbar zoom immediately after a far scroll anchors an unloaded preview, not an old canvas',async()=>{
  const before=await page.evaluate(()=>{
   const stage=document.querySelector('.bn-editor-canvas-stage'),r=stage.getBoundingClientRect(),sheet=document.querySelector('#vertical-page-70 .bn-vertical-page-placeholder'),p=sheet.getBoundingClientRect();
   stage.scrollTop+=p.top+p.height/2-(r.top+r.height/2);const visible=sheet.getBoundingClientRect(),y=(r.top+r.height/2-visible.top)/qa.toolbar.zoom;
   qa.toolbar.onZoomIn();return{y};
  });
  await page.waitForTimeout(500);const after=await page.evaluate(()=>{
   const stage=document.querySelector('.bn-editor-canvas-stage'),r=stage.getBoundingClientRect(),sheet=document.querySelector('#vertical-page-70 .bn-canvas-container, #vertical-page-70 .bn-vertical-page-placeholder'),p=sheet.getBoundingClientRect();return{y:(r.top+r.height/2-p.top)/qa.toolbar.zoom,page:qa.thumbnails.currentPageIndex};
  });assert.equal(after.page,70);assert.ok(Math.abs(after.y-before.y)<3,JSON.stringify({before,after}));
 });
};
