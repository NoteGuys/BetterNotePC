import test from 'node:test';
import assert from 'node:assert/strict';
import { AppCacheService } from '../src/services/appCacheService.js';
import { thumbnailLayout, thumbnailWindow } from '../src/utils/thumbnailWindow.js';
import { pageSummary, trimPageWindow, windowPageIds } from '../src/utils/pageWindow.js';
import { canvasRasterScale, appendedStrokeStart } from '../src/utils/canvasBudget.js';
import { preservePdfOriginals } from '../src/utils/pdfOriginal.js';
test('Preview cache enforces its cap on insert and replacement', () => {
 const c=new AppCacheService(20);c.set('a','12345');c.set('b','12345');assert.equal(c.totalBytes,20);
 c.get('a');c.set('c','12345');assert.equal(c.get('b'),null);assert.equal(c.get('a'),'12345');
 c.set('a','123456789');assert.ok(c.totalBytes<=20);assert.equal(c.get('c'),null);
 assert.equal(c.set('huge','12345678901'),false);assert.ok(c.totalBytes<=20);
});
test('Cache clearing notifies actual preview owners without touching data outside the cache',()=>{
 const c=new AppCacheService(20);let calls=0;const stop=c.subscribeClear(()=>calls++);c.set('a','abc');c.clearAll();
 assert.equal(calls,1);assert.equal(c.totalBytes,0);stop();c.clearAll();assert.equal(calls,1);
});
test('Thumbnail windows stay bounded across 1000 mixed page sizes',()=>{
 const pages=Array.from({length:1000},(_,i)=>({pageWidth:i%2?1200:1600,pageHeight:i%2?1600:900}));
 const offsets=thumbnailLayout(pages,208);
 for(const i of [0,1,500,999]) { const range=thumbnailWindow(offsets,offsets[i],700);assert.ok(range.end-range.start<=12);assert.ok(range.start<=i&&range.end>i); }
 assert.equal(offsets.length,1001);
});
test('Page summaries and trimming retain no heavy media or ink fields',()=>{
 const pages=Array.from({length:100},(_,i)=>({id:String(i),pageIndex:i,pageWidth:1200,strokes:[{points:Array(100)}],pdfPageImage:'large',pdfOriginal:{dataUrl:'large'}}));
 const wanted=windowPageIds(pages,50,2),trimmed=trimPageWindow(pages,wanted);
 assert.equal(trimmed.filter(p=>!p.__unloaded).length,5);assert.equal(trimmed[0].pdfOriginal,undefined);assert.equal(trimmed[0].strokes,undefined);
 assert.equal(trimmed[50],pages[50]);assert.equal(pageSummary(pages[0]).pageWidth,1200);
});
test('Canvas budgets cap three layers while leaving normal page coordinates intact',()=>{
 for(const [w,h,dpr]of [[1200,1600,2],[3000,4000,3],[30000,50000,2],[1e9,1e9,2]]) {
  const scale=canvasRasterScale(w,h,dpr,12*1048576);assert.ok(w*h*scale*scale*12<=12*1048576+1);assert.ok(w*scale<=16384);assert.ok(h*scale<=16384);
 }
 assert.equal(canvasRasterScale(1200,1600,2),2);
});
test('Incremental rendering accepts only an unchanged prefix',()=>{
 const a={},b={},c={};assert.equal(appendedStrokeStart([a,b],[a,b,c]),2);assert.equal(appendedStrokeStart([a,b],[a,c,b]),-1);
 assert.equal(appendedStrokeStart([a,b],[a]),-1);assert.equal(appendedStrokeStart([a,b],[a,b]),-1);
});
const source={id:'pdf-1',name:'synthetic.pdf',dataUrl:'data:application/pdf;base64,c3ludGhldGlj'};
test('Deleting the original PDF owner transfers bytes to a remaining PDF page',()=>{
 const removed={id:'p0',pdfOriginalId:source.id,pdfOriginal:source};
 const pages=[{id:'p1',pdfOriginalId:source.id},{id:'blank'}],result=preservePdfOriginals(pages,removed);
 assert.deepEqual(result[0].pdfOriginal,source);assert.equal(pages[0].pdfOriginal,undefined);
});
test('Undo/duplicate cannot multiply an original payload in one notebook',()=>{
 const pages=[{id:'p0',pdfOriginalId:source.id,pdfOriginal:source},{id:'p1',pdfOriginalId:source.id,pdfOriginal:source}];
 assert.equal(preservePdfOriginals(pages).filter(p=>p.pdfOriginal).length,1);assert.equal(pages.filter(p=>p.pdfOriginal).length,2);
});


test('Preview fallbacks keep small local images, reject remote URLs and full-sized media',()=>{
 const local='data:image/jpeg;base64,c3ludGhldGlj';
 assert.equal(pageSummary({id:'p',thumbnailUrl:local,pdfPageImage:'heavy'}).thumbnailUrl,local);
 for(const thumbnailUrl of ['https://example.invalid/private.png','file:///private.png','data:image/jpeg;base64,'+'a'.repeat(256*1024)]) {
  assert.equal(pageSummary({id:'p',thumbnailUrl}).thumbnailUrl,undefined);
 }
});
