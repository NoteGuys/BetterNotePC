import { openRasterPdf, rasterPdfPage, pdfBytesFromUrl, configurePdfAssets } from '../utils/pdfRaster.js';
import { getBackupNotebookSnapshot, getBackupMetadata } from './db.js';
import { notebookBackupRevision } from '../utils/backupRevision.js';
import { notebookPdfRevision } from './backupController.js';
import { createVerifiedBackupPdfRenderer } from '../utils/backupPdf.js';
import { backupPageDimensions, renderBackupPageImage } from '../utils/backupPageImage.js';
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
let rasterDoc, rasterSource, backupSources=new Map();
const sharpBackupPage = async page => {
  if (!page.pdfLazyRaster) return page;
  if(page.pdfNativeRaster)return {...page,pdfPageImage:await nativeBackground(page)};
  const source=backupSources.get(page.pdfOriginalId);
  if(!source)throw Error('PDF source unavailable');
  if(rasterSource!==source){if(rasterDoc)await rasterDoc.destroy();rasterDoc=await openRasterPdf(await pdfBytesFromUrl(source.dataUrl));rasterSource=source;}
  try{return {...page,pdfPageImage:(await rasterPdfPage(rasterDoc,page.pdfPageNumber,{maxPixels:16000000,maxEdge:8192})).dataUrl};}
  catch(error){if(error.message!=='pdf-native-filter-required')throw error;return {...page,pdfPageImage:await nativeBackground(page)};}
};
const renderer = createVerifiedBackupPdfRenderer({ dimensions: backupPageDimensions,
  renderImage: async (page,templateId,dimensions) => renderBackupPageImage(await sharpBackupPage(page),templateId,dimensions,{decodeSvg}),
  validateImage: async source => { if (!/^data:image\//i.test(source)) throw new Error('pdf-backup-image-invalid'); },
  output: pdf => pdf.output('arraybuffer'),
  yieldForPage: progress => new Promise((resolve,reject) => {
    const timer = setTimeout(() => { gate = null; reject(deferred()); }, 30000);
    gate = proceed => { clearTimeout(timer); gate = null; proceed ? resolve() : reject(deferred()); };
    self.postMessage({ requestId: active, progress });
  })
});
const describe = note => ({ id:note.id,name:note.name,folderId:note.folderId,updatedAt:note.updatedAt,pageCount:note.pageCount,isDeleted:note.isDeleted,
  templateId:note.templateId,paperSize:note.paperSize,orientation:note.orientation,
  pages:note.pages.map(page=>({id:page.id,updatedAt:page.updatedAt,pageIndex:page.pageIndex,templateId:page.templateId,pageWidth:page.pageWidth,pageHeight:page.pageHeight})) });
const execute = async data => {
  active = data.requestId;configurePdfAssets(data.assets);
  try {
    if (data.action === 'metadata') { self.postMessage({requestId:active,result:await getBackupMetadata()}); return; }
    const note = await getBackupNotebookSnapshot(data.id);
    if (!note?.pages?.length) throw new Error('notebook-snapshot-unavailable');
    const description = describe(note);
    if (data.action === 'pdf') {
      if (notebookBackupRevision(note) !== data.revision || notebookPdfRevision(note) !== data.pdfRevision) throw deferred();
      backupSources=new Map(note.pages.filter(p=>p.pdfOriginal).map(p=>[p.pdfOriginal.id,p.pdfOriginal]));
      const bytes = await renderer.render(note,()=>{}, {force:!!data.force});
      self.postMessage({requestId:active,result:bytes},[bytes]);
    } else if (data.action === 'snapshot') {
      const bytes = new TextEncoder().encode(JSON.stringify(note)).buffer;
      if (bytes.byteLength > 272 * 1048576) throw new Error('backup-too-large');
      self.postMessage({requestId:active,result:{...description,backupEncoded:bytes}},[bytes]);
    } else if (data.action === 'describe') self.postMessage({requestId:active,result:description});
    else throw new Error('backup-preparation-failed');
  } catch (error) {
    const safe = ['notebook-snapshot-unavailable','backup-too-large','pdf-backup-deferred'];
    self.postMessage({requestId:active,error:safe.includes(error.message)?error.message:/image/i.test(error.message||'')?'pdf-backup-image-invalid':'backup-preparation-failed'});
  } finally { active = null;backupSources.clear();if(rasterDoc)await rasterDoc.destroy().catch(()=>{});rasterDoc=rasterSource=null; }
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
