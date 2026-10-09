export function processBnote(file,action='validate',targetFolderId=null){
 return import('./bnote.worker.js?worker&inline').then(({default:Worker})=>new Promise((resolve,reject)=>{
  const worker=new Worker();let settled=false;
  const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();error?reject(Object.assign(Error(error),{code:error})):resolve(result);};
  // Validation is cancellable. An import must wait for the atomic transaction's result.
  const timer=action==='validate'?setTimeout(()=>finish('bnote-timeout'),120000):null;
  worker.onmessage=({data})=>finish(data.error,data);worker.onerror=e=>{e.preventDefault();finish('bnote-import-failed');};
  try{worker.postMessage({file,action,targetFolderId});}catch(_){finish('bnote-import-failed');}
 }));
}
export const validateBnoteBlob=blob=>processBnote(blob);
export const importPortableBnote=async(file,targetFolderId)=> (await processBnote(file,'import',targetFolderId)).notebook;
export async function saveNativeBnote(blob,name,api){
 const begin=await api.saveBnote({action:'begin',name,size:blob.size});
 if(begin?.cancelled)return false;
 if(!begin?.success)throw Error(begin?.reason||'bnote-save-failed');
 try{
  for(let offset=0;offset<blob.size;offset+=2*1048576){
   const bytes=await blob.slice(offset,offset+2*1048576).arrayBuffer();
   const result=await api.saveBnote({action:'chunk',id:begin.id,offset,bytes});
   if(!result?.success)throw Error(result?.reason||'bnote-save-failed');
  }
  const result=await api.saveBnote({action:'finish',id:begin.id});
  if(!result?.success)throw Error(result?.reason||'bnote-save-failed');
  return true;
 }catch(error){await api.saveBnote({action:'abort',id:begin.id}).catch(()=>{});throw error;}
}
