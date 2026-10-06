import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackupController, notebookPdfRevision } from '../src/services/backupController.js';
import { notebookBackupRevision, backupMetadataRevision } from '../src/utils/backupRevision.js';
const note = (id='n',time=10) => ({id,name:id,updatedAt:time,pageCount:1,pages:[{id:id+'-p0',pageIndex:0,updatedAt:time}]});
const setup = (overrides={}) => {
  let notes=[note()], folders=[], localState={status:'saved'}, calls=[], pdfCalls=0, roundNotes=[], target={kind:'local',targetDir:'synthetic',notebooks:{},fullRevision:null,lastSuccess:null};
  const native=async command=>{
    calls.push(command.action);
    if(command.action==='inspect')return{success:true,targets:[target]};
    if(command.action==='begin'){roundNotes=[];return{success:true,targets:[{...target,verifiedPdfIds:Object.keys(target.notebooks)}]};}
    if(command.action==='notebook'){
      const n=command.notebook,t=notebookBackupRevision(n),prior=target.notebooks[n.id];roundNotes.push(n);
      target={...target,notebooks:{...target.notebooks,[n.id]:{editable:{revision:t},pdf:command.pdfBase64||prior?.pdf?.contentRevision===command.pdfRevision?{revision:t,contentRevision:command.pdfRevision}:prior?.pdf}}};
      return{success:true,targets:[target]};
    }
    if(command.action==='finish'){
      target={...target,fullRevision:command.metadataRevision,lastSuccess:100};
      return{success:roundNotes.every(n=>target.notebooks[n.id]?.pdf?.revision===notebookBackupRevision(n)),targets:[target],timestamp:100,folderWritten:true};
    }
    return{success:true};
  };
  const core=createBackupController({
    getMetadata:async()=>({folders:[...folders],notebooks:notes.map(({pages,...n})=>n)}),
    getNotebook:async id=>notes.find(n=>n.id===id), waitForLocalSaves:async()=>{},
    native,makePdf:async()=>{pdfCalls++;return'synthetic-pdf';},yieldTask:async()=>{},
    getLocalState:()=>localState,scheduleDelay:60000,...overrides
  });
  return{core,calls,setNotes:n=>notes=n,setFolders:f=>folders=f,setLocal:s=>localState=s,getPdfCalls:()=>pdfCalls,getTarget:()=>target};
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
test('PDF generation failure remains partial and editable backup is still sent',async()=>{
 const env=setup({makePdf:async()=>{throw Error('render fail');}});const result=await env.core.run();
 assert.equal(result.success,false);assert.ok(env.calls.includes('notebook'));assert.ok(env.calls.includes('finish'));assert.notEqual(env.core.getSnapshot().status,'current');
});
test('Active writing defers heavy PDF work while allowing editable backups',async()=>{
 const env=setup({canRenderPdf:()=>false});await env.core.run();assert.equal(env.getPdfCalls(),0);assert.ok(env.calls.includes('notebook'));assert.notEqual(env.core.getSnapshot().status,'current');
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