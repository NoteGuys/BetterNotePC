import test from 'node:test';import assert from 'node:assert/strict';
import {backupPdfPageKey,backupPdfSourceKeys} from '../src/services/backupPdfPageCache.js';
const note={id:'n',name:'Original',folderId:'a',updatedAt:1,templateId:'blank',pages:[]};
const page={id:'p',pageIndex:0,updatedAt:1,pageWidth:480,pageHeight:620,strokes:[{points:[{x:1,y:2}]}],textElements:[],imageElements:[]};
test('PDF page cache follows visible content rather than names, locations, timestamps or page order',async()=>{
 const key=await backupPdfPageKey(note,page);
 assert.equal(await backupPdfPageKey({...note,name:'Renamed',folderId:'b',updatedAt:20},{...page,updatedAt:30,pageIndex:90,isFavorite:true}),key);
 for(const changed of [{...page,strokes:[{points:[{x:99,y:2}]}]},{...page,pageWidth:620},{...page,paperColor:'#222'},{...page,textElements:[{text:'Changed'}]},{...page,imageElements:[{src:'image changed'}]}])assert.notEqual(await backupPdfPageKey(note,changed),key);
});
test('Portable original PDF content changes invalidate every dependent page',async()=>{
 const original={id:'source',dataUrl:'data:application/pdf;base64,old'},p={...page,pdfOriginalId:'source',pdfPageNumber:2};
 const first=await backupPdfSourceKeys({pages:[{pdfOriginal:original}]});
 const second=await backupPdfSourceKeys({pages:[{pdfOriginal:{...original,dataUrl:'different'}}]});
 assert.notEqual(await backupPdfPageKey(note,p,first),await backupPdfPageKey(note,p,second));
});
