const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{EventEmitter}=require('node:events');
const {sanitizeEvent,createDiagnosticLog}=require('../electron/performanceDiagnostics.cjs');
const {createImageReader}=require('../electron/imageRead.cjs');
const qa=process.env.BETTERNOTE_QA_TEMP;
test('Diagnostic event allowlist excludes personal data, raw errors and GPU model names',()=>{
 const clean=sanitizeEvent({event:'renderer-gone',reason:'oom',exitCode:-1,path:'PRIVATE',notebook:'PRIVATE',message:'PRIVATE',type:'Renderer'});
 assert.deepEqual(clean,{event:'renderer-gone',reason:'oom',type:'Renderer',exitCode:-1});assert.equal(sanitizeEvent({event:'unknown'}),null);
 assert.deepEqual(sanitizeEvent({event:'gpu-info',vendorId:4318,deviceId:7815,driverVersion:'32.0.15.8180',model:'PRIVATE'}),{event:'gpu-info',vendorId:4318,deviceId:7815,driverVersion:'32.0.15.8180'});assert.equal(sanitizeEvent({event:'gpu-info',driverVersion:'PRIVATE'}).driverVersion,undefined);
 assert.deepEqual(sanitizeEvent({event:'performance',category:'ink',count:1,p95:5,points:[1],filename:'PRIVATE'}),{event:'performance',category:'ink',count:1,p95:5});
});
test('Local diagnostics rotate at a bounded size and exported reports contain only allowed data',async()=>{
 assert.ok(qa,'Isolated QA folder required');const root=await fs.mkdtemp(path.join(qa,'diagnostics-'));const log=createDiagnosticLog({directory:root,version:'1.3.0',runtime:'44',maxBytes:300});
 for(let i=0;i<20;i++){log.record({event:'renderer-gone',reason:'crashed',filename:'PRIVATE'});await log.flush();}
 for(const entry of await fs.readdir(root))assert.ok((await fs.stat(path.join(root,entry))).size<=300);
 const destination=path.join(root,'report.jsonl');await log.exportReport(destination);const text=await fs.readFile(destination,'utf8');assert.ok(text.includes('renderer-gone'));assert.equal(text.includes('PRIVATE'),false);assert.ok(Buffer.byteLength(text)<=600);
});
test('Image worker returns real image bytes and safe errors without blocking other main-loop work',async()=>{
 assert.ok(qa);const root=await fs.mkdtemp(path.join(qa,'image-')),file=path.join(root,'test.png');await fs.writeFile(file,Buffer.from('png-fixture'));
 const read=createImageReader();const result=await read(file);assert.equal(result.success,true);assert.equal(Buffer.from(result.dataUrl.split(',')[1],'base64').toString(),'png-fixture');
 assert.deepEqual(await read(path.join(root,'missing.png')),{success:false,error:'image-read-failed'});
 const large=path.join(root,'large.png');const handle=await fs.open(large,'w');await handle.truncate(128*1024*1024+1);await handle.close();assert.equal((await read(large)).error,'image-too-large');
});
test('Stalled image reads time out, reject duplicate work and release the reader for retry',async()=>{
 let worker;const read=createImageReader({timeout:20,makeWorker:()=>{worker=new EventEmitter();worker.terminate=async()=>{worker.emit('exit',1);};return worker;}});
 const job=read('test.png');assert.equal((await read('other.png')).error,'image-read-busy');let ticks=0;const timer=setInterval(()=>ticks++,1);
 assert.equal((await job).error,'image-read-timeout');clearInterval(timer);assert.ok(ticks>0);assert.equal((await read('retry.png')).error,'image-read-timeout');
});


const {configureGpuProfile}=require('../electron/gpuProfile.cjs');
test('GPU default A/B profile is opt-in in test builds and never disables hardware acceleration',()=>{
 const calls=[];const app={isPackaged:false,commandLine:{appendSwitch:(...args)=>calls.push(args)}};
 assert.equal(configureGpuProfile(app,{profile:'default'}),'default');assert.equal(calls.length,0);
 assert.equal(configureGpuProfile(app,{profile:'legacy'}),'legacy');assert.equal(calls.length,5);calls.length=0;
 assert.equal(configureGpuProfile(app,{packaged:true,profile:'default'}),'legacy');assert.equal(calls.length,5);assert.equal(calls.some(c=>c[0]==='disable-gpu'),false);
});

