import test from 'node:test';
import assert from 'node:assert/strict';
import {SvgCanvas} from '../src/utils/svgCanvas.js';
import {renderStroke} from '../src/utils/inkingEngine.js';
const pen={tool:'pen',color:'#123456',width:4,isTapered:false,usePressure:false,points:[{x:10,y:10,pressure:.5},{x:20,y:10,pressure:.5},{x:30,y:20,pressure:.5}]};
const render=(stroke,enabled)=>{const ctx=new SvgCanvas({explicitRoundCaps:enabled});renderStroke(ctx,stroke);return ctx.toString();};
test('Vector export adds filled caps while retaining exact original stroke commands and source data',()=>{
 const original=JSON.stringify(pen),before=render(pen,false),after=render(pen,true);
 assert.equal(after.replace(/<path data-ink-caps="true"[^>]+\/>/g,''),before);
 assert.equal(JSON.stringify(pen),original);
 assert.match(after,/data-ink-caps/);
 const caps=after.match(/data-ink-caps="true" d="([^"]+)"/)[1];
 assert.equal((caps.match(/M /g)||[]).length,4); // duplicate adjacent endpoints coalesce
 assert.equal((caps.match(/ C /g)||[]).length,16);
});
test('Markers, dots and angular shapes keep their existing geometry and blending',()=>{
 for(const stroke of [{...pen,color:'#12345680'},{...pen,color:'rgba(20,30,40,0.5)'},{...pen,tool:'highlighter',highlighterTip:'round'},{...pen,tool:'highlighter',highlighterTip:'square'},{...pen,shapeType:'rectangle'},{...pen,points:pen.points.slice(0,1)}])assert.equal(render(stroke,true),render(stroke,false));
});
test('Caps respect paint order and never bridge separated erased stroke fragments',()=>{
 const ctx=new SvgCanvas({explicitRoundCaps:true});renderStroke(ctx,{...pen,points:pen.points.slice(0,2)});
 ctx.fillStyle='#fff';ctx.fillRect(0,0,40,40);
 renderStroke(ctx,{...pen,color:'#ff0000',points:[{x:100,y:100,pressure:.5},{x:110,y:100,pressure:.5}]});
 const s=ctx.toString();assert.ok(s.indexOf('data-ink-caps')<s.indexOf('<rect'));
 assert.ok(s.lastIndexOf('data-ink-caps')>s.indexOf('<rect'));
 assert.equal((s.match(/data-ink-caps/g)||[]).length,2);
 assert.equal(ctx.roundCaps.size,0);assert.equal(ctx.stack.length,0);
 assert.equal(ctx.toString(),s);
});
