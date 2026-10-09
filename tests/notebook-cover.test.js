import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotebookCoverQueue, createNotebookCoverInputGuard } from '../src/services/notebookCoverService.js';
import { getThumbnailDimensions } from '../src/utils/notebookThumbnail.js';
import { NOTEBOOK_COVERS, THUMBNAIL_COVER_ID } from '../src/data/covers.js';
import { TRANSLATIONS } from '../src/services/i18n.js';
const defer=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};

test('Thumbnail is separate from the eight existing cover IDs and localized in all languages',()=>{
  assert.equal(THUMBNAIL_COVER_ID,'thumbnail');assert.equal(NOTEBOOK_COVERS.length,8);
  assert.equal(NOTEBOOK_COVERS[0].id,'deep-ocean');
  for(const locale of ['en','th','zh','ru']) for(const key of ['coverThumbnail','coverThumbnailDescription','coverThumbnailAlt'])assert.ok(TRANSLATIONS[locale][key]);
});
test('Thumbnail allocation stays bounded and preserves portrait, landscape and whiteboard proportions',()=>{
  for(const [width,height]of [[1200,1697],[2400,1200],[100000,200000],[50,100],[1200,800]]){
    const result=getThumbnailDimensions({width,height});assert.ok(result.width<=320&&result.height<=320);
    assert.ok(result.width>0&&result.height>0);assert.ok(Math.abs(result.width-result.height*width/height)<=2);
  }
  assert.throws(()=>getThumbnailDimensions({width:Infinity,height:1}));
});
test('Rapid edits coalesce into one latest preview instead of nine simultaneous renders',async()=>{
  let loaded=0,rendered=0,saved=0;
  const queue=createNotebookCoverQueue({load:async id=>{loaded++;return{id};},render:async source=>{rendered++;return source;},save:async()=>{saved++;return{};}});
  for(let i=0;i<20;i++)queue.enqueue('same');assert.equal(queue.getSnapshot().queued,1);
  assert.equal(await queue.flush(),true);assert.deepEqual([loaded,rendered,saved],[1,1,1]);
});
test('A new edit cancels an in-flight old preview and only the newest result is saved',async()=>{
  const gate=defer(),started=defer(),writes=[];let version=1;
  const queue=createNotebookCoverQueue({load:async()=>({version}),render:async source=>{if(source.version===1){started.resolve();await gate.promise;}return source;},save:async(source,preview)=>{writes.push(preview.version);return{};}});
  queue.enqueue('a');const finished=queue.flush();await started.promise;version=2;queue.enqueue('a');gate.resolve();await finished;
  assert.deepEqual(writes,[2]);
});
test('Preview jobs stay serial across notebooks and do not lose jobs added while rendering',async()=>{
  const order=[];let active=0,maximum=0;
  const queue=createNotebookCoverQueue({load:async id=>({id}),render:async source=>{active++;maximum=Math.max(maximum,active);await Promise.resolve();active--;return source;},save:async(source)=>{order.push(source.id);return{};}});
  for(const id of ['a','b','c'])queue.enqueue(id);await queue.flush();assert.equal(maximum,1);assert.deepEqual(order,['a','b','c']);
});
test('Thumbnail failure never writes a blank cover and a later request can retry',async()=>{
  let fails=true,writes=0;
  const queue=createNotebookCoverQueue({load:async()=>({}),render:async()=>{if(fails)throw Error('synthetic');return{};},save:async()=>{writes++;return{};}});
  queue.enqueue('a');assert.equal(await queue.flush(),false);assert.equal(writes,0);
  fails=false;queue.enqueue('a');assert.equal(await queue.flush(),true);assert.equal(writes,1);
});
test('A synchronous read failure releases the queue and does not hang the next request',async()=>{
  let fails=true;
  const queue=createNotebookCoverQueue({load:()=>{if(fails)throw Error('synthetic');return{};},render:async()=>({}),save:async()=>({})});
  queue.enqueue('a');assert.equal(await queue.flush(),false);assert.equal(queue.getSnapshot().running,null);
  fails=false;queue.enqueue('a');assert.equal(await queue.flush(),true);
});
test('Missing or unchanged first pages skip rendering and metadata writes',async()=>{
  let rendered=false;
  const queue=createNotebookCoverQueue({load:async()=>null,render:async()=>{rendered=true;},save:async()=>{throw Error('Should not write');}});
  queue.enqueue('gone');await queue.flush();assert.equal(rendered,false);
});

test('Failure of a superseded render does not mark a successful newer cover as failed',async()=>{
  const started=defer(),gate=defer();let version=1;
  const queue=createNotebookCoverQueue({load:async()=>({version}),render:async source=>{if(source.version===1){started.resolve();await gate.promise;throw Error('superseded');}return{};},save:async()=>({})});
  queue.enqueue('a');const finished=queue.flush();await started.promise;version=2;queue.enqueue('a');gate.resolve();
  assert.equal(await finished,true);assert.equal(queue.getSnapshot().failed,0);
});


const pointer = (target, type, pointerId, pointerType = 'mouse', buttons = 1) => {
  const event = new Event(type);Object.assign(event,{pointerId,pointerType,buttons});target.dispatchEvent(event);
};
test('Thumbnail input guard releases a real mouse click without changing a stale editor flag',()=>{
  const target=new EventTarget();target.__bn_pen_active=true;
  const guard=createNotebookCoverInputGuard(target);guard.start();guard.start();
  pointer(target,'pointerdown',1);assert.equal(guard.canRun(),false);
  pointer(target,'pointerup',1,'mouse',0);assert.equal(guard.canRun(),true);
  assert.equal(target.__bn_pen_active,true);guard.stop();
});
test('Thumbnail rendering waits for all contacts and recovers from cancel, lost capture and blur',()=>{
  const target=new EventTarget(),guard=createNotebookCoverInputGuard(target);guard.start();
  pointer(target,'pointerdown',1,'pen');pointer(target,'pointerdown',2,'touch');
  pointer(target,'pointercancel',1,'pen',0);assert.equal(guard.canRun(),false);
  pointer(target,'pointermove',2,'touch',0);assert.equal(guard.canRun(),false);
  pointer(target,'pointerup',2,'touch',0);assert.equal(guard.canRun(),true);
  pointer(target,'pointerdown',3);pointer(target,'lostpointercapture',3);assert.equal(guard.canRun(),true);
  pointer(target,'pointerdown',4);target.dispatchEvent(new Event('blur'));assert.equal(guard.canRun(),true);
  pointer(target,'pointerdown',5);pointer(target,'pointermove',5,'mouse',0);assert.equal(guard.canRun(),true);guard.stop();
});
test('Stopping the Thumbnail observer removes its state and listeners',()=>{
  const target=new EventTarget(),guard=createNotebookCoverInputGuard(target);guard.start();pointer(target,'pointerdown',1);guard.stop();
  pointer(target,'pointerdown',2);assert.equal(guard.canRun(),true);
  guard.start();pointer(target,'pointerdown',3,'pen');assert.equal(guard.canRun(),false);guard.stop();
});
test('An automatic preview waits during contact then runs after release without a forced flush',async()=>{
  const target=new EventTarget(),guard=createNotebookCoverInputGuard(target),saved=defer();let rendered=0;guard.start();pointer(target,'pointerdown',1);
  const queue=createNotebookCoverQueue({delay:10,canRun:guard.canRun,load:async()=>({}),render:async()=>{rendered++;return{};},save:async()=>({}),onSaved:()=>saved.resolve()});
  queue.enqueue('auto');await new Promise(resolve=>setTimeout(resolve,40));assert.equal(rendered,0);
  pointer(target,'pointerup',1,'mouse',0);let timer;
  try{await Promise.race([saved.promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Preview stayed blocked after release')),2000);})]);}finally{clearTimeout(timer);guard.stop();}
  assert.equal(rendered,1);await queue.flush();
});


const completed=async promise=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Automatic preview did not finish')),2000);})]);}finally{clearTimeout(timer);}};
test('While the editor is visible repeated dirty marks cause no reads, renders or input polling',async()=>{
  let version=0,reads=0,renders=0,polls=0;const saved=defer(),writes=[];
  const queue=createNotebookCoverQueue({enabled:false,delay:10,canRun:()=>{polls++;return true;},load:async()=>{reads++;return{version};},render:async source=>{renders++;return source;},save:async source=>{writes.push(source.version);return{};},onSaved:()=>saved.resolve()});
  for(let i=1;i<=30;i++){version=i;queue.enqueue('first-page');}
  await new Promise(resolve=>setTimeout(resolve,80));assert.deepEqual([reads,renders,polls],[0,0,0]);assert.equal(queue.getSnapshot().queued,1);
  queue.setEnabled(true);await completed(saved.promise);await queue.flush();assert.deepEqual([reads,renders],[1,1]);assert.deepEqual(writes,[30]);
});
test('Opening an editor cancels a running preview, keeps its ID and resumes with the latest page',async()=>{
  const started=defer(),gate=defer(),saved=defer(),writes=[];let version=1,cancelled=0;
  const queue=createNotebookCoverQueue({delay:1,load:async()=>({version}),render:async source=>{if(source.version===1){started.resolve();await gate.promise;throw Error('Cancelled worker');}return source;},save:async source=>{writes.push(source.version);return{};},onSaved:()=>saved.resolve(),cancelRender:()=>{cancelled++;gate.resolve();}});
  queue.enqueue('one');await completed(started.promise);queue.setEnabled(false);version=2;queue.enqueue('one');
  while(queue.getSnapshot().running)await new Promise(resolve=>setTimeout(resolve,1));
  assert.equal(cancelled,1);assert.equal(queue.getSnapshot().queued,1);assert.equal(queue.getSnapshot().failed,0);assert.deepEqual(writes,[]);
  queue.setEnabled(true);await completed(saved.promise);await queue.flush();assert.deepEqual(writes,[2]);
});
test('A page read paused mid-flight cannot start a worker or lose the request for the next library visit',async()=>{
  const started=defer(),gate=defer(),saved=defer();let reads=0,renders=0,firstCurrent;
  const queue=createNotebookCoverQueue({delay:1,load:async(id,isCurrent)=>{reads++;if(reads===1){firstCurrent=isCurrent;started.resolve();await gate.promise;}return{id};},render:async source=>{renders++;return source;},save:async()=>({}),onSaved:()=>saved.resolve()});
  queue.enqueue('one');await completed(started.promise);queue.setEnabled(false);assert.equal(firstCurrent(),false);gate.resolve();
  while(queue.getSnapshot().running)await new Promise(resolve=>setTimeout(resolve,1));
  assert.equal(renders,0);assert.equal(queue.getSnapshot().queued,1);
  queue.setEnabled(true);await completed(saved.promise);await queue.flush();assert.equal(renders,1);assert.equal(reads,2);
});
test('Dirty notebooks survive tab changes and refresh once each from their latest revision',async()=>{
  const writes=[],versions={a:0,b:0},finished=defer();const queue=createNotebookCoverQueue({enabled:false,delay:1,load:async id=>({id,version:versions[id]}),render:async source=>source,save:async source=>{writes.push(source);return{};},onSaved:()=>{if(writes.length===2)finished.resolve();}});
  for(let i=1;i<=20;i++){versions.a=i;queue.enqueue('a');versions.b=i+10;queue.enqueue('b');}
  assert.equal(queue.getSnapshot().queued,2);queue.setEnabled(true);await completed(finished.promise);await queue.flush();
  assert.deepEqual(writes,[{id:'a',version:20},{id:'b',version:30}]);
});
