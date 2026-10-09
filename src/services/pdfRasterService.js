// Shared, priority-ordered PDF work: ready page images remain visible while it runs.
import { appCacheService } from './appCacheService.js';
import { pagePreviewEpoch } from './pagePreviewState.js';
import { getPdfOriginalSource } from './db.js';
import { createNotebookCoverInputGuard } from './notebookCoverService.js';
const jobs=new Map();
const guard=createNotebookCoverInputGuard(typeof window==='undefined'?null:window);
let worker,active,timer,idleTimer,generation=0;
const keyOf=(page,quality='display')=>'pdf-raster:'+JSON.stringify([page.notebookId,page.pdfOriginalId,page.pdfOriginalDigest,page.pdfPageNumber,pagePreviewEpoch(page.notebookId),quality]);
const close=()=>{worker?.terminate();worker=null;};
const idle=()=>guard.canRun()&&!globalThis.window?.__bn_pen_active&&!globalThis.window?.__bn_drag_active;
export const nativePdfRaster=async (page,quality='export')=>{
  const source=await getPdfOriginalSource(page.notebookId,page.pdfOriginalId);
  if(!/^data:application\/pdf(?:;[^,]*)?;base64,/i.test(source?.dataUrl||''))throw Error('PDF source unavailable');
  const {loadPdfFromFile,renderPageToImage}=await import('./pdfService.js');
  const {pdfDoc}=await loadPdfFromFile(new Blob([await(await fetch(source.dataUrl)).arrayBuffer()],{type:'application/pdf'}));
  try{return await renderPageToImage(pdfDoc,page.pdfPageNumber,2,quality==='export'?8192:4096,quality==='export'?16000000:4000000);}finally{await pdfDoc.destroy();}
};
const request=async job=>{
  clearTimeout(idleTimer);
  if(!worker){const {default:RasterWorker}=await import('./pdfRaster.worker.js?worker&inline');worker=new RasterWorker();}
  if(!job.consumers.size)return null;
  const result=await new Promise((resolve,reject)=>{
    const instance=worker;
    const finish=(error,value)=>{clearTimeout(timeout);instance.onmessage=instance.onerror=null;job.cancel=null;error?reject(error):resolve(value);};
    const timeout=setTimeout(()=>{close();finish(Error('PDF raster timeout'));},60000);
    job.cancel=()=>{close();finish(Error('PDF raster paused'));};
    instance.onerror=e=>{e.preventDefault();close();finish(Error('PDF raster unavailable'));};
    instance.onmessage=({data})=>{if(data.error)finish(Error(data.error));else if(data.result)finish(null,data.result);};
    (async()=>{try{const {pdfAssets}=await import('../utils/pdfAssetUrls.js');if(!job.consumers.size){job.cancel?.();return;}instance.postMessage({action:'raster',assets:pdfAssets(),page:job.page,quality:job.quality});}catch(_){close();finish(Error('PDF raster unavailable'));}})();
  });
  return result.dataUrl;
};
const settle=(job,error,url)=>{
  for(const item of job.consumers){item.signal?.removeEventListener('abort',item.cancel);error?item.reject(error):item.resolve(url);}
  job.consumers.clear();
};
const schedule=()=>{
  clearTimeout(timer);
  if(active)return;
  if(!jobs.size){guard.stop();idleTimer=setTimeout(close,15000);return;}
  timer=setTimeout(pump,0);
};
const pump=async()=>{
  if(active||!jobs.size)return;
  if(!idle()||globalThis.document?.hidden){timer=setTimeout(pump,100);return;}
  const job=[...jobs.values()].find(j=>j.priority===0)||jobs.values().next().value;
  jobs.delete(job.key);active=job;const epoch=generation;
  try{
    let url=appCacheService.get(job.key);
    if(!url){
      try{url=job.page.pdfNativeRaster?(await nativePdfRaster(job.page,job.quality)).dataUrl:await request(job);}
      catch(error){if(error.message!=='pdf-native-filter-required')throw error;url=(await nativePdfRaster(job.page,job.quality)).dataUrl;}
      if(url&&epoch===generation)appCacheService.set(job.key,url,'pdf-raster');
    }
    settle(job,null,url);
  }catch(error){
    if(error.message==='PDF raster paused'&&job.consumers.size)jobs.set(job.key,job);
    else settle(job,error);
  }finally{if(active===job)active=null;schedule();}
};
const pause=()=>{active?.cancel?.();};
if(typeof window!=='undefined')window.addEventListener('pointerdown',pause,{passive:true});
export const cachedPdfRaster=page=>page?.pdfLazyRaster?appCacheService.get(keyOf(page)):null;
export const loadPdfRaster=(page,{signal,priority=0,quality='display'}={})=>{
  if(!page?.pdfLazyRaster)return Promise.resolve(page?.pdfPageImage||null);
  if(signal?.aborted)return Promise.reject(Error('PDF raster cancelled'));
  const key=keyOf(page,quality),cached=appCacheService.get(key);if(cached)return Promise.resolve(cached);
  let job=active?.key===key?active:jobs.get(key);
  if(!job){
    const metadata={};for(const field of ['notebookId','pdfOriginalId','pdfOriginalDigest','pdfPageNumber','pdfNativeRaster'])metadata[field]=page[field];
    metadata.cacheEpoch=pagePreviewEpoch(page.notebookId);
    job={key,page:metadata,priority,quality,consumers:new Set()};jobs.set(key,job);
  }
  job.priority=Math.min(job.priority,priority);
  return new Promise((resolve,reject)=>{
    const item={resolve,reject,signal};
    item.cancel=()=>{job.consumers.delete(item);signal?.removeEventListener('abort',item.cancel);reject(Error('PDF raster cancelled'));
      if(!job.consumers.size){if(jobs.get(key)===job)jobs.delete(key);if(active===job)job.cancel?.();}schedule();};
    signal?.addEventListener('abort',item.cancel,{once:true});job.consumers.add(item);guard.start();schedule();
  });
};
export const pageForPdfExport=async page=>page?.pdfLazyRaster?{...page,pdfPageImage:await loadPdfRaster(page,{quality:'export'})}:page;
appCacheService.subscribeClear(()=>{generation++;});
