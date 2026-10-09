const assert=require('node:assert/strict');
module.exports=async({page})=>{
 let count=0;
 const check=async(name,fn)=>{await fn();count++;console.log('PASS PDF on demand: '+name);};
 await check('every imported page already has a small background and thumbnail; no full raster is saved',async()=>{
  const info=await page.evaluate(async()=>{
   const sizes=await Promise.all(qa.snapshot.pages.map(async p=>{const b=await createImageBitmap(await(await fetch(p.pdfPageImage)).blob());const size=[b.width,b.height];b.close();return size;}));
   return {lazy:qa.snapshot.pages.every(p=>p.pdfLazyRaster===1&&p.pdfOriginalDigest.length===64),sizes};
  });
  assert.equal(info.lazy,true);assert.ok(info.sizes.every(s=>Math.max(...s)<=960));
 });
 await check('the ready background stays visible while pen activity postpones sharp rendering',async()=>{
  await page.evaluate(()=>{window.__bn_pen_active=true;qa.mountCanvas(qa.snapshot.pages[0]);});
  await page.waitForSelector('.bn-pdf-ready-background');
  assert.equal(await page.evaluate(()=>document.querySelector('.bn-pdf-ready-background').src===qa.snapshot.pages[0].pdfPageImage),true);
  assert.equal(await page.evaluate(()=>qa.raster.cachedPdfRaster(qa.snapshot.pages[0])),null);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>qa.raster.cachedPdfRaster(qa.snapshot.pages[0])),null);
  await page.evaluate(()=>window.__bn_pen_active=false);
  const deadline=Date.now()+15000;
  while(Date.now()<deadline&&!await page.evaluate(()=>!!qa.raster.cachedPdfRaster(qa.snapshot.pages[0])))await page.waitForTimeout(50);
  assert.equal(await page.evaluate(()=>!!qa.raster.cachedPdfRaster(qa.snapshot.pages[0])),true);
  await page.waitForFunction(()=>{const c=document.querySelector('.bn-layer-bg');const p=c.getContext('2d').getImageData(40,140,300,40).data;return [...p].some((v,i)=>i%4===0&&v>150&&p[i+1]<150);});
 });
 await check('a sharp page does not rewrite its stored background, modification time or handwriting',async()=>{
  const info=await page.evaluate(async()=>{
   const before=qa.snapshot.pages[1],url=await qa.raster.loadPdfRaster(before);
   const bitmap=await createImageBitmap(await(await fetch(url)).blob());const sharp=[bitmap.width,bitmap.height];bitmap.close();
   const stored=await qa.db.getPage(before.id);
   return{sharp,unchanged:JSON.stringify(stored)===JSON.stringify(before)};
  });
  assert.equal(info.unchanged,true);assert.ok(Math.max(...info.sharp)>960);
 });
 await check('cancelled offscreen jobs do not block a newly requested page',async()=>{
  await page.evaluate(()=>{qa.unmountCanvas();qa.cache.clearAll();window.__bn_pen_active=true;});
  const result=await page.evaluate(async()=>{
   const controller=new AbortController(),pending=qa.raster.loadPdfRaster(qa.snapshot.pages[2],{signal:controller.signal,priority:1});
   controller.abort();let rejected=false;try{await pending;}catch(_){rejected=true;}
   window.__bn_pen_active=false;
   return{rejected,ready:!!(await qa.raster.loadPdfRaster(qa.snapshot.pages[0]))};
  });
  assert.deepEqual(result,{rejected:true,ready:true});
 });
 await check('image and native PDF exports resolve a sharp background while retaining ink',async()=>{
  const info=await page.evaluate(async()=>{
   const stored=qa.snapshot.pages[1],p={...stored,strokes:[{tool:'pen',color:'#0000ff',width:10,points:[{x:20,y:20,pressure:1},{x:200,y:20,pressure:1}]}]};
   const image=await qa.engine.exportPageAsImage(p,'blank',{format:'png',dpi:150});
   const b=await createImageBitmap(image.blob),c=new OffscreenCanvas(b.width,b.height),ctx=c.getContext('2d');ctx.drawImage(b,0,0);b.close();
   const pixels=ctx.getImageData(0,0,c.width,c.height).data;let red=0,blue=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i]>150&&pixels[i+1]<150&&pixels[i+2]<150)red++;if(pixels[i]<100&&pixels[i+1]<100&&pixels[i+2]>150)blue++;}
   let html='';window.electronAPI={exportPdfDocument:async content=>{html=content;return new ArrayBuffer(1);}};
   await qa.engine.exportSinglePageToPdf(qa.nb,p,1);delete window.electronAPI;
   const found=html.match(/<image[^>]+href="([^"]+)"/);
   const bitmap=await createImageBitmap(await(await fetch(found[1])).blob());const background=[bitmap.width,bitmap.height];bitmap.close();
   return{red,blue,background,storedUnchanged:(await qa.db.getPage(p.id)).pdfPageImage===stored.pdfPageImage};
  });
  assert.ok(info.red>100);assert.ok(info.blue>100);assert.ok(Math.max(...info.background)>960);assert.equal(info.storedUnchanged,true);
 });
 await check('automatic PDF backup uses the original for every page',async()=>{
  const info=await page.evaluate(async()=>{
   const service=qa.preparation.createBackupPreparationService();
   try{
    const descriptor=await service.getNotebook(qa.nb.id,{pdf:true}),bytes=await service.makePdf(descriptor,()=>{},{force:true});
    const loaded=await qa.pdf.loadPdfFromFile(new Blob([bytes],{type:'application/pdf'}));
    try{return{count:loaded.pdfDoc.numPages,signature:new TextDecoder().decode(bytes.slice(0,4))};}finally{await loaded.pdfDoc.destroy();}
   }finally{service.close();}
  });
  assert.deepEqual(info,{count:3,signature:'%PDF'});
 });
 await check('a corrupt PDF cannot publish a partial notebook',async()=>{
  const info=await page.evaluate(async()=>{
   const before=(await qa.db.getAllNotebooks()).length;let rejected=false;
   try{await qa.pdf.importPdfAsNotebook(new File(['not a PDF'],'broken.pdf',{type:'application/pdf'}));}catch(_){rejected=true;}
   return{rejected,unchanged:(await qa.db.getAllNotebooks()).length===before};
  });
  assert.deepEqual(info,{rejected:true,unchanged:true});
 });
 await check('a transaction failure rolls back both the notebook and its imported pages',async()=>{
  const info=await page.evaluate(async()=>{
   const p={...qa.snapshot.pages[1],notebookId:'failed-atomic-import'};
   let rejected=false;try{await qa.db.importNotebookPagesAtomic({id:'failed-atomic-import',name:'Failed import'},[{...p,pageIndex:0},{...p,pageIndex:1}]);}catch(_){rejected=true;}
   return{rejected,missing:!(await qa.db.getNotebookById('failed-atomic-import')),pages:(await qa.db.getPagesByNotebookId('failed-atomic-import')).length};
  });
  assert.deepEqual(info,{rejected:true,missing:true,pages:0});
 });
 await check('native PDF luminosity filters preserve appearance without reverting to full-page storage',async()=>{
  const info=await page.evaluate(async()=>{
   const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 600] /Resources << /ExtGState << /GS1 5 0 R >> >> /Contents 4 0 R >>',
    'STREAM:q /GS1 gs 1 0 0 rg 40 100 300 100 re f Q',
    '<< /Type /ExtGState /SMask << /S /Luminosity /G 6 0 R >> >>',
    'FORM:0.5 g 0 0 400 600 re f'
   ];
   let text='%PDF-1.4\n',offsets=[0];
   for(let i=0;i<objects.length;i++){
    offsets.push(text.length);let body=objects[i];
    if(body.startsWith('STREAM:')){const s=body.slice(7);body='<< /Length '+s.length+' >>\nstream\n'+s+'\nendstream';}
    if(body.startsWith('FORM:')){const s=body.slice(5);body='<< /Type /XObject /Subtype /Form /BBox [0 0 400 600] /Group << /S /Transparency /CS /DeviceRGB >> /Resources << >> /Length '+s.length+' >>\nstream\n'+s+'\nendstream';}
    text+=(i+1)+' 0 obj\n'+body+'\nendobj\n';
   }
   const xref=text.length;text+='xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
   const nb=await qa.pdf.importPdfAsNotebook(new File([text],'native-filter.pdf'));
   const p=(await qa.db.getPagesByNotebookId(nb.id))[0];qa.nativeNote=nb;
   const sharp=await qa.raster.pageForPdfExport(p),bitmap=await createImageBitmap(await(await fetch(sharp.pdfPageImage)).blob());
   const c=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();
   const pixel=Array.from(ctx.getImageData(Math.round(c.width*.3),Math.round(c.height*.75),1,1).data);
   const service=qa.preparation.createBackupPreparationService();let backup=false;
   try{backup=(await service.makePdf(await service.getNotebook(nb.id,{pdf:true}),()=>{},{force:true})).byteLength>100;}finally{service.close();}
   return{lazy:p.pdfLazyRaster,native:p.pdfNativeRaster,pixel,backup,unchanged:(await qa.db.getPage(p.id)).pdfPageImage===p.pdfPageImage};
  });
  assert.equal(info.lazy,1);assert.equal(info.native,true);assert.ok(info.pixel[0]>230&&info.pixel[1]>100&&info.pixel[1]<180);assert.equal(info.backup,true);assert.equal(info.unchanged,true);
 });
 await check('sixty mixed PDF pages keep ready images small while sharp rasters stay on demand',async()=>{
  const info=await page.evaluate(async()=>{
   const doc=new qa.jsPDF({unit:'pt',format:[600,900],compress:true});
   const image=new OffscreenCanvas(64,64),ctx=image.getContext('2d');ctx.fillStyle='#008800';ctx.fillRect(0,0,64,64);
   const blob=await image.convertToBlob({type:'image/png'}),bytes=new Uint8Array(await blob.arrayBuffer());
   for(let i=0;i<60;i++){
    if(i)doc.addPage(i%2?[900,600]:[600,900],i%2?'landscape':'portrait');
    doc.setTextColor(200,0,0);doc.text('Ready PDF page '+(i+1),40,80);doc.addImage(bytes,'PNG',40,100,64,64);
   }
   const started=performance.now(),nb=await qa.pdf.importPdfAsNotebook(new File([doc.output('arraybuffer')],'sixty-pages.pdf',{type:'application/pdf'}));
   const pages=await qa.db.getPagesByNotebookId(nb.id);qa.largePdf=nb;
   const allSmall=await Promise.all(pages.map(async p=>{const b=await createImageBitmap(await(await fetch(p.pdfPageImage)).blob());const small=Math.max(b.width,b.height)<=960;b.close();return small;}));
   const manifest=await qa.editorPages.loadPageManifest(nb.id,{templateId:'blank'});
   return{count:pages.length,sources:pages.filter(p=>p.pdfOriginal).length,allSmall:allSmall.every(Boolean),
     thumbnails:manifest.every(p=>p.thumbnailUrl&&p.__unloaded&&!p.strokes&&!p.pdfPageImage),bytes:pages.reduce((n,p)=>n+p.pdfPageImage.length*2,0),elapsedMs:Math.round(performance.now()-started)};
  });
  assert.equal(info.count,60);assert.equal(info.sources,1);assert.equal(info.allSmall,true);assert.equal(info.thumbnails,true);assert.ok(info.bytes<16*1048576);
  console.log('PDF54_IMPORT '+JSON.stringify(info));
 });
 await check('embedded Thai PDF glyphs remain visible in ready and sharp images',async()=>{
  const info=await page.evaluate(async()=>{
   const doc=new qa.jsPDF({unit:'pt',format:[600,900]});
   doc.addFileToVFS('qa-thai.ttf',window.__pdfThaiFont);doc.addFont('qa-thai.ttf','QAThai','normal');doc.setFont('QAThai');doc.setFontSize(28);doc.setTextColor(200,0,0);
   doc.text('ฟอนต์ภาษาไทย ทดสอบ PDF',40,90);
   const nb=await qa.pdf.importPdfAsNotebook(new File([doc.output('arraybuffer')],'embedded-thai.pdf',{type:'application/pdf'}));
   const p=(await qa.db.getPagesByNotebookId(nb.id))[0],sharp=await qa.raster.pageForPdfExport(p);
   const countRed=async src=>{
    const b=await createImageBitmap(await(await fetch(src)).blob()),c=new OffscreenCanvas(b.width,b.height),ctx=c.getContext('2d');ctx.drawImage(b,0,0);b.close();
    const pixels=ctx.getImageData(0,0,c.width,c.height).data;let red=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>100&&pixels[i+1]<100&&pixels[i+2]<100)red++;
    return red;
   };
   const ready=await countRed(p.pdfPageImage),full=await countRed(sharp.pdfPageImage);
   return{ready,full,lazy:p.pdfLazyRaster,native:!!p.pdfNativeRaster};
  });
  assert.ok(info.ready>100&&info.full>info.ready);assert.equal(info.lazy,1);assert.equal(info.native,false);
 });
 await check('portable backups with missing originals or invalid lazy-page references are rejected',async()=>{
  const info=await page.evaluate(()=>{
    const broken=JSON.parse(JSON.stringify(qa.snapshot));
    for(const p of broken.pages)delete p.pdfOriginal;
    let missing=false,invalid=false;
    try{qa.prepareBackup({folders:[],notebooks:[broken]});}catch(e){missing=e.code==='backup-incomplete';}
    const invalidPage=JSON.parse(JSON.stringify(qa.snapshot));invalidPage.pages[1].pdfPageNumber=0;
    try{qa.prepareBackup({folders:[],notebooks:[invalidPage]});}catch(e){invalid=e.code==='invalid-backup-data';}
    return{missing,invalid};
  });
  assert.deepEqual(info,{missing:true,invalid:true});
 });
 await check('native PDF backup defers when writing starts instead of claiming a backup failure',async()=>{
  const info=await page.evaluate(async()=>{
    const service=qa.preparation.createBackupPreparationService();let checks=0,message;
    try{
      const note=await service.getNotebook(qa.nativeNote.id,{pdf:true});
      try{await service.makePdf(note,()=>{if(++checks>=3)throw Error('pdf-backup-deferred');},{force:true});}
      catch(error){message=error.message;}
      return{message,checks};
    }finally{service.close();}
  });
  assert.equal(info.message,'pdf-backup-deferred');assert.ok(info.checks>=3);
 });
 return count;
};
