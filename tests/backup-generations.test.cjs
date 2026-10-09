const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs').promises,path=require('node:path');
const {createBackupWriter,notebookBackupRevision}=require('../electron/backupWriter.cjs');
const {createBackupReader}=require('../electron/backupReader.cjs');
const qa=process.env.BETTERNOTE_QA_TEMP;if(!qa)throw Error('Isolated QA folder required');
const note=(id,time)=>({id,name:id,updatedAt:time,pageCount:1,pages:[{id:id+'-p',notebookId:id,pageIndex:0,strokes:[{id:'s',points:[{x:time,y:1}]}],textElements:[],imageElements:[]}]});
async function start(writer,id,notes){return writer.execute({action:'begin',jobId:id,phase:'data',metadata:{folders:[],notebooks:notes.map(n=>({...n,pages:undefined}))},metadataRevision:JSON.stringify(['[]',notes.map(notebookBackupRevision)])});}
async function complete(writer,id,notes){assert.equal((await start(writer,id,notes)).success,true);for(const n of notes)assert.equal((await writer.execute({action:'notebook',jobId:id,notebook:n})).success,true);return writer.execute({action:'finish',jobId:id});}
async function restored(root){const read=await createBackupReader().execute({folderPath:root});assert.equal(read.success,true,JSON.stringify(read));return read.data.notebooks;}
test('Interrupted new generation preserves the published manifest and restores all previous ink',async()=>{
 const root=await fs.mkdtemp(path.join(qa,'betternote-generation-')),writer=createBackupWriter({localDir:root}),old=[note('a',10),note('b',10)];assert.equal((await complete(writer,'old',old)).success,true);
 const manifest=path.join(root,'Full_System/backup_manifest.json'),before=await fs.readFile(manifest);assert.equal((await start(writer,'interrupted',[note('a',20),note('b',20)])).success,true);assert.equal((await writer.execute({action:'notebook',jobId:'interrupted',notebook:note('a',20)})).success,true);
 assert.deepEqual(await fs.readFile(manifest),before);assert.deepEqual(await restored(root),old);await writer.execute({action:'abort',jobId:'interrupted'});assert.deepEqual(await restored(root),old);
 const next=createBackupWriter({localDir:root});assert.equal((await complete(next,'retry',[note('a',20),note('b',20)])).success,true);assert.deepEqual(await restored(root),[note('a',20),note('b',20)]);
});
test('Failure publishing a new complete snapshot leaves the last completed generation restorable',async()=>{
 const root=await fs.mkdtemp(path.join(qa,'betternote-generation-'));assert.equal((await complete(createBackupWriter({localDir:root}),'old',[note('a',10)])).success,true);
 const writer=createBackupWriter({localDir:root,beforeReplace:async({relative})=>{if(relative.startsWith('Full_System')&&relative.includes('Backup--'))throw Object.assign(Error(),{code:'ENOSPC'});}});
 assert.equal((await complete(writer,'fails',[note('a',20)])).success,false);assert.deepEqual(await restored(root),[note('a',10)]);
});
test('A damaged convenience copy cannot invalidate the committed immutable snapshot',async()=>{
 const root=await fs.mkdtemp(path.join(qa,'betternote-generation-'));assert.equal((await complete(createBackupWriter({localDir:root}),'old',[note('a',10)])).success,true);await fs.writeFile(path.join(root,'Full_System/BetterNote_Latest_Backup.json'),'{partial');assert.deepEqual(await restored(root),[note('a',10)]);
});


test('An incomplete cloud arrival offers only a fully verified previous generation on explicit request',async()=>{
 const root=await fs.mkdtemp(path.join(qa,'betternote-generation-')),writer=createBackupWriter({localDir:root});
 assert.equal((await complete(writer,'old',[note('a',10)])).success,true);assert.equal((await complete(writer,'new',[note('a',20)])).success,true);
 const manifestFile=path.join(root,'Full_System/backup_manifest.json'),bytes=await fs.readFile(manifestFile),manifest=JSON.parse(bytes);
 await fs.unlink(path.join(root,manifest.notebooks.a.editable.path));const reader=createBackupReader();assert.equal((await reader.execute({folderPath:root})).success,false);
 const previous=await reader.execute({folderPath:root,allowPrevious:true});assert.equal(previous.success,true,JSON.stringify(previous));assert.ok(previous.previousGeneration.savedAt);assert.deepEqual(previous.data.notebooks,[note('a',10)]);assert.deepEqual(await fs.readFile(manifestFile),bytes);
 const archived=path.join(root,'Backup_History','Editable_Notes'),files=await fs.readdir(archived);for(const file of files.filter(f=>f.endsWith('.bnote')))await fs.writeFile(path.join(archived,file),'{}');
 assert.equal((await reader.execute({folderPath:root,allowPrevious:true})).success,false);
});
test('A concurrent commit invalidates the other job without losing its staged bytes',async()=>{
 const root=await fs.mkdtemp(path.join(qa,'betternote-generation-'));await complete(createBackupWriter({localDir:root}),'seed',[note('a',10)]);
 const a=createBackupWriter({localDir:root}),b=createBackupWriter({localDir:root});await start(a,'A',[note('a',20)]);await start(b,'B',[note('a',30)]);
 await a.execute({action:'notebook',jobId:'A',notebook:note('a',20)});const staged=await b.execute({action:'notebook',jobId:'B',notebook:note('a',30)});assert.equal(staged.success,true);
 assert.equal((await a.execute({action:'finish',jobId:'A'})).success,true);assert.equal((await b.execute({action:'finish',jobId:'B'})).success,false);assert.deepEqual(await restored(root),[note('a',20)]);
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,staged.targets[0].notebooks.a.editable.path))),note('a',30));
});


test('Manual recovery can transfer validated bytes without cloning rich notebooks through the UI',async()=>{
 const root=await fs.mkdtemp(path.join(qa,'betternote-generation-'));await complete(createBackupWriter({localDir:root}),'data',[note('a',10)]);
 const result=await createBackupReader().execute({folderPath:root,encodedRecovery:true});assert.equal(result.success,true);assert.equal(result.data,undefined);assert.ok(result.encoded instanceof Uint8Array);assert.deepEqual(JSON.parse(new TextDecoder().decode(result.encoded)).notebooks,[note('a',10)]);
});


test('An existing four-generation folder is organized even on an unchanged backup',async()=>{
 const root=await fs.mkdtemp(path.join(qa,'betternote-history-')),writer=createBackupWriter({localDir:root});
 for(let time=1;time<=4;time++)await complete(writer,'round-'+time,[note('a',time)]);
 // Simulate the older installed version, which stored history alongside current files.
 for(const dir of ['Editable_Notes','Full_System'])for(const file of await fs.readdir(path.join(root,'Backup_History',dir)))await fs.rename(path.join(root,'Backup_History',dir,file),path.join(root,dir,file));
 for(const [directory,oldDirectory] of [['Manifests','backup_manifest.json'],['System_Copies','BetterNote_Latest_Backup.json']]){
  const dest=path.join(root,'Full_System','.history',oldDirectory);await fs.mkdir(dest,{recursive:true});
  for(const file of await fs.readdir(path.join(root,'Backup_History',directory)))await fs.rename(path.join(root,'Backup_History',directory,file),path.join(dest,file));
 }
 const manifest=await fs.readFile(path.join(root,'Full_System/backup_manifest.json'));
 await complete(createBackupWriter({localDir:root}),'unchanged',[note('a',4)]);
 assert.deepEqual(await fs.readFile(path.join(root,'Full_System/backup_manifest.json')),manifest);
 assert.equal((await fs.readdir(path.join(root,'Editable_Notes'))).length,1);
 assert.equal((await fs.readdir(path.join(root,'Backup_History','Editable_Notes'))).length,3);
 assert.equal((await fs.readdir(path.join(root,'Backup_History','Manifests'))).length,3);
 assert.equal((await fs.readdir(path.join(root,'Full_System','.history','BetterNote_Latest_Backup.json'))).length,0);
 assert.deepEqual(await restored(root),[note('a',4)]);
});

test('Interrupted history relocation leaves the latest and previous recovery generation intact',async()=>{
 const root=await fs.mkdtemp(path.join(qa,'betternote-history-'));await complete(createBackupWriter({localDir:root}),'old',[note('a',1)]);
 const writer=createBackupWriter({localDir:root,fs:{...fs,unlink:async file=>{if(file.endsWith('.bnote')&&!file.includes('Backup_History'))throw Object.assign(Error(),{code:'EPERM'});return fs.unlink(file);}}});
 assert.equal((await complete(writer,'new',[note('a',2)])).success,true);assert.deepEqual(await restored(root),[note('a',2)]);
 const current=JSON.parse(await fs.readFile(path.join(root,'Full_System/backup_manifest.json')));await fs.unlink(path.join(root,current.notebooks.a.editable.path));
 const previous=await createBackupReader().execute({folderPath:root,allowPrevious:true});assert.equal(previous.success,true);assert.deepEqual(previous.data.notebooks,[note('a',1)]);
});


test('Historical recovery chooses the newest verified previous version after relocation',async()=>{
 const root=await fs.mkdtemp(path.join(qa,'betternote-history-')),writer=createBackupWriter({localDir:root});
 for(let time=1;time<=5;time++)await complete(writer,'round-'+time,[note('a',time)]);
 const current=JSON.parse(await fs.readFile(path.join(root,'Full_System/backup_manifest.json')));await fs.unlink(path.join(root,current.notebooks.a.editable.path));
 const result=await createBackupReader().execute({folderPath:root,allowPrevious:true});assert.equal(result.success,true,JSON.stringify(result));assert.deepEqual(result.data.notebooks,[note('a',4)]);
});
