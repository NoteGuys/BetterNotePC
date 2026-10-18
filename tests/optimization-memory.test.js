import test from 'node:test';
import assert from 'node:assert/strict';
import {createNotebookValidator,validateNotebook} from '../electron/backupValidation.js';
import {hasForegroundJobs,runHeavyJob as runForegroundJob,runBackgroundJob,runDataJob} from '../src/services/foregroundJobs.js';
import {createBackupRecovery} from '../src/services/backupRecoveryCore.js';
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('Heavy work runs one at a time; queued foreground pauses optional PDF and errors release the lane',async()=>{
 const held=gate(),order=[];
 const first=runDataJob(async()=>{order.push('data');await held.promise;order.push('data-done');});
 const next=runForegroundJob(async()=>{order.push('foreground');throw Error('fixture');});
 const failure=assert.rejects(next,/fixture/);
 assert.equal(hasForegroundJobs(),true);await assert.rejects(runBackgroundJob(()=>order.push('unwanted')),/pdf-backup-deferred/);
 await Promise.resolve();assert.deepEqual(order,['data']);held.resolve();await first;await failure;
 await runBackgroundJob(()=>order.push('pdf'));assert.deepEqual(order,['data','data-done','foreground','pdf']);assert.equal(hasForegroundJobs(),false);
});
test('Recovery drains an earlier backup before entering the heavy lane, and cancellation cannot commit queued work',async()=>{
 const held=gate(),order=[];
 const backup=runDataJob(async()=>{order.push('backup');await held.promise;});
 const recovery=createBackupRecovery({pauseBackups:()=>({wait:()=>backup,resume:()=>order.push('resume')}),flushLocalSaves:async()=>{},runHeavyWork:runForegroundJob,restore:async()=>{order.push('commit');return {notebooks:[]};}});
 const restored=recovery.run(async()=>{order.push('read');return {};});
 await Promise.resolve();assert.equal(hasForegroundJobs(),false);held.resolve();await restored;
 assert.deepEqual(order,['backup','read','commit','resume']);
 const blocked=gate(),foreground=runForegroundJob(()=>blocked.promise);
 const cancelled=recovery.run(async()=>{throw Error('must not read');});await Promise.resolve();recovery.cancel();blocked.resolve();await foreground;await assert.rejects(cancelled,e=>e.code==='backup-recovery-cancelled');assert.equal(hasForegroundJobs(),false);
});
test('Cursor validator accepts late PDF sources, preserves ordering precedence, and rejects incomplete documents',()=>{
 const note={id:'n',pageCount:2},pages=[{id:'p1',notebookId:'n',pageIndex:1,pdfLazyRaster:1,pdfOriginalId:'src',pdfOriginalDigest:'a'.repeat(64),pdfPageNumber:2,pdfPageImage:'data:image/jpeg;base64,AA=='},{id:'p0',notebookId:'n',pageIndex:0,pdfOriginal:{id:'src',dataUrl:'data:application/pdf;base64,AA=='}}];
 const validator=createNotebookValidator(note,2);pages.forEach((p,i)=>validator.page(p,i));validator.finish();assert.deepEqual(validateNotebook({...note,pages}).pages.map(p=>p.id),['p0','p1']);
 for(const broken of [pages.slice(0,1),[pages[0],{...pages[1],pageIndex:1}],[pages[0],{...pages[1],pdfOriginal:undefined}],[pages[0],{...pages[1],strokes:[{points:[{x:NaN,y:1}]}]}]]){
  const checker=createNotebookValidator(note,2);assert.throws(()=>{broken.forEach((p,i)=>checker.page(p,i));checker.finish();});
 }
});
