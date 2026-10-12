import {openDB} from './db.js';
import {assertJsonSize} from '../utils/jsonSizeBudget.js';
// One readonly transaction is one consistent library snapshot. Serialize page by
// page in the worker, retaining Blob fragments rather than full page object graphs.
export const exportLibraryBlob=async(maxBytes=256*1024*1024)=>{
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(['folders','notebooks','pages'],'readonly'),chunks=[];
  let size=0,failure,firstNote=true,folderCount=0;
  const append=text=>{const blob=text instanceof Blob?text:new Blob([text]);size+=blob.size;if(size>maxBytes)throw Error('backup-too-large');chunks.push(blob);};
  const safe=fn=>()=>{try{fn();}catch(error){failure=error;tx.abort();}};
  append('{"version":1,"appName":"BetterNote","exportDate":'+JSON.stringify(new Date().toISOString())+',"folders":[');
  const folders=tx.objectStore('folders').openCursor();
  folders.onsuccess=safe(()=>{const c=folders.result;if(c){append((folderCount++?',':'')+JSON.stringify(c.value));c.continue();return;}
   append('],"notebooks":[');
   const notes=tx.objectStore('notebooks').openCursor();
   notes.onsuccess=safe(()=>{const note=notes.result;if(!note){append(']}');return;}
    const header=JSON.stringify(note.value);append((firstNote?'':',')+header.slice(0,-1)+',"pages":[');firstNote=false;
    const fragments=[];let pendingBytes=0;const pages=tx.objectStore('pages').index('notebookId').openCursor(note.value.id);
    pages.onsuccess=safe(()=>{const p=pages.result;if(p){assertJsonSize(p.value,maxBytes-size-pendingBytes);const blob=new Blob([JSON.stringify(p.value)]);pendingBytes+=blob.size;if(size+pendingBytes>maxBytes)throw Error('backup-too-large');fragments.push({index:p.value.pageIndex,blob});p.continue();}
     else{fragments.sort((a,b)=>a.index-b.index).forEach((item,index)=>{if(index)append(',');append(item.blob);});append(']}');note.continue();}});
   });
  });
  tx.oncomplete=()=>resolve(new Blob(chunks,{type:'application/json'}));
  tx.onabort=()=>reject(failure||tx.error||Error('backup-export-failed'));tx.onerror=()=>{};
 });
};
if(typeof WorkerGlobalScope!=='undefined' && self instanceof WorkerGlobalScope)self.onmessage=async()=>{try{self.postMessage({blob:await exportLibraryBlob()});}catch(error){self.postMessage({error:error.message==='backup-too-large'?'backup-too-large':'backup-export-failed'});}};

