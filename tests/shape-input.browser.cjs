// Phase 4.3: real CanvasBoard shape geometry and committed pixel checks.
const assert=require('node:assert/strict');
module.exports=async({page,mount,check})=>{
 const snapshot=()=>page.evaluate(()=>{const c=document.querySelector('.bn-layer-active');qa.shapePreview=Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);});
 const samePixels=async()=>{
  await page.waitForFunction(()=>qa.strokes.length===1);
  return page.evaluate(()=>{const c=document.querySelector('.bn-layer-static'),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let diff=0;for(let i=0;i<data.length;i++)if(data[i]!==qa.shapePreview[i])diff++;return diff;});
 };
 for(const shape of ['line','rectangle','circle','triangle','arrow'])for(const reverse of [false,true])await check('Shape '+shape+' '+(reverse?'reverse':'forward')+' preview and saved pixels agree',async()=>{
  await mount({tool:'shape',shape});await page.evaluate(reverse=>{qa.holdFrames=true;const a=reverse?[260,230]:[60,70],b=reverse?[60,70]:[260,230];qa.event('pointerdown',...a);qa.event('pointermove',...b);qa.flushFrame();},reverse);
  assert.ok(await page.evaluate(()=>qa.pixels('.bn-layer-active')>0));await snapshot();
  await page.evaluate(reverse=>qa.event('pointerup',...(reverse?[60,70]:[260,230])),reverse);
  assert.equal(await samePixels(),0);assert.equal(await page.evaluate(()=>qa.commits.length),1);
  assert.equal(await page.evaluate(()=>qa.strokes[0].points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))),true);
 });
 for(const shape of ['rectangle','triangle'])await check('Sharp '+shape+' corners appear in preview and saved pixels',async()=>{
  await mount({tool:'shape',shape});await page.evaluate(()=>{qa.holdFrames=true;qa.event('pointerdown',60,70);qa.event('pointermove',260,230);qa.flushFrame();});
  const corners=shape==='rectangle'?[[259.5,70.5],[259.5,229.5],[60.5,229.5],[60.5,70.5]]:[[259,229.5],[61,229.5],[160,70.5]];
  const alpha=await page.evaluate(corners=>{const c=document.querySelector('.bn-layer-active'),ctx=c.getContext('2d'),scale=c.width/480;return corners.map(([x,y])=>ctx.getImageData(Math.floor(x*scale),Math.floor(y*scale),1,1).data[3]);},corners);
  assert.ok(alpha.every(a=>a>100),'Missing corner pixels: '+JSON.stringify(alpha));
  await snapshot();await page.evaluate(()=>qa.event('pointerup',260,230));assert.equal(await samePixels(),0);
  assert.equal(await page.evaluate(()=>qa.strokes[0].shapeType),shape);
 });
 for(const zoom of [.65,1.5])await check('Line snaps horizontal and stores logical coordinates at zoom '+zoom,async()=>{
  await mount({tool:'shape',shape:'line',zoom});await page.evaluate(()=>{qa.event('pointerdown',40,60);qa.event('pointermove',240,65);qa.event('pointerup',240,65);});
  const pts=await page.evaluate(()=>qa.commits[0][0].points);assert.ok(pts.every(p=>Math.abs(p.y-60)<.001));assert.ok(Math.abs(pts[0].x-40)<.001);assert.ok(Math.abs(pts.at(-1).x-(40+Math.hypot(200,5)))<.001);
 });
 await check('Shape release without an intermediate move still saves its actual endpoint',async()=>{
  await mount({tool:'shape',shape:'line'});await page.evaluate(()=>{qa.event('pointerdown',40,60);qa.event('pointerup',240,60);});
  const pts=await page.evaluate(()=>qa.commits[0][0].points);assert.equal(pts[0].x,40);assert.equal(pts.at(-1).x,240);assert.ok(pts.every(p=>p.y===60));
 });
 await check('A burst of shape drag events paints once using the latest geometry',async()=>{
  await mount({tool:'shape',shape:'rectangle'});
  const result=await page.evaluate(()=>{qa.holdFrames=true;qa.event('pointerdown',40,60);qa.clears=0;for(let i=0;i<50;i++)qa.event('pointermove',100+i*3,120+i*2);
   const pending=qa.frames.size,before=qa.clears;qa.flushFrame();return {pending,before,after:qa.clears};});
  assert.deepEqual(result,{pending:1,before:0,after:1});await snapshot();await page.evaluate(()=>qa.event('pointerup',247,218));assert.equal(await samePixels(),0);
 });
 for(const ending of ['pointerup','pointercancel','unmount'])await check('Shape '+ending+' before its frame cannot paint late or duplicate a shape',async()=>{
  await mount({tool:'shape',shape:'rectangle'});const result=await page.evaluate(ending=>{
   qa.holdFrames=true;qa.event('pointerdown',40,60);qa.event('pointermove',240,160);
   if(ending==='unmount')qa.unmount();else qa.event(ending,260,180);
   const pending=qa.frames.size;qa.clears=0;qa.flushFrame();return {pending,paints:qa.clears,commits:qa.commits.length};
  },ending);assert.deepEqual(result,{pending:0,paints:0,commits:ending==='pointerup'?1:0});
 });
 const hold=async kind=>{
  await mount();await page.evaluate(kind=>{
   const list=kind==='circle'?Array.from({length:49},(_,i)=>[150+60*Math.cos(i*Math.PI/24),150+60*Math.sin(i*Math.PI/24),.6]):
    Array.from({length:21},(_,i)=>[40+i*10,100+(i%2),.6]);
   qa.event('pointerdown',list[0][0],list[0][1]);qa.event('pointermove',list.at(-1)[0],list.at(-1)[1],{samples:list.slice(1)});
  },kind);await page.waitForFunction(()=>!!document.querySelector('.bn-gesture-toast'),undefined,{polling:50,timeout:4000});
 };
 await check('Held pen line preview matches the saved nib rendering',async()=>{
  await hold('line');await snapshot();await page.evaluate(()=>qa.event('pointerup',240,100));assert.equal(await samePixels(),0);
 });
 for(const tool of ['pen','highlighter'])await check('Held '+tool+' uses a newer release endpoint even without a final pointermove',async()=>{
  await mount({tool});await page.evaluate(()=>{qa.event('pointerdown',40,100);qa.event('pointermove',240,100,{samples:Array.from({length:20},(_,i)=>[50+i*10,100,.6])});});
  await page.waitForFunction(()=>!!document.querySelector('.bn-gesture-toast'),undefined,{polling:50,timeout:4000});
  await page.evaluate(()=>qa.event('pointerup',280,160));const end=await page.evaluate(()=>qa.commits[0][0].points.at(-1));assert.equal(end.x,280);assert.equal(end.y,160);
 });
 await check('A held circle released at its hold point keeps its recognized size and center',async()=>{
  await hold('circle');await snapshot();await page.evaluate(()=>qa.event('pointerup',210,150));assert.equal(await samePixels(),0);
  const pts=await page.evaluate(()=>qa.commits[0][0].points);assert.ok(Math.abs(Math.min(...pts.map(p=>p.x))-90)<.001);assert.ok(Math.abs(Math.max(...pts.map(p=>p.y))-210)<.001);
 });
 await check('Resizing a held circle moves its center with its new bounding box',async()=>{
  await hold('circle');await page.evaluate(()=>qa.event('pointermove',300,250));await snapshot();await page.evaluate(()=>qa.event('pointerup',300,250));
  assert.equal(await samePixels(),0);const pts=await page.evaluate(()=>qa.commits[0][0].points);
  for(const [actual,expected]of [[Math.min(...pts.map(p=>p.x)),90],[Math.max(...pts.map(p=>p.x)),300],[Math.min(...pts.map(p=>p.y)),90],[Math.max(...pts.map(p=>p.y)),250]])assert.ok(Math.abs(actual-expected)<.001);
 });
 await check('Changing the selected shape cancels an unfinished shape instead of saving a different kind',async()=>{
  await mount({tool:'shape',shape:'rectangle'});await page.evaluate(()=>{qa.event('pointerdown',40,60);qa.event('pointermove',240,160);qa.configure({shape:'circle'});qa.event('pointerup',240,160);});
  assert.equal(await page.evaluate(()=>qa.commits.length),0);assert.equal(await page.evaluate(()=>!!window.__bn_pen_active),false);
 });
};
