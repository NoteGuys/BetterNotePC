import {prepareNotebookBlob} from './notebookBlob.js';
import { openRasterPdf, rasterPdfPage, pdfBytesFromUrl, configurePdfAssets } from '../utils/pdfRaster.js';
import { getPage, getPdfOriginalSource, getBackupMetadata, getBackupNotebookDescription } from './db.js';
import { notebookBackupRevision } from '../utils/backupRevision.js';
import { notebookPdfRevision } from './backupController.js';
import { createVerifiedBackupPdfRenderer } from '../utils/backupPdf.js';
import { backupPageDimensions, renderBackupPageImage } from '../utils/backupPageImage.js';
import { createBackupPdfPageCache, backupPdfPageKey, backupPdfSourceKeys } from './backupPdfPageCache.js';
let gate = null, imageGate = null, rasterGate = null, active = null;
const deferred = () => new Error('pdf-backup-deferred');
const decodeSvg = (src, size) => new Promise((resolve,reject) => {
  const timer = setTimeout(() => { imageGate = null; reject(new Error('pdf-backup-image-invalid')); }, 10000);
  imageGate = data => { clearTimeout(timer); imageGate = null; data.imageError ? reject(new Error(data.imageError)) : resolve(data.bitmap); };
  self.postMessage({requestId:active,decodeImage:{src,size}});
});
const nativeBackground = page => new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{rasterGate=null;reject(Error('PDF raster unavailable'));},60000);
  rasterGate=data=>{clearTimeout(timer);rasterGate=null;data.error?reject(Error(typeof data.error==='string'?data.error:'PDF raster unavailable')):resolve(data.url);};
  self.postMessage({requestId:active,renderPdfBackground:{notebookId:page.notebookId,pdfOriginalId:page.pdfOriginalId,pdfPageNumber:page.pdfPageNumber,pdfLazyRaster:1}});
});
let rasterDoc, rasterSource, sourceKeys=new Map(), pageKeys=new Map(), currentNote;
const pageGate=progress=>new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{gate=null;reject(deferred());},30000);
 gate=proceed=>{clearTimeout(timer);gate=null;proceed?resolve():reject(deferred());};
 self.postMessage({requestId:active,progress});
});
const sourceKey=async id=>{
 if(sourceKeys.has(id))return sourceKeys.get(id);
 const source=await getPdfOriginalSource(currentNote.id,id);if(!source)throw Error('PDF source unavailable');
 const keys=await backupPdfSourceKeys({pages:[{pdfOriginal:source}]});
 const key=keys.get(id);sourceKeys.set(id,key);return key;
};
const readPage=async descriptor=>{
 const page=await getPage(descriptor.id);
 if(!page||page.notebookId!==currentNote.id||page.pageIndex!==descriptor.pageIndex||page.updatedAt!==descriptor.updatedAt)throw deferred();
 return page;
};
const preparePageKey=async(note,descriptor)=>{
 await pageGate({checking:true,totalPages:note.pages.length});
 const page=await readPage(descriptor);
 if(page.pdfOriginalId)await sourceKey(page.pdfOriginalId);
 descriptor.exportDimensions=backupPageDimensions(page,note.templateId);
 const key=await backupPdfPageKey(note,page,sourceKeys);pageKeys.set(page.id,key);return key;
};
const loadVerifiedPage=async descriptor=>{
 const page=await readPage(descriptor);
 if(await backupPdfPageKey(currentNote,page,sourceKeys)!==pageKeys.get(page.id))throw deferred();
 return page;
};
const pageCache=createBackupPdfPageCache();
const sharpBackupPage = async page => {
  if (!page.pdfLazyRaster) return page;
  if(page.pdfNativeRaster)return {...page,pdfPageImage:await nativeBackground(page)};
  if(rasterSource!==page.pdfOriginalId){
    const source=await getPdfOriginalSource(currentNote.id,page.pdfOriginalId);
    if(!source)throw Error('PDF source unavailable');
    const keys=await backupPdfSourceKeys({pages:[{pdfOriginal:source}]});
    if(keys.get(source.id)!==sourceKeys.get(source.id))throw deferred();
    if(rasterDoc)await rasterDoc.destroy();rasterDoc=await openRasterPdf(await pdfBytesFromUrl(source.dataUrl));rasterSource=source.id;
  }
  try{return {...page,pdfPageImage:(await rasterPdfPage(rasterDoc,page.pdfPageNumber,{maxPixels:16000000,maxEdge:8192})).dataUrl};}
  catch(error){if(error.message!=='pdf-native-filter-required')throw error;return {...page,pdfPageImage:await nativeBackground(page)};}
};
const pageDimensions=(page,template)=>page.exportDimensions||backupPageDimensions(page,template);
const renderer = createVerifiedBackupPdfRenderer({ dimensions: pageDimensions,
  persistentCache:pageCache,contentKey:preparePageKey,
  renderImage: async (page,templateId,dimensions) => renderBackupPageImage(await sharpBackupPage(page),templateId,dimensions,{decodeSvg}),
  validateImage: async source => { if (!/^data:image\//i.test(source)) throw new Error('pdf-backup-image-invalid'); },
  output: pdf => pdf.output('arraybuffer'),
  yieldForPage: pageGate
});
const describe = note => ({ id:note.id,name:note.name,folderId:note.folderId,updatedAt:note.updatedAt,pageCount:note.pageCount,isDeleted:note.isDeleted,
  templateId:note.templateId,paperSize:note.paperSize,orientation:note.orientation,
  pages:note.pages.map(page=>({id:page.id,updatedAt:page.updatedAt,pageIndex:page.pageIndex,templateId:page.templateId,pageWidth:page.pageWidth,pageHeight:page.pageHeight})) });
const execute = async data => {
  active = data.requestId;configurePdfAssets(data.assets);
  try {
    if (data.action === 'metadata') { self.postMessage({requestId:active,result:await getBackupMetadata()}); return; }
    if(data.action==='snapshot'){
      const {blob,description}=await prepareNotebookBlob(data.id);
      const bytes=await blob.arrayBuffer();
      self.postMessage({requestId:active,result:{...description,backupEncoded:bytes}},[bytes]);return;
    }
    const note = await getBackupNotebookDescription(data.id);
    if (!note?.pages?.length) throw new Error('notebook-snapshot-unavailable');
    const description = describe(note);
    if (data.action === 'pdf') {
      if (notebookBackupRevision(note) !== data.revision || notebookPdfRevision(note) !== data.pdfRevision) throw deferred();
      currentNote=note;
      const bytes = await renderer.render(note,progress=>{if(progress?.rendered!==undefined)self.postMessage({requestId:active,pdfCacheProgress:progress});}, {force:!!data.force,loadPage:loadVerifiedPage});
      const latest=await getBackupNotebookDescription(note.id);
      if(!latest||notebookBackupRevision(latest)!==data.revision||notebookPdfRevision(latest)!==data.pdfRevision)throw deferred();
      self.postMessage({requestId:active,result:bytes},[bytes]);
    } else if (data.action === 'describe') self.postMessage({requestId:active,result:description});
    else throw new Error('backup-preparation-failed');
  } catch (error) {
    const safe = ['notebook-snapshot-unavailable','backup-too-large','pdf-backup-deferred'];
    self.postMessage({requestId:active,error:safe.includes(error.message)?error.message:/image/i.test(error.message||'')?'pdf-backup-image-invalid':'backup-preparation-failed'});
  } finally { active = null;currentNote=null;pageKeys.clear();sourceKeys.clear();if(rasterDoc)await rasterDoc.destroy().catch(()=>{});rasterDoc=rasterSource=null; }
};

// Metadata refresh can arrive while PDF awaits an idle check. Control messages
// bypass the queue; data reads run sequentially and never cancel another request.
let queue = Promise.resolve();
self.onmessage = ({data}) => {
  if (data.action === 'raster') {if(data.requestId===active)rasterGate?.(data);return;}
  if (data.action === 'image') { if (data.requestId === active && imageGate) imageGate(data); else data.bitmap?.close(); return; }
  if (data.action === 'continue') { if (data.requestId === active) gate?.(data.proceed); return; }
  queue = queue.then(()=>execute(data));
};
