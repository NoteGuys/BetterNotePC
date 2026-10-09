import test from 'node:test';
import assert from 'node:assert/strict';
import { createTouchGuard, createTwoFingerTap, normalizeWheel, createWheelPageGate } from '../src/utils/touchNavigation.js';
const finger=(identifier,x=100,y=100)=>({identifier,clientX:x,clientY:y});
test('A palm held during pen input stays blocked; a fresh touch after release works immediately',()=>{
 const guard=createTouchGuard(),palm=finger(1),fresh=finger(2);
 assert.deepEqual(guard.update([palm],true),[]);assert.deepEqual(guard.update([palm],false),[]);
 guard.update([]);assert.deepEqual(guard.update([fresh]),[fresh]);
});
test('Pen input blocks contacts that started before it and keeps only the live contact IDs',()=>{
 const guard=createTouchGuard(),a=finger(1),b=finger(2);guard.update([a]);guard.block();
 assert.deepEqual(guard.update([a,b]),[b]);guard.update([]);assert.equal(guard.size,0);assert.deepEqual(guard.update([a]),[a]);
});
test('Two-finger Undo allows naturally staggered finger placement and release exactly once',()=>{
 let time=0;const tap=createTwoFingerTap(()=>time),a=finger(1),b=finger(2,180);
 const once=()=>{tap.start([a]);time+=90;tap.start([a,b]);time+=40;assert.equal(tap.end([b]),false);time+=20;return tap.end([]);};
 assert.equal(once(),false);time+=70;assert.equal(once(),true);time+=70;assert.equal(once(),false);
});
for(const kind of ['move','cancel','third finger','long hold','late second finger','release jump'])test('Undo ignores '+kind+' and resets a preceding tap',()=>{
 let time=0;const tap=createTwoFingerTap(()=>time),a=finger(1),b=finger(2,180);
 tap.start([a,b]);time=50;tap.end([]);time=100;
 tap.start([a]);if(kind==='late second finger')time+=200;
 tap.start([a,b]);
 if(kind==='move'||kind==='release jump')tap.move([finger(1,130),b]);
 if(kind==='cancel')tap.cancel();
 if(kind==='third finger')tap.start([a,b,finger(3,260)]);
 if(kind==='long hold')time+=500;
 time+=50;assert.equal(tap.end([]),false);
 time+=50;tap.start([a,b]);time+=50;assert.equal(tap.end([]),false);
});
test('A full touchpad gesture including a long inertial tail turns only one page',()=>{
 let time=0;const gate=createWheelPageGate(()=>time),values=[];
 for(const delta of [10,15,20,80,40,20,10,5]){values.push(gate.push(delta));time+=120;}
 assert.deepEqual(values,[0,0,1,0,0,0,0,0]);time+=221;assert.equal(gate.push(-50),-1);
});
test('Wheel direction changes restart accumulation; subthreshold jitter does not flip',()=>{
 let time=0;const gate=createWheelPageGate(()=>time);
 assert.equal(gate.push(30),0);time+=20;assert.equal(gate.push(-25),0);time+=20;assert.equal(gate.push(-20),-1);
});
test('Wheel units are normalized for pixel, line and page devices',()=>{
 assert.deepEqual(normalizeWheel({deltaX:2,deltaY:3,deltaMode:0},700),{x:2,y:3});
 assert.deepEqual(normalizeWheel({deltaX:2,deltaY:3,deltaMode:1},700),{x:32,y:48});
 assert.deepEqual(normalizeWheel({deltaX:2,deltaY:3,deltaMode:2},700),{x:1400,y:2100});
});

test('Suspending clears stale live contacts but still rejects a held palm on the next event',()=>{
 const guard=createTouchGuard(),palm=finger(1);guard.update([palm]);guard.suspend();assert.equal(guard.size,0);
 assert.deepEqual(guard.update([palm]),[]);guard.update([]);assert.deepEqual(guard.update([finger(2)]),[finger(2)]);
});
