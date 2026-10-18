const {parentPort,workerData}=require('node:worker_threads');
const {readImageDataUrl}=require('./imageReadBase64.cjs');
(async()=>{
 try{
  const dataUrl=await readImageDataUrl(workerData.file,workerData.mime,{progress:()=>parentPort.postMessage({progress:true})});
  parentPort.postMessage({success:true,dataUrl,width:600,height:450});
 }catch(error){parentPort.postMessage({success:false,error:error.message==='image-too-large'?'image-too-large':'image-read-failed'});}
})();
