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
    clearTimeout(idleTimer);
    const instance = worker;
    worker = null; starting = null;
    if (instance) { instance.onmessage=instance.onerror=instance.onmessageerror=null; instance.terminate(); }
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('backup-preparation-unavailable')); }
    pending.clear();
  };
  const isCurrent = (instance,requestId,item) => worker===instance && pending.get(requestId)===item;
  const send = (instance,requestId,item,data,transfer) => {
    if (!isCurrent(instance,requestId,item)) return false;
    try { instance.postMessage(data,transfer); return true; }
    catch (_) { close(); return false; }
  };
  const attach = instance => {
    instance.onerror = () => { if (worker===instance) close(); }; instance.onmessageerror=instance.onerror;
    instance.onmessage = ({data}) => {
      if (worker!==instance) return;
      if (!data || typeof data!=='object') { close(); return; }
      const item=pending.get(data.requestId); if (!item) return;
      if (data.renderPdfBackground) {
        item.arm();
        Promise.resolve().then(()=>{item.check?.();return nativePdfRaster(data.renderPdfBackground);}).then(result=>{
          if (isCurrent(instance,data.requestId,item)) { item.check?.(); send(instance,data.requestId,item,{action:'raster',requestId:data.requestId,url:result.dataUrl}); }
        }).catch(error=>{send(instance,data.requestId,item,{action:'raster',requestId:data.requestId,error:error?.message==='pdf-backup-deferred'?'pdf-backup-deferred':'PDF raster unavailable'});});
        return;
      }
      if (data.decodeImage) {
        item.arm();
        Promise.resolve().then(()=>{item.check?.();return decodeSvg(data.decodeImage);}).then(bitmap=>{
          if (!isCurrent(instance,data.requestId,item)) { bitmap.close(); return; }
          try { item.check?.(); } catch (_) { bitmap.close(); send(instance,data.requestId,item,{action:'image',requestId:data.requestId,imageError:'pdf-backup-deferred'}); return; }
          if (!send(instance,data.requestId,item,{action:'image',requestId:data.requestId,bitmap},[bitmap])) bitmap.close();
        },error=>{send(instance,data.requestId,item,{action:'image',requestId:data.requestId,imageError:error?.message==='pdf-backup-deferred'?'pdf-backup-deferred':'pdf-backup-image-invalid'});});
        return;
      }
      if (data.pdfCacheProgress) { item.arm(); try { item.check?.(data.pdfCacheProgress); } catch (_) {} return; }
      if (data.progress) {
        item.arm(); let proceed=true;
        try { item.check?.(data.progress); } catch (_) { proceed=false; }
        send(instance,data.requestId,item,{action:'continue',requestId:data.requestId,proceed}); return;
      }
      pending.delete(data.requestId); clearTimeout(item.timer);
      if (data.error) item.reject(new Error(data.error)); else item.resolve(data.result);
      if (!pending.size) idleTimer=setTimeout(close,idleLifetime);
    };
  };
  const acquire = () => {
    if (worker) return Promise.resolve(worker);
    if (!starting) {
      const startup={}; starting=startup;
      startup.promise=Promise.resolve().then(createWorker).then(instance=>{
        // A factory may finish after close/timeout. It must never revive an old session.
        if (starting!==startup) { instance.terminate(); throw new Error('backup-preparation-unavailable'); }
        worker=instance; starting=null; attach(instance); return instance;
      },error=>{if (starting===startup) starting=null; throw error;});
    }
    return starting.promise;
  };
  const request = (command,check) => new Promise((resolve,reject) => {
    clearTimeout(idleTimer);
    const requestId=++counter,item={resolve,reject,check};
    item.arm=()=>{clearTimeout(item.timer);item.timer=setTimeout(()=>{if(pending.get(requestId)===item)close();},timeout);};
    pending.set(requestId,item); item.arm();
    (async()=>{
      try {
        const instance=await acquire();
        if (!isCurrent(instance,requestId,item)) return;
        const assets=command.action==='pdf'&&typeof window!=='undefined'?(await import('../utils/pdfAssetUrls.js')).pdfAssets():undefined;
        send(instance,requestId,item,{...command,requestId,...(assets?{assets}:{})});
      } catch (_) { if (pending.get(requestId)===item) close(); }
    })();
  });
  return { close,
    getMetadata: () => request({action:'metadata'}),
    getNotebook: (id, options = {}) => request({action:options.pdf?'describe':'snapshot',id}),
    makePdf: async (note, check, options = {}) => {
      check(); const result = await request({action:'pdf',id:note.id,revision:notebookBackupRevision(note),pdfRevision:notebookPdfRevision(note),force:!!options.force},check);
      check(); return result;
    }
  };
};
