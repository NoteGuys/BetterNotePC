// Rebuildable PDF page images live separately from the user's notes database.
// Used only by the backup worker; quota/eviction never modifies notes or backups.
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
export const backupPdfPageKey=async(note,page,sources=new Map())=>sha(new TextEncoder().encode(JSON.stringify([
 'backup-jpeg-150dpi-v1',note.templateId,note.paperSize,note.orientation,
 page.templateId,page.sizeId,page.pageWidth,page.pageHeight,page.paperColor,
 page.strokes||[],page.textElements||[],page.imageElements||[],page.pdfPageImage||null,
 page.pdfOriginalId||null,page.pdfPageNumber||null,sources.get(page.pdfOriginalId)||null
])));
export const backupPdfSourceKeys=async note=>{
 const sources=new Map();
 for(const page of note.pages)if(page.pdfOriginal?.id&&!sources.has(page.pdfOriginal.id))sources.set(page.pdfOriginal.id,await sha(new TextEncoder().encode(page.pdfOriginal.dataUrl||'')));
 return sources;
};
export const createBackupPdfPageCache=({name='BetterNoteBackupPdfPages',maxBytes=256*1048576,maxEntries=2048}={})=>{
 let opening,protectedKeys=new Set();
 const open=()=>opening||=(new Promise((resolve,reject)=>{
  const request=indexedDB.open(name,1);
  request.onupgradeneeded=()=>{request.result.createObjectStore('images',{keyPath:'key'});request.result.createObjectStore('metadata',{keyPath:'key'});};
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();opening=null;};resolve(db);};
  request.onerror=()=>{opening=null;reject(request.error);};
 }));
 const remove=async key=>{const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(['images','metadata'],'readwrite');tx.objectStore('images').delete(key);tx.objectStore('metadata').delete(key);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});};
 return {
  protect(keys){protectedKeys=new Set(keys);},
  async get(key){
   const db=await open();const item=await new Promise((resolve,reject)=>{
    const tx=db.transaction(['images','metadata'],'readonly');let image,meta;
    tx.objectStore('images').get(key).onsuccess=e=>image=e.target.result;
    tx.objectStore('metadata').get(key).onsuccess=e=>meta=e.target.result;
    tx.oncomplete=()=>resolve({image,meta});tx.onabort=()=>reject(tx.error);
   });
   if(!item.image||!item.meta)return null;
   const bytes=item.image.bytes;
   if(!(bytes instanceof Uint8Array)||bytes.byteLength!==item.meta.size||bytes[0]!==255||bytes[1]!==216||await sha(bytes)!==item.meta.digest){await remove(key);return null;}
   return bytes;
  },
  async put(key,bytes,{notebookId,pageId}={}){
   if(!(bytes instanceof Uint8Array)||!bytes.byteLength||bytes.byteLength>Math.min(maxBytes,16*1048576))return;
   const digest=await sha(bytes),db=await open();
   return new Promise((resolve,reject)=>{
    const tx=db.transaction(['images','metadata'],'readwrite'),images=tx.objectStore('images'),meta=tx.objectStore('metadata');
    images.put({key,bytes});meta.put({key,size:bytes.byteLength,digest,notebookId,pageId,used:Date.now()});
    // This is a lightweight metadata-only scan, never getAll() of image buffers.
    meta.getAll().onsuccess=e=>{
     const rows=e.target.result.sort((a,b)=>(protectedKeys.has(b.key)&&b.key!==key)-(protectedKeys.has(a.key)&&a.key!==key)||(b.key===key)-(a.key===key)||b.used-a.used),kept=[];let total=0;
     for(const row of rows){
      if(row.key!==key&&row.notebookId===notebookId&&row.pageId===pageId||kept.length>=maxEntries||total+row.size>maxBytes){meta.delete(row.key);images.delete(row.key);}
      else{kept.push(row);total+=row.size;}
     }
    };
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>{};
   });
  },
  async close(){const db=await opening?.catch(()=>null);db?.close();opening=null;}
 };
};
