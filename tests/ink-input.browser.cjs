// Phases 4.1–4.3: actual React CanvasBoard, isolated profile, synthetic pen only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),esbuild=require('esbuild');
const {chromium,_electron}=require(process.env.BETTERNOTE_PLAYWRIGHT_PATH||'playwright');
const root=fs.realpathSync(path.resolve(__dirname,'..')),qaRoot=process.env.BETTERNOTE_QA_TEMP;
if(!qaRoot||!path.isAbsolute(qaRoot))throw Error('An isolated QA directory is required');
const baseline=process.env.BETTERNOTE_QA_INK_BASELINE==='1',native=process.env.BETTERNOTE_QA_INK_ELECTRON==='1';
const entry=String.raw`
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {CanvasBoard} from './src/components/Editor/CanvasBoard.jsx';import {setAppLanguage} from './src/services/i18n.js';setAppLanguage('en');
window.qa={commits:[],clears:0,frames:new Map(),nextFrame:1,holdFrames:false};
const raf=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
window.requestAnimationFrame=fn=>{if(!qa.holdFrames)return raf(fn);const id=-qa.nextFrame++;qa.frames.set(id,fn);return id;};
window.cancelAnimationFrame=id=>{if(id<0)qa.frames.delete(id);else cancel(id);};
qa.flushFrame=()=>{const frames=[...qa.frames.values()];qa.frames.clear();for(const fn of frames)fn(performance.now());};
const clear=CanvasRenderingContext2D.prototype.clearRect;
CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.classList.contains('bn-layer-active'))qa.clears++;return clear.apply(this,args);};
const renderer=createRoot(document.getElementById('root'));
qa.mount=(initialOptions={})=>{
 flushSync(()=>renderer.render(null));qa.commits=[];qa.commitPages=[];qa.otherCommits=[];qa.frames.clear();qa.holdFrames=false;qa.clears=0;window.__bn_pen_active=false;window.__bn_pen_last_time=0;
 const Harness=()=>{
 const[options,setOptions]=React.useState(initialOptions),[pages,setPages]=React.useState({[initialOptions.pageId||'ink-page']:initialOptions.strokes||[]});
 qa.configure=value=>flushSync(()=>setOptions(old=>({...old,...value})));
 const pageId=options.pageId||'ink-page',strokes=pages[pageId]||[];
 qa.strokes=strokes;qa.pages=pages;
 return <><CanvasBoard page={{id:pageId,strokes,pageWidth:options.width||480,pageHeight:640}} templateId="blank"
 activeTool={options.tool||'pen'} highlighterTip={options.tip||'square'} activeColor="#ef4444" activeWidth={4} penNib="fountain" isTapered={true} usePressure={true}
 pressureSensitivity="medium" scribbleToErase={options.scribble||false} penOnly={true} zoom={options.zoom||1} activeShape={options.shape||"rectangle"}
 onStrokesChange={value=>{qa.commits.push(structuredClone(value));qa.commitPages.push(pageId);setPages(old=>({...old,[pageId]:value}));}}
 onTextElementsChange={()=>{}} onImageElementsChange={()=>{}} onUndo={()=>{}}/>
 {options.multiple&&<CanvasBoard page={{id:'other-page',strokes:[],pageWidth:480,pageHeight:640}} templateId="blank"
 activeTool="pen" activeColor="#2563eb" activeWidth={4} zoom={1} onStrokesChange={value=>qa.otherCommits.push(value)}
 onTextElementsChange={()=>{}} onImageElementsChange={()=>{}}/>}</>;};flushSync(()=>renderer.render(<Harness/>));
};
qa.unmount=()=>flushSync(()=>renderer.render(null));
qa.event=(type,x,y,options={})=>{
 const canvas=document.querySelectorAll('.bn-layer-active')[options.board||0],r=canvas.getBoundingClientRect();
 const make=(sx,sy,p)=>new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:options.pointerId??71,pointerType:options.pointerType||'pen',button:0,
 buttons:options.buttons??(type==='pointerup'||type==='pointercancel'?0:1),pressure:p,clientX:r.left+sx*r.width/480,clientY:r.top+sy*r.height/640});
 const e=make(x,y,options.pressure??(type==='pointerup'?0:.6));
 if(options.samples)Object.defineProperty(e,'getCoalescedEvents',{value:()=>options.samples.map(p=>make(...p))});
 if(options.empty)Object.defineProperty(e,'getCoalescedEvents',{value:()=>[]});
 if(options.missing)Object.defineProperty(e,'getCoalescedEvents',{value:undefined});
 if(options.throws)Object.defineProperty(e,'getCoalescedEvents',{value:()=>{throw Error('Unavailable samples');}});
 canvas.dispatchEvent(e);
};
qa.pixels=selector=>{const c=document.querySelector(selector),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<data.length;i+=4)if(data[i])n++;return n;};
qa.burst=()=>{qa.holdFrames=true;qa.event('pointerdown',20,80);qa.clears=0;const start=performance.now();
 for(let i=0;i<20;i++){const samples=Array.from({length:100},(_,j)=>[21+i*15+j*.15,80+30*Math.sin((i*100+j)/40),.2+(j%50)/100]);const last=samples.at(-1);qa.event('pointermove',last[0],last[1],{samples,pressure:last[2]});}
 const dispatchMs=performance.now()-start,beforeFrame=qa.clears,pendingFrames=qa.frames.size,paintStart=performance.now();qa.flushFrame();
 const paintMs=performance.now()-paintStart,afterFrame=qa.clears;qa.event('pointerup',360,120);
 return {dispatchMs,paintMs,beforeFrame,afterFrame,pendingFrames,points:qa.commits[0]?.[0].points.length};};
`;
(async()=>{
 const fixture=fs.mkdtempSync(path.join(qaRoot,'betternote-ink-input-')),errors=[],passed=[],metrics={};
 const bundle=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent',plugins:[{name:'offline-workers',setup:require('./helpers/recovery-worker.cjs').setupRecoveryWorker}]});
 const html=path.join(fixture,'ink.html');fs.writeFileSync(html,'<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="'+pathToFileURL(path.join(root,'src/index.css')).href+'"><div id="root"></div>');
 let application,context,page;
 if(native){
  const main=path.join(fixture,'main.cjs');
  fs.writeFileSync(main,"const {app,BrowserWindow}=require('electron'),path=require('node:path');const fixture=process.argv.at(-1);"+
   "app.setPath('userData',path.join(fixture,'profile'));app.setPath('sessionData',path.join(fixture,'session'));"+
   "app.commandLine.appendSwitch('force-device-scale-factor','2');app.whenReady().then(()=>{const win=new BrowserWindow({show:false,width:1280,height:1000,"+
   "webPreferences:{nodeIntegration:false,contextIsolation:true}});win.loadFile(path.join(fixture,'ink.html'));});app.on('window-all-closed',()=>app.quit());");
  const env={...process.env,TEMP:qaRoot,TMP:qaRoot};delete env.ELECTRON_RUN_AS_NODE;
  application=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[main,fixture],env,timeout:30000});
  context=application.context();page=await application.firstWindow();
 }else{
  context=await chromium.launchPersistentContext(path.join(fixture,'profile'),{headless:true,executablePath:process.env.BETTERNOTE_QA_BROWSER,viewport:{width:1280,height:1000},deviceScaleFactor:2,env:{...process.env,TEMP:qaRoot,TMP:qaRoot}});
  page=context.pages()[0];
 }page.on('pageerror',e=>errors.push(e.message));await context.route(/^https?:\/\//,r=>r.abort());
 const check=async(name,fn)=>{await fn();passed.push(name);console.log('PASS '+name);};
 const mount=async options=>{await page.evaluate(o=>qa.mount(o),options);await page.waitForSelector('.bn-layer-active');};
 const points=()=>page.evaluate(()=>qa.commits.at(-1)?.at(-1)?.points);
 const compare=(actual,expected)=>{assert.equal(actual.length,expected.length);actual.forEach((p,i)=>{assert.ok(Math.abs(p.x-expected[i][0])<.001);assert.ok(Math.abs(p.y-expected[i][1])<.001);assert.ok(Math.abs(p.pressure-expected[i][2])<.001);});};
 try{
  await page.goto(pathToFileURL(html).href);await page.addScriptTag({content:bundle.outputFiles[0].text});await mount();metrics.burst=await page.evaluate(()=>qa.burst());
  if(baseline){const report={baseline:true,fixture,metrics,errors};fs.writeFileSync(path.join(fixture,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));return;}
  await require('./shape-input.browser.cjs')({page,mount,check});
  await check('Native samples preserve order, pressure and release endpoint',async()=>{await mount();await page.evaluate(()=>{qa.event('pointerdown',20,30,{pressure:.2});qa.event('pointermove',80,90,{pressure:.8,samples:[[40,50,.4],[60,70,.6],[80,90,.8]]});qa.event('pointerup',100,110);});compare(await points(),[[20,30,.2],[40,50,.4],[60,70,.6],[80,90,.8],[100,110,.8]]);});
  await check('Parent endpoint included when omitted from samples',async()=>{await mount();await page.evaluate(()=>{qa.event('pointerdown',20,30);qa.event('pointermove',80,90,{samples:[[40,50,.4]]});qa.event('pointerup',80,90);});compare(await points(),[[20,30,.6],[40,50,.4],[80,90,.6]]);});
  for(const fallback of ['empty','missing','throws'])await check('Fallback: '+fallback,async()=>{await mount();await page.evaluate(f=>{qa.event('pointerdown',20,30);qa.event('pointermove',80,90,{[f]:true});qa.event('pointerup',100,110);},fallback);compare(await points(),[[20,30,.6],[80,90,.6],[100,110,.6]]);});
  await check('Pressure changes kept; duplicate release endpoint omitted',async()=>{await mount();await page.evaluate(()=>{qa.event('pointerdown',20,30,{pressure:.2});qa.event('pointermove',20,30,{pressure:.8,samples:[[20,30,.4],[20,30,.8]]});qa.event('pointerup',20,30);});compare(await points(),[[20,30,.2],[20,30,.4],[20,30,.8]]);});
  await check('Highlighter retains samples and endpoint',async()=>{await mount({tool:'highlighter'});await page.evaluate(()=>{qa.event('pointerdown',20,30);qa.event('pointermove',80,90,{samples:[[40,50,.3],[80,90,.6]]});qa.event('pointerup',100,110);});compare(await points(),[[20,30,.6],[40,50,.3],[80,90,.6],[100,110,.6]]);assert.equal(await page.evaluate(()=>qa.commits[0][0].tool),'highlighter');});
  await check('20-event burst paints once per frame and commits all 2002 points',async()=>{await mount();metrics.burst=await page.evaluate(()=>qa.burst());assert.equal(metrics.burst.beforeFrame,0);assert.equal(metrics.burst.pendingFrames,1);assert.equal(metrics.burst.afterFrame,1);assert.equal(metrics.burst.points,2002);});
  await check('Release before frame commits once and cancels late paint',async()=>{await mount();const r=await page.evaluate(()=>{qa.holdFrames=true;qa.event('pointerdown',20,30);qa.event('pointermove',80,90,{samples:[[40,50,.4],[80,90,.6]]});const pending=qa.frames.size;qa.event('pointerup',100,110);const remaining=qa.frames.size;qa.clears=0;qa.flushFrame();return {pending,remaining,clears:qa.clears,commits:qa.commits.length};});assert.deepEqual(r,{pending:1,remaining:0,clears:0,commits:1});assert.equal((await points()).length,4);});
  await check('Single tap stays one point without release-pressure enlargement',async()=>{await mount();await page.evaluate(()=>{qa.event('pointerdown',20,30,{pressure:.25});qa.event('pointerup',20,30);});compare(await points(),[[20,30,.25]]);});
  await check('Cancel keeps collected input without fabricated origin endpoint',async()=>{await mount();await page.evaluate(()=>{qa.event('pointerdown',20,30);qa.event('pointermove',80,90);qa.event('pointercancel',0,0);});compare(await points(),[[20,30,.6],[80,90,.6]]);});
  await check('Zoomed Hi-DPI canvas stores logical coordinates and paints ink',async()=>{await mount({zoom:1.5});const n=await page.evaluate(()=>{qa.holdFrames=true;qa.event('pointerdown',20,30);qa.event('pointermove',80,90,{samples:[[40,50,.4],[80,90,.6]]});qa.flushFrame();return qa.pixels('.bn-layer-active');});assert.ok(n>0);await page.evaluate(()=>qa.event('pointerup',100,110));compare(await points(),[[20,30,.6],[40,50,.4],[80,90,.6],[100,110,.6]]);});
  await check('Real frame paints during pen down; next stroke has no old points',async()=>{await mount();await page.evaluate(()=>{qa.event('pointerdown',20,30);qa.event('pointermove',80,90);});await page.waitForFunction(()=>qa.pixels('.bn-layer-active')>0);await page.evaluate(()=>qa.event('pointerup',100,110));await page.waitForFunction(()=>qa.strokes.length===1);await page.evaluate(()=>{qa.event('pointerdown',150,180);qa.event('pointerup',170,200);});assert.equal(await page.evaluate(()=>qa.commits.length),2);compare(await points(),[[150,180,.6],[170,200,.6]]);});
  await check('QuickShape prevents queued freehand from overwriting preview',async()=>{await mount();await page.evaluate(()=>{qa.holdFrames=true;qa.event('pointerdown',20,80);qa.event('pointermove',200,80,{samples:Array.from({length:20},(_,i)=>[29+i*9,80,.6])});});await page.waitForFunction(()=>!!document.querySelector('.bn-gesture-toast'),undefined,{polling:50,timeout:4000});const r=await page.evaluate(()=>{qa.clears=0;qa.flushFrame();const clears=qa.clears;qa.event('pointerup',200,80);return {clears,commits:qa.commits.length,tapered:qa.commits[0][0].isTapered};});assert.deepEqual(r,{clears:0,commits:1,tapered:false});});
  await check('Unmount cancels pending ink frame',async()=>{await mount();const r=await page.evaluate(()=>{qa.holdFrames=true;qa.event('pointerdown',20,30);qa.event('pointermove',80,90);const before=qa.frames.size;qa.unmount();return {before,after:qa.frames.size};});assert.deepEqual(r,{before:1,after:0});});
  for(const tool of ['pen','highlighter'])await check('Preview matches committed pixels: '+tool,async()=>{
   await mount({tool});await page.evaluate(()=>{qa.holdFrames=true;qa.event('pointerdown',20,30,{pressure:.2});
    qa.event('pointermove',180,140,{pressure:.7,samples:[[60,100,.4],[120,50,.8],[180,140,.7]]});qa.flushFrame();
    const c=document.querySelector('.bn-layer-active');qa.preview=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    qa.event('pointerup',180,140);});
   await page.waitForFunction(()=>qa.strokes.length===1);
   const differences=await page.evaluate(()=>{const c=document.querySelector('.bn-layer-static'),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let n=0;for(let i=0;i<data.length;i++)if(data[i]!==qa.preview[i])n++;qa.preview=null;return n;});
   assert.equal(differences,0);
  });
  await check('Release batch preserves its contact samples before the zero-pressure endpoint',async()=>{
   await mount();await page.evaluate(()=>{qa.event('pointerdown',20,30,{pressure:.2});qa.event('pointerup',100,110,{samples:[[40,50,.4],[80,90,.8]]});});
   compare(await points(),[[20,30,.2],[40,50,.4],[80,90,.8],[100,110,.8]]);
  });

  for(const tip of ['round','square']){
   for(const kind of ['tap','short','long'])await check('Highlighter '+tip+' '+kind+' keeps tip, width, opacity and preview pixels',async()=>{
    await mount({tool:'highlighter',tip});await page.evaluate(kind=>{
     qa.holdFrames=true;qa.event('pointerdown',100,100);
     if(kind!=='tap')qa.event('pointermove',200,100,kind==='long'?{samples:[[130,100,.3],[160,100,.8],[200,100,.6]]}:{});
     qa.flushFrame();const c=document.querySelector('.bn-layer-active');qa.preview=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
     qa.event('pointerup',kind==='tap'?100:200,100);
    },kind);await page.waitForFunction(()=>qa.strokes.length===1);
    const r=await page.evaluate(()=>{
     const c=document.querySelector('.bn-layer-static'),ctx=c.getContext('2d'),data=ctx.getImageData(0,0,c.width,c.height).data,dpr=devicePixelRatio;
     const alpha=(x,y)=>ctx.getImageData(Math.floor(x*dpr),Math.floor(y*dpr),1,1).data[3];
     let diff=0;for(let i=0;i<data.length;i++)if(data[i]!==qa.preview[i])diff++;
     return {diff,tip:qa.strokes[0].highlighterTip,center:alpha(100,100),corner:alpha(94,94),beyond:alpha(100,108)};
    });assert.equal(r.diff,0);assert.equal(r.tip,tip);assert.ok(r.center>=95&&r.center<=98);assert.equal(r.beyond,0);
    assert.equal(r.corner>0,tip==='square');
   });
   await check('Held '+tip+' highlighter straightens and follows endpoint without changing tool',async()=>{
    await mount({tool:'highlighter',tip});await page.evaluate(()=>{
     qa.holdFrames=true;qa.event('pointerdown',40,100);
     qa.event('pointermove',240,101,{samples:[[80,99,.3],[130,104,.5],[180,98,.8],[240,101,.6]]});
    });await page.waitForFunction(()=>!!document.querySelector('.bn-gesture-toast'),undefined,{polling:50,timeout:4000});
    await page.evaluate(()=>{
     qa.flushFrame();qa.event('pointermove',260,140);
     const c=document.querySelector('.bn-layer-active');qa.preview=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
     qa.event('pointerup',260,140);
    });await page.waitForFunction(()=>qa.strokes.length===1);
    const r=await page.evaluate(()=>{
     const s=qa.strokes[0],c=document.querySelector('.bn-layer-static'),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
     let diff=0;for(let i=0;i<data.length;i++)if(data[i]!==qa.preview[i])diff++;
     return {tool:s.tool,tip:s.highlighterTip,start:s.points[0],end:s.points.at(-1),deviation:Math.max(...s.points.map(p=>Math.abs((p.x-40)*40-(p.y-100)*220))),diff};
    });assert.equal(r.tool,'highlighter');assert.equal(r.tip,tip);assert.equal(r.start.x,40);assert.equal(r.start.y,100);
    assert.equal(r.end.x,260);assert.equal(r.end.y,140);assert.ok(r.deviation<.001);assert.equal(r.diff,0);
   });
  }
  for(const kind of ['circle','rectangle','zigzag'])await check('Held highlighter leaves '+kind+' freehand without other shapes',async()=>{
   await mount({tool:'highlighter',tip:'round'});const count=await page.evaluate(kind=>{
    const list=kind==='circle'?Array.from({length:41},(_,i)=>[150+60*Math.cos(i*Math.PI/20),150+60*Math.sin(i*Math.PI/20)]):
      kind==='rectangle'?[[80,80],[200,80],[200,200],[80,200],[80,80]]:[[40,100],[100,200],[160,100],[220,200],[280,100]];
    qa.event('pointerdown',...list[0]);qa.event('pointermove',...list.at(-1),{samples:list.slice(1).map(p=>[...p,.6])});qa.last=list.at(-1);return list.length;
   },kind);await page.waitForTimeout(480);
   assert.equal(await page.locator('.bn-gesture-toast').count(),0);await page.evaluate(()=>qa.event('pointerup',...qa.last));
   assert.equal((await points()).length,count);
  });
  await check('Highlighter release cancels hold timer; no later conversion',async()=>{
   await mount({tool:'highlighter'});await page.evaluate(()=>{qa.event('pointerdown',40,100);qa.event('pointermove',240,102);qa.event('pointerup',240,102);});
   await page.waitForTimeout(480);assert.equal(await page.locator('.bn-gesture-toast').count(),0);assert.equal(await page.evaluate(()=>qa.commits.length),1);
  });


  for(const pointerType of ['pen','mouse'])await check('Accepted '+pointerType+' releases its lock and ignores a duplicate release',async()=>{
   await mount();const r=await page.evaluate(pointerType=>{qa.event('pointerdown',20,30,{pointerType});qa.event('pointermove',80,90,{pointerType});qa.event('pointerup',100,110,{pointerType});qa.event('pointerup',180,190,{pointerType});return {locked:!!window.__bn_pen_active,commits:qa.commits.length};},pointerType);
   assert.deepEqual(r,{locked:false,commits:1});compare(await points(),[[20,30,.6],[80,90,.6],[100,110,.6]]);
  });
  await check('Unrelated pen, mouse and touch cannot replace, move or release an active stroke',async()=>{
   await mount();const r=await page.evaluate(()=>{
    qa.event('pointerdown',20,30);qa.event('pointermove',80,90);
    for(const pointerType of ['pen','mouse','touch']){
     qa.event('pointerdown',200,200,{pointerId:99,pointerType});
     qa.event('pointermove',300,300,{pointerId:99,pointerType});
     qa.event('pointerup',350,350,{pointerId:99,pointerType});
    }
    const locked=window.__bn_pen_active,early=qa.commits.length;qa.event('pointerup',100,110);return {locked,early};
   });assert.deepEqual(r,{locked:true,early:0});compare(await points(),[[20,30,.6],[80,90,.6],[100,110,.6]]);
  });
  for(const ending of ['blur','capture','cancel','window-up','hidden'])for(const tool of ['pen','highlighter'])await check(tool+' interruption '+ending+' keeps ink once and allows the next stroke',async()=>{
   await mount({tool});const r=await page.evaluate(ending=>{
    qa.holdFrames=true;qa.event('pointerdown',20,30);qa.event('pointermove',80,90);
    if(ending==='blur')window.dispatchEvent(new Event('blur'));
    if(ending==='capture')qa.event('lostpointercapture',0,0);
    if(ending==='cancel')qa.event('pointercancel',0,0);
    if(ending==='window-up')window.dispatchEvent(new PointerEvent('pointerup',{pointerId:71,pointerType:'pen',clientX:100,clientY:110}));
    if(ending==='hidden'){
     Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;
    }
    const r={commits:qa.commits.length,locked:!!window.__bn_pen_active,frames:qa.frames.size,points:qa.commits[0][0].points};
    qa.event('pointerup',300,300);qa.event('lostpointercapture',0,0);qa.flushFrame();return {...r,lateCommits:qa.commits.length};
   },ending);
   assert.equal(r.commits,1);assert.equal(r.lateCommits,1);assert.equal(r.locked,false);assert.equal(r.frames,0);
   if(ending!=='window-up')compare(r.points,[[20,30,.6],[80,90,.6]]);
   await page.evaluate(()=>{qa.event('pointerdown',150,180);qa.event('pointerup',170,200);});assert.equal(await page.evaluate(()=>qa.commits.length),2);compare(await points(),[[150,180,.6],[170,200,.6]]);
  });
  for(const change of [{tool:'highlighter'},{pageId:'next-page'},{zoom:1.5},{width:600}])await check('Configuration change '+JSON.stringify(change)+' saves using the previous page/tool',async()=>{
   await mount();const r=await page.evaluate(change=>{
    qa.event('pointerdown',20,30);qa.event('pointermove',80,90);qa.configure(change);qa.event('pointerup',300,300);
    return {pages:qa.commitPages,tool:qa.commits[0]?.[0].tool,points:qa.commits[0]?.[0].points,locked:!!window.__bn_pen_active};
   },change);assert.deepEqual(r.pages,['ink-page']);assert.equal(r.tool,'pen');assert.equal(r.locked,false);compare(r.points,[[20,30,.6],[80,90,.6]]);
  });
  await check('Unmount preserves collected ink once, clears timers and does not affect another mounted board',async()=>{
   await mount();await page.evaluate(()=>{qa.holdFrames=true;qa.event('pointerdown',20,30);qa.event('pointermove',80,90);qa.unmount();});
   assert.equal(await page.evaluate(()=>qa.commits.length),1);compare(await points(),[[20,30,.6],[80,90,.6]]);
   await page.waitForTimeout(450);assert.equal(await page.evaluate(()=>!!window.__bn_pen_active),false);
   await mount({multiple:true});const r=await page.evaluate(()=>{
    qa.event('pointerdown',20,30);qa.event('pointerdown',250,250,{board:1,pointerId:99});qa.event('pointermove',350,350,{board:1,pointerId:99});qa.event('pointerup',350,350,{board:1,pointerId:99});
    const locked=window.__bn_pen_active;qa.event('pointerup',80,90);return {locked,own:qa.commits.length,other:qa.otherCommits.length};
   });assert.deepEqual(r,{locked:true,own:1,other:0});
  });
  await check('Pointer hover and Hand/Text clicks do not leave an ink lock',async()=>{
   await mount();await page.evaluate(()=>qa.event('pointermove',80,90,{buttons:0,pressure:0}));assert.equal(await page.evaluate(()=>!!window.__bn_pen_active),false);
   for(const tool of ['hand','text']){await mount({tool});await page.evaluate(()=>{qa.event('pointerdown',20,30);qa.event('pointerup',80,90);});assert.equal(await page.evaluate(()=>!!window.__bn_pen_active),false);}
  });
  await check('Outside UI click finishes ink before its action and cancels draw-hold',async()=>{
   await mount();await page.evaluate(()=>{qa.event('pointerdown',20,80);qa.event('pointermove',200,80);document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'mouse',pointerId:1}));});
   await page.waitForTimeout(450);assert.equal(await page.locator('.bn-gesture-toast').count(),0);assert.equal(await page.evaluate(()=>qa.commits.length),1);assert.equal(await page.evaluate(()=>!!window.__bn_pen_active),false);
  });
  for(const tool of ['lasso','snip','shape','eraser'])await check(tool+' interruption clears locks without creating phantom ink',async()=>{
   await mount({tool});await page.evaluate(()=>{qa.event('pointerdown',20,30);qa.event('pointermove',80,90);window.dispatchEvent(new Event('blur'));qa.event('pointerup',0,0);});
   assert.equal(await page.evaluate(()=>!!window.__bn_pen_active),false);assert.equal(await page.evaluate(()=>qa.commits.length),0);
  });
  for(const ending of ['pointerup','pointercancel','blur'])await check('Scribble '+ending+' preserves normal erase behavior and never erases on interruption',async()=>{
   await mount({scribble:true,strokes:[{tool:'pen',color:'#2563eb',width:4,points:[{x:80,y:100,pressure:.6},{x:160,y:100,pressure:.6}]}]});
   await page.evaluate(ending=>{
    const list=[[60,80],[180,90],[60,100],[180,110],[60,120],[180,130],[60,140],[180,150],[60,160]];
    qa.event('pointerdown',...list[0]);qa.event('pointermove',...list.at(-1),{samples:list.slice(1).map(p=>[...p,.6])});
    if(ending==='blur')window.dispatchEvent(new Event('blur'));else qa.event(ending,...list.at(-1));
   },ending);
   assert.equal(await page.evaluate(()=>qa.commits.length),1);
   assert.equal(await page.evaluate(()=>qa.commits[0].length),ending==='pointerup'?0:2);
  });
  await check('Real mouse pointer capture loss saves once and restores capture on the next stroke',async()=>{
   await mount();const box=await page.locator('.bn-layer-active').boundingBox();
   await page.mouse.move(box.x+30,box.y+40);await page.mouse.down();await page.mouse.move(box.x+100,box.y+120);
   const captured=await page.evaluate(()=>document.querySelector('.bn-layer-active').hasPointerCapture(1));assert.equal(captured,true);
   await page.evaluate(()=>document.querySelector('.bn-layer-active').releasePointerCapture(1));await page.mouse.move(box.x+110,box.y+130);
   await page.waitForFunction(()=>qa.commits.length===1);await page.mouse.up();assert.equal(await page.evaluate(()=>qa.commits.length),1);assert.equal(await page.evaluate(()=>!!window.__bn_pen_active),false);
   await page.mouse.move(box.x+150,box.y+180);await page.mouse.down();await page.mouse.up();await page.waitForFunction(()=>qa.commits.length===2);
  });

  await check('Touch never appends ink; no renderer exception',async()=>{await mount();await page.evaluate(()=>{qa.event('pointerdown',20,30,{pointerType:'touch'});qa.event('pointermove',80,90,{pointerType:'touch'});qa.event('pointerup',100,110,{pointerType:'touch'});});assert.equal(await page.evaluate(()=>qa.commits.length),0);assert.deepEqual(errors,[]);});
  await mount();await page.evaluate(()=>{qa.event('pointerdown',20,80);for(let i=0;i<20;i++)qa.event('pointermove',30+i*15,80+30*Math.sin(i/2));qa.event('pointerup',340,100);});await page.waitForFunction(()=>qa.strokes.length===1);if(!native)await page.screenshot({path:path.join(fixture,'ink.png')});
  const report={passed:passed.length,failed:0,fixture,metrics,errors,syntheticOnly:true,realReactCanvas:true,deviceScaleFactor:await page.evaluate(()=>window.devicePixelRatio),electron:native};fs.writeFileSync(path.join(fixture,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{if(application)await application.close();else await context.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
