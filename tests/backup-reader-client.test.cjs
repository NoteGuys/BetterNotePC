const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createBackupReaderClient}=require('../electron/backupReaderClient.cjs');
const {mock}=test;
const setup=()=>{let instance;class FakeWorker extends EventEmitter{constructor(){super();instance=this;this.commands=[];this.stopped=false;}unref(){}postMessage(message){this.commands.push(message);}terminate(){this.stopped=true;return Promise.resolve();}}
 return {create:options=>createBackupReaderClient({WorkerClass:FakeWorker,...options}),worker:()=>instance};};
test('Real read progress extends idle time without abandoning a queued preview',async()=>{
 mock.timers.enable({apis:['setTimeout']});const env=setup(),client=env.create({timeoutMs:100,maxDurationMs:1000});
 try{const a=client.execute({folderPath:'X:/selected'}),b=client.execute({folderPath:'X:/selected',previewOnly:true});const worker=env.worker();
  for(let i=0;i<4;i++){mock.timers.tick(70);worker.emit('message',{requestId:worker.commands[0].requestId,progress:{stage:'reading',bytesDone:i+1,totalBytes:5}});}
  assert.equal(worker.stopped,false);worker.emit('message',{requestId:worker.commands[0].requestId,result:{success:true,count:2}});worker.emit('message',{requestId:worker.commands[1].requestId,result:{success:true,count:2}});
  assert.equal((await a).success,true);assert.equal((await b).success,true);
 }finally{await client.close();mock.timers.reset();}
});
test('No progress stops a stuck read, and late success from its old worker is ignored',async()=>{
 mock.timers.enable({apis:['setTimeout']});const env=setup(),client=env.create({timeoutMs:100,maxDurationMs:1000});
 try{const a=client.execute({folderPath:'X:/selected'}),worker=env.worker();mock.timers.tick(101);assert.equal((await a).reason,'backup-read-timeout');assert.equal(worker.stopped,true);
  worker.emit('message',{requestId:1,result:{success:true}});const b=client.execute({folderPath:'X:/selected'});assert.notEqual(env.worker(),worker);env.worker().emit('message',{requestId:2,result:{success:true}});assert.equal((await b).success,true);
 }finally{await client.close();mock.timers.reset();}
});
test('The hard reading limit still stops work even if byte progress keeps arriving',async()=>{
 mock.timers.enable({apis:['setTimeout']});const env=setup(),client=env.create({timeoutMs:100,maxDurationMs:300});
 try{const a=client.execute({folderPath:'X:/selected'}),worker=env.worker();for(let i=0;i<4;i++){mock.timers.tick(70);worker.emit('message',{requestId:1,progress:{bytesDone:i+1,totalBytes:9}});}mock.timers.tick(21);
  assert.equal((await a).reason,'backup-read-timeout');assert.equal(worker.stopped,true);
 }finally{await client.close();mock.timers.reset();}
});
test('Closing clears idle and hard timers and cannot fabricate a complete read',async()=>{
 mock.timers.enable({apis:['setTimeout']});const env=setup(),client=env.create({timeoutMs:100,maxDurationMs:300});
 try{const pending=client.execute({folderPath:'X:/selected'});await client.close();assert.equal((await pending).reason,'backup-reader-unavailable');mock.timers.tick(1000);assert.equal(env.worker().stopped,true);
 }finally{mock.timers.reset();}
});
