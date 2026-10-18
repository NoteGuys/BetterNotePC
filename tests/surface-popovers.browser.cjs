const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const {chromium}=require(process.env.BETTERNOTE_PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),base=process.env.BETTERNOTE_QA_TEMP;
if(!base||!path.isAbsolute(base))throw Error('Isolated QA directory required');
const entry=`import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{EditorToolbar}from'./src/components/Editor/EditorToolbar.jsx';import{ExportModal}from'./src/components/Common/ExportModal.jsx';
import{FolderCard}from'./src/components/Library/FolderCard.jsx';import{NotebookCard}from'./src/components/Library/NotebookCard.jsx';
import{setAppLanguage}from'./src/services/i18n.js';import{applyLanguageToDom}from'./src/services/languageCatalog.js';
window.qa={opens:0,closes:0,exports:0,renames:0,background:0};let renderer;
const noop=()=>{};const note={id:'qa-note',name:'Surface QA',pageCount:1,templateId:'blank'};
function App({mode,x=0,y=100}){const[open,setOpen]=useState(false),[tool,setTool]=useState('pen');qa.open=()=>setOpen(true);
return <><div id="background" style={{position:'fixed',inset:0}} onClick={()=>qa.background++}/>{mode==='toolbar'?<><EditorToolbar notebookTitle="Surface QA" activeTool={tool} setActiveTool={setTool} activeColor="#2563eb" setActiveColor={noop} activeWidth={4} setActiveWidth={noop} activeShape="rectangle" setActiveShape={noop} penNib="fountain" setPenNib={noop} isTapered setIsTapered={noop} setUsePressure={noop} pressureSensitivity="medium" setPressureSensitivity={noop} eraserMode="precision" setEraserMode={noop} setScribbleToErase={noop} penOnly setPenOnly={noop} scrollDirection="horizontal" setScrollDirection={noop} zoom={1} onOpenExport={()=>{qa.opens++;setOpen(true);}} onExportCurrentPagePdf={()=>qa.exports++} onBackToLibrary={noop} onDuplicateNotebook={noop} onUndo={noop} onRedo={noop} onZoomIn={noop} onZoomOut={noop} onResetZoom={noop} setShowThumbnails={noop} onRenameTitle={noop}/><ExportModal isOpen={open} onClose={()=>{qa.closes++;setOpen(false);}} notebook={note} pages={[{id:'p',pageIndex:0,strokes:[],imageElements:[],textElements:[]}]} currentPageIndex={0}/></>:<div id="scroller" style={{position:'absolute',inset:'60px 0 0',overflow:'hidden'}}><div id="card" style={{position:'absolute',left:x,top:y-60,width:140}}>{mode==='folder'?<FolderCard folder={{id:'qa-folder',name:'Folder',color:'#ef4444'}} onRename={()=>qa.renames++}/>:<NotebookCard notebook={note} onRename={()=>qa.renames++}/>}</div></div>}</>;}
qa.mount=options=>{renderer?.unmount();renderer=createRoot(document.getElementById('root'));qa.opens=qa.closes=qa.exports=qa.renames=qa.background=0;renderer.render(<App {...options}/>);};
qa.lang=code=>{setAppLanguage(code);applyLanguageToDom(code);};qa.lang('en');`;
(async()=>{
const dir=fs.mkdtempSync(path.join(base,'popovers-')),checks=[],errors=[];
const code=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'workers',setup:require('./helpers/recovery-worker.cjs').setupRecoveryWorker}],logLevel:'silent'});
const browser=await chromium.launch({headless:true,executablePath:process.env.BETTERNOTE_QA_BROWSER});
try{
 const context=await browser.newContext({viewport:{width:1024,height:900},hasTouch:true}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).pathname==='/'?r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}):r.abort());await page.goto('https://surface-ui.invalid/');
 await page.addStyleTag({content:fs.readFileSync(path.join(root,'src/index.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/localization.css'),'utf8')});await page.addScriptTag({content:code.outputFiles[0].text});
 await page.evaluate(()=>{qa.openObservers=0;const Actual=ResizeObserver;window.ResizeObserver=class extends Actual{constructor(fn){super(fn);qa.openObservers++;}disconnect(){if(!this.closed){qa.openObservers--;this.closed=true;}super.disconnect();}};});
 const cdp=await context.newCDPSession(page);
 const settle=()=>page.waitForTimeout(80);
 const mount=async options=>{await page.evaluate(o=>qa.mount(o),options);await settle();};
 const pen=async(locator,offset)=>{const r=await locator.boundingBox();assert.ok(r);const x=r.x+(offset?.x??r.width/2),y=r.y+(offset?.y??r.height/2);await locator.evaluate((el,{x,y})=>{qa.hit={expected:el.outerHTML.slice(0,180),pointerEvents:getComputedStyle(el).pointerEvents,hit:document.elementFromPoint(x,y)?.outerHTML.slice(0,180)};},{x,y});for(const type of ['mouseMoved','mousePressed','mouseReleased'])await cdp.send('Input.dispatchMouseEvent',{type,x,y,button:type==='mouseMoved'?'none':'left',buttons:type==='mousePressed'?1:0,clickCount:1,pointerType:'pen',force:type==='mousePressed'?.6:0});await settle();};
 const bounds=async locator=>locator.evaluate(el=>{const r=el.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,viewport:[innerWidth,innerHeight]};});
 const inside=async locator=>{const r=await bounds(locator);assert.ok(r.left>=7&&r.top>=7&&r.right<=r.viewport[0]-7&&r.bottom<=r.viewport[1]-7,JSON.stringify(r));};
 const check=async(name,fn)=>{try{await fn();}catch(error){console.log('FAILED '+name,await page.evaluate(()=>({opens:qa.opens,closes:qa.closes,hit:qa.hit,events:qa.events,menus:[...document.querySelectorAll('.bn-viewport-popover')].map(e=>({text:e.innerText,style:e.getAttribute('style')}))})));await page.screenshot({path:path.join(dir,'failure.png')});throw error;}checks.push(name);console.log('PASS '+name);};
 await page.evaluate(()=>{qa.events=[];for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,e=>{qa.events.push({type,pointer:e.pointerType,detail:e.detail,target:e.target.tagName+' '+e.target.getAttribute('class'),x:e.clientX,y:e.clientY});if(qa.events.length>30)qa.events.shift();},true);});
 await mount({mode:'toolbar'});
 if(process.env.BETTERNOTE_QA_POPOVER_PROBE==='1'){
  await pen(page.locator('.bn-btn-export-pdf'));const menu=page.locator('.bn-shape-dropdown');const result={menuVisible:await menu.count(),menu:await menu.count()?await bounds(menu):null};
  if(await menu.count()){await pen(menu.locator('button').last());result.afterOptions=await page.evaluate(()=>({opens:qa.opens,closes:qa.closes,modal:!!document.querySelector('.bn-export-dialog')}));}
  await page.evaluate(()=>qa.open());await settle();await pen(page.locator('.bn-export-dialog .bn-modal-close-btn svg'));result.afterX=await page.evaluate(()=>({closes:qa.closes,modal:!!document.querySelector('.bn-export-dialog')}));
  await mount({mode:'folder',x:0,y:100});await page.locator('.bn-gn-chevron-btn').click();result.folder=await bounds(page.locator('.bn-gn-context-menu'));
  fs.writeFileSync(path.join(base,'baseline.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));return;
 }
 await check('Trusted pen opens PDF options once; dialog stays open and SVG X closes once',async()=>{
  for(let i=0;i<8;i++){await pen(page.locator('.bn-btn-export-pdf'));await inside(page.locator('.bn-shape-dropdown'));await pen(page.locator('.bn-shape-dropdown button').last());assert.equal(await page.locator('.bn-export-dialog').count(),1);assert.equal(await page.evaluate(()=>qa.opens),i+1);await pen(page.locator('.bn-export-dialog .bn-modal-close-btn svg'));assert.equal(await page.locator('.bn-export-dialog').count(),0);assert.equal(await page.evaluate(()=>qa.closes),i+1);}
 });
 await check('Pen current-page command runs exactly once',async()=>{await pen(page.locator('.bn-btn-export-pdf'));await pen(page.locator('.bn-shape-dropdown button').first());assert.equal(await page.evaluate(()=>qa.exports),1);});
 await check('PDF Options X owns real pen capture; centre/edge taps close once and dragging outside cancels',async()=>{
  await mount({mode:'toolbar'});
  await page.evaluate(()=>{qa.closeCaptures=[];document.addEventListener('gotpointercapture',e=>{if(e.target.matches?.('[data-export-close]'))qa.closeCaptures.push(e.target.hasPointerCapture(e.pointerId));},true);});
  for(const edge of [false,true]){await page.evaluate(()=>qa.open());await settle();const close=page.locator('[data-export-close]'),r=await close.boundingBox(),x=r.x+(edge?3:r.width/2),y=r.y+(edge?3:r.height/2);
   for(const [type,dx]of [['mouseMoved',0],['mousePressed',0],['mouseMoved',1]])await cdp.send('Input.dispatchMouseEvent',{type,x:x+dx,y,button:type==='mouseMoved'?'none':'left',buttons:type==='mousePressed'||dx?1:0,clickCount:1,pointerType:'pen',force:type==='mousePressed'||dx?.6:0});
   assert.equal(await close.evaluate(el=>getComputedStyle(el.querySelector('svg')).pointerEvents),'none');assert.ok(await page.evaluate(()=>qa.closeCaptures.at(-1)===true));
   await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+1,y,button:'left',buttons:0,clickCount:1,pointerType:'pen',force:0});await settle();assert.equal(await close.count(),0);
  }
  assert.equal(await page.evaluate(()=>qa.closes),2);await page.evaluate(()=>qa.open());await settle();const close=page.locator('[data-export-close]'),r=await close.boundingBox(),x=r.x+r.width/2,y=r.y+r.height/2;
  for(const [type,px,buttons]of [['mousePressed',x,1],['mouseMoved',r.x-40,1],['mouseReleased',r.x-40,0]])await cdp.send('Input.dispatchMouseEvent',{type,x:px,y,button:type==='mouseMoved'?'none':'left',buttons,clickCount:1,pointerType:'pen',force:buttons?.6:0});
  await settle();assert.equal(await close.count(),1);assert.equal(await page.evaluate(()=>qa.closes),2);await close.click();
 });
 await check('Pen hover-leave before release and retargeted compatibility clicks do not lose or repeat actions',async()=>{
  await mount({mode:'toolbar'});await page.locator('.bn-btn-export-pdf').click();
  const tap=async locator=>locator.evaluate(el=>{const button=el.closest('button'),r=button.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;for(const type of ['pointerdown','pointerout','pointerup'])el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'pen',pointerId:93,button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:y,relatedTarget:type==='pointerout'?document.body:null}));return{x,y};});
  const p=await tap(page.locator('.bn-shape-dropdown button').last());assert.equal(await page.locator('.bn-export-dialog').count(),1);
  const prevented=await page.evaluate(({x,y})=>{const event=new MouseEvent('click',{bubbles:true,cancelable:true,detail:1,clientX:x,clientY:y});document.querySelector('.bn-modal-backdrop').dispatchEvent(event);return event.defaultPrevented;},p);assert.equal(prevented,true);assert.equal(await page.evaluate(()=>qa.closes),0);
  const q=await tap(page.locator('.bn-export-dialog .bn-modal-close-btn svg'));assert.equal(await page.locator('.bn-export-dialog').count(),0);
  await page.evaluate(({x,y})=>document.getElementById('background').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail:1,clientX:x,clientY:y})),q);assert.equal(await page.evaluate(()=>qa.background),0);
  await page.mouse.click(q.x,q.y);assert.equal(await page.evaluate(()=>qa.background),1);
 });
 await check('Mouse, touch, keyboard and border taps keep working',async()=>{
  for(const kind of ['mouse','touch','keyboard','border']){const trigger=page.locator('.bn-btn-export-pdf');if(kind==='mouse')await trigger.click();else if(kind==='touch')await trigger.tap();else if(kind==='keyboard'){await trigger.focus();await page.keyboard.press('Enter');}else await pen(trigger,{x:3,y:3});
   const option=page.locator('.bn-shape-dropdown button').last();if(kind==='touch')await option.tap();else if(kind==='keyboard'){await option.focus();await page.keyboard.press('Enter');}else await option.click();assert.equal(await page.locator('.bn-export-dialog').count(),1);await page.locator('.bn-export-dialog .bn-modal-close-btn').click();
  }
 });
 await check('Cancelled/drifting pen taps do not activate or consume the next mouse gesture',async()=>{
  const trigger=page.locator('.bn-btn-export-pdf');for(const action of ['pointercancel','drift'])await trigger.evaluate((el,action)=>{const r=el.getBoundingClientRect(),fire=(type,x=r.left+5)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'pen',pointerId:73,button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:r.top+5}));fire('pointerdown');fire(action==='drift'?'pointermove':'pointercancel',r.left+50);fire('pointerup');},action);
  assert.equal(await page.locator('.bn-shape-dropdown').count(),0);await trigger.click();assert.equal(await page.locator('.bn-shape-dropdown').count(),1);await page.keyboard.press('Escape');assert.equal(await page.locator('.bn-shape-dropdown').count(),0);
 });
 for(const mode of ['folder','notebook'])for(const lang of ['en','th','de','ar'])await check(mode+' '+lang+' menus stay clickable at all four edges and flip above',async()=>{
  await page.evaluate(code=>qa.lang(code),lang);for(const [x,y]of [[0,70],[884,70],[0,630],[884,630]]){await mount({mode,x,y});await pen(page.locator('.bn-gn-chevron-btn'));const menu=page.locator('.bn-gn-context-menu');await inside(menu);
   const r=await menu.boundingBox();assert.ok(await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('.bn-gn-context-menu'),{x:r.x+10,y:r.y+10}));
   await pen(menu.locator('.bn-gn-action-item').first());assert.equal(await page.evaluate(()=>qa.renames),1);assert.equal(await menu.count(),0);
  }
 });
 await page.evaluate(()=>qa.lang('en'));
 await check('All toolbar popovers stay inside short/narrow viewports; slider is usable',async()=>{
  for(const width of [800,1024,1368]){await page.setViewportSize({width,height:600});await mount({mode:'toolbar'});for(const title of ['Pen:','Highlighter','Eraser:','Shapes']){
    const tools=page.locator('.bn-tool-btn');const index={'Pen:':0,Highlighter:1,'Eraser:':2,Shapes:3}[title];await pen(tools.nth(index));if(index!==0)await pen(tools.nth(index));const menu=page.locator('.bn-viewport-popover');await inside(menu);await page.keyboard.press('Escape');}
   await pen(page.locator('button[title="Adjust Stroke Thickness"]'));await inside(page.locator('.bn-width-slider-dropdown'));await page.keyboard.press('Escape');
  }
 });
 await check('Position updates on scroll/resize and outside pointer dismisses only once',async()=>{
  await page.setViewportSize({width:1024,height:900});await mount({mode:'folder',x:850,y:200});await pen(page.locator('.bn-gn-chevron-btn'));await page.setViewportSize({width:900,height:650});await settle();await inside(page.locator('.bn-gn-context-menu'));
  const before=(await page.locator('.bn-gn-chevron-btn').boundingBox()).x;await page.evaluate(()=>{document.getElementById('scroller').scrollLeft=80;});await settle();assert.ok((await page.locator('.bn-gn-chevron-btn').boundingBox()).x<before-50);await inside(page.locator('.bn-gn-context-menu'));await page.mouse.click(400,400);assert.equal(await page.locator('.bn-gn-context-menu').count(),0);
 });
 await check('150% and 200% device scaling preserve menu bounds and pen targets',async()=>{
  for(const deviceScaleFactor of [1.5,2]){await cdp.send('Emulation.setDeviceMetricsOverride',{width:1024,height:680,deviceScaleFactor,mobile:false});await mount({mode:'toolbar'});await pen(page.locator('.bn-btn-export-pdf'));await inside(page.locator('.bn-shape-dropdown'));await pen(page.locator('.bn-shape-dropdown button').last());assert.equal(await page.locator('.bn-export-dialog').count(),1);await pen(page.locator('.bn-export-dialog .bn-modal-close-btn'));assert.equal(await page.locator('.bn-export-dialog').count(),0);}
  await cdp.send('Emulation.clearDeviceMetricsOverride');
 });
 await check('Open-menu observers are released after repeated close/unmount; light theme and screenshots',async()=>{
  for(let i=0;i<12;i++){await mount({mode:'toolbar'});await page.locator('.bn-btn-export-pdf').click();assert.equal(await page.evaluate(()=>qa.openObservers),1);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>qa.openObservers),0);}
  await page.evaluate(()=>document.documentElement.setAttribute('data-theme','light'));await page.locator('.bn-btn-export-pdf').click();await inside(page.locator('.bn-shape-dropdown'));await page.screenshot({path:path.join(dir,'pdf-menu-light.png')});await page.keyboard.press('Escape');await page.locator('.bn-btn-export-pdf').click();await mount({mode:'folder',x:0,y:630});assert.equal(await page.evaluate(()=>qa.openObservers),0);await page.locator('.bn-gn-chevron-btn').click();await inside(page.locator('.bn-gn-context-menu'));await page.screenshot({path:path.join(dir,'folder-bottom-left.png')});
 });
 assert.deepEqual(errors,[]);const result={passed:checks.length,checks,errors,dir};fs.writeFileSync(path.join(base,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
