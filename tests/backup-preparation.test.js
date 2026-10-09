import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackupPreparationService } from '../src/services/backupPreparationService.js';
const note={id:'n',name:'n',updatedAt:10,pageCount:1,pages:[{id:'p',pageIndex:0,updatedAt:10}]};
const fixture=(options={})=>{
 const workers=[];
 const service=createBackupPreparationService({idleLifetime:20,timeout:40,...options,createWorker:()=>{const worker={sent:[],terminated:false,
 postMessage(value){this.sent.push(value);},terminate(){this.terminated=true;},reply(data){this.onmessage({data});}};workers.push(worker);return worker;}});
 return{service,workers};
};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
test('Backup worker starts lazily, sends only identity, releases idle memory and restarts',async()=>{
 const{service,workers}=fixture();assert.equal(workers.length,0);
 const result=service.getNotebook('n');await tick();const worker=workers[0],request=worker.sent[0];
 assert.deepEqual(Object.keys(request).sort(),['action','id','requestId']);
 worker.reply({requestId:request.requestId,result:note});assert.deepEqual(await result,note);
 await new Promise(resolve=>setTimeout(resolve,30));assert.equal(worker.terminated,true);
 const next=service.getNotebook('n',{pdf:true});await tick();assert.equal(workers.length,2);assert.equal(workers[1].sent[0].action,'describe');
 workers[1].reply({requestId:workers[1].sent[0].requestId,result:note});await next;service.close();
});
test('Active writing refuses the next worker PDF page and propagates deferral',async()=>{
 const{service,workers}=fixture();let checks=0;
 const result=service.makePdf(note,()=>{if(++checks>1)throw Error('pdf-backup-deferred');});
 const rejected=assert.rejects(result,/pdf-backup-deferred/);await tick();const worker=workers[0],id=worker.sent[0].requestId;
 worker.reply({requestId:id,progress:{page:2,totalPages:3}});assert.deepEqual(worker.sent[1],{action:'continue',requestId:id,proceed:false});
 worker.reply({requestId:id,error:'pdf-backup-deferred'});await rejected;service.close();
});
test('A crashed or non-responsive worker fails explicitly and can be retried',async()=>{
 const{service,workers}=fixture();let result=service.getNotebook('n');let rejected=assert.rejects(result,/backup-preparation-unavailable/);await tick();workers[0].onerror();await rejected;
 result=service.getNotebook('n');rejected=assert.rejects(result,/backup-preparation-unavailable/);await rejected;assert.equal(workers[1].terminated,true);
 service.close();
});
test('New writing just after PDF completion prevents returning a stale successful PDF',async()=>{
 const{service,workers}=fixture();let idle=true;
 const result=service.makePdf(note,()=>{if(!idle)throw Error('pdf-backup-deferred');});const rejected=assert.rejects(result,/pdf-backup-deferred/);
 await tick();idle=false;const worker=workers[0];worker.reply({requestId:worker.sent[0].requestId,result:new ArrayBuffer(5)});await rejected;service.close();
});
