const {Worker}=require('node:worker_threads');
const path=require('node:path');
const MIME={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',bmp:'image/bmp',gif:'image/gif',svg:'image/svg+xml',avif:'image/avif'};
const createImageReader=({makeWorker=data=>new Worker(path.join(__dirname,'imageRead.worker.cjs'),{workerData:data}),timeout=30000}={})=>{
 let busy=false;
 return async file=>{
  const mime=MIME[path.extname(file||'').slice(1).toLowerCase()];if(!mime)return {success:false,error:'unsupported-image'};
  if(busy)return {success:false,error:'image-read-busy'};busy=true;
  let worker;
  try{return await new Promise(resolve=>{
   let settled=false;const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);resolve(result);};
   let timer;const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{finish({success:false,error:'image-read-timeout'});worker?.terminate();},timeout);};arm();
   try{worker=makeWorker({file,mime});worker.on('message',result=>{if(settled)return;if(result?.progress===true)arm();else finish(result);});worker.once('error',()=>finish({success:false,error:'image-read-failed'}));worker.once('exit',()=>{busy=false;finish({success:false,error:'image-read-failed'});});}
   catch(_){busy=false;finish({success:false,error:'image-read-failed'});}
  });}finally{if(worker)await worker.terminate().catch(()=>{});else busy=false;}
 };
};
module.exports={createImageReader};

