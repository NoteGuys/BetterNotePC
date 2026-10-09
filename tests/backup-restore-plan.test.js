import test from 'node:test';
import assert from 'node:assert/strict';
import { planRestoredNotebook, restoredContentHash } from '../src/services/backupRestorePlan.js';
const stroke = (id, x = 10) => ({id, points:[{x,y:20},{x:x+10,y:30}],width:2,color:'#ff0000'});
const note = (ink = [], time = 10, id = 'a') => ({id,name:'a',updatedAt:time,pageCount:1,
  pages:[{id:id+'-p',notebookId:id,pageIndex:0,updatedAt:time,templateId:'dotted',pageWidth:1200,pageHeight:1697,
    pdfPageImage:'data:image/png;base64,c3ludGhldGlj',strokes:ink,textElements:[],imageElements:[]}]});
const plan = (local,incoming,extra={}) => planRestoredNotebook({local,incoming,remoteHash:'remote',folders:[],localFolders:[],copyLabel:'Copy from this device',...extra});
test('The existing unannotated page receives handwriting without a duplicate, even before receipts exist',async()=>{
 const remote=note([stroke('pc')],1),result=await plan(note([],500),remote);
 assert.equal(result.conflict,false);assert.equal(result.notebooks.length,1);assert.deepEqual(result.notebooks[0],remote);
});
test('Added ink retains existing strokes, text and image locks without a duplicate',async()=>{
 const local=note([stroke('old')]);local.pages[0].textElements=[{id:'t',text:'Original',x:1,y:2}];local.pages[0].imageElements=[{id:'i',src:'image',locked:true}];
 const remote=structuredClone(local);remote.pages[0].strokes.push(stroke('new'));remote.pages[0].textElements.push({id:'t2',text:'Added'});
 const result=await plan(local,remote);assert.equal(result.conflict,false);assert.deepEqual(result.notebooks[0],remote);
});
test('An unchanged received version accepts remote erasure, text edits and page changes with its content receipt',async()=>{
 const local=note([stroke('old')]);local.pages[0].textElements=[{id:'t',text:'Old text'}];
 const remote=note([],1);remote.pages[0].textElements=[{id:'t',text:'New text'}];remote.pages.push({...remote.pages[0],id:'second',pageIndex:1});remote.pageCount=2;
 const result=await plan(local,remote,{contentBase:await restoredContentHash(local)});
 assert.equal(result.conflict,false);assert.equal(result.notebooks.length,1);assert.deepEqual(result.notebooks[0],remote);
});
test('Two devices with independent strokes keep both versions',async()=>{
 const base=note(),local=note([stroke('surface')]),remote=note([stroke('pc')]);
 const result=await plan(local,remote,{contentBase:await restoredContentHash(base)});
 assert.equal(result.conflict,true);assert.equal(result.notebooks.length,2);
 assert.deepEqual(result.notebooks[0].pages[0].strokes,local.pages[0].strokes);assert.deepEqual(result.notebooks[1],remote);
});
test('Local edits are detected even when a notebook timestamp was not advanced',async()=>{
 const base=note(),local=note([stroke('surface')],base.updatedAt),remote=note([stroke('pc')]);
 assert.equal((await plan(local,remote,{contentBase:await restoredContentHash(base)})).conflict,true);
});
test('Unknown local erasure and altered text, backgrounds, dimensions or page order are preserved',async()=>{
 const local=note([stroke('surface')]);
 const cases=[note(),note([stroke('surface',99)]),structuredClone(local),structuredClone(local),structuredClone(local)];
 cases[2].pages[0].pdfPageImage='different';cases[3].pages[0].pageWidth=800;cases[4].pages[0].textElements=[{id:'t',text:'different'}];
 local.pages[0].textElements=[{id:'t',text:'original'}];
 for(const remote of cases)assert.equal((await plan(local,remote)).conflict,true);
});
test('Reordered or removed annotations cannot prove that local work survives',async()=>{
 const a=stroke('a'),b=stroke('b');
 for(const remote of [note([b,a]),note([b])])assert.equal((await plan(note([a,b]),remote)).conflict,true);
});
test('Same names with different notebook IDs remain separate documents',async()=>{
 const result=await plan(null,note([stroke('pc')],10,'different-id'),{contentBase:await restoredContentHash(note())});
 assert.equal(result.conflict,false);assert.equal(result.notebooks[0].id,'different-id');
});
test('Content receipts ignore cached previews and clocks, and repeat restores do not copy again',async()=>{
 const remote=note([stroke('pc')]),first=await plan(note(),remote),local=structuredClone(remote);
 local.firstPageThumbnail={dataUrl:'preview'};local.updatedAt=999;local.pages[0].updatedAt=888;
 const result=await plan(local,remote,{contentBase:first.contentBase});
 assert.equal(result.conflict,false);assert.equal(result.notebooks.length,1);assert.equal(result.contentBase,first.contentBase);
});
test('A replaced conflict establishes the incoming version as the next content base',async()=>{
 const result=await plan(note([stroke('surface')]),note([stroke('pc')]));assert.equal(result.conflict,true);
 assert.equal(result.contentBase,await restoredContentHash(result.notebooks[1]));
});
test('Reserved IDs do not inherit a content receipt',async()=>{
 const entries=Object.create(null);assert.equal(Object.hasOwn(entries,'constructor'),false);
 assert.equal((await plan(note([stroke('surface')],10,'constructor'),note([stroke('pc')],11,'constructor'))).conflict,true);
});
