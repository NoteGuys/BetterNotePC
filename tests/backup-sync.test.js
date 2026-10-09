import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {syncRevision,syncContent,syncDecision,syncCandidates,syncWriteGuard} from '../electron/backupSyncProtocol.js';
import {backupMetadataRevision} from '../src/utils/backupRevision.js';
const require=createRequire(import.meta.url);
const {createBackupWriter}=require('../electron/backupWriter.cjs');
const {createBackupSyncReader}=require('../electron/backupSyncReader.cjs');
const qa=process.env.BETTERNOTE_QA_TEMP;
if(!qa||!path.isAbsolute(qa))throw Error('Use isolated QA storage');
const makeNote=(id,time=20)=>({id,name:id,updatedAt:time,pageCount:1,pages:[{id:id+'-p',notebookId:id,pageIndex:0,strokes:[{points:[{x:4,y:8}]}],textElements:[],imageElements:[]}]});
const local=makeNote('a'),remote={id:'a',hash:'new',revision:syncRevision(makeNote('a',2))},base={localRevision:syncRevision(local),remoteHash:'old'};
test('Unchanged local content receives a remote revision even when its clock is older',()=>assert.equal(syncDecision({local,remote,base}),'receive'));
test('Both changed sides preserve a conflict instead of picking the newer clock',()=>assert.equal(syncDecision({local:makeNote('a',500),remote,base}),'conflict'));
test('Unknown shared ancestry preserves both differing versions',()=>assert.equal(syncDecision({local,remote}),'conflict'));
test('Identical content resolves timestamp-only differences without a conflict',()=>assert.equal(syncDecision({local,remote,base,equalContent:true}),'equal'));
test('A remote missing version is not treated as permission to delete or resend',()=>assert.equal(syncDecision({local,base}),'missing-remote'));
test('A locally missing known note is not resurrected automatically',()=>assert.equal(syncDecision({remote,base}),'missing-local'));
test('A new remote notebook is received using its ID, independent of name',()=>assert.equal(syncDecision({remote}),'receive'));
test('Content comparison ignores object order, timestamps and cached covers',()=>{
 const reordered=JSON.parse(JSON.stringify(local));reordered.updatedAt=600;reordered.firstPageThumbnail={dataUrl:'cached'};
 reordered.pages[0]={...reordered.pages[0],createdAt:88};
 assert.equal(syncContent(reordered),syncContent({...local,firstPageThumbnail:null}));
});
test('Write guard requires a shared base for every existing remote ID',()=>{
 assert.equal(syncWriteGuard({notebooks:[local]},{manifestHash:'hash',notes:[remote]},{entries:{}}).ready,false);
 assert.equal(syncWriteGuard({notebooks:[local]},{manifestHash:'hash',notes:[remote]},{entries:{a:{...base,remoteHash:'new'}}}).ready,true);
});
test('Incremental selection reads only remote changes and notes without a shared base',()=>{
 const b=makeNote('b');assert.deepEqual(syncCandidates({notebooks:[local,b]},{notes:[{id:'a',hash:'old'},{id:'b',hash:'new'}]},{entries:{a:base,b:base}}),['b']);
});
const fixture=async()=>{
 const root=await fs.mkdtemp(path.join(qa,'betternote-sync-native-')),notes=[makeNote('a'),makeNote('b')],metadata={folders:[],notebooks:notes};
 const writer=createBackupWriter({localDir:root,deadlineMs:10000});
 const jobId='seed';assert.equal((await writer.execute({action:'begin',jobId,metadata,metadataRevision:backupMetadataRevision(metadata),phase:'data'})).success,true);
 for(const note of notes)await writer.execute({action:'notebook',jobId,notebook:note,pdfRevision:'pages-'+note.id});
 assert.equal((await writer.execute({action:'finish',jobId,metadataRevision:backupMetadataRevision(metadata)})).dataSuccess,true);
 return {root,notes,manifestFile:path.join(root,'Full_System','backup_manifest.json')};
};
test('Preview reads metadata only; selected note never reads the complete library snapshot',async()=>{
 const {root}=await fixture(),opened=[];
 const reader=createBackupSyncReader({fs:{...fs,open:async(file,...args)=>{opened.push(file);return fs.open(file,...args);}}});
 const preview=await reader.execute({folderPath:root,syncMode:'preview'});assert.equal(preview.success,true);assert.equal(preview.notes.length,2);
 assert.ok(opened.every(file=>file.endsWith('backup_manifest.json')));opened.length=0;
 const result=await reader.execute({folderPath:root,syncMode:'note',syncNotebookId:'a',manifestHash:preview.manifestHash});
 assert.equal(result.success,true);assert.equal(JSON.parse(new TextDecoder().decode(result.encoded)).notebooks[0].id,'a');
 assert.ok(opened.every(file=>!file.includes('BetterNote_Latest_Backup')&&!file.includes('Notebook-b--')));
});
test('A new empty folder can be connected without inventing remote backups',async()=>{
 const root=path.join(qa,'unused-'+crypto.randomUUID()),result=await createBackupSyncReader().execute({folderPath:root,syncMode:'preview'});
 assert.equal(result.success,true);assert.equal(result.manifestHash,null);assert.deepEqual(result.notes,[]);
});
test('Legacy folders require explicit recovery before shared automatic writes',async()=>{
 const root=await fs.mkdtemp(path.join(qa,'betternote-sync-legacy-'));await fs.mkdir(path.join(root,'Editable_Notes'));
 assert.equal((await createBackupSyncReader().execute({folderPath:root,syncMode:'preview'})).reason,'drive-sync-legacy');
});
test('A partially published revision cannot be received or authorize a write',async()=>{
 const {root,manifestFile}=await fixture(),manifest=JSON.parse(await fs.readFile(manifestFile));
 manifest.notebooks.a.editable.revision=syncRevision(makeNote('a',900));await fs.writeFile(manifestFile,JSON.stringify(manifest));
 assert.equal((await createBackupSyncReader().execute({folderPath:root,syncMode:'preview'})).reason,'backup-incomplete');
});
test('A changed manifest invalidates an earlier preview',async()=>{
 const {root,manifestFile}=await fixture(),reader=createBackupSyncReader(),preview=await reader.execute({folderPath:root,syncMode:'preview'});
 const manifest=JSON.parse(await fs.readFile(manifestFile));manifest.verifiedAt++;await fs.writeFile(manifestFile,JSON.stringify(manifest));
 assert.equal((await reader.execute({folderPath:root,syncMode:'note',syncNotebookId:'a',manifestHash:preview.manifestHash})).reason,'backup-changed-during-read');
});
test('A corrupted selected file is rejected before any data reaches IndexedDB',async()=>{
 const {root,manifestFile}=await fixture(),reader=createBackupSyncReader(),preview=await reader.execute({folderPath:root,syncMode:'preview'}),manifest=JSON.parse(await fs.readFile(manifestFile));
 await fs.appendFile(path.join(root,manifest.notebooks.a.editable.path),' ');
 assert.equal((await reader.execute({folderPath:root,syncMode:'note',syncNotebookId:'a',manifestHash:preview.manifestHash})).reason,'backup-incomplete');
});
test('Inactive historical entries do not silently recreate a removed note',async()=>{
 const {root,manifestFile}=await fixture(),manifest=JSON.parse(await fs.readFile(manifestFile));
 const extra=makeNote('retired'),bytes=Buffer.from(JSON.stringify(extra)),h=createHash('sha256').update('retired').digest('hex').slice(0,32);
 manifest.notebooks.retired={pageCount:1,editable:{path:'Editable_Notes/Notebook-retired--'+h+'.bnote',hash:createHash('sha256').update(bytes).digest('hex'),size:bytes.length,revision:syncRevision(extra)}};
 await fs.writeFile(manifestFile,JSON.stringify(manifest));
 const preview=await createBackupSyncReader().execute({folderPath:root,syncMode:'preview'});assert.equal(preview.success,true);assert.equal(preview.notes.length,2);
});

const guardedRound=async(writer,notes,drive,guard,acceptedReceives)=>{
 const metadata={folders:[],notebooks:notes},jobId=crypto.randomUUID();
 const start=await writer.execute({action:'begin',jobId,metadata,metadataRevision:backupMetadataRevision(metadata),phase:'data',driveBackupPath:drive,driveSyncGuard:guard,acceptedReceives});
 for(const notebook of notes)await writer.execute({action:'notebook',jobId,notebook,pdfRevision:'pages-'+notebook.id});
 const finish=await writer.execute({action:'finish',jobId,metadataRevision:backupMetadataRevision(metadata)});return {start,finish};
};
const guardFor=async(root,deviceId='synthetic-device')=>{
 const preview=await createBackupSyncReader().execute({folderPath:root,syncMode:'preview',syncDeviceId:deviceId});assert.equal(preview.success,true);
 return {ready:true,manifestHash:preview.manifestHash,deviceId,entries:preview.entries||Object.fromEntries(preview.notes.map(n=>[n.id,n.hash]))};
};
test('A pending Drive guard blocks shared writes while local recovery data continues',async()=>{
 const {root,notes}=await fixture(),local=await fs.mkdtemp(path.join(qa,'betternote-sync-local-')),before=await fs.readFile(path.join(root,'Full_System/BetterNote_Latest_Backup.json'));
 const result=await guardedRound(createBackupWriter({localDir:local}),notes,root,{ready:false,reason:'drive-sync-pending'});
 assert.equal(result.finish.targets.find(t=>t.kind==='local').dataSuccess,true);assert.equal(result.finish.targets.find(t=>t.kind==='drive').error,'drive-sync-pending');
 assert.deepEqual(await fs.readFile(path.join(root,'Full_System/BetterNote_Latest_Backup.json')),before);
});
test('A manifest changed after preview cannot authorize a shared overwrite',async()=>{
 const {root,notes,manifestFile}=await fixture(),guard=await guardFor(root),before=await fs.readFile(path.join(root,'Full_System/BetterNote_Latest_Backup.json'));
 await fs.appendFile(manifestFile,' ');const local=await fs.mkdtemp(path.join(qa,'betternote-sync-cas-'));
 const result=await guardedRound(createBackupWriter({localDir:local}),notes,root,guard);assert.equal(result.finish.targets.find(t=>t.kind==='drive').error,'backup-changed-externally');
 assert.deepEqual(await fs.readFile(path.join(root,'Full_System/BetterNote_Latest_Backup.json')),before);
});
test('A file changed without changing its metadata cannot bypass a shared hash guard',async()=>{
 const {root,notes,manifestFile}=await fixture(),guard=await guardFor(root),manifest=JSON.parse(await fs.readFile(manifestFile)),file=path.join(root,manifest.notebooks.a.editable.path);
 const peer={...notes[0],pages:[{...notes[0].pages[0],textElements:[{text:'peer work'}]}]},peerBytes=JSON.stringify(peer);await fs.writeFile(file,peerBytes);
 const changed={...notes[0],updatedAt:21},local=await fs.mkdtemp(path.join(qa,'betternote-sync-byte-cas-'));
 const result=await guardedRound(createBackupWriter({localDir:local}),[changed,notes[1]],root,guard);assert.equal(result.finish.targets.find(t=>t.kind==='drive').error,'backup-changed-externally');assert.equal(await fs.readFile(file,'utf8'),peerBytes);
});
test('An interrupted new round leaves the last committed generation available to every device',async()=>{
 const {root,notes}=await fixture(),guard=await guardFor(root),local=await fs.mkdtemp(path.join(qa,'betternote-sync-resume-')),writer=createBackupWriter({localDir:local}),changed={...notes[0],updatedAt:33};
 const metadata={folders:[],notebooks:[changed,notes[1]]},jobId='interrupted';await writer.execute({action:'begin',jobId,metadata,metadataRevision:backupMetadataRevision(metadata),phase:'data',driveBackupPath:root,driveSyncGuard:guard});
 await writer.execute({action:'notebook',jobId,notebook:changed});await writer.execute({action:'abort',jobId});
 const reader=createBackupSyncReader();const old=await reader.execute({folderPath:root,syncMode:'preview',syncDeviceId:'other-device'});assert.equal(old.success,true);assert.equal(old.notes.find(n=>n.id==='a').updatedAt,notes[0].updatedAt);
 const resume=await guardFor(root),result=await guardedRound(writer,[changed,notes[1]],root,resume);assert.equal(result.finish.targets.find(t=>t.kind==='drive').dataSuccess,true);
 assert.equal((await reader.execute({folderPath:root,syncMode:'preview',syncDeviceId:'other-device'})).success,true);
});
test('A verified accepted receive updates local backup despite an older foreign clock',async()=>{
 const {root,notes,manifestFile}=await fixture(),manifest=JSON.parse(await fs.readFile(manifestFile)),writer=createBackupWriter({localDir:root});
 const changed={...notes[0],updatedAt:2,pages:[{...notes[0].pages[0],textElements:[{text:'remote clock is behind'}]}]};
 const result=await guardedRound(writer,[changed,notes[1]],null,undefined,{a:{targetDir:root,previousHash:manifest.notebooks.a.editable.hash}});
 assert.equal(result.finish.dataSuccess,true);assert.equal(JSON.parse(await fs.readFile(path.join(root,'Full_System/BetterNote_Latest_Backup.json'))).notebooks.find(n=>n.id==='a').updatedAt,2);
});
test('A stale accepted receive cannot authorize overwriting unrelated local bytes',async()=>{
 const {root,notes}=await fixture(),writer=createBackupWriter({localDir:root}),changed={...notes[0],updatedAt:2};
 const result=await guardedRound(writer,[changed,notes[1]],null,undefined,{a:{targetDir:root,previousHash:'0'.repeat(64)}});
 assert.equal(result.finish.dataSuccess,false);assert.equal(result.finish.targets[0].notebookIssues.a.error,'newer-backup-exists');
});
test('Reserved IDs remain independent in shared ancestry maps',()=>{
 const note=makeNote('constructor');assert.deepEqual(syncCandidates({notebooks:[note]},{notes:[{id:'constructor',hash:'old'}]},{entries:{}}),['constructor']);
 assert.equal(syncWriteGuard({notebooks:[note]},{manifestHash:null,notes:[]},{entries:{}}).ready,true);
});

test('Failure publishing the commit after installing notes preserves the previous complete index',async()=>{
 const {root,notes}=await fixture(),guard=await guardFor(root),local=await fs.mkdtemp(path.join(qa,'betternote-sync-intent-')),changed={...notes[0],updatedAt:44};let installed=false,failed=false;
 const writer=createBackupWriter({localDir:local,beforeReplace:async({file,relative})=>{
  if(file.startsWith(root+path.sep)&&relative.endsWith('.bnote'))installed=true;
  if(installed&&!failed&&file.startsWith(root+path.sep)&&relative.endsWith('backup_manifest.json')){failed=true;throw Object.assign(new Error(),{code:'EIO'});}
 }});
 const metadata={folders:[],notebooks:[changed,notes[1]]},jobId='crash';await writer.execute({action:'begin',jobId,metadata,metadataRevision:backupMetadataRevision(metadata),phase:'data',driveBackupPath:root,driveSyncGuard:guard});
 await writer.execute({action:'notebook',jobId,notebook:changed});await writer.execute({action:'notebook',jobId,notebook:notes[1]});await writer.execute({action:'finish',jobId});assert.equal(failed,true);const previous=await createBackupSyncReader().execute({folderPath:root,syncMode:'preview'});assert.equal(previous.success,true);assert.equal(previous.notes.find(n=>n.id==='a').updatedAt,notes[0].updatedAt);
 const resume=await guardFor(root);const result=await guardedRound(createBackupWriter({localDir:local}),[changed,notes[1]],root,resume);
 assert.equal(result.finish.targets.find(t=>t.kind==='drive').dataSuccess,true);
});
test('Guarded pruning removes only confirmed IDs and lets its owner complete the next snapshot',async()=>{
 const {root,notes}=await fixture(),guard=await guardFor(root),local=await fs.mkdtemp(path.join(qa,'betternote-sync-prune-')),writer=createBackupWriter({localDir:local});
 const result=await writer.execute({action:'prune',notebookIds:['a'],driveBackupPath:root,driveSyncGuard:guard});assert.equal(result.targets.find(t=>t.kind==='drive').error,null);
 assert.deepEqual((await createBackupSyncReader().execute({folderPath:root,syncMode:'preview',syncDeviceId:'other'})).notes.map(n=>n.id),['b']);
 const resume=await guardFor(root);assert.equal((await guardedRound(writer,[notes[1]],root,resume)).finish.targets.find(t=>t.kind==='drive').dataSuccess,true);
 assert.deepEqual((await createBackupSyncReader().execute({folderPath:root,syncMode:'preview'})).notes.map(n=>n.id),['b']);
});
test('A pending Drive guard never prunes an unreceived notebook',async()=>{
 const {root}=await fixture(),before=await fs.readFile(path.join(root,'Full_System/BetterNote_Latest_Backup.json')),local=await fs.mkdtemp(path.join(qa,'betternote-sync-prune-block-'));
 const result=await createBackupWriter({localDir:local}).execute({action:'prune',notebookIds:['a'],driveBackupPath:root,driveSyncGuard:{ready:false,reason:'drive-sync-pending'}});
 assert.equal(result.targets.find(t=>t.kind==='drive').error,'drive-sync-pending');assert.deepEqual(await fs.readFile(path.join(root,'Full_System/BetterNote_Latest_Backup.json')),before);
});

test('Legacy title-prefix migration preserves guarded Drive sync hashes and remains recoverable',async()=>{
 const {root,notes,manifestFile}=await fixture(),manifest=JSON.parse(await fs.readFile(manifestFile));
 for(const entry of Object.values(manifest.notebooks)){const artifact=entry.editable,legacy=path.join(path.dirname(artifact.path),'Notebook-'+path.basename(artifact.path));await fs.rename(path.join(root,artifact.path),path.join(root,legacy));artifact.path=legacy;}
 await fs.writeFile(manifestFile,JSON.stringify(manifest));const guard=await guardFor(root),local=await fs.mkdtemp(path.join(qa,'guarded-readable-'));
 const result=await guardedRound(createBackupWriter({localDir:local}),notes,root,guard);assert.equal(result.finish.targets.find(t=>t.kind==='drive').dataSuccess,true);
 const current=JSON.parse(await fs.readFile(manifestFile));for(const entry of Object.values(current.notebooks))assert.ok(!path.basename(entry.editable.path).startsWith('Notebook-'));
 const preview=await createBackupSyncReader().execute({folderPath:root,syncMode:'preview',syncDeviceId:'synthetic-device'});assert.equal(preview.success,true);assert.equal(preview.notes.length,2);
});
