import { nativePdfRaster } from './pdfRasterService.js';
import { notebookBackupRevision } from '../utils/backupRevision.js';
import { notebookPdfRevision } from './backupController.js';
// SVG and uncommon PDF filters use Chromium's DOM renderer; PDF assembly remains off-thread.
const decodeSvg = ({src,size}) => new Promise((resolve,reject) => {
  if (!/^data:image\/svg\+xml[;,]/i.test(src) || ![size?.resizeWidth,size?.resizeHeight].every(n=>Number.isInteger(n)&&n>0&&n<=8192) || size.resizeWidth*size.resizeHeight>16000000)
    { reject(new Error('pdf-backup-image-invalid')); return; }
  const image = new Image();
  const finish = () => { clearTimeout(timer); image.onload=image.onerror=null; };
  const timer = setTimeout(()=>{finish();reject(new Error('pdf-backup-image-invalid'));},3000);
  image.onerror = () => { finish(); reject(new Error('pdf-backup-image-invalid')); };
  image.onload = async () => { finish(); try { resolve(await createImageBitmap(image,size)); } catch (_) { reject(new Error('pdf-backup-image-invalid')); } };
  image.src = src;
});
// One lazily started, offline worker. Only headers/binary bytes cross the UI thread.
export const createBackupPreparationService = ({ createWorker = async () => { const {default: Worker} = await import('./backupPreparation.worker.js?worker&inline'); return new Worker(); }, idleLifetime = 45000, timeout = 120000 } = {}) => {
  let worker = null, starting = null, idleTimer, counter = 0;
  const pending = new Map();
  const close = () => {
    clearTimeout(idleTimer); worker?.terminate(); worker = null;
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('backup-preparation-unavailable')); }
    pending.clear();
  };
  const request = async (command, check) => {
    clearTimeout(idleTimer);
    if (!worker) {
      try { worker = await (starting ||= Promise.resolve().then(createWorker)); } finally { starting = null; }
      const instance = worker;
      worker.onerror = () => { if (worker === instance) close(); }; worker.onmessageerror = worker.onerror;
      worker.onmessage = ({data}) => {
        if (worker !== instance) return;
        const item = pending.get(data.requestId); if (!item) return;
        if (data.renderPdfBackground) {
          item.arm();
          Promise.resolve().then(()=>{item.check?.();return nativePdfRaster(data.renderPdfBackground);}).then(result=>{
            if(worker===instance&&pending.has(data.requestId)){item.check?.();instance.postMessage({action:'raster',requestId:data.requestId,url:result.dataUrl});}
          }).catch(error=>{if(worker===instance)instance.postMessage({action:'raster',requestId:data.requestId,error:error.message==='pdf-backup-deferred'?'pdf-backup-deferred':'PDF raster unavailable'});});
          return;
        }
        if (data.decodeImage) {
          item.arm();
          Promise.resolve().then(()=>{item.check?.(); return decodeSvg(data.decodeImage);}).then(bitmap=>{
            if (worker !== instance || !pending.has(data.requestId)) { bitmap.close(); return; }
            try { instance.postMessage({action:'image',requestId:data.requestId,bitmap},[bitmap]); } catch (_) { bitmap.close(); close(); }
          },error=>{ if (worker === instance) instance.postMessage({action:'image',requestId:data.requestId,imageError:error.message==='pdf-backup-deferred'?'pdf-backup-deferred':'pdf-backup-image-invalid'}); });
          return;
        }
        if(data.pdfCacheProgress){item.arm();try{item.check?.(data.pdfCacheProgress);}catch(_){}return;}
        if (data.progress) {
          item.arm(); let proceed = true;
          try { item.check?.(data.progress); } catch (_) { proceed = false; }
          worker.postMessage({action:'continue',requestId:data.requestId,proceed}); return;
        }
        pending.delete(data.requestId); clearTimeout(item.timer);
        if (data.error) item.reject(new Error(data.error)); else item.resolve(data.result);
        if (!pending.size) idleTimer = setTimeout(close,idleLifetime);
      };
    }
    return new Promise((resolve,reject) => {
      const requestId = ++counter, item = {resolve,reject,check};
      item.arm = () => { clearTimeout(item.timer); item.timer = setTimeout(close,timeout); };
      pending.set(requestId,item); item.arm();
      (async()=>{try { const assets=command.action==='pdf'&&typeof window!=='undefined'?(await import('../utils/pdfAssetUrls.js')).pdfAssets():undefined; if(worker&&pending.has(requestId))worker.postMessage({...command,requestId,...(assets?{assets}:{})}); } catch (_) { close(); }})();
    });
  };
  return { close,
    getMetadata: () => request({action:'metadata'}),
    getNotebook: (id, options = {}) => request({action:options.pdf?'describe':'snapshot',id}),
    makePdf: async (note, check, options = {}) => {
      check(); const result = await request({action:'pdf',id:note.id,revision:notebookBackupRevision(note),pdfRevision:notebookPdfRevision(note),force:!!options.force},check);
      check(); return result;
    }
  };
};
