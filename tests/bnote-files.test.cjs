const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createBnoteSaver}=require('../electron/bnoteSave.cjs');
const root=process.env.BETTERNOTE_QA_TEMP;if(!root)throw Error('Isolated QA directory required');
const data=()=>({format:'BetterNote_Document',version:1,notebook:{id:'qa-note',name:'ภาษาไทย # %',pageCount:91},pages:Array.from({length:91},(_,i)=>({id:'qa-p'+i,notebookId:'qa-note',pageIndex:i,strokes:[{points:[{x:i,y:2}]}],textElements:[{text:'ข้อความ '+i}],imageElements:[],pageWidth:i%2?1600:1200,pageHeight:i%2?1200:1600}))});
const bytes=value=>new TextEncoder().encode(JSON.stringify(value));
test('Portable and legacy formats preserve all 91 pages; empty/truncated/missing pages are refused',async()=>{
 const {decodeBnote}=await import('../electron/bnoteFormat.js');const exported=data();assert.equal(decodeBnote(bytes(exported)).pages.length,91);
 assert.equal(decodeBnote(bytes({...exported.notebook,pages:exported.pages})).name,exported.notebook.name);
 for(const broken of [new Uint8Array(),bytes(exported).slice(0,-1),new TextEncoder().encode('{'),bytes({...exported,pages:exported.pages.slice(0,90)})])assert.throws(()=>decodeBnote(broken));
 const bom=Buffer.concat([Buffer.from([239,187,191]),Buffer.from(bytes(exported))]);assert.equal(decodeBnote(bom).pages.length,91);
});
test('Native chunked save verifies exact bytes, Unicode path, replacement and immediate readback',async()=>{
 const dir=await fs.mkdtemp(path.join(root,'bnote-native-')),file=path.join(dir,'ภาษาไทย % #.bnote');const original=Buffer.from('existing file');await fs.writeFile(file,original);
 const saver=createBnoteSaver({dialog:{showSaveDialog:async()=>({filePath:file})},getWindow:()=>null});
 try{
  const payload=data();payload.pages[0].textElements.push({text:'text '.repeat(500000)});const raw=bytes(payload),begin=await saver.execute({action:'begin',name:'ชื่อ.bnote',size:raw.byteLength});assert.equal(begin.success,true);
  assert.equal((await saver.execute({action:'begin',name:'other.bnote',size:10})).reason,'bnote-save-busy');
  for(let offset=0;offset<raw.byteLength;offset+=2*1048576){const chunk=raw.slice(offset,offset+2*1048576);assert.equal((await saver.execute({action:'chunk',id:begin.id,offset,bytes:chunk.buffer})).success,true);}
  assert.equal((await saver.execute({action:'finish',id:begin.id})).success,true);assert.deepEqual(await fs.readFile(file),Buffer.from(raw));
  const begin2=await saver.execute({action:'begin',name:'ชื่อ.bnote',size:1});assert.equal(begin2.success,true);await saver.execute({action:'chunk',id:begin2.id,offset:0,bytes:new TextEncoder().encode('{').buffer});assert.equal((await saver.execute({action:'finish',id:begin2.id})).success,false);assert.deepEqual(await fs.readFile(file),Buffer.from(raw));
  assert.deepEqual(await fs.readdir(dir),[path.basename(file)]);
 }finally{saver.dispose();}
});
test('Cancelled save, invalid chunk order and abort preserve the previous file',async()=>{
 const dir=await fs.mkdtemp(path.join(root,'bnote-cancel-')),file=path.join(dir,'keep.bnote');await fs.writeFile(file,'kept');let cancel=true;
 const saver=createBnoteSaver({dialog:{showSaveDialog:async()=>cancel?{canceled:true}:{filePath:file}},getWindow:()=>null});
 try{
  assert.equal((await saver.execute({action:'begin',name:'test.bnote',size:1})).cancelled,true);cancel=false;
  const begun=await saver.execute({action:'begin',name:'test.bnote',size:1});assert.equal((await saver.execute({action:'chunk',id:begun.id,offset:1,bytes:new Uint8Array([123]).buffer})).success,false);
  assert.equal(await fs.readFile(file,'utf8'),'kept');assert.deepEqual(await fs.readdir(dir),['keep.bnote']);
 }finally{saver.dispose();}
});

test('An external change during export is preserved and an incomplete save cannot replace it',async()=>{
 const dir=await fs.mkdtemp(path.join(root,'bnote-concurrent-')),file=path.join(dir,'note.bnote');await fs.writeFile(file,'old');
 const saver=createBnoteSaver({dialog:{showSaveDialog:async()=>({filePath:file})},getWindow:()=>null});
 try{const raw=bytes(data()),begin=await saver.execute({action:'begin',name:'note.bnote',size:raw.byteLength});await saver.execute({action:'chunk',id:begin.id,offset:0,bytes:raw.buffer});await fs.writeFile(file,'external edit');assert.equal((await saver.execute({action:'finish',id:begin.id})).success,false);assert.equal(await fs.readFile(file,'utf8'),'external edit');}
 finally{saver.dispose();}
});
