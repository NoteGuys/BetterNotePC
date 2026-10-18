import {openDB} from './db.js';
import {assertJsonSize} from '../utils/jsonSizeBudget.js';
import {createNotebookValidator} from '../../electron/backupValidation.js';

// One transaction gives a consistent snapshot. Rich page objects are released
// after serialization; only Blob fragments and navigation metadata are retained.
export const prepareNotebookBlob=async(id,{portable=false,maxBytes=272*1048576}={})=>{
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(['notebooks','pages'],'readonly');
  let notebook,count,validator,problem,blob,description,size=0;
  const fragments=[],metadata=[],chunks=[];
  const append=part=>{const chunk=part instanceof Blob?part:new Blob([part]);size+=chunk.size;if(size>maxBytes)throw Error('backup-too-large');chunks.push(chunk);};
  const safe=fn=>()=>{try{fn();}catch(error){problem=error;tx.abort();}};
  const noteRequest=tx.objectStore('notebooks').get(id),index=tx.objectStore('pages').index('notebookId');
  noteRequest.onsuccess=safe(()=>{notebook=noteRequest.result;begin();});
  const countRequest=index.count(id);countRequest.onsuccess=safe(()=>{count=countRequest.result;begin();});
  const begin=()=>{
   if(notebook===undefined||count===undefined)return;
   if(!notebook||!count)throw Error('notebook-snapshot-unavailable');
   validator=createNotebookValidator(notebook,count);
   assertJsonSize(notebook,maxBytes);
   const header=JSON.stringify(notebook);
   append(portable?'{"format":"BetterNote_Document","version":1,"exportedAt":'+JSON.stringify(new Date().toISOString())+',"notebook":'+header+',"pages":[':header.slice(0,-1)+',"pages":[');
   const request=index.openCursor(id);
   request.onsuccess=safe(()=>{
    const cursor=request.result;
    if(cursor){
     const page=cursor.value;validator.page(page,fragments.length);
     assertJsonSize(page,maxBytes-size);
     const chunk=new Blob([JSON.stringify(page)]);size+=chunk.size;if(size>maxBytes)throw Error('backup-too-large');
     fragments.push({index:page.pageIndex,chunk});
     metadata.push({id:page.id,updatedAt:page.updatedAt,pageIndex:page.pageIndex,templateId:page.templateId,pageWidth:page.pageWidth,pageHeight:page.pageHeight});
     cursor.continue();return;
    }
    validator.finish();fragments.sort((a,b)=>a.index-b.index);
    fragments.forEach((item,i)=>{if(i)append(',');chunks.push(item.chunk);});append(']}');
    blob=new Blob(chunks,{type:'application/json'});
    const {pages,...headerFields}=notebook;
    description={...headerFields,pages:metadata.sort((a,b)=>a.pageIndex-b.pageIndex)};
   });
  };
  tx.oncomplete=()=>blob?resolve({blob,description}):reject(Error('notebook-snapshot-unavailable'));
  tx.onabort=()=>reject(problem||tx.error||Error('notebook-snapshot-unavailable'));tx.onerror=()=>{};
 });
};
