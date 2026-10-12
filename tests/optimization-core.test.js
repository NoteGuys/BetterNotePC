import test from 'node:test';import assert from 'node:assert/strict';
import {createPerformanceMetrics} from '../src/utils/performanceMetrics.js';
import {canStartBackgroundPdf,BACKUP_PDF_IDLE_MS} from '../src/utils/backgroundPdfPolicy.js';
import {createInkPreview} from '../src/utils/inkPreview.js';
import {renderStroke} from '../src/utils/inkingEngine.js';
const context=()=>{let calls=[];const ctx=new Proxy({}, {get:(_o,key)=> (...args)=>calls.push([key,...args]),set:(o,k,v)=>{calls.push(['set',k,v]);o[k]=v;return true;}});return{ctx,calls};};
const ink=n=>({tool:'pen',color:'#123456',width:4,points:Array.from({length:n},(_,i)=>({x:i*.5,y:50+Math.sin(i/10)*20,pressure:.2+(i%11)/20})),nibType:'fountain',isTapered:true,usePressure:true});
test('PDF preparation waits through thinking pauses and never starts over active/unsaved/hidden work',()=>{
 assert.equal(BACKUP_PDF_IDLE_MS,15000);assert.equal(canStartBackgroundPdf({lastInput:1000,now:1700}),false);
 assert.equal(canStartBackgroundPdf({lastInput:1000,now:16000}),true);
 for(const guard of [{pointers:1},{saved:false},{paused:true},{hidden:true}])assert.equal(canStartBackgroundPdf({now:20000,...guard}),false);
});
test('Performance summaries retain bounded numeric samples, discard content and reset after publication',()=>{
 const m=createPerformanceMetrics(4);for(let i=1;i<=10;i++)m.record('ink',i);m.record('filename',123);m.record('ink',NaN);
 const values=m.take();assert.deepEqual(values,[{event:'performance',category:'ink',count:10,p50:8,p95:10,p99:10,max:10}]);assert.deepEqual(m.take(),[]);
});
test('Stable prefix preserves exact renderer command order and pressure/taper widths',()=>{
 for(const nibType of ['fountain','brush','ballpoint'])for(const usePressure of [true,false])for(const isTapered of [true,false]){
  const stroke={...ink(1000),nibType,usePressure,isTapered},full=context(),prefix=context(),tail=context();
  renderStroke(full.ctx,stroke);const preview=createInkPreview(()=>{});preview.draw(prefix.ctx,tail.ctx,stroke);
  const geometry=calls=>calls.filter(c=>['moveTo','lineTo','quadraticCurveTo','stroke'].includes(c[0])||(c[0]==='set'&&c[1]==='lineWidth'));
  assert.deepEqual([...geometry(prefix.calls),...geometry(tail.calls)],geometry(full.calls));
 }
});
test('Long stroke previews draw a bounded tail without copying or losing input points',()=>{
 const stroke=ink(1000),prefix=context(),tail=context();let resets=0;const preview=createInkPreview(()=>resets++);
 preview.draw(prefix.ctx,tail.ctx,stroke);const oldLength=prefix.calls.length;tail.calls.length=0;
 stroke.points.push({x:501,y:60,pressure:.8});preview.draw(prefix.ctx,tail.ctx,stroke);
 assert.ok(prefix.calls.length-oldLength<30);assert.ok(tail.calls.length<160);assert.equal(stroke.points.length,1001);
 preview.reset();preview.reset();assert.equal(resets,1);assert.equal(preview.baked,false);
});
test('Short strokes, angular shapes and highlighters retain the existing complete renderer',()=>{
 for(const stroke of [ink(99),{...ink(1000),shapeType:'rectangle'},{...ink(1000),tool:'highlighter'}]){
 const full=context(),prefix=context(),active=context();renderStroke(full.ctx,stroke);createInkPreview(()=>{}).draw(prefix.ctx,active.ctx,stroke);
 assert.deepEqual(active.calls,full.calls);assert.equal(prefix.calls.length,0);
 }
});


import {assertJsonSize} from '../src/utils/jsonSizeBudget.js';
test('JSON byte budget counts Unicode, escaping, surrogate pairs and omitted fields before allocation',()=>{
 for(const value of [{text:'ไทย\n😀',quote:'"',slash:'\\',missing:undefined,number:NaN},[null,undefined,Infinity,1e50],{text:'\ud800',date:new Date('2026-10-13T00:00:00Z')}]){
  const size=new TextEncoder().encode(JSON.stringify(value)).length;assert.equal(assertJsonSize(value,size),size);assert.throws(()=>assertJsonSize(value,size-1),/backup-too-large/);
 }
 assert.throws(()=>assertJsonSize({pages:[{image:'x'.repeat(1000)}]},100),/backup-too-large/);
});

test('An explicit manual backup can prepare PDFs immediately once input and local saving finish',()=>{assert.equal(canStartBackgroundPdf({now:10,lastInput:10,automatic:false}),true);assert.equal(canStartBackgroundPdf({now:10,lastInput:10,automatic:false,pointers:1}),false);});

import {runForegroundJob,hasForegroundJobs} from '../src/services/foregroundJobs.js';
test('Foreground work pauses optional background PDF and always releases its priority after nested errors',async()=>{
 assert.equal(hasForegroundJobs(),false);await assert.rejects(runForegroundJob(async()=>{assert.equal(hasForegroundJobs(),true);await runForegroundJob(async()=>{assert.equal(hasForegroundJobs(),true);});assert.equal(hasForegroundJobs(),true);throw Error('cancelled');}),/cancelled/);assert.equal(hasForegroundJobs(),false);
});

test('Changing preview style or trimming points clears a baked prefix before replaying',()=>{
 for(const change of [stroke=>stroke.color='#654321',stroke=>stroke.nibType='brush',stroke=>stroke.usePressure=false,stroke=>stroke.points.splice(80)]){
  const stroke=ink(1000),prefix=context(),active=context();let resets=0;const preview=createInkPreview(()=>resets++);
  preview.draw(prefix.ctx,active.ctx,stroke);change(stroke);prefix.calls.length=0;active.calls.length=0;
  preview.draw(prefix.ctx,active.ctx,stroke);const full=context();renderStroke(full.ctx,stroke);
  const geometry=calls=>calls.filter(c=>['moveTo','lineTo','quadraticCurveTo','stroke'].includes(c[0])||(c[0]==='set'&&c[1]==='lineWidth'));
  assert.equal(resets,1);assert.deepEqual([...geometry(prefix.calls),...geometry(active.calls)],geometry(full.calls));
 }
});
