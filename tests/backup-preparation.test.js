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


test('Closing during startup rejects immediately, terminates the late worker and isolates a retry',async()=>{
 let release,creations=0;
 const workers=[];
 const make=()=>{const worker={sent:[],terminated:false,postMessage(data){this.sent.push(data);},terminate(){this.terminated=true;},reply(data){this.onmessage({data});}};workers.push(worker);return worker;};
 const service=createBackupPreparationService({timeout:500,createWorker:()=>++creations===1?new Promise(resolve=>{release=resolve;}):make()});
 const old=service.getNotebook('old');const rejected=assert.rejects(old,/backup-preparation-unavailable/);
 await tick();service.close();
 const fresh=service.getNotebook('new');await tick();
 const current=workers[0];assert.equal(current.sent[0].id,'new');
 const late=make();release(late);await tick();
 assert.equal(late.terminated,true);assert.equal(late.sent.length,0);assert.equal(current.terminated,false);
 current.reply({requestId:current.sent[0].requestId,result:note});assert.deepEqual(await fresh,note);
 await rejected;service.close();
});

test('A worker factory that never resolves times out and a late completion cannot revive it',async()=>{
 let release;
 const service=createBackupPreparationService({timeout:25,createWorker:()=>new Promise(resolve=>{release=resolve;})});
 const result=service.getNotebook('n');
 const outcome=await Promise.race([result.then(()=> 'resolved',error=>error.message),new Promise(resolve=>setTimeout(()=>resolve('hung'),120))]);
 assert.equal(outcome,'backup-preparation-unavailable');
 const late={sent:[],terminated:false,postMessage(data){this.sent.push(data);},terminate(){this.terminated=true;}};
 release(late);await tick();assert.equal(late.terminated,true);assert.equal(late.sent.length,0);service.close();
});

test('A failed PDF continuation fails the request explicitly instead of throwing from a message event',async()=>{
 const {service,workers}=fixture();
 const result=service.makePdf(note,()=>{});const rejected=assert.rejects(result,/backup-preparation-unavailable/);
 await tick();const worker=workers[0],id=worker.sent[0].requestId;
 worker.postMessage=()=>{throw Error('worker unavailable');};
 assert.doesNotThrow(()=>worker.reply({requestId:id,progress:{page:1,totalPages:1}}));
 await rejected;assert.equal(worker.terminated,true);service.close();
});
