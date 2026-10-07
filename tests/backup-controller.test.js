import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackupController, notebookPdfRevision } from '../src/services/backupController.js';
import { notebookBackupRevision, backupMetadataRevision } from '../src/utils/backupRevision.js';
const note = (id='n',time=10) => ({id,name:id,updatedAt:time,pageCount:1,pages:[{id:id+'-p0',pageIndex:0,updatedAt:time}]});
const setup = (overrides={}) => {
  let notes=[note()], folders=[], localState={status:'saved'}, calls=[], pdfCalls=0, roundNotes=[], roundJob=null, target={kind:'local',targetDir:'synthetic',notebooks:{},fullRevision:null,lastSuccess:null};
  const native=async command=>{
    calls.push(command.action);
    if(command.action==='inspect')return{success:true,targets:[target]};
    if(command.action==='begin'){roundNotes=[];roundJob=command.jobId;return{success:true,targets:[{...target,verifiedEditableIds:Object.keys(target.notebooks),verifiedPdfIds:Object.keys(target.notebooks)}]};}
    if(command.action==='reuse'){roundNotes.push(command.notebook);return{success:true,targets:[target]};}
    if(command.action==='notebook'){
      const n=command.notebook,t=notebookBackupRevision(n),prior=target.notebooks[n.id];roundNotes.push(n);
      target={...target,notebooks:{...target.notebooks,[n.id]:{editable:{revision:t},pdf:command.pdfBase64||prior?.pdf?.contentRevision===command.pdfRevision?{revision:t,contentRevision:command.pdfRevision}:prior?.pdf}}};
      return{success:true,targets:[target]};
    }
    if(command.action==='finish'){
      target={...target,fullRevision:command.metadataRevision,lastDataSuccess:100};
      return{success:true,dataSuccess:true,targets:[target],timestamp:100,folderWritten:true};
    }
    if(command.action==='pdf'){
      const prior=target.notebooks[command.notebookId];
      target={...target,notebooks:{...target.notebooks,[command.notebookId]:{...prior,pdfError:command.pdfError,
        pdf:command.pdfBase64?{revision:command.revision,contentRevision:command.pdfRevision}:prior.pdf}}};
      return{success:!command.pdfError,targets:[target]};
    }
    return{success:true};
  };
  const core=createBackupController({
    getMetadata:async()=>({folders:[...folders],notebooks:notes.map(({pages,...n})=>n)}),
    getNotebook:async id=>notes.find(n=>n.id===id), waitForLocalSaves:async()=>{},
    native,makePdf:async()=>{pdfCalls++;return'synthetic-pdf';},yieldTask:async()=>{},
    getLocalState:()=>localState,scheduleDelay:60000,...overrides
  });
  return{core,calls,setNotes:n=>notes=n,setFolders:f=>folders=f,setLocal:s=>localState=s,getPdfCalls:()=>pdfCalls,getTarget:()=>target,getJob:()=>roundJob};
};
test('Local-save failure prevents native backup and cannot report success',async()=>{
 const env=setup({waitForLocalSaves:async()=>{throw Error('local save failed');}});
 const result=await env.core.run();assert.equal(result.success,false);assert.deepEqual(env.calls,[]);assert.equal(env.core.getSnapshot().status,'error');
});
test('All current revisions are acknowledged before the status becomes current',async()=>{
 const env=setup();await env.core.initialize();assert.equal(env.core.getSnapshot().status,'pending');
 assert.equal((await env.core.run()).success,true);assert.equal(env.core.getSnapshot().status,'current');assert.equal(env.core.getSnapshot().cloudUploadVerified,false);
});
test('New edits immediately invalidate green status before the asynchronous metadata refresh',async()=>{
 const env=setup();await env.core.run();env.setNotes([note('n',20)]);env.core.markDirty();assert.notEqual(env.core.getSnapshot().status,'current');
 await env.core.refresh();assert.equal(env.core.getSnapshot().status,'pending');env.core.stop();
});
test('Concurrent manual backup requests share the real pending result',async()=>{
 let release;const gate=new Promise(r=>release=r);const env=setup({waitForLocalSaves:()=>gate});
 const a=env.core.run(),b=env.core.run();assert.equal(a,b);release();assert.equal((await a).success,true);
 assert.equal(env.calls.filter(c=>c==='begin').length,1);
});
test('A native false response is reported as failure instead of unconditional success',async()=>{
 const env=setup({native:async()=>({success:false,reason:'disk failure'})});assert.equal((await env.core.run()).success,false);
 assert.equal(env.core.getSnapshot().status,'error');assert.equal(env.core.getSnapshot().lastSuccess,null);
});
test('An unsupported native bridge cannot fabricate a recent backup time',async()=>{
 const env=setup({native:async()=>({success:false,reason:'unsupported-environment'})});await env.core.initialize();
 assert.equal(env.core.getSnapshot().lastSuccess,null);assert.notEqual(env.core.getSnapshot().status,'current');
});
test('Unchanged page content is not rendered to PDF again',async()=>{
 const env=setup();await env.core.run();await env.core.run();assert.equal(env.getPdfCalls(),1);
});
test('Renaming a notebook reuses its PDF when the page content did not change',async()=>{
 const env=setup();await env.core.run();env.setNotes([{...note(),name:'Renamed',updatedAt:20}]);
 await env.core.run();assert.equal(env.getPdfCalls(),1);assert.equal(env.core.getSnapshot().status,'current');
});
test('Folder-only changes are backed up without rendering unchanged notebooks again',async()=>{
 const env=setup();await env.core.run();env.setFolders([{id:'folder',name:'New folder'}]);await env.core.run();
 assert.equal(env.getPdfCalls(),1);assert.equal(env.core.getSnapshot().status,'current');
});
test('Newly committed pages during backup remain visibly pending',async()=>{
 let env;env=setup({makePdf:async()=>{env.setNotes([note('n',20)]);return'pdf';}});
 const result=await env.core.run();assert.equal(result.success,false);assert.equal(result.newerEditsPending,true);
 assert.equal(env.core.getSnapshot().status,'pending');
});
test('An empty library skips writing and retains the previous backups',async()=>{
 const env=setup();env.setNotes([]);const result=await env.core.run();assert.equal(result.success,false);assert.equal(result.reason,'empty-library');assert.deepEqual(env.calls,[]);
});
test('PDF generation failure keeps recovery data complete and reports its separate PDF failure',async()=>{
 const env=setup({makePdf:async()=>{throw Error('render fail');}});const result=await env.core.run();
 assert.equal(result.success,true);assert.equal(result.pdfComplete,false);assert.ok(env.calls.includes('notebook'));assert.ok(env.calls.includes('finish'));assert.equal(env.core.getSnapshot().status,'current');assert.equal(env.core.getSnapshot().pdfStatus,'error');
});
test('Active writing defers heavy PDF work while allowing editable backups',async()=>{
 const env=setup({canRenderPdf:()=>false});const result=await env.core.run();assert.equal(result.success,true);assert.equal(result.pdfComplete,false);assert.equal(env.getPdfCalls(),0);assert.ok(env.calls.includes('notebook'));assert.equal(env.core.getSnapshot().status,'current');assert.equal(env.core.getSnapshot().pdfStatus,'pending');env.core.stop();
});
test('The backup read tokens cover notebook changes and folder changes independently',()=>{
 const a={folders:[],notebooks:[note()]},b={folders:[{id:'f',name:'Folder'}],notebooks:a.notebooks};
 assert.notEqual(backupMetadataRevision(a),backupMetadataRevision(b));assert.notEqual(notebookPdfRevision(note()),notebookPdfRevision(note('n',20)));
});


test('In-flight local changes invalidate each destination badge as well as the overall badge',async()=>{
 const env=setup();await env.core.run();env.setLocal({status:'saving'});env.core.localStateChanged();
 assert.equal(env.core.getSnapshot().status,'pending');assert.equal(env.core.getSnapshot().targets[0].current,false);
});

test('A delayed metadata read cannot turn green after a newer committed edit',async()=>{
 let delayed=false,release;const gate=new Promise(r=>release=r);let current=note();
 const env=setup({getMetadata:async()=>{const result={folders:[],notebooks:[{...current,pages:undefined}]};if(delayed)await gate;return result;}});
 await env.core.run();assert.equal(env.core.getSnapshot().status,'current');
 delayed=true;const refreshed=env.core.refresh();await Promise.resolve();current=note('n',20);env.core.markDirty();release();await refreshed;
 assert.notEqual(env.core.getSnapshot().status,'current');assert.equal(env.core.getSnapshot().metadataPending,true);
 env.core.stop();
});
test('A failed retry cannot replace its failure with a stale green overall badge',async()=>{
 const env=setup();await env.core.run();
 // The injected metadata remains unchanged; an inspection failure must still be visible.
 let unavailable=false;const second=setup({native:async command=>unavailable?{success:false,reason:'offline'}:
 command.action==='inspect'?{success:true,targets:[env.getTarget()]}:{success:false,reason:'offline'}});
 await second.core.initialize();assert.equal(second.core.getSnapshot().status,'current');unavailable=true;await second.core.refresh({inspect:true});
 assert.notEqual(second.core.getSnapshot().status,'current');assert.equal(second.core.getSnapshot().lastSuccess,null);
});
test('Pauses between strokes do not reread notebook metadata before the idle backup',async()=>{
 let reads=0;const env=setup({getMetadata:async()=>{reads++;return{folders:[],notebooks:[{...note(),pages:undefined}]};}});
 await env.core.run();reads=0;
 for(let i=0;i<3;i++){env.core.markDirty();await new Promise(resolve=>setTimeout(resolve,50));}
 await new Promise(resolve=>setTimeout(resolve,220));
 assert.equal(reads,0);assert.equal(env.core.getSnapshot().status,'pending');env.core.stop();
});

test('Recovery-data completion becomes visible before a slow PDF resolves',async()=>{
 let release,entered=false;const gate=new Promise(resolve=>release=resolve);
 const env=setup({makePdf:async()=>{entered=true;await gate;return'pdf';}});
 const result=env.core.run();while(!entered)await new Promise(resolve=>setTimeout(resolve,1));
 assert.equal(env.core.getSnapshot().status,'current');assert.equal(env.core.getSnapshot().pdfStatus,'working');
 assert.equal(env.core.getSnapshot().lastSuccess,100);assert.equal(env.core.getSnapshot().syncing,true);
 release();assert.equal((await result).success,true);
});
test('Unchanged notebooks reuse verified artifacts without reading their page snapshots again',async()=>{
 let reads=0;const env=setup({getNotebook:async()=>{reads++;return note();}});
 await env.core.run();reads=0;await env.core.run();
 assert.equal(reads,0);assert.ok(env.calls.includes('reuse'));assert.equal(env.core.getSnapshot().status,'current');
});
test('Native byte progress updates only the matching active backup job',async()=>{
 let release,entered=false,env;const gate=new Promise(resolve=>release=resolve);
 env=setup({makePdf:async()=>{entered=true;env.core.nativeProgress({jobId:env.getJob(),stage:'writing',bytesDone:5,totalBytes:10});await gate;return'pdf';}});
 const running=env.core.run();while(!entered)await new Promise(resolve=>setTimeout(resolve,1));
 assert.equal(env.core.getSnapshot().progress.io.bytesDone,5);
 env.core.nativeProgress({jobId:'obsolete',stage:'writing',bytesDone:9,totalBytes:10});
 assert.equal(env.core.getSnapshot().progress.io.bytesDone,5);
 release();await running;env.core.nativeProgress({jobId:env.getJob(),stage:'writing',bytesDone:9,totalBytes:10});
 assert.equal(env.core.getSnapshot().progress.io.bytesDone,5);env.core.stop();
});

for(const separateDrive of [false,true])test('Real backup keeps healthy PDFs moving past a conflict in '+(separateDrive?'Drive':'Local'),async()=>{
 const fs=await import('node:fs/promises'),path=await import('node:path');
 const {createRequire}=await import('node:module'),require=createRequire(import.meta.url);
 const {createBackupWriter}=require('../electron/backupWriter.cjs');
 const qaRoot=process.env.BETTERNOTE_QA_TEMP;
 assert.ok(qaRoot&&path.isAbsolute(qaRoot),'Use isolated synthetic QA storage');
 const root=await fs.mkdtemp(path.join(qaRoot,'backup-conflict-controller-'));
 const local=path.join(root,'local'),drive=separateDrive?path.join(root,'drive'):null,blocked=drive||local;
 const original=[note('first',10),note('blocked',100),note('last',10)];
 await fs.mkdir(path.join(blocked,'Full_System'),{recursive:true});
 const full=path.join(blocked,'Full_System','BetterNote_Latest_Backup.json');
 const prior=Buffer.from(JSON.stringify({notebooks:original,folders:[]}));
 await fs.writeFile(full,prior);
 let notes=[note('first',20),note('blocked',50),note('last',20)];const rendered=[];
 const writer=createBackupWriter({localDir:local});
 const core=createBackupController({
  getMetadata:async()=>({folders:[],notebooks:notes.map(({pages,...n})=>n)}),
  getNotebook:async id=>notes.find(n=>n.id===id),waitForLocalSaves:async()=>{},
  native:command=>writer.execute(command),getPath:async()=>({localBackupPath:local,driveBackupPath:drive}),
  makePdf:async n=>{rendered.push(n.id);return Buffer.from('%PDF-1.7\\nsynthetic\\n%%EOF').toString('base64');},
  yieldTask:async()=>{},scheduleDelay:60000
 });
 const result=await core.run(),snapshot=core.getSnapshot();
 assert.equal(result.success,separateDrive);
 assert.equal(snapshot.status,separateDrive?'current':'partial');
 const target=snapshot.targets.find(t=>t.targetDir===blocked);
 assert.equal(target.error,'newer-backup-exists');assert.equal(target.fatalError,null);
 assert.equal(target.editableCount,2);assert.equal(target.pdfCount,2);assert.equal(target.dataCurrent,false);
 assert.equal(target.notebookIssues.blocked.backupUpdatedAt,100);
 assert.deepEqual(await fs.readFile(full),prior);
 assert.ok(rendered.includes('last'));if(!separateDrive)assert.equal(rendered.includes('blocked'),false);
 await core.refresh({inspect:true});
 assert.equal(core.getSnapshot().targets.find(t=>t.targetDir===blocked).notebookIssues.blocked.error,'newer-backup-exists');
 notes=notes.map(n=>note(n.id,200));
 assert.equal((await core.run()).success,true);
 assert.ok(core.getSnapshot().targets.every(t=>t.dataCurrent&&t.pdfCurrent&&Object.keys(t.notebookIssues).length===0));
 core.stop();
});


test('An equal-time conflict stays pending after reopening and retrying the same device',async()=>{
 const fs=await import('node:fs/promises'),path=await import('node:path');
 const {createRequire}=await import('node:module'),require=createRequire(import.meta.url);
 const {createBackupWriter}=require('../electron/backupWriter.cjs');
 const root=await fs.mkdtemp(path.join(process.env.BETTERNOTE_QA_TEMP,'backup-conflict-reopen-'));
 const original=[note('blocked',10),note('healthy',10)];
 const writer=createBackupWriter({localDir:root});
 // A complete older backup and matching manifest already exist.
 await writer.execute({action:'begin',jobId:'seed',phase:'data',metadata:{folders:[],notebooks:original},metadataRevision:backupMetadataRevision({folders:[],notebooks:original})});
 for(const n of original)assert.equal((await writer.execute({action:'notebook',jobId:'seed',notebook:n,pdfRevision:notebookPdfRevision(n)})).success,true);
 assert.equal((await writer.execute({action:'finish',jobId:'seed'})).success,true);
 const changed={...original[0],pages:[{...original[0].pages[0],strokes:[{points:[{x:99,y:55}]}]}]};
 // First detect the conflict through the notebook write path.
 await writer.execute({action:'begin',jobId:'detect',metadata:{folders:[],notebooks:original}});
 await writer.execute({action:'notebook',jobId:'detect',notebook:changed});
 await writer.execute({action:'abort',jobId:'detect'});
 const prior=await fs.readFile(path.join(root,'Full_System','BetterNote_Latest_Backup.json'));
 let notes=[changed,note('healthy',20)],rendered=[];
 const reopened=createBackupWriter({localDir:root});
 const core=createBackupController({
  getMetadata:async()=>({folders:[],notebooks:notes.map(({pages,...n})=>n)}),
  getNotebook:async id=>notes.find(n=>n.id===id),waitForLocalSaves:async()=>{},
  native:c=>reopened.execute(c),getPath:async()=>root,
  makePdf:async n=>{rendered.push(n.id);return Buffer.from('%PDF-1.7\\nsynthetic\\n%%EOF').toString('base64');},yieldTask:async()=>{}
 });
 await core.initialize();
 assert.equal(core.getSnapshot().targets[0].notebookIssues.blocked.error,'conflicting-backup-revision');
 for(let round=0;round<2;round++){
  assert.equal((await core.run()).success,false);
  const target=core.getSnapshot().targets[0];
  assert.equal(target.editableCount,1);assert.equal(target.pdfCount,1);
  assert.equal(target.notebookIssues.blocked.error,'conflicting-backup-revision');
  assert.deepEqual(await fs.readFile(path.join(root,'Full_System','BetterNote_Latest_Backup.json')),prior);
 }
 assert.equal(rendered.includes('blocked'),false);
 notes=[note('blocked',30),note('healthy',20)];
 assert.equal((await core.run()).success,true);
 assert.deepEqual(core.getSnapshot().targets[0].notebookIssues,{});
 core.stop();
});


test('Notebook IDs matching Object prototype keys are not mistaken for backup conflicts',async()=>{
 const env=setup();env.setNotes([note('__proto__'),note('constructor'),note('toString')]);
 assert.equal((await env.core.run()).success,true);
 const target=env.core.getSnapshot().targets[0];assert.equal(target.editableCount,3);assert.equal(target.pdfCount,3);
 assert.equal(env.getPdfCalls(),3);env.core.stop();
});

test('Selecting a new Drive folder schedules its backup even when Local is already current',async()=>{
 const fs=await import('node:fs/promises'),path=await import('node:path');
 const {createRequire}=await import('node:module'),require=createRequire(import.meta.url);
 const {createBackupWriter}=require('../electron/backupWriter.cjs');
 const root=await fs.mkdtemp(path.join(process.env.BETTERNOTE_QA_TEMP,'backup-drive-schedule-'));
 const local=path.join(root,'local'),drive=path.join(root,'drive');let selected=null;
 const n=note(),writer=createBackupWriter({localDir:local});
 const core=createBackupController({
  getMetadata:async()=>({folders:[],notebooks:[{...n,pages:undefined}]}),
  getNotebook:async()=>n,waitForLocalSaves:async()=>{},
  native:c=>writer.execute(c),getPath:async()=>({localBackupPath:local,driveBackupPath:selected}),
  makePdf:async()=>Buffer.from('%PDF-1.7\nsynthetic\n%%EOF').toString('base64'),
  yieldTask:async()=>{},scheduleDelay:5
 });
 try{
  await core.run();assert.equal(core.getSnapshot().status,'current');
  selected=drive;await core.destinationChanged();
  assert.equal(core.getSnapshot().status,'current');
  assert.equal(core.getSnapshot().allDestinationsCurrent,false);
  const deadline=Date.now()+2000;
  while(!core.getSnapshot().allDestinationsCurrent&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
  await core.waitForRunning();
  assert.equal(core.getSnapshot().allDestinationsCurrent,true,'Drive must be backed up without another edit or manual click');
  assert.equal(core.getSnapshot().allPdfsCurrent,true);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(drive,'Full_System','BetterNote_Latest_Backup.json'))).notebooks[0],n);
 }finally{core.stop();}
});

for(const stage of ['startup','periodic'])test('The '+stage+' check notices missing Drive recovery data even with complete PDFs',async context=>{
 context.mock.timers.enable({apis:['setTimeout','setInterval']});
 const n=note(),metadata={folders:[],notebooks:[{...n,pages:undefined}]},token=notebookBackupRevision(n);
 let driveMissing=stage==='startup',attempts=0;
 const target=kind=>({kind,targetDir:kind,notebooks:{n:{editable:{revision:token},pdf:{revision:token}}},
  fullRevision:kind==='drive'&&driveMissing?null:backupMetadataRevision(metadata),lastDataSuccess:100});
 const core=createBackupController({
  getMetadata:async()=>metadata,getNotebook:async()=>n,waitForLocalSaves:async()=>{},
  native:async command=>{
   if(command.action==='inspect')return{success:true,targets:[target('local'),target('drive')]};
   if(command.action==='begin'){attempts++;return{success:false,reason:'synthetic-stop',targets:[target('local'),target('drive')]};}
   return{success:true};
  },getPath:async()=>({localBackupPath:'local',driveBackupPath:'drive'}),makePdf:async()=>{throw Error('Unexpected PDF');}
 });
 const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
 try{
  core.start();await settle();
  assert.equal(core.getSnapshot().status,'current');
  assert.equal(core.getSnapshot().allPdfsCurrent,true);
  context.mock.timers.tick(20000);await settle();
  if(stage==='periodic'){assert.equal(attempts,0);driveMissing=true;context.mock.timers.tick(3600000);await settle();}
  assert.equal(attempts,1,'Automatic verification must schedule the incomplete Drive destination');
 }finally{core.stop();context.mock.timers.reset();}
});
