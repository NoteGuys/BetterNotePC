const fs=require('node:fs/promises');
const {constants}=require('node:buffer');
// This is the runtime's string representation limit, not a product file-size
// policy. Keep original bytes; only a small binary read buffer is allocated.
const imageDataUrlLength=(size,mime)=>{
 if(!Number.isSafeInteger(size)||size<0)throw Error('image-read-failed');
 const length=4*Math.ceil(size/3)+('data:'+mime+';base64,').length;
 if(length>constants.MAX_STRING_LENGTH)throw Error('image-too-large');
 return length;
};
const readImageDataUrl=async(file,mime,{chunkBytes=3*1024*1024,progress=()=>{}}={})=>{
 if(!Number.isInteger(chunkBytes)||chunkBytes<3||chunkBytes%3)throw Error('image-read-failed');
 let handle;
 try{
  handle=await fs.open(file,'r');const info=await handle.stat();
  if(!info.isFile())throw Error('image-read-failed');imageDataUrlLength(info.size,mime);
  const buffer=Buffer.allocUnsafe(Math.min(chunkBytes,info.size)),parts=[];let offset=0;
  while(offset<info.size){
   const wanted=Math.min(buffer.length,info.size-offset);let filled=0;
   while(filled<wanted){
    const {bytesRead}=await handle.read(buffer,filled,Math.min(1048576,wanted-filled),offset+filled);
    if(!bytesRead)throw Error('image-read-failed');filled+=bytesRead;progress(offset+filled);
   }
   parts.push(buffer.subarray(0,filled).toString('base64'));offset+=filled;
  }
  const after=await handle.stat();if(after.size!==info.size||after.mtimeMs!==info.mtimeMs)throw Error('image-read-failed');
  return 'data:'+mime+';base64,'+parts.join('');
 }finally{await handle?.close().catch(()=>{});}
};
module.exports={imageDataUrlLength,readImageDataUrl};
