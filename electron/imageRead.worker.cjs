const {parentPort,workerData}=require('node:worker_threads');
const fs=require('node:fs/promises');
(async()=>{
 let handle;
 try {
  handle=await fs.open(workerData.file,'r');const info=await handle.stat();
  if(!info.isFile()||info.size>128*1024*1024)throw Error('image-too-large');
  const data=Buffer.allocUnsafe(info.size);let offset=0;
  while(offset<data.length){const {bytesRead}=await handle.read(data,offset,Math.min(1024*1024,data.length-offset),offset);if(!bytesRead)throw Error('image-read-failed');offset+=bytesRead;}
  const after=await handle.stat();if(after.size!==info.size||after.mtimeMs!==info.mtimeMs)throw Error('image-read-failed');
  parentPort.postMessage({success:true,dataUrl:'data:'+workerData.mime+';base64,'+data.toString('base64'),width:600,height:450});
 }catch(error){parentPort.postMessage({success:false,error:error.message==='image-too-large'?'image-too-large':'image-read-failed'});}
 finally{await handle?.close().catch(()=>{});}
})();

