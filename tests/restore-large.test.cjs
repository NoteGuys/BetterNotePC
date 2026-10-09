// Synthetic recovery I/O, slow cloud and cancellation. Never accesses real notes/Drive.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs').promises,path=require('node:path');
const {EventEmitter}=require('node:events');
const {createBackupWriter}=require('../electron/backupWriter.cjs');
const {createBackupReader}=require('../electron/backupReader.cjs');
const {createBackupReaderClient}=require('../electron/backupReaderClient.cjs');
const qa=process.env.BETTERNOTE_QA_TEMP;if(!qa||!path.isAbsolute(qa))throw Error('Set isolated QA directory');
const note=(id,pages=1,payload='')=>({id,name:'QA '+id,updatedAt:10,folderId:'class',pageCount:pages,pages:Array.from({length:pages},(_,i)=>({id:id+'-p'+i,notebookId:id,pageIndex:i,pageWidth:1200,pageHeight:1697,strokes:[{color:'#ff0000',width:2,points:[{x:3,y:4,pressure:.5},{x:20,y:30,pressure:.8}]}],textElements:[{id:'t',text:'ทดสอบ page '+i,x:50,y:40}],imageElements:[{id:'img',locked:true,src:'data:image/jpeg;base64,'+payload}]}))});
async function fixture(notes=[note('n')]){
 const selected=await fs.mkdtemp(path.join(qa,'betternote-large-restore-')),device={id:'qa-surface-device',name:'Surface QA'},root=path.join(selected,'Devices',device.id),writer=createBackupWriter({localDir:selected});
 const metadata={folders:[{id:'class',name:'Lecture Notes',parentId:null}],notebooks:notes.map(({pages,...n})=>n)};
 const begin=await writer.execute({action:'begin',jobId:'qa',backupDevice:device,metadata,metadataRevision:'revision',phase:'data'});assert.equal(begin.success,true,JSON.stringify(begin));
 for(const n of notes)assert.equal((await writer.execute({action:'notebook',jobId:'qa',notebook:n})).success,true);
 assert.equal((await writer.execute({action:'finish',jobId:'qa',metadataRevision:'revision'})).success,true);
 const manifestPath=path.join(root,'Full_System/backup_manifest.json'),manifest=JSON.parse(await fs.readFile(manifestPath));
 return{root,manifest,manifestPath,notes};
}
const read=(root,options={})=>createBackupReader(options).execute({folderPath:root,encodedRecovery:true,snapshotRecovery:true});
const decode=result=>JSON.parse(new TextDecoder().decode(result.encoded));
test('91-page rich notebook and ten other notebooks restore with one snapshot read, preserving all data',async()=>{
 const notes=[note('large',91,'A'.repeat(Number(process.env.BETTERNOTE_QA_RESTORE_PAYLOAD_KB||256)*1024)),...Array.from({length:10},(_,i)=>note('small'+i,3,'B'.repeat(1024)))];
 const{root,manifest}=await fixture(notes),opens=[],events=[];
 const result=await read(root,{onProgress:p=>events.push(p),fs:{...fs,open:async(...args)=>{opens.push(path.relative(root,args[0]));return fs.open(...args);},readdir:async()=>{throw Error('Should not read copy directories');}}});
 assert.equal(result.success,true,JSON.stringify({...result,encoded:undefined}));assert.equal(result.count,11);assert.deepEqual(decode(result).notebooks,notes);
 assert.deepEqual(opens.sort(),[path.join('Full_System','backup_manifest.json'),path.normalize(manifest.fullPath)].sort());
 assert.ok(events.some(p=>p.stage==='reading'&&p.bytesDone>1048576));assert.equal(events.at(-1).notebooksDone,11);
 console.log('Synthetic snapshot bytes: '+result.encoded.byteLength+'; opens: '+opens.length);
});
test('Intact full snapshot can restore before editable copies/PDF exports hydrate, strict verification still rejects missing copies',async()=>{
 const{root,manifest}=await fixture();await fs.unlink(path.join(root,manifest.notebooks.n.editable.path));
 assert.equal((await read(root)).success,true);
 const strict=await createBackupReader().execute({folderPath:root});assert.equal(strict.success,false);assert.equal(strict.reason,'backup-incomplete');
});
test('Corrupt full snapshot or mismatch with notebook manifest exposes no payload',async()=>{
 for(const mode of ['corrupt','mismatch','count']){
 const{root,manifest,manifestPath}=await fixture();
 if(mode==='corrupt')await fs.writeFile(path.join(root,manifest.fullPath),'damaged');
 else {if(mode==='mismatch')manifest.notebooks.n.editable.hash='0'.repeat(64);else manifest.activeIds=[];await fs.writeFile(manifestPath,JSON.stringify(manifest));}
 const result=await read(root);assert.equal(result.success,false,mode);assert.equal(result.encoded,undefined);assert.equal(result.data,undefined);
 }
});
test('A generation changed during read cannot commit mixed data',async()=>{
 const{root,manifest,manifestPath}=await fixture();let changed=false;
 const result=await read(root,{fs:{...fs,open:async(file,...args)=>{
 const h=await fs.open(file,...args);if(file.endsWith(path.basename(manifest.fullPath))){const read=h.read.bind(h);h.read=async(...args)=>{const result=await read(...args);if(!changed){changed=true;await fs.writeFile(manifestPath,JSON.stringify({...manifest,lastDataSuccess:manifest.lastDataSuccess+1}));}return result;};}return h;
 }}});assert.equal(result.success,false);assert.equal(result.reason,'backup-changed-during-read');assert.equal(result.encoded,undefined);
});
test('Slow open makes recovery progress visible, stalled open remains bounded',async()=>{
 const{root}=await fixture(),events=[];
 const slow=await read(root,{deadlineMs:100,onProgress:p=>events.push(p),fs:{...fs,open:async(...a)=>{await new Promise(r=>setTimeout(r,15));return fs.open(...a);}}});assert.equal(slow.success,true);assert.ok(events.some(p=>p.stage==='opening'));
 const stalled=await read(root,{deadlineMs:5,fs:{...fs,open:()=>new Promise(()=>{})}});assert.equal(stalled.reason,'backup-read-timeout');
});
class ProgressWorker extends EventEmitter {
 constructor(){super();this.timers=[];}
 unref(){}
 postMessage({requestId}) {for(let n=1;n<=12;n++)this.timers.push(setTimeout(()=>this.emit('message',{requestId,progress:{stage:'reading',bytesDone:n,totalBytes:12}}),n*15));this.timers.push(setTimeout(()=>this.emit('message',{requestId,result:{success:true}}),200));}
 terminate(){this.timers.forEach(clearTimeout);return Promise.resolve();}
}
test('Healthy long read is governed by inactivity rather than a total-duration ceiling',async()=>{
 const client=createBackupReaderClient({timeoutMs:70,WorkerClass:ProgressWorker});let pulses=0;
 try{assert.equal((await client.execute({},()=>pulses++)).success,true);assert.equal(pulses,12);}finally{await client.close();}
});
test('An explicit total limit remains available for diagnostics; reports last byte progress',async()=>{
 const client=createBackupReaderClient({timeoutMs:70,maxDurationMs:100,WorkerClass:ProgressWorker});
 try{const result=await client.execute({});assert.equal(result.reason,'backup-read-timeout');assert.ok(result.diagnostics.bytesDone>0);}finally{await client.close();}
});
test('Native cancellation terminates an active read and never returns a late successful payload',async()=>{
 const client=createBackupReaderClient({timeoutMs:70,WorkerClass:ProgressWorker});const pending=client.execute({});await client.cancel();assert.equal((await pending).reason,'backup-recovery-cancelled');
 try{assert.equal((await client.execute({})).success,true);}finally{await client.close();}
});


test('Small snapshots use an independently transferable buffer in the real native worker',async()=>{
 const{root,notes}=await fixture();const client=createBackupReaderClient();try{const result=await client.execute({folderPath:root,encodedRecovery:true,snapshotRecovery:true});assert.equal(result.success,true,JSON.stringify({...result,encoded:undefined}));assert.deepEqual(decode(result).notebooks,notes);}finally{await client.close();}
});
