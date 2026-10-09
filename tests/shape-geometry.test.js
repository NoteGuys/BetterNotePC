import test from 'node:test';
import assert from 'node:assert/strict';
import { snapAngle, classifyGeometricShape, recognizeHighlighterLine, generateVectorShapePoints, renderStroke, transformStroke, eraseStrokesPrecision } from '../src/utils/inkingEngine.js';
const rad=deg=>deg*Math.PI/180;
const deg=angle=>angle*180/Math.PI;
test('Overlapping snap ranges choose the closest angle in either direction',()=>{
 for(const [input,target] of [[37.8,45],[-37.8,-45],[52.2,45],[-52.2,-45],[142.8,150],[-142.8,-150]])assert.ok(Math.abs(deg(snapAngle(rad(input),8))-target)<1e-8);
});
test('Cardinal, diagonal and wrapped angles snap within threshold and preserve other angles',()=>{
 for(const [input,target]of [[3,0],[87,90],[177,180],[-177,180],[44,45],[121,120]])assert.ok(Math.abs(Math.cos(snapAngle(rad(input),6))-Math.cos(rad(target)))<1e-8);
 for(const input of [12,-12,72,-72])assert.equal(snapAngle(rad(input),6),rad(input));
});
test('Nearest snap is used by both the pen classifier and line-only highlighter hold',()=>{
 const angle=rad(37.8),points=Array.from({length:21},(_,i)=>({x:20+i*10*Math.cos(angle),y:30+i*10*Math.sin(angle),pressure:.6}));
 for(const recognize of [classifyGeometricShape,recognizeHighlighterLine]){
  const shape=recognize(points);assert.equal(shape.type,'line');
  assert.ok(Math.abs(deg(Math.atan2(shape.endPt.y-shape.startPt.y,shape.endPt.x-shape.startPt.x))-45)<1e-8);
 }
});
test('Generated closed shapes keep their bounding box for reversed and negative coordinates',()=>{
 for(const type of ['rectangle','triangle','circle'])for(const [startPt,endPt] of [[{x:60,y:70},{x:260,y:230}],[{x:260,y:230},{x:60,y:70}],[{x:-260,y:-230},{x:-60,y:-70}]]){
  const pts=generateVectorShapePoints({type,startPt,endPt});assert.ok(pts.length>2);assert.ok(pts.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.pressure===.5));
  const bounds=[Math.min(...pts.map(p=>p.x)),Math.max(...pts.map(p=>p.x)),Math.min(...pts.map(p=>p.y)),Math.max(...pts.map(p=>p.y))];
  assert.deepEqual(bounds,[Math.min(startPt.x,endPt.x),Math.max(startPt.x,endPt.x),Math.min(startPt.y,endPt.y),Math.max(startPt.y,endPt.y)]);
  assert.ok(Math.hypot(pts[0].x-pts.at(-1).x,pts[0].y-pts.at(-1).y)<1e-8);
 }
});

const traceStroke=stroke=>{
 const calls=[],ctx={save(){},restore(){},beginPath(){calls.push('begin');},moveTo(){},lineTo(){calls.push('line');},closePath(){calls.push('close');},quadraticCurveTo(){calls.push('curve');},stroke(){calls.push({join:this.lineJoin,cap:this.lineCap,limit:this.miterLimit,width:this.lineWidth});}};
 renderStroke(ctx,stroke);return calls;
};
test('New angular shapes use sharp joins and a single path; old ink and circles keep smoothing',()=>{
 for(const type of ['line','rectangle','square','triangle','arrow','polyline','circle','ellipse']){
  const points=generateVectorShapePoints({type,startPt:{x:60,y:70},endPt:{x:260,y:230},vertices:type==='polyline'?[{x:60,y:70},{x:260,y:70},{x:60,y:230}]:undefined});
  const stroke={tool:'pen',color:'#ef4444',width:4,points,isTapered:false},legacy=traceStroke(stroke),tagged=traceStroke({...stroke,shapeType:type});
  assert.ok(legacy.includes('curve'));
  if(type==='circle'||type==='ellipse')assert.deepEqual(tagged,legacy);
  else{assert.ok(!tagged.includes('curve'));const paints=tagged.filter(c=>typeof c==='object');assert.equal(paints.length,1);assert.equal(paints[0].join,'miter');assert.equal(paints[0].cap,'butt');assert.equal(paints[0].limit,10);assert.ok(paints[0].width>0);}
 }
});
test('Moving and precision-erasing sharp geometry preserve its style without closing erased gaps',()=>{
 const stroke={tool:'pen',color:'#ef4444',width:4,isTapered:false,shapeType:'rectangle',points:generateVectorShapePoints({type:'rectangle',startPt:{x:60,y:70},endPt:{x:260,y:230}})};
 const moved=transformStroke(stroke,{dx:20,dy:30,newColor:'#00ff00'});assert.equal(moved.shapeType,'rectangle');assert.equal(moved.points[0].x,80);assert.ok(traceStroke(moved).includes('close'));
 const fragments=eraseStrokesPrecision([stroke],{x:160,y:70},20);assert.equal(fragments.length,2);
 for(const fragment of fragments){assert.equal(fragment.shapeType,'rectangle');assert.ok(!traceStroke(fragment).includes('close'));assert.ok(!traceStroke(fragment).includes('curve'));}
});
