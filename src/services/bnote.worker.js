import { decodeBnote, MAX_BNOTE_BYTES } from '../../electron/bnoteFormat.js';
import { importNotebookPagesAtomic, getAllFolders } from './db.js';
self.onmessage=async({data:{file,action,targetFolderId}})=>{
 try {
  if (!file || !Number.isFinite(file.size) || file.size>MAX_BNOTE_BYTES) throw Object.assign(Error(),{code:'bnote-too-large'});
  const note=decodeBnote(new Uint8Array(await file.arrayBuffer()));
  if(action==='validate'){self.postMessage({valid:true});return;}
  const id='nb-'+crypto.randomUUID(),now=Date.now(),{pages,...metadata}=note;
  // A portable file's source folder belongs to the old library, not this device.
  if(targetFolderId!=null && !(await getAllFolders()).some(folder=>folder.id===targetFolderId && !folder.isDeleted))throw Object.assign(Error(),{code:'bnote-folder-missing'});
  const notebook={...metadata,id,folderId:targetFolderId??null,createdAt:now,updatedAt:now,isDeleted:false};
  const imported=pages.map((p,i)=>({...p,id:'page-'+id+'-'+i,notebookId:id,pageIndex:i}));
  const saved=await importNotebookPagesAtomic(notebook,imported,{requireFolder:true});
  self.postMessage({notebook:saved});
 }catch(error){self.postMessage({error:error.code||'bnote-import-failed'});}
};
