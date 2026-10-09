
// Actual editor UI, persisted strokes and history. Synthetic notebook only.
const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async({page,fixture,mount,flush,check,preview})=>{
 const notebook=await fixture('highlighter-color-ui',1);
 await page.evaluate(()=>{qa.unmount();qa.lang.setAppLanguage('en');localStorage.setItem('betternote_quick_color_slots',JSON.stringify(['#1e293b','#2563eb','#dc2626','#16a34a','#ea580c']));});await mount(notebook);
 const tool=()=>page.getByRole('button',{name:'Highlighter',exact:true});
 const choose=async(selector,color)=>page.locator(selector).evaluate((input,value)=>{
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);
  input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
 },color);
 const draw=async(y)=>page.evaluate(y=>{
  const c=document.querySelector('.bn-layer-active'),r=c.getBoundingClientRect(),board=[...qa.boards.values()][0];
  const emit=(type,x)=>c.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'pen',pointerId:81,button:0,
   buttons:type==='pointerup'?0:1,pressure:type==='pointerup'?0:.6,clientX:r.left+x*r.width/board.page.pageWidth,clientY:r.top+y*r.height/board.page.pageHeight}));
  emit('pointerdown',80);emit('pointermove',140);emit('pointermove',190);emit('pointerup',190);
 },y);
 await check('Rainbow toolbar color picker has a full circular 24px hit target and keeps color slots',async()=>{
  const input=page.locator('.bn-color-wheel input').first();
  const info=await input.evaluate(el=>{
   const r=el.getBoundingClientRect(),style=getComputedStyle(el.parentElement);
   return {width:r.width,height:r.height,background:style.backgroundImage,radius:style.borderRadius,type:el.type,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el};
  });assert.equal(info.width,24);assert.equal(info.height,24);assert.ok(info.background.includes('conic-gradient'));assert.equal(info.radius,'50%');assert.equal(info.type,'color');assert.equal(info.hit,true);
  await choose('.bn-color-wheel input','#ac31e8');await page.waitForFunction(()=>qa.toolbar.activeColor==='#ac31e8');
  assert.equal(await page.locator('.bn-color-wheel input').first().inputValue(),'#ac31e8');
 });
 await check('Highlighter opens only its two tip settings on second tap',async()=>{
  await page.evaluate(()=>qa.toolbar.setActiveTool('pen'));await page.waitForFunction(()=>qa.toolbar.activeTool==='pen');
  await tool().click();assert.equal(await page.locator('.bn-highlighter-settings').count(),0);
  await tool().click();await page.waitForSelector('.bn-highlighter-settings');
  assert.deepEqual(await page.locator('.bn-highlighter-settings [aria-pressed]').allTextContents(),['Round tip','Square tip']);
  assert.equal(await page.locator('.bn-highlighter-settings input').count(),0);
  await page.getByRole('button',{name:'Round tip',exact:true}).click();await page.waitForFunction(()=>qa.toolbar.highlighterTip==='round');
  assert.equal(await page.getByRole('button',{name:'Round tip',exact:true}).getAttribute('aria-pressed'),'true');
  await page.waitForFunction(()=>document.querySelector('.bn-highlighter-settings .bn-nib-choice-active')?.textContent==='Round tip');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:path.join(preview,'betternote-highlighter-tips.png')});
  await page.getByRole('button',{name:'Done',exact:true}).click();
 });
 await check('New round and square strokes retain independent tips in local storage',async()=>{
  await draw(140);await page.waitForFunction(()=>[...qa.boards.values()][0].page.strokes.length===1);
  await tool().click();await page.getByRole('button',{name:'Square tip',exact:true}).click();await page.getByRole('button',{name:'Done',exact:true}).click();
  await draw(380);await page.waitForFunction(()=>[...qa.boards.values()][0].page.strokes.length===2);await flush();
  const s=await page.evaluate(async()=> (await qa.db.getPage('highlighter-color-ui-p0')).strokes);
  assert.deepEqual(s.map(x=>[x.tool,x.highlighterTip,x.color]),[['highlighter','round','#ac31e8'],['highlighter','square','#ac31e8']]);
 });
 await check('Tip preference and both existing stroke tips survive reopening the editor',async()=>{
  await page.evaluate(()=>qa.toolbar.setHighlighterTip('round'));await page.waitForFunction(()=>JSON.parse(localStorage.getItem('betternote_user_preferences')).highlighterTip==='round');
  await flush();await mount(notebook);
  assert.equal(await page.evaluate(()=>qa.toolbar.highlighterTip),'round');
  assert.deepEqual(await page.evaluate(()=>[...qa.boards.values()][0].page.strokes.map(s=>s.highlighterTip)),['round','square']);
 });
 await check('Lasso rainbow recolor changes only selected ink and preserves both tips',async()=>{
  await page.evaluate(()=>qa.toolbar.setActiveTool('lasso'));await page.waitForFunction(()=>[...qa.boards.values()][0].activeTool==='lasso');
  await page.evaluate(()=>{
   const c=document.querySelector('.bn-layer-active'),r=c.getBoundingClientRect(),board=[...qa.boards.values()][0];
   const emit=(type,x,y)=>c.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:81,pointerType:'pen',button:0,buttons:type==='pointerup'?0:1,pressure:.6,
    clientX:r.left+x*r.width/board.page.pageWidth,clientY:r.top+y*r.height/board.page.pageHeight}));
   emit('pointerdown',20,80);for(const p of [[130,80],[250,80],[250,150],[250,220],[130,220],[20,220],[20,150],[20,80]])emit('pointermove',...p);emit('pointerup',20,80);
  });await page.locator('.bn-lasso-action-btn').filter({hasText:'Recolor'}).click();
  const input=page.locator('.bn-lasso-color-popover .bn-color-wheel input');
  assert.equal((await input.boundingBox()).width,24);
  assert.equal(await page.locator('.bn-lasso-color-swatch').count(),5);
  assert.deepEqual(await page.locator('.bn-lasso-color-swatch').evaluateAll(items=>items.map(e=>e.style.backgroundColor)),await page.locator('.bn-quick-color-btn').evaluateAll(items=>items.map(e=>e.style.backgroundColor)));
  await page.screenshot({path:path.join(preview,'betternote-lasso-rainbow.png')});
  assert.equal(await page.locator('.bn-lasso-color-swatch').evaluateAll(items=>items.every(e=>{const r=e.getBoundingClientRect();return r.width===20&&r.height===20&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e;})),true);
  assert.equal(await input.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;}),true);
  await page.screenshot({path:path.join(preview,'betternote-lasso-rainbow.png')});
  await choose('.bn-lasso-color-popover .bn-color-wheel input','#18b47e');await flush();
  await page.waitForFunction(()=>qa.toolbar.activeColor==='#18b47e'&&qa.toolbar.colorSlots.includes('#18b47e'));
  assert.deepEqual(await page.evaluate(()=>qa.toolbar.colorSlots),await page.evaluate(()=>JSON.parse(localStorage.getItem('betternote_quick_color_slots'))));
  assert.deepEqual(await page.evaluate(async()=> (await qa.db.getPage('highlighter-color-ui-p0')).strokes.map(s=>[s.color,s.highlighterTip])),[['#18b47e','round'],['#ac31e8','square']]);
 });
 await check('Recolor Undo and Redo preserve highlighter tip and saved content',async()=>{
  await page.evaluate(()=>qa.toolbar.onUndo());await flush();
  assert.deepEqual(await page.evaluate(async()=> (await qa.db.getPage('highlighter-color-ui-p0')).strokes.map(s=>[s.color,s.highlighterTip])),[['#ac31e8','round'],['#ac31e8','square']]);
  await page.evaluate(()=>qa.toolbar.onRedo());await flush();
  assert.deepEqual(await page.evaluate(async()=> (await qa.db.getPage('highlighter-color-ui-p0')).strokes.map(s=>[s.color,s.highlighterTip])),[['#18b47e','round'],['#ac31e8','square']]);
 });

 await check('Saved palette is shared in both directions and preset clicks recolor only the selection',async()=>{
  const reopen=()=>page.locator('.bn-lasso-action-btn').filter({hasText:'Recolor'}).click();
  await reopen();
  assert.deepEqual(await page.locator('.bn-lasso-color-swatch').evaluateAll(items=>items.map(e=>e.style.backgroundColor)),
    await page.locator('.bn-quick-color-btn').evaluateAll(items=>items.map(e=>e.style.backgroundColor)));
  const preset=await page.evaluate(()=>qa.toolbar.colorSlots[3]);
  await page.locator('.bn-lasso-color-swatch').nth(3).click();await flush();
  assert.equal(await page.evaluate(()=>qa.toolbar.activeColor),preset);
  assert.deepEqual(await page.evaluate(async()=> (await qa.db.getPage('highlighter-color-ui-p0')).strokes.map(s=>s.color)),[preset,'#ac31e8']);
  await reopen();
  await choose('.bn-quick-colors .bn-color-wheel input','#ef9c22');
  await page.waitForFunction(()=>[...document.querySelectorAll('.bn-lasso-color-swatch')].some(e=>e.style.backgroundColor==='rgb(239, 156, 34)'));
  // Choosing a toolbar color changes the saved palette; it does not recolor ink until a swatch is applied.
  assert.equal(await page.evaluate(async()=> (await qa.db.getPage('highlighter-color-ui-p0')).strokes[0].color),preset);
  await page.locator('.bn-lasso-color-swatch').nth(3).click();await flush();
  assert.equal(await page.evaluate(async()=> (await qa.db.getPage('highlighter-color-ui-p0')).strokes[0].color),'#ef9c22');
  const saved=await page.evaluate(()=>qa.toolbar.colorSlots);await mount(notebook);
  assert.deepEqual(await page.evaluate(()=>qa.toolbar.colorSlots),saved);
  assert.equal(await page.evaluate(()=>qa.toolbar.activeColor),'#ef9c22');
 });

 await check('Highlighter settings and rainbow accessibility label follow four languages',async()=>{
  await page.evaluate(()=>qa.toolbar.setActiveTool('highlighter'));await page.waitForFunction(()=>qa.toolbar.activeTool==='highlighter');await tool().click();
  for(const locale of ['en','th','zh','ru']){
   const labels=await page.evaluate(locale=>{qa.lang.setAppLanguage(locale);return ['highlighterSettings','highlighterTipRound','highlighterTipSquare','chooseColorWheel'].map(k=>qa.lang.t(k));},locale);
   await page.waitForFunction(label=>document.querySelector('.bn-highlighter-settings')?.getAttribute('aria-label')===label,labels[0]);
   assert.deepEqual(await page.locator('.bn-highlighter-settings [aria-pressed]').allTextContents(),labels.slice(1,3));
   assert.equal(await page.locator('.bn-color-wheel input').first().getAttribute('aria-label'),labels[3]);
  }
  await page.evaluate(()=>qa.lang.setAppLanguage('en'));await page.getByRole('button',{name:'Done',exact:true}).click();
 });
};
