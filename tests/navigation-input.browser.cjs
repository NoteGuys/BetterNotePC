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
 const check=async(name,fn)=>{await fn();passed.push(name);console.log('PASS '+name);};
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
 await check('No unhandled renderer errors during offline navigation',async()=>assert.deepEqual(errors,[]));
 await page.evaluate(()=>qa.unmount());await page.evaluate(()=>qa.flushLocalSaves());
 const report={passed:passed.length,failed:0,fixture,metrics,errors,electron:native,syntheticOnly:true,offline:true};
 fs.writeFileSync(path.join(fixture,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{if(application)await application.close();else await context?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
