import { openRasterPdf, rasterPdfPage, pdfBytesFromUrl, pdfOriginalDataUrl, configurePdfAssets } from '../utils/pdfRaster.js';
import { getPdfOriginalSource, importNotebookPagesAtomic } from './db.js';
let document, sourceId, sourceScope;
const release = async () => { if (document) await document.destroy(); document = sourceId = sourceScope = null; };
self.onmessage = async ({data}) => {
  try {
    configurePdfAssets(data.assets);
    if (data.action === 'import') {
      await release();
      const bytes = new Uint8Array(await data.file.arrayBuffer()), original = await pdfOriginalDataUrl(bytes);
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
      document = await openRasterPdf(bytes);
      const id = 'nb-pdf-' + crypto.randomUUID(), now = Date.now(), originalId = id + ':pdf', pages = [];
      for (let number = 1; number <= document.numPages; number++) {
        const raster = await rasterPdfPage(document, number, {preview:true});
        pages.push({id:id+'_page_'+(number-1),notebookId:id,pageIndex:number-1,templateId:'blank',
          pdfPageImage:raster.dataUrl,thumbnailUrl:raster.thumbnailUrl,pdfLazyRaster:1,pdfOriginalId:originalId,pdfOriginalDigest:digest,pdfPageNumber:number,
          ...(number===1?{pdfOriginal:{id:originalId,name:data.file.name,dataUrl:original}}:{}),
          pageWidth:raster.width,pageHeight:raster.height,strokes:[],textElements:[],imageElements:[],updatedAt:now});
        self.postMessage({progress:number,total:document.numPages});
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      const notebook=await importNotebookPagesAtomic({id,name:data.file.name.replace(/\.[^/.]+$/,''),folderId:data.folderId||null,
        coverId:'nordic-slate',templateId:'blank',createdAt:now,updatedAt:now,pageCount:pages.length,isPdf:true,pdfName:data.file.name},pages);
      await release(); self.postMessage({result:notebook}); return;
    }
    const page=data.page;
    const scope=JSON.stringify([page.notebookId,page.pdfOriginalDigest,page.cacheEpoch]);
    if (!document || !page.pdfOriginalDigest || sourceId!==page.pdfOriginalId || sourceScope!==scope) {
      const source=await getPdfOriginalSource(page.notebookId,page.pdfOriginalId);
      if (!source) throw Error('PDF source unavailable');
      await release(); document=await openRasterPdf(await pdfBytesFromUrl(source.dataUrl)); sourceId=source.id;sourceScope=scope;
    }
    const result=await rasterPdfPage(document,page.pdfPageNumber,data.quality==='export'?{maxPixels:16000000,maxEdge:8192}:{});
    self.postMessage({result});
  } catch(error) {
    await release().catch(()=>{});
    // No source bytes or personal filenames in error messages.
    self.postMessage({error:error.message==='pdf-native-filter-required'?'pdf-native-filter-required':'PDF raster unavailable'});
  }
};
