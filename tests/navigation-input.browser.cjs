// Phase 4.4: real editor/whiteboard navigation, isolated synthetic data, offline.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const {pathToFileURL}=require('node:url');
const {chromium,_electron}=require(process.env.BETTERNOTE_PLAYWRIGHT_PATH||'playwright');
const root=fs.realpathSync(path.resolve(__dirname,'..')),qaRoot=process.env.BETTERNOTE_QA_TEMP;
if(!qaRoot||!path.isAbsolute(qaRoot))throw Error('An isolated QA directory is required');
const native=process.env.BETTERNOTE_QA_NAV_ELECTRON==='1';
const entry=String.raw`
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {NoteEditor} from './src/components/Editor/NoteEditor.jsx';
import * as db from './src/services/db.js';import {flushLocalSaves} from './src/services/localSaveService.js';
import {setAppLanguage} from './src/services/i18n.js';setAppLanguage('en');
window.qa={db,flushLocalSaves,boards:new Map(),frames:new Map(),frameId:0,holdFrames:false,boardRenders:0,zoomCalls:0,changes:[],alerts:[]};
window.alert=s=>qa.alerts.push(s);window.confirm=()=>true;
const raf=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
window.requestAnimationFrame=fn=>{if(!qa.holdFrames)return raf(fn);const id=--qa.frameId;qa.frames.set(id,fn);return id;};
window.cancelAnimationFrame=id=>{if(id<0)qa.frames.delete(id);else cancel(id);};
qa.flushFrame=()=>{const list=[...qa.frames.values()];qa.frames.clear();for(const fn of list)fn(performance.now());};
let renderer;qa.unmount=()=>{if(renderer){flushSync(()=>renderer.unmount());renderer=null;}qa.frames.clear();qa.holdFrames=false;qa.toolbar=null;qa.boards.clear();};
qa.mount=async({whiteboard=false,vertical=false,zoom=1}={})=>{
 qa.unmount();window.__bn_pen_active=false;window.__bn_drag_active=false;window.__bn_pen_last_time=0;
 localStorage.setItem('betternote_user_preferences',JSON.stringify({activeTool:'pen',scribbleToErase:false,zoom,scrollDirection:vertical?'vertical':'horizontal'}));
 const id='navigation-'+crypto.randomUUID(),nb=await db.saveNotebook({id,name:'Synthetic navigation',pageCount:5,templateId:'blank'});
 for(let i=0;i<5;i++)await db.savePage({id:id+'-p'+i,notebookId:id,pageIndex:i,templateId:whiteboard?'whiteboard':'blank',sizeId:whiteboard?'whiteboard':undefined,pageWidth:800,pageHeight:1100,strokes:[],imageElements:[],textElements:[]});
 qa.id=id;qa.changes=[];renderer=createRoot(document.getElementById('root'));
 renderer.render(React.createElement(NoteEditor,{notebook:nb,onBackToLibrary(){},onNotebookUpdated(){},onPageChanged:index=>qa.changes.push(index)}));
};
qa.target=(where='canvas')=>document.querySelector(where==='stage'?'.bn-editor-canvas-stage':where==='whiteboard'?'.bn-whiteboard-viewport':'.bn-layer-active');
qa.touch=(type,points,changed=points,where='canvas')=>{
 const target=qa.target(where),make=p=>new Touch({identifier:p[0],target,clientX:p[1],clientY:p[2],radiusX:3,radiusY:3,force:.5});
 target.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:points.map(make),targetTouches:points.map(make),changedTouches:changed.map(make)}));
};
qa.pen=(type,x=100,y=100)=>{
 const c=qa.target(),r=c.getBoundingClientRect(),board=[...qa.boards.values()].at(-1);
 c.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'pen',pointerId:81,button:0,buttons:type==='pointerup'?0:1,pressure:type==='pointerup'?0:.6,
 clientX:r.left+x*r.width/board.page.pageWidth,clientY:r.top+y*r.height/board.page.pageHeight}));
};
qa.ink=()=>{qa.pen('pointerdown',60,80);qa.pen('pointermove',160,180);qa.pen('pointerup',160,180);};
qa.wheel=(deltaY,{ctrlKey=false,deltaX=0,deltaMode=0,where='canvas',x=600,y=450}={})=>{
 const e=new WheelEvent('wheel',{bubbles:true,cancelable:true,clientX:x,clientY:y,deltaX,deltaY,ctrlKey,deltaMode});qa.target(where).dispatchEvent(e);return e.defaultPrevented;
};
qa.state=()=>{
 const stage=qa.target('stage'),content=document.querySelector('.bn-vertical-pages-stack,.bn-horizontal-page-container'),wb=qa.target('whiteboard');
 return {zoom:qa.toolbar.zoom,index:qa.changes.at(-1),left:stage.scrollLeft,top:stage.scrollTop,transform:content?.style.transform||'',frames:qa.frames.size,
 origin:wb?[Number(wb.dataset.originX),Number(wb.dataset.originY)]:null};
};
qa.strokeCount=async()=>{await flushLocalSaves();return(await db.getPage(qa.id+'-p0')).strokes.length;};
`;
const captured=new Map(['EditorToolbar','CanvasBoard','WhiteboardBoard'].map(name=>[path.join(root,'src/components/Editor',name+'.jsx'),name]));
const plugins=[{name:'actual-navigation-components',setup(build){
 require('./helpers/recovery-worker.cjs').setupRecoveryWorker(build);
 build.onResolve({filter:/^qa-original:/},args=>({path:args.path.slice(12),namespace:'qa-original'}));
 build.onLoad({filter:/.*/,namespace:'qa-original'},args=>({contents:fs.readFileSync(process.env.BETTERNOTE_QA_NAV_BASELINE&&fs.existsSync(path.join(process.env.BETTERNOTE_QA_NAV_BASELINE,path.basename(args.path)))?path.join(process.env.BETTERNOTE_QA_NAV_BASELINE,path.basename(args.path)):args.path,'utf8'),loader:'jsx',resolveDir:path.dirname(args.path)}));
 build.onResolve({filter:/notebookCover\.worker\.js\?worker&inline$/},()=>({path:'cover',namespace:'qa-cover'}));
 build.onLoad({filter:/.*/,namespace:'qa-cover'},async()=>{
  const bundle=await esbuild.build({entryPoints:[path.join(root,'src/utils/notebookCover.worker.js')],bundle:true,write:false,format:'iife',platform:'browser',logLevel:'silent'});
  return{contents:'const source='+JSON.stringify(bundle.outputFiles[0].text)+';export default function(){const url=URL.createObjectURL(new Blob([source],{type:"text/javascript"}));try{return new Worker(url);}finally{URL.revokeObjectURL(url);}}',loader:'js'};
 });
 build.onLoad({filter:/\.jsx$/},args=>{
  const name=captured.get(args.path);if(!name){if(process.env.BETTERNOTE_QA_NAV_BASELINE&&path.basename(args.path)==='NoteEditor.jsx')return{contents:fs.readFileSync(path.join(process.env.BETTERNOTE_QA_NAV_BASELINE,'NoteEditor.jsx'),'utf8'),loader:'jsx',resolveDir:path.dirname(args.path)};return;}
  const actualProps=name==='WhiteboardBoard'?'{...props,onZoomChange:value=>{qa.zoomCalls++;props.onZoomChange?.(value);}}':'props';
  const capture=name==='EditorToolbar'?'qa.toolbar=props;':"qa.boards.set(props.page.id,props);qa.boardRenders++;";
  return{contents:"import React from 'react';import {"+name+" as Actual} from "+JSON.stringify('qa-original:'+args.path)+";export const "+name+"=props=>{"+capture+"return React.createElement(Actual,"+actualProps+");};",loader:'jsx',resolveDir:path.dirname(args.path)};
 });
}}];
(async()=>{const fixture=fs.mkdtempSync(path.join(qaRoot,'betternote-navigation-')),passed=[],errors=[],metrics={};let context,application;
 try{
 const bundle=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},plugins,logLevel:'silent'});
 const html=path.join(fixture,'navigation.html');fs.writeFileSync(html,'<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="'+pathToFileURL(path.join(root,'src/index.css')).href+'"><div id="root" style="height:100vh"></div>');
 let page;
 if(native){
  const main=path.join(fixture,'main.cjs');fs.writeFileSync(main,"const{app,BrowserWindow}=require('electron'),path=require('node:path'),dir=process.argv.at(-1);app.setPath('userData',path.join(dir,'profile'));app.setPath('sessionData',path.join(dir,'session'));app.whenReady().then(()=>{const w=new BrowserWindow({show:false,width:1360,height:1000,webPreferences:{nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});w.loadFile(path.join(dir,'navigation.html'));});app.on('window-all-closed',()=>app.quit());");
  const env={...process.env,TEMP:qaRoot,TMP:qaRoot};delete env.ELECTRON_RUN_AS_NODE;
  application=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[main,fixture],env});
  context=application.context();page=await application.firstWindow();await page.waitForLoadState();
 }else{
  context=await chromium.launchPersistentContext(path.join(fixture,'profile'),{headless:true,executablePath:process.env.BETTERNOTE_QA_BROWSER,viewport:{width:1360,height:1000},env:{...process.env,TEMP:qaRoot,TMP:qaRoot}});
  page=context.pages()[0];await page.goto(pathToFileURL(html).href);
 }
 page.on('pageerror',e=>errors.push(e.message));await context.route(/^https?:\/\//,r=>r.abort());
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 const mount=async options=>{await page.evaluate(o=>qa.mount(o),options);await page.waitForFunction(()=>qa.toolbar&&qa.boards.size);await page.waitForTimeout(100);};
 const check=async(name,fn)=>{if(process.env.BETTERNOTE_QA_NAV_FILTER&&!name.includes(process.env.BETTERNOTE_QA_NAV_FILTER))return;await fn();passed.push(name);console.log('PASS '+name);};
 const state=()=>page.evaluate(()=>qa.state());
 const settle=()=>page.waitForTimeout(80);
 if(process.env.BETTERNOTE_QA_NAV_BENCH==='1'){
  await mount({whiteboard:true});
  metrics.whiteboard=await page.evaluate(()=>{qa.holdFrames=true;qa.touch('touchstart',[[1,500,450],[2,700,450]],undefined,'whiteboard');qa.zoomCalls=0;const start=performance.now();
   for(let i=1;i<=30;i++)qa.touch('touchmove',[[1,500-i,450],[2,700+i,450]],undefined,'whiteboard');
   const before=qa.zoomCalls,dispatchMs=performance.now()-start;qa.flushFrame();return{events:30,zoomCallbacksBeforeFrame:before,zoomCallbacksAfterFrame:qa.zoomCalls,dispatchMs};});
  await mount({vertical:true});
  metrics.notebook=await page.evaluate(()=>{const original=Object.getOwnPropertyDescriptor(Element.prototype,'scrollTop');let writes=0;
   Object.defineProperty(Element.prototype,'scrollTop',{...original,set(value){if(this.classList?.contains('bn-editor-canvas-stage'))writes++;original.set.call(this,value);}});
   try{qa.holdFrames=true;qa.touch('touchstart',[[1,600,700]]);const start=performance.now();
    for(let i=1;i<=30;i++)qa.touch('touchmove',[[1,600,700-i*6]]);
    const before=writes,dispatchMs=performance.now()-start;qa.flushFrame();return{events:30,scrollWritesBeforeFrame:before,scrollWritesAfterFrame:writes,dispatchMs};
   }finally{Object.defineProperty(Element.prototype,'scrollTop',original);}
  });
  await page.evaluate(()=>qa.unmount());assert.deepEqual(errors,[]);
  const report={baseline:!!process.env.BETTERNOTE_QA_NAV_BASELINE,metrics,errors,fixture,syntheticOnly:true,controlledFrame:true};
  fs.writeFileSync(path.join(fixture,'benchmark.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));return;
 }
 for(const where of ['canvas','stage'])await check('One finger pans once through '+where+' and touchcancel stops queued motion',async()=>{
  await mount({vertical:true});const before=await state();
  await page.evaluate(where=>{qa.holdFrames=true;qa.touch('touchstart',[[1,600,650]],undefined,where);for(let i=0;i<20;i++)qa.touch('touchmove',[[1,600,650-i*8]],undefined,where);},where);
  assert.equal((await state()).frames,1);await page.evaluate(()=>qa.flushFrame());assert.ok((await state()).top>before.top+100);
  await page.evaluate(where=>{qa.touch('touchmove',[[1,600,400]],undefined,where);qa.touch('touchcancel',[],[[1,600,400]],where);qa.flushFrame();},where);
  const stopped=await state();assert.equal(stopped.frames,0);await settle();assert.equal((await state()).top,stopped.top);
  assert.equal(await page.evaluate(()=>qa.strokeCount()),0);
 });
 await check('A held palm cannot pan after pen release; a fresh touch pans immediately',async()=>{
  await mount({vertical:true});await page.evaluate(()=>{qa.pen('pointerdown');qa.touch('touchstart',[[1,600,650]]);qa.pen('pointermove',160,180);qa.pen('pointerup',160,180);qa.touch('touchmove',[[1,600,400]]);});
  assert.equal((await state()).top,0);assert.equal(await page.evaluate(()=>qa.strokeCount()),1);
  await page.evaluate(()=>{qa.touch('touchend',[],[[1,600,400]]);qa.holdFrames=true;qa.touch('touchstart',[[2,600,650]]);qa.touch('touchmove',[[2,600,500]]);qa.flushFrame();});
  assert.ok((await state()).top>=140);
  await page.evaluate(()=>qa.touch('touchcancel',[],[[2,600,500]]));
 });
 await check('Pen landing interrupts touch momentum and saves ink without later page movement',async()=>{
  await mount({vertical:true});await page.evaluate(()=>{qa.holdFrames=true;qa.touch('touchstart',[[1,600,700]]);qa.touch('touchmove',[[1,600,500]]);qa.touch('touchend',[],[[1,600,500]]);});
  assert.ok((await state()).frames>0);await page.evaluate(()=>{qa.pen('pointerdown');qa.flushFrame();});const fixed=(await state()).top;
  await page.evaluate(()=>{qa.pen('pointermove',160,180);qa.pen('pointerup',160,180);qa.flushFrame();});assert.equal((await state()).top,fixed);assert.equal(await page.evaluate(()=>qa.strokeCount()),1);
 });
 for(const vertical of [false,true])await check('Notebook '+(vertical?'vertical':'horizontal')+' zoom keeps the actual page point under the fingers after layout',async()=>{
  await mount({vertical,zoom:2});
  const anchor=await page.evaluate(()=>{
   const stage=qa.target('stage');stage.scrollLeft=130;stage.scrollTop=500;
   const c=document.querySelector('.bn-canvas-container'),r=c.getBoundingClientRect();
   qa.anchorElement=c;return{x:(600-r.left)/2,y:(450-r.top)/2};
  });
  await page.evaluate(()=>{qa.touch('touchstart',[[1,500,450],[2,700,450]]);qa.touch('touchmove',[[1,470,450],[2,730,450]]);});await settle();
  await page.evaluate(()=>qa.touch('touchend',[],[[1,470,450],[2,730,450]]));await settle();
  const actual=await page.evaluate(anchor=>{const r=qa.anchorElement.getBoundingClientRect();return{x:r.left+anchor.x*qa.toolbar.zoom,y:r.top+anchor.y*qa.toolbar.zoom};},anchor);
  assert.ok(Math.abs(actual.x-600)<1.5&&Math.abs(actual.y-450)<1.5,JSON.stringify(actual));
 });
 for(const whiteboard of [false,true]){
  const label=whiteboard?'Whiteboard':'Notebook',where=whiteboard?'whiteboard':'canvas';
  await check(label+' pinch burst updates once per frame and keeps content stationary under the midpoint',async()=>{
   await mount({whiteboard,zoom:1});const start=await state();
   const result=await page.evaluate(where=>{qa.holdFrames=true;qa.touch('touchstart',[[1,500,450],[2,700,450]],undefined,where);qa.boardRenders=0;
    for(let i=1;i<=30;i++)qa.touch('touchmove',[[1,500-i,450],[2,700+i,450]],undefined,where);
    const before={frames:qa.frames.size,renders:qa.boardRenders};qa.flushFrame();return before;},where);
   assert.equal(result.frames,1);assert.equal(result.renders,0);
   await settle();if(whiteboard)assert.ok((await state()).zoom>1.2);else assert.ok((await state()).transform.includes('scale(1.3)'));
   await page.evaluate(where=>{qa.touch('touchend',[[2,730,450]],[[1,470,450]],where);qa.flushFrame();},where);await settle();const end=await state();assert.ok(Math.abs(end.zoom-1.3)<.015);
   if(whiteboard){assert.ok(Math.abs(end.origin[0]+600/end.zoom-(start.origin[0]+600))<2);}
   await page.evaluate(where=>qa.touch('touchend',[],[[2,730,450]],where),where);assert.equal(await page.evaluate(()=>qa.strokeCount()),0);
   metrics[label+'Pinch']={pendingFrames:result.frames,rendersDuringBurst:result.renders,zoom:end.zoom};
  });
  await check(label+' cancelled two-finger contact never Undo; intentional double tap does',async()=>{
   await mount({whiteboard});await page.evaluate(()=>qa.ink());await settle();assert.equal(await page.evaluate(()=>qa.strokeCount()),1);
   await page.evaluate(where=>{qa.touch('touchstart',[[1,500,450],[2,700,450]],undefined,where);qa.touch('touchend',[],[[1,500,450],[2,700,450]],where);},where);await page.waitForTimeout(70);
   await page.evaluate(where=>{qa.touch('touchstart',[[3,500,450],[4,700,450]],undefined,where);qa.touch('touchcancel',[],[[3,500,450],[4,700,450]],where);},where);
   await settle();assert.equal(await page.evaluate(()=>qa.strokeCount()),1);
   for(let i=0;i<2;i++){await page.evaluate(([where,id])=>{qa.touch('touchstart',[[id,500,450],[id+1,700,450]],undefined,where);qa.touch('touchend',[],[[id,500,450],[id+1,700,450]],where);},[where,10+i*2]);await page.waitForTimeout(70);}
   await settle();assert.equal(await page.evaluate(()=>qa.strokeCount()),0);
  });
  await check(label+' even a small recognized pinch cancels a preceding Undo tap',async()=>{
   await mount({whiteboard});await page.evaluate(()=>qa.ink());await settle();
   await page.evaluate(where=>{qa.touch('touchstart',[[1,500,450],[2,700,450]],undefined,where);qa.touch('touchend',[],[[1,500,450],[2,700,450]],where);},where);
   await page.waitForTimeout(70);
   // Each finger moves only 5 px, but their distance changes by 10 px: a real pinch.
   await page.evaluate(where=>{qa.touch('touchstart',[[3,500,450],[4,700,450]],undefined,where);qa.touch('touchmove',[[3,495,450],[4,705,450]],undefined,where);qa.touch('touchend',[],[[3,495,450],[4,705,450]],where);},where);
   await settle();assert.equal(await page.evaluate(()=>qa.strokeCount()),1);
  });
  await check(label+' pinch and finger-count changes never turn into Undo or a new one-finger drag',async()=>{
   await mount({whiteboard});await page.evaluate(()=>qa.ink());await settle();
   await page.evaluate(where=>{qa.touch('touchstart',[[1,500,450],[2,700,450]],undefined,where);qa.touch('touchmove',[[1,470,450],[2,730,450]],undefined,where);},where);await settle();
   await page.evaluate(where=>qa.touch('touchend',[[2,730,450]],[[1,470,450]],where),where);await settle();const before=await state();
   await page.evaluate(where=>{qa.touch('touchmove',[[2,730,300]],undefined,where);qa.touch('touchend',[],[[2,730,300]],where);},where);await settle();const after=await state();
   assert.equal(after.top,before.top);assert.deepEqual(after.origin,before.origin);assert.equal(await page.evaluate(()=>qa.strokeCount()),1);
  });
  await check(label+' blur cancels pending navigation and the next gesture works',async()=>{
   await mount({whiteboard});await page.evaluate(where=>{qa.holdFrames=true;qa.touch('touchstart',[[1,500,450],[2,700,450]],undefined,where);qa.touch('touchmove',[[1,450,450],[2,750,450]],undefined,where);window.dispatchEvent(new Event('blur'));qa.flushFrame();},where);
   assert.equal((await state()).frames,0);assert.equal((await state()).transform,'');
   await page.evaluate(where=>{qa.touch('touchend',[],[[1,450,450],[2,750,450]],where);qa.holdFrames=false;qa.touch('touchstart',[[3,500,450],[4,700,450]],undefined,where);qa.touch('touchmove',[[3,470,450],[4,730,450]],undefined,where);},where);await settle();
   if(whiteboard)await page.waitForFunction(()=>qa.toolbar.zoom>1.2,undefined,{timeout:3000});
   await page.evaluate(where=>qa.touch('touchend',[],[[3,470,450],[4,730,450]],where),where);await settle();assert.ok((await state()).zoom>1.2,JSON.stringify({...await state(),hidden:await page.evaluate(()=>document.hidden)}));
  });
 }
 await check('Touchpad inertial wheel tail flips one page; a new gesture can flip again',async()=>{
  await mount({zoom:.35});await page.evaluate(()=>{for(const delta of [10,15,20,80,60,30,10])qa.wheel(delta);});await settle();assert.equal((await state()).index,1);
  await page.waitForTimeout(260);await page.evaluate(()=>qa.wheel(60));await settle();assert.equal((await state()).index,2);
 });
 await check('Zoomed-page wheel pans content instead of unexpectedly changing pages',async()=>{
  await mount({zoom:2});await page.evaluate(()=>qa.wheel(180));await settle();assert.equal((await state()).index,0);assert.ok((await state()).top>0);
 });
 await check('Ctrl-wheel is blocked while writing and works immediately after release',async()=>{
  await mount();await page.evaluate(()=>{qa.pen('pointerdown');qa.wheel(-100,{ctrlKey:true});});await settle();assert.equal((await state()).zoom,1);
  await page.evaluate(()=>{qa.pen('pointerup');qa.wheel(-100,{ctrlKey:true});});await page.waitForFunction(()=>qa.toolbar.zoom>1.1,undefined,{timeout:3000});assert.ok((await state()).zoom>1.1);
 });
 for(const whiteboard of [false,true])await check((whiteboard?'Whiteboard':'Notebook')+' wheel zoom burst queues one frame and does not rerender for every event',async()=>{
  await mount({whiteboard});
  const result=await page.evaluate(whiteboard=>{qa.holdFrames=true;qa.boardRenders=0;for(let i=0;i<30;i++)qa.wheel(-2,{ctrlKey:true,where:whiteboard?'whiteboard':'canvas'});
   const result={frames:qa.frames.size,renders:qa.boardRenders};qa.flushFrame();return result;},whiteboard);
  assert.deepEqual(result,{frames:1,renders:0});await settle();assert.ok((await state()).zoom>1.1);
 });
 await check('Third finger and cancelled pinch cannot become Undo',async()=>{
  await mount();await page.evaluate(()=>qa.ink());await settle();
  await page.evaluate(()=>{qa.touch('touchstart',[[1,500,450],[2,700,450]]);qa.touch('touchstart',[[1,500,450],[2,700,450],[3,600,500]]);qa.touch('touchend',[],[[1,500,450],[2,700,450],[3,600,500]]);});
  await settle();assert.equal(await page.evaluate(()=>qa.strokeCount()),1);assert.equal((await state()).transform,'');
 });
 await check('A queued Whiteboard wheel cannot move the view during object dragging',async()=>{
  await mount({whiteboard:true});const before=await state();
  await page.evaluate(()=>{qa.holdFrames=true;qa.wheel(200,{where:'whiteboard'});window.__bn_drag_active=true;qa.flushFrame();window.__bn_drag_active=false;});
  assert.deepEqual((await state()).origin,before.origin);assert.equal((await state()).frames,0);
 });
 await check('Explicit page selection cancels an unfinished touch gesture',async()=>{
  await mount();await page.evaluate(()=>{qa.holdFrames=true;qa.touch('touchstart',[[1,500,450],[2,700,450]]);qa.touch('touchmove',[[1,450,450],[2,750,450]]);});
  await page.locator('.bn-page-nav-btn').last().click();await page.evaluate(()=>qa.flushFrame());await settle();
  assert.equal((await state()).index,1);assert.equal((await state()).transform,'');assert.equal((await state()).frames,0);assert.equal(await page.evaluate(()=>qa.strokeCount()),0);
 });
 for(const whiteboard of [false,true])await check((whiteboard?'Whiteboard':'Notebook')+' outside touch release cannot leave wheel navigation locked',async()=>{
  await mount({whiteboard,zoom:.35});const where=whiteboard?'whiteboard':'canvas';
  await page.evaluate(where=>{
   qa.touch('touchstart',[[1,500,450],[2,700,450]],undefined,where);qa.touch('touchend',[[2,700,450]],[[1,500,450]],where);
   const target=document.body,ended=new Touch({identifier:2,target,clientX:700,clientY:450});
   target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],targetTouches:[],changedTouches:[ended]}));
   qa.holdFrames=true;qa.wheel(120,{where});qa.flushFrame();
  },where);await settle();
  if(whiteboard)assert.ok((await state()).origin[1]>0);else assert.equal((await state()).index,1);
 });
 for(const whiteboard of [false,true])await check((whiteboard?'Whiteboard':'Notebook')+' blur without a touchend does not leave wheel navigation locked',async()=>{
  await mount({whiteboard,zoom:.35});const where=whiteboard?'whiteboard':'canvas';
  await page.evaluate(where=>{qa.touch('touchstart',[[1,500,450],[2,700,450]],undefined,where);window.dispatchEvent(new Event('blur'));
   qa.holdFrames=true;qa.wheel(120,{where});qa.flushFrame();},where);await settle();
  if(whiteboard)assert.ok((await state()).origin[1]>0);else assert.equal((await state()).index,1);
 });
 await check('Changing page or unmounting cancels queued gesture work without changing note content',async()=>{
  await mount({vertical:true});await page.evaluate(()=>{qa.holdFrames=true;qa.touch('touchstart',[[1,600,650]]);qa.touch('touchmove',[[1,600,400]]);qa.unmount();qa.flushFrame();});
  assert.equal(await page.evaluate(()=>qa.frames.size),0);assert.equal(await page.evaluate(()=>qa.strokeCount()),0);
 });

 for(const penOnly of [true,false])for(const tool of ['pen','highlighter'])await check('Whiteboard one-finger pan with '+tool+' and shield '+penOnly+' retains its contact canvas',async()=>{
  await mount({whiteboard:true});await page.evaluate(({tool,penOnly})=>{qa.toolbar.setActiveTool(tool);qa.toolbar.setPenOnly(penOnly);},{tool,penOnly});await settle();
  await page.evaluate(()=>{qa.contactCanvas=qa.target();qa.touch('touchstart',[[1,600,600]],undefined,'canvas');});await settle();
  assert.equal(await page.evaluate(()=>qa.contactCanvas===qa.target()),true);
  const before=await state();await page.evaluate(()=>{qa.holdFrames=true;qa.touch('touchmove',[[1,500,450]],undefined,'canvas');qa.flushFrame();});await settle();
  const after=await state();assert.ok(after.origin[0]>before.origin[0]+90);assert.ok(after.origin[1]>before.origin[1]+140);assert.equal(await page.evaluate(()=>qa.strokeCount()),0);
  await page.evaluate(()=>qa.touch('touchend',[],[[1,500,450]],'canvas'));
  const corner=await page.evaluate(()=>{const viewport=qa.target('whiteboard').getBoundingClientRect(),controls=document.querySelector('.bn-whiteboard-controls').getBoundingClientRect();return{left:controls.left-viewport.left,bottom:viewport.bottom-controls.bottom};});assert.ok(Math.abs(corner.left)<1&&Math.abs(corner.bottom)<1,JSON.stringify(corner));
 });
 for(const whiteboard of [false,true])await check((whiteboard?'Whiteboard':'Notebook')+' missed pen-up recovers on hover and the next fresh finger scrolls',async()=>{
  await mount({whiteboard,vertical:!whiteboard});await page.evaluate(()=>{qa.pen('pointerdown',80,100);qa.pen('pointermove',130,150);document.body.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'pen',pointerId:81,buttons:0,pressure:0}));});await settle();
  assert.equal(await page.evaluate(()=>!!window.__bn_pen_active),false);
  await page.evaluate(where=>{qa.holdFrames=true;qa.touch('touchstart',[[1,600,650]],undefined,where);qa.touch('touchmove',[[1,600,500]],undefined,where);qa.flushFrame();},whiteboard?'whiteboard':'canvas');await settle();const st=await state();if(whiteboard)assert.ok(st.origin[1]>=140);else assert.ok(st.top>=140);assert.equal(await page.evaluate(()=>qa.strokeCount()),1);
 });
 await check('Pen taps activate a toolbar button once, cancelled/drifting taps do not activate, keyboard remains native',async()=>{
  await mount();const btn=page.locator('.bn-tool-btn').nth(2);const box=await btn.boundingBox();
  await btn.evaluate((el,b)=>{const fire=(type,x,buttons=1)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'pen',pointerId:97,button:0,buttons,clientX:x,clientY:b.y+b.height/2}));fire('pointerdown',b.x+b.width/2);fire('pointerup',b.x+b.width/2,0);},box);await settle();assert.equal(await page.evaluate(()=>qa.toolbar.activeTool),'eraser');
  await page.evaluate(()=>qa.toolbar.setActiveTool('pen'));await settle();
  for(const action of ['pointercancel','drift'])await btn.evaluate((el,{b,action})=>{const fire=(type,x)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'pen',pointerId:98,button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:b.y+b.height/2}));fire('pointerdown',b.x+b.width/2);if(action==='drift')fire('pointermove',b.x-30);else fire('pointercancel',b.x+b.width/2);fire('pointerup',b.x+b.width/2);},{b:box,action});
  await settle();assert.equal(await page.evaluate(()=>qa.toolbar.activeTool),'pen');await btn.focus();await page.keyboard.press('Enter');await settle();assert.equal(await page.evaluate(()=>qa.toolbar.activeTool),'eraser');
 });
 await check('A pen tap closes the actual Export dialog X without a compatibility mouse click',async()=>{
  await mount();await page.evaluate(()=>qa.toolbar.onOpenExport());await settle();const x=page.locator('.bn-export-dialog .bn-modal-close-btn');const box=await x.boundingBox();assert.ok(box.width>=44&&box.height>=44);
  await x.evaluate((el,b)=>{for(const type of ['pointerdown','pointerup'])el.querySelector('svg').dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'pen',pointerId:99,button:0,buttons:type==='pointerup'?0:1,clientX:b.x+b.width/2,clientY:b.y+b.height/2}));},box);await settle();assert.equal(await page.locator('.bn-export-dialog').count(),0);
 });

 await check('Vertical Whiteboard fills the actual workspace and receives fresh gestures far from right-hand writing',async()=>{
  await mount({whiteboard:true,vertical:true});
  const bounds=await page.evaluate(()=>{
   const stage=qa.target('stage').getBoundingClientRect(),viewport=qa.target('whiteboard').getBoundingClientRect(),controls=document.querySelector('.bn-whiteboard-controls').getBoundingClientRect();
   const corners=[[stage.left+8,stage.top+8],[stage.right-8,stage.top+8],[stage.left+8,stage.bottom-80],[stage.right-8,stage.bottom-8]];
   return{stage:{left:stage.left,top:stage.top,right:stage.right,bottom:stage.bottom},viewport:{left:viewport.left,top:viewport.top,right:viewport.right,bottom:viewport.bottom},controls:{left:controls.left,bottom:controls.bottom},hits:corners.map(([x,y])=>!!document.elementFromPoint(x,y)?.closest('.bn-whiteboard-viewport'))};
  });
  for(const key of ['left','top','right','bottom'])assert.ok(Math.abs(bounds.stage[key]-bounds.viewport[key])<1,JSON.stringify(bounds));
  assert.ok(Math.abs(bounds.controls.left-bounds.stage.left)<1&&Math.abs(bounds.controls.bottom-bounds.stage.bottom)<1,JSON.stringify(bounds));assert.ok(bounds.hits.every(Boolean),JSON.stringify(bounds));
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  const r=bounds.stage,x=r.right-160,y=r.top+160;
  for(const [type,px,py,buttons] of [['mousePressed',x,y,1],['mouseMoved',x+40,y+40,1],['mouseReleased',x+40,y+40,0]])await cdp.send('Input.dispatchMouseEvent',{type,x:px,y:py,button:buttons?'left':'left',buttons,clickCount:1,pointerType:'pen',force:buttons?.5:0});
  await settle();const before=await state(),left=r.left+30,top=r.top+100;
  const touch=async(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:3,radiusY:3,force:.5}))});
  await touch('touchStart',[[1,left,top]]);await touch('touchMove',[[1,left+60,top+50]]);await settle();await touch('touchEnd',[]);await settle();
  assert.ok((await state()).origin[0]<before.origin[0]-40);assert.ok((await state()).origin[1]<before.origin[1]-35);
  const z=(await state()).zoom;await touch('touchStart',[[2,left+30,top],[3,left+130,top]]);await touch('touchMove',[[2,left+10,top],[3,left+150,top]]);await settle();await touch('touchEnd',[]);await settle();assert.ok((await state()).zoom>z*1.2);assert.equal(await page.evaluate(()=>qa.strokeCount()),1);
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});await cdp.detach();
 });
 await check('Surface toolbar stays in one row with separate 44px targets and accessible overflow commands',async()=>{
  await mount({whiteboard:true});const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await page.addStyleTag({content:'.bn-editor-toolbar-container *{transition:none!important}'});
  for(const width of [800,1024,1368,1920]){
   await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:912,deviceScaleFactor:1,mobile:false});await settle();
   const boxes=await page.evaluate(()=>{
    const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    return{bar:rect('.bn-editor-toolbar-container'),left:rect('.bn-editor-toolbar-left'),right:rect('.bn-editor-toolbar-right'),center:rect('.bn-editor-toolbar-center'),buttons:[...document.querySelectorAll('.bn-editor-toolbar-container .bn-tool-btn,.bn-editor-toolbar-container .bn-btn-icon')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};})};
   });
   assert.ok(boxes.bar.height<=56,JSON.stringify({width,boxes}));
   const centers=[boxes.left,boxes.center,boxes.right].map(b=>(b.y+b.bottom)/2);
   assert.ok(Math.max(...centers)-Math.min(...centers)<1,JSON.stringify({width,boxes}));
   assert.ok(boxes.left.right<=boxes.center.x+.5&&boxes.center.right<=boxes.right.x+.5&&boxes.right.right<=width,JSON.stringify({width,boxes}));
   for(const b of boxes.buttons){assert.ok(b.width>=44&&b.height>=44,JSON.stringify({width,b}));assert.ok(b.x>=0&&b.right<=width,JSON.stringify({width,b}));}
   for(let i=0;i<boxes.buttons.length;i++)for(let j=i+1;j<boxes.buttons.length;j++){const a=boxes.buttons[i],b=boxes.buttons[j];assert.ok(Math.min(a.right,b.right)-Math.max(a.x,b.x)<.5||Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)<.5,'overlapping touch targets');}
   if(width===1368)await page.screenshot({path:path.join(fixture,'surface-toolbar.png')});
  }
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1024,height:912,deviceScaleFactor:1,mobile:false});await settle();
  const more=page.locator('.bn-toolbar-more > button');await more.click();
  assert.equal(await more.getAttribute('aria-expanded'),'true');
  for(const command of ['add-page','favorite','capture','paste','scroll','duplicate','zoom-in','zoom-out','zoom-reset','thumbnails','shield','rename'])assert.ok(await page.locator('[data-toolbar-command="'+command+'"]').isVisible(),command);
  const before=await state();await page.locator('[data-toolbar-command="zoom-in"]').click();await settle();assert.ok((await state()).zoom>before.zoom);assert.equal(await more.getAttribute('aria-expanded'),'false');
  const oldPenOnly=await page.evaluate(()=>qa.toolbar.penOnly);await more.click();await page.locator('[data-toolbar-command="shield"]').click();await settle();assert.equal(await page.evaluate(()=>qa.toolbar.penOnly),!oldPenOnly);
  await more.click();await page.keyboard.press('Escape');assert.equal(await more.getAttribute('aria-expanded'),'false');
  await more.click();await page.locator('.bn-tool-btn').first().click();assert.equal(await more.getAttribute('aria-expanded'),'false');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:800,height:912,deviceScaleFactor:1,mobile:false});await settle();await more.click();await page.locator('[data-toolbar-command="hand"]').click();await settle();assert.equal(await page.evaluate(()=>qa.toolbar.activeTool),'hand');
  await cdp.send('Emulation.clearDeviceMetricsOverride');await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});await cdp.detach();
 });
 await check('No unhandled renderer errors during offline navigation',async()=>assert.deepEqual(errors,[]));
 await page.evaluate(()=>qa.unmount());await page.evaluate(()=>qa.flushLocalSaves());
 const report={passed:passed.length,failed:0,fixture,metrics,errors,electron:native,syntheticOnly:true,offline:true};
 fs.writeFileSync(path.join(fixture,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{if(application)await application.close();else await context?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
