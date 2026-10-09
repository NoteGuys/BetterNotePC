const assert = require('node:assert/strict');
module.exports = async ({page,fixture,mount,flush,check,reload}) => {
 let notebook, savedUrls;
 const readPrepared = () => page.evaluate(async()=>{
  const pages=Array.from({length:12},(_,i)=>({id:'preview-ready-p'+i,notebookId:'preview-ready',templateId:'blank'}));
  return qa.previewStorage.readPagePreviews('preview-ready',pages,'blank',qa.previewState.pagePreviewEpoch('preview-ready'));
 });
 const waitPrepared = async () => {
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){const records=await readPrepared();if(records.length===12)return records;await page.waitForTimeout(50);}
  throw Error('Not all twelve previews were persisted');
 };
 const shown = () => page.evaluate(()=>[...document.querySelectorAll('.bn-thumbnail-item')].map(el=>({index:Number(el.dataset.pageIndex),src:el.querySelector('.bn-thumbnail-img')?.getAttribute('src')||null})));
 const scroll = async index => {
  await page.evaluate(index=>{const list=document.querySelector('.bn-thumbnail-list');list.scrollTop=index*276;list.dispatchEvent(new Event('scroll'));},index);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 };
 await check('Thumbnail navigation: unseen pages prepare while the sidebar is closed without retaining rich pages',async()=>{
  notebook=await fixture('preview-ready',12);
  await page.evaluate(async()=>{for(let i=0;i<12;i++){const p=await qa.db.getPage('preview-ready-p'+i);await qa.db.savePage({...p,strokes:[{tool:'pen',color:i%2?'#00aa00':'#ff0000',width:5,points:[{x:40,y:40,pressure:.6},{x:300,y:300,pressure:.6}]}]});}});
  await mount(notebook);await page.evaluate(()=>qa.toolbar.setShowThumbnails(false));const prepared=await waitPrepared();
  const info=await page.evaluate(()=>({rich:[...qa.boards.values()].filter(b=>b.page.notebookId==='preview-ready').length,bytes:qa.cache.getCacheStats().totalBytes}));
  assert.ok(info.rich<=5);assert.ok(info.bytes<=32*1024*1024);
  savedUrls=Object.fromEntries(prepared.map(p=>[Number(p.pageId.slice('preview-ready-p'.length)),p.dataUrl]));
 });
 await check('Thumbnail navigation: scrolling into prepared pages and back shows PNGs in the first rendered frame',async()=>{
  await page.evaluate(()=>qa.toolbar.setShowThumbnails(true));await page.waitForFunction(()=>qa.thumbnails?.pages[0]?.notebookId==='preview-ready' && document.querySelector('.bn-thumbnail-list'));
  for(const index of [9,0,6,0]){
   await scroll(index);const cards=await shown();assert.ok(cards.length>0&&cards.length<=12);
   for(const card of cards)assert.ok(card.src && card.src===savedUrls[card.index],JSON.stringify({index:card.index,keys:Object.keys(savedUrls),hasImage:!!card.src,notebook:await page.evaluate(()=>qa.thumbnails?.pages[0]?.notebookId)}));
  }
 });
 await check('Thumbnail navigation: replacing a page record keeps its previous PNG while an update waits for pen idle',async()=>{
  await page.evaluate(()=>qa.thumbnails.onSelectPage(0));await page.waitForFunction(()=>qa.boards.get('preview-ready-p0')?.page.strokes.length===1);
  await scroll(0);const before=(await shown()).find(c=>c.index===0).src;
  await page.evaluate(async()=>{
   window.__bn_pen_active=true;
   const board=qa.boards.get('preview-ready-p0');await board.onStrokesChange(board.page.strokes.map(s=>({...s,color:'#0000ff'})));
  });await flush();await page.waitForTimeout(120);
  assert.equal((await shown()).find(c=>c.index===0).src,before);
  await page.evaluate(()=>window.__bn_pen_active=false);
  await page.waitForFunction(before=>document.querySelector('[data-page-index="0"] .bn-thumbnail-img')?.src!==before,before);
  savedUrls[0]=(await shown()).find(c=>c.index===0).src;
 });
 await check('Thumbnail navigation: an evicted RAM preview is restored from disk before the sidebar mounts',async()=>{
  await page.evaluate(()=>{qa.unmount();qa.cache.invalidate('page-preview:');});
  await mount(notebook);await page.evaluate(()=>qa.toolbar.setShowThumbnails(true));await page.waitForFunction(()=>qa.thumbnails);
  await scroll(9);for(const card of await shown())assert.ok(card.src===savedUrls[card.index],'Restored preview differs at page '+card.index);
 });
 await check('Thumbnail navigation: preparing and reusing images never changes note content or adds preview fields to backups',async()=>{
  const data=await page.evaluate(async()=>{
   const nb=await qa.db.getBackupNotebookSnapshot('preview-ready');
   return {count:nb.pages.length,colors:nb.pages.map(p=>p.strokes[0].color),polluted:nb.pages.some(p=>Object.keys(p).some(key=>key.startsWith('__preview')||key==='previewDataUrl'))};
  });
  assert.equal(data.count,12);assert.equal(data.colors[0],'#0000ff');assert.equal(data.polluted,false);
 });
 await check('Thumbnail navigation: persisted PNGs survive a fresh renderer with no RAM cache',async()=>{
  await page.evaluate(()=>qa.unmount());await flush();await reload();await mount(notebook);
  await page.evaluate(()=>qa.toolbar.setShowThumbnails(true));
  await page.waitForFunction(()=>document.querySelector('.bn-thumbnail-list'));
  await scroll(9);
  for(const card of await shown())assert.ok(card.src===savedUrls[card.index],'Fresh renderer preview differs at page '+card.index);
 });
 await check('Thumbnail navigation: recovery receipts invalidate cached previews from the previous notebook version',async()=>{
  await page.evaluate(async()=>{
   qa.unmount();
   await qa.db.saveSetting('backup_recovery_receipt',{operationId:'preview-recovered-version'});
   const loaded=await qa.pageLoader.loadPageManifest('preview-ready',{templateId:'blank'});
   return loaded.length;
  });
  assert.equal(await page.evaluate(()=>qa.previewState.cachedPagePreview({id:'preview-ready-p0',notebookId:'preview-ready',templateId:'blank'},'blank')),null);
 });
};
