const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs').promises,path=require('node:path');
const {createBackupWriter,notebookBackupRevision}=require('../electron/backupWriter.cjs'),{createBackupReader}=require('../electron/backupReader.cjs');
const qa=process.env.BETTERNOTE_QA_TEMP;if(!qa)throw Error('Isolated QA folder required');
const device=id=>({id,name:id==='device-a-0001'?'Desktop':'Surface'});
const note=(id,time=10)=>({id,name:id,updatedAt:time,pageCount:1,pages:[{id:id+'-p',notebookId:id,pageIndex:0,updatedAt:time,strokes:[],textElements:[],imageElements:[]}]});
const revision=(notes,folders=[])=>JSON.stringify([JSON.stringify(folders),notes.map(notebookBackupRevision)]);
async function complete(writer,notes,id='device-a-0001',extra={}){
 const jobId='round-'+Math.random();let result=await writer.execute({action:'begin',jobId,phase:'data',backupDevice:device(id),metadata:{folders:[],notebooks:notes,...extra.metadata},metadataRevision:revision(notes,extra.metadata?.folders),...extra});
 if(!result.success)return result;
 for(const n of notes){result=await writer.execute({action:'notebook',jobId,notebook:n});if(!result.success)return result;}
 return writer.execute({action:'finish',jobId});
}
const root=()=>fs.mkdtemp(path.join(qa,'betternote-devices-'));
const read=folderPath=>createBackupReader().execute({folderPath});
const scoped=(r,id='device-a-0001')=>path.join(r,'Devices',id);
test('Two machines use the same selected directory without replacing each other or old shared backup',async()=>{
 const r=await root(),w=createBackupWriter({localDir:r});
 const legacy=Buffer.from('keep original');await fs.mkdir(path.join(r,'Full_System'));await fs.writeFile(path.join(r,'Full_System','legacy.json'),legacy);
 assert.equal((await complete(w,[note('same',500)])).success,true);const before=await fs.readFile(path.join(scoped(r),'Full_System','backup_manifest.json'));
 assert.equal((await complete(w,[{...note('same',1),name:'Surface work'}],'device-b-0001')).success,true);
 assert.deepEqual(await fs.readFile(path.join(scoped(r),'Full_System','backup_manifest.json')),before);
 assert.equal((await read(scoped(r))).data.notebooks[0].name,'same');assert.equal((await read(scoped(r,'device-b-0001'))).data.notebooks[0].name,'Surface work');
 assert.deepEqual(await fs.readFile(path.join(r,'Full_System','legacy.json')),legacy);
 const sources=await createBackupReader().execute({folderPath:r,listDevices:true});assert.equal(sources.success,true);assert.deepEqual(new Set(sources.folders.map(s=>s.deviceName)),new Set(['Desktop','Surface']));
});
test('Deleted notebook is absent from the next backup; older generation remains explicitly restorable',async()=>{
 const r=await root(),w=createBackupWriter({localDir:r});await complete(w,[note('a'),note('b')]);
 assert.equal((await complete(w,[note('b')],undefined,{metadata:{folders:[],notebooks:[note('b')],deletedNotebooks:[{id:'a',deletedAt:20}]}})).success,true);
 const result=await read(scoped(r));assert.equal(result.success,true,JSON.stringify(result));assert.deepEqual(result.data.notebooks.map(n=>n.id),['b']);
 const m=JSON.parse(await fs.readFile(path.join(scoped(r),'Full_System','backup_manifest.json')));assert.equal(m.notebooks.a,undefined);assert.equal(m.deletedNotebooks[0].id,'a');
 assert.ok((await fs.readdir(path.join(scoped(r),'Backup_History','Manifests'))).length);
});
test('Deleting the last notebook publishes a valid empty backup instead of keeping it alive',async()=>{
 const r=await root(),w=createBackupWriter({localDir:r});await complete(w,[note('a')]);
 assert.equal((await complete(w,[])).success,true);const result=await read(scoped(r));assert.equal(result.success,true,JSON.stringify(result));assert.equal(result.data.notebooks.length,0);
});
test('Missing editable or full snapshot is rebuilt from local work; no recovery is required',async()=>{
 const r=await root(),w=createBackupWriter({localDir:r});await complete(w,[note('a')]);const file=path.join(scoped(r),'Full_System','backup_manifest.json');
 let m=JSON.parse(await fs.readFile(file));await fs.unlink(path.join(scoped(r),m.notebooks.a.editable.path));
 assert.equal((await complete(w,[note('a')])).success,true);assert.equal((await read(scoped(r))).success,true);
 m=JSON.parse(await fs.readFile(file));await fs.unlink(path.join(scoped(r),m.fullPath));
 assert.equal((await complete(w,[note('a')])).success,true);assert.equal((await read(scoped(r))).success,true);
});
test('Backup selection that has not been created yet can be created without unsafe ancestor rejection',async()=>{
 const r=await root(),selected=path.join(r,'new','local'),w=createBackupWriter({localDir:selected});assert.equal((await complete(w,[note('a')])).success,true);assert.equal((await read(scoped(selected))).success,true);
});
test('Restore of an older notebook or folder can be backed up on its own device without a timestamp conflict',async()=>{
 const r=await root(),w=createBackupWriter({localDir:r});const folder={id:'f',name:'newer',updatedAt:500};
 await complete(w,[{...note('a',500),folderId:'f'}],undefined,{metadata:{folders:[folder],notebooks:[{...note('a',500),folderId:'f'}]}});
 const old={...note('a',1),folderId:'f'};assert.equal((await complete(w,[old],undefined,{metadata:{folders:[{...folder,name:'older',updatedAt:1}],notebooks:[old]}})).success,true);
 const result=await read(scoped(r));assert.equal(result.success,true,JSON.stringify(result));assert.equal(result.data.folders[0].name,'older');
});
test('Invalid device identifiers cannot escape the selected folder',async()=>{
 const r=await root(),w=createBackupWriter({localDir:r});const result=await complete(w,[note('a')],'../escape');assert.equal(result.success,false);assert.equal(result.reason,'invalid-backup-device');
});
test('An unavailable Local target does not prevent the Drive generation being committed',async()=>{
 const r=await root(),local=path.join(r,'blocked'),drive=path.join(r,'drive');await fs.writeFile(local,'not a folder');
 const w=createBackupWriter({localDir:local}),result=await complete(w,[note('a')],undefined,{driveBackupPath:drive});
 assert.equal(result.targets.find(t=>t.kind==='drive').dataSuccess,true,JSON.stringify(result));assert.ok(result.targets.find(t=>t.kind==='local').error);
 assert.equal((await read(scoped(drive))).success,true);
});

test('A linked Devices directory outside the selection is refused by both writer and discovery',async()=>{
 const r=await root(),outside=await root();await fs.symlink(outside,path.join(r,'Devices'),'junction');const w=createBackupWriter({localDir:r});
 const result=await complete(w,[note('a')]);assert.equal(result.success,false);assert.equal(result.targets[0].error,'unsafe-backup-path');
 assert.equal((await createBackupReader().execute({folderPath:r,listDevices:true})).reason,'unsafe-backup-path');assert.deepEqual(await fs.readdir(outside),[]);
});
test('Per-device history retains current plus three completed generations after deletion',async()=>{
 const r=await root(),w=createBackupWriter({localDir:r});for(let time=1;time<=5;time++)assert.equal((await complete(w,[note('a',time)])).success,true);
 assert.equal((await complete(w,[])).success,true);assert.equal((await fs.readdir(path.join(scoped(r),'Backup_History','Manifests'))).length,3);
 assert.deepEqual(await fs.readdir(path.join(scoped(r),'Editable_Notes')),[]);assert.equal((await read(scoped(r))).data.notebooks.length,0);
});
