// Covers and menu checks using actual components, native IDB and the bundled worker.
const assert=require('node:assert/strict'),path=require('path');
module.exports=async({page,fixture,mount,flush,check,preview})=>{
  const waitCover=async id=>{
    await page.waitForFunction(async id=>{
      const state=qa.covers.getNotebookCoverQueueSnapshot(),nb=await qa.db.getNotebookById(id),first=await qa.db.getNotebookThumbnailPage(id);
      return state.queued>0||state.running!==null||(first&&nb?.firstPageThumbnail?.pageId===first.id&&nb.firstPageThumbnail.pageUpdatedAt===first.updatedAt);
    },id);
    assert.equal(await page.evaluate(()=>qa.covers.flushNotebookCovers()),true);
    return page.evaluate(async id=>(await qa.db.getNotebookById(id)).firstPageThumbnail,id);
  };
  const waitAutomaticCover=async id=>{
    const deadline=Date.now()+6000;
    while(Date.now()<deadline){
      const current=await page.evaluate(async id=>{
        const nb=await qa.db.getNotebookById(id),p=await qa.db.getNotebookThumbnailPage(id);
        return p&&nb?.firstPageThumbnail?.pageId===p.id&&nb.firstPageThumbnail.pageUpdatedAt===p.updatedAt?nb:null;
      },id);
      if(current)return current;await page.waitForTimeout(50);
    }
    throw Error('Automatic thumbnail stalled: '+JSON.stringify(await page.evaluate(()=>({queue:qa.covers.getNotebookCoverQueueSnapshot(),penActive:!!window.__bn_pen_active,dragActive:!!window.__bn_drag_active}))));
  };
  const openInApp=async id=>{
    await page.evaluate(()=>qa.mountApp());await page.waitForFunction(id=>qa.library?.notebooks.some(nb=>nb.id===id),id);
    await page.evaluate(id=>qa.library.onOpenNotebook(id),id);await page.waitForFunction(id=>qa.toolbar&&[...qa.boards.values()].some(board=>board.page.notebookId===id),id);
  };
  const goHome=async()=>{await page.evaluate(()=>qa.toolbar.onBackToLibrary());await page.waitForFunction(()=>!!qa.library&&!document.querySelector('.bn-editor-container'));};
  const showPages=async()=>{
    await page.evaluate(()=>qa.toolbar.setShowThumbnails(true));await page.waitForFunction(()=>!!qa.thumbnails);
  };
  await check('Share and Copy link are absent while the five supported notebook actions remain',async()=>{
    const nb=await fixture('cover-menu',1);await page.evaluate(nb=>{qa.lang.setAppLanguage('en');qa.mountCard(nb);},nb);
    await page.locator('.bn-gn-chevron-btn').click();
    assert.deepEqual(await page.locator('.bn-gn-action-item span').allTextContents(),['Rename','Duplicate','Export to PDF','Move','Move to Trash']);
    assert.equal(await page.getByRole('button',{name:'Share…',exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'Copy link',exact:true}).count(),0);
  });
  await check('Thumbnail is the new default cover and all eight existing color choices remain available',async()=>{
    await page.evaluate(()=>qa.mountNewNotebook());await page.waitForSelector('.bn-create-cover-thumbnail');
    assert.equal(await page.locator('.bn-create-cover-thumbnail').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.bn-create-cover-option').count(),8);
    assert.equal(await page.locator('.bn-create-cover-thumbnail-preview svg').count(),1);
    if(process.env.BETTERNOTE_QA_SCREENSHOTS==='1')await page.screenshot({path:path.join(preview,'betternote-create-thumbnail-default.png')});
    await page.locator('#bn-new-notebook-name').fill('Synthetic preview notebook');
    await page.getByRole('button',{name:'Create Notebook',exact:true}).click();
    assert.equal(await page.evaluate(()=>qa.createdNotebook.coverId),'thumbnail');
    assert.equal(await page.evaluate(()=>qa.createdNotebook.name),'Synthetic preview notebook');
  });
  await check('Explicit color covers work and reopening New Notebook restores the Thumbnail default',async()=>{
    await page.evaluate(()=>qa.setNewModalOpen(true));await page.waitForSelector('.bn-create-cover-thumbnail');
    await page.getByRole('button',{name:'Deep Ocean',exact:true}).click();
    await page.getByRole('button',{name:'Create Notebook',exact:true}).click();
    assert.equal(await page.evaluate(()=>qa.createdNotebook.coverId),'deep-ocean');
    await page.evaluate(()=>qa.setNewModalOpen(true));await page.waitForSelector('.bn-create-cover-thumbnail');
    assert.equal(await page.locator('.bn-create-cover-thumbnail').getAttribute('aria-pressed'),'true');
  });
  await check('Thumbnail label and help follow all four selected languages',async()=>{
    for(const locale of ['en','th','zh','ru']){
      const name=await page.evaluate(locale=>{qa.lang.setAppLanguage(locale);return qa.lang.t('coverThumbnail');},locale);
      await page.waitForFunction(name=>document.querySelector('.bn-create-cover-thumbnail strong')?.textContent===name,name);
      assert.equal(await page.locator('.bn-create-cover-thumbnail').getAttribute('aria-label'),name);
    }
    await page.evaluate(()=>qa.lang.setAppLanguage('en'));
  });
  const notebook=await page.evaluate(async()=>{
    const nb=await qa.fixture('cover-live',2);return qa.db.saveNotebook({...nb,name:'Synthetic engineering notes',coverId:'thumbnail'});
  });
  await check('An empty Thumbnail cover shows its paper preview without querying or painting notebook pages',async()=>{
    const readCount=await page.evaluate(async nb=>{
      const db=await qa.db.openDB(),original=db.transaction.bind(db);let pageReads=0;
      db.transaction=(stores,...rest)=>{if((Array.isArray(stores)?stores:[stores]).includes('pages'))pageReads++;return original(stores,...rest);};
      try{qa.mountCard(nb);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return pageReads;}finally{db.transaction=original;}
    },notebook);
    assert.equal(readCount,0);assert.equal(await page.locator('.bn-gn-thumbnail-placeholder svg').count(),1);
  });
  let richPreview,richPage;
  await check('The real background worker renders first-page ink, text and images into a bounded PNG',async()=>{
    await mount(notebook);
    await page.evaluate(()=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=20;const ctx=canvas.getContext('2d');ctx.fillStyle='#0000ff';ctx.fillRect(0,0,20,20);
      qa.coverImage=canvas.toDataURL('image/png');
      qa.boards.get('cover-live-p0').onBatchUpdatePage({
        strokes:[{id:'cover-red',tool:'pen',nibType:'ballpoint',width:24,color:'#ff0000',isTapered:false,usePressure:false,points:[{x:45,y:70,pressure:1},{x:200,y:70,pressure:1}]}],
        textElements:[{id:'cover-green',text:'Preview',x:30,y:130,fontSize:70,color:'#00aa00'}],
        imageElements:[{id:'cover-blue',src:qa.coverImage,x:260,y:260,width:150,height:150,locked:true}]
      });
    });
    await flush();richPreview=await waitCover(notebook.id);
    assert.ok(richPreview.dataUrl.startsWith('data:image/png;base64,'));assert.ok(richPreview.width<=320&&richPreview.height<=320);
    const colors=await page.evaluate(async url=>{
      const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let red=0,green=0,blue=0;
      for(let i=0;i<data.length;i+=4){if(data[i]>180&&data[i+1]<100&&data[i+2]<100)red++;if(data[i+1]>90&&data[i]<90&&data[i+2]<90)green++;if(data[i+2]>180&&data[i]<100&&data[i+1]<100)blue++;}
      return{red,green,blue};
    },richPreview.dataUrl);
    assert.ok(colors.red>100);assert.ok(colors.green>30);assert.ok(colors.blue>100);
    richPage=await page.evaluate(async()=>qa.db.getPage('cover-live-p0'));
    assert.equal(richPreview.pageId,richPage.id);assert.equal(richPreview.pageUpdatedAt,richPage.updatedAt);
  });
  await check('The generated cover shows the whole page and keeps note content and Undo history intact',async()=>{
    const state=await page.evaluate(async()=>({page:await qa.db.getPage('cover-live-p0'),history:qa.history.notebookHistoryStore.forNotebook('cover-live').getSnapshot().pointer,nb:await qa.db.getNotebookById('cover-live')}));
    assert.deepEqual(state.page,richPage);assert.equal(state.history,0);
    await page.evaluate(nb=>qa.mountCard(nb),state.nb);await page.waitForSelector('.bn-gn-firstpage-img');
    assert.equal(await page.locator('.bn-gn-firstpage-img').getAttribute('src'),richPreview.dataUrl);
    assert.equal(await page.locator('.bn-gn-firstpage-img').evaluate(image=>getComputedStyle(image).objectFit),'contain');
    if(process.env.BETTERNOTE_QA_SCREENSHOTS==='1')await page.locator('.bn-gn-notebook-card').screenshot({path:path.join(preview,'betternote-first-page-cover.png')});
  });
  await check('A stale rename or favorite form cannot discard a newer cached first-page cover',async()=>{
    assert.equal(await page.evaluate(async stale=>{
      const before=await qa.db.getPage('cover-live-p0');
      const renamed=await qa.db.saveNotebook({...stale,isFavorite:true});
      return renamed.firstPageThumbnail?.dataUrl===(await qa.db.getNotebookById(stale.id)).firstPageThumbnail?.dataUrl &&
        !!renamed.firstPageThumbnail?.dataUrl && renamed.isFavorite && JSON.stringify(before)===JSON.stringify(await qa.db.getPage(before.id));
    },notebook),true);
    assert.equal(await page.evaluate(async()=>(await qa.db.getNotebookById('cover-live')).firstPageThumbnail.dataUrl),richPreview.dataUrl);
  });
  await check('Editing page two does not rebuild the first-page cover',async()=>{
    await mount(await page.evaluate(async()=>qa.db.getNotebookById('cover-live')));await showPages();
    await page.evaluate(()=>qa.thumbnails.onSelectPage(1));await page.waitForFunction(()=>qa.boards.has('cover-live-p1'));
    await page.evaluate(()=>qa.boards.get('cover-live-p1').onStrokesChange(qa.ink(4)));await flush();
    await page.evaluate(()=>qa.covers.flushNotebookCovers());
    assert.equal(await page.evaluate(async()=>(await qa.db.getNotebookById('cover-live')).firstPageThumbnail.dataUrl),richPreview.dataUrl);
    assert.equal(await page.evaluate(()=>qa.covers.getNotebookCoverQueueSnapshot().queued),0);
  });
  await check('Undo and Redo of first-page ink also refresh its cover without altering the saved page',async()=>{
    await page.evaluate(()=>qa.thumbnails.onSelectPage(0));await page.waitForFunction(()=>qa.toolbar&&qa.boards.has('cover-live-p0'));
    await page.evaluate(()=>qa.boards.get('cover-live-p0').onStrokesChange(qa.ink(7)));await flush();
    const edited=await waitCover('cover-live');assert.notEqual(edited.dataUrl,richPreview.dataUrl);
    await page.evaluate(()=>qa.toolbar.onUndo());await flush();const undone=await waitCover('cover-live');assert.equal(undone.dataUrl,richPreview.dataUrl);
    await page.evaluate(()=>qa.toolbar.onRedo());await flush();const redone=await waitCover('cover-live');assert.equal(redone.dataUrl,edited.dataUrl);
    assert.equal(await page.evaluate(async()=>(await qa.db.getPage('cover-live-p0')).strokes.length),7);
  });
  await check('Deleting page one and Undo restore the correct first-page cover with its original page ID',async()=>{
    await showPages();await page.evaluate(()=>qa.thumbnails.onDeletePage(0));await flush();
    const afterDelete=await waitCover('cover-live');assert.equal(afterDelete.pageId,'cover-live-p1');
    await page.evaluate(()=>qa.toolbar.onUndo());await flush();const afterUndo=await waitCover('cover-live');assert.equal(afterUndo.pageId,'cover-live-p0');
    assert.equal(await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('cover-live')).length),2);
  });
  await check('Thumbnail writes reject stale revisions, renamed first-page targets and disabled cover styles',async()=>{
    assert.deepEqual(await page.evaluate(async()=>{
      const nb=await qa.db.getNotebookById('cover-live'),before=nb.firstPageThumbnail;
      const page=await qa.db.getPage('cover-live-p0');await qa.db.savePage({...page,strokes:qa.ink(9)});
      const stale=await qa.db.saveNotebookThumbnail(nb.id,before);
      const badId=await qa.db.saveNotebookThumbnail(nb.id,{...before,pageId:'different-page'});
      await qa.db.saveNotebook({...await qa.db.getNotebookById(nb.id),coverId:'deep-ocean'});
      const wrongStyle=await qa.db.saveNotebookThumbnail(nb.id,{...before,pageUpdatedAt:(await qa.db.getPage(page.id)).updatedAt});
      const after=await qa.db.getNotebookById(nb.id);
      return{stale,badId,wrongStyle,sameCover:after.firstPageThumbnail.dataUrl===before.dataUrl,name:after.name};
    }),{stale:null,badId:null,wrongStyle:null,sameCover:true,name:'Synthetic engineering notes'});
  });
  await check('An aborted cover save keeps existing content, name, modification time and the previous cover',async()=>{
    assert.equal(await page.evaluate(async()=>{
      const nb=await qa.db.getNotebookById('cover-live');await qa.db.saveNotebook({...nb,coverId:'thumbnail'});
      const before=await qa.db.getNotebookById(nb.id),p=await qa.db.getPage('cover-live-p0');
      const restore=await qa.fault({store:'notebooks',key:nb.id});let rejected=false;
      try{await qa.db.saveNotebookThumbnail(nb.id,{...before.firstPageThumbnail,pageUpdatedAt:p.updatedAt});}catch(_){rejected=true;}finally{restore();}
      return rejected&&JSON.stringify(await qa.db.getNotebookById(nb.id))===JSON.stringify(before)&&JSON.stringify(await qa.db.getPage(p.id))===JSON.stringify(p);
    }),true);
  });
  await check('Preview failure keeps the previous cover; a later valid edit retries successfully',async()=>{
    await mount(await page.evaluate(async()=>qa.db.getNotebookById('cover-live')));
    const previous=await page.evaluate(async()=>(await qa.db.getNotebookById('cover-live')).firstPageThumbnail.dataUrl);
    await page.evaluate(()=>qa.boards.get('cover-live-p0').onImageElementsChange([{id:'bad-preview',src:'https://unavailable.invalid/never-fetch.png',x:0,y:0,width:40,height:40}]));await flush();
    await page.waitForFunction(()=>qa.covers.getNotebookCoverQueueSnapshot().queued>0);
    assert.equal(await page.evaluate(()=>qa.covers.flushNotebookCovers()),false);
    assert.equal(await page.evaluate(async()=>(await qa.db.getNotebookById('cover-live')).firstPageThumbnail.dataUrl),previous);
    await page.evaluate(()=>qa.boards.get('cover-live-p0').onImageElementsChange([]));await flush();assert.ok((await waitCover('cover-live')).dataUrl);
    assert.equal(await page.evaluate(async()=>(await qa.db.getPage('cover-live-p0')).strokes.length),9);
  });
  await check('Whiteboard thumbnails include negative-coordinate content using a small cropped bitmap',async()=>{
    const nb=await page.evaluate(async()=>{
      const nb=await qa.fixture('cover-whiteboard',1);await qa.db.savePage({...await qa.db.getPage('cover-whiteboard-p0'),templateId:'whiteboard',strokes:[{...qa.ink(1)[0],color:'#ff0000',width:20,points:[{x:-500,y:-800,pressure:1},{x:800,y:600,pressure:1}]}]});
      return qa.db.saveNotebook({...nb,templateId:'whiteboard',coverId:'thumbnail'});
    });await mount(nb);const cover=await waitCover(nb.id);assert.ok(cover.width<=320&&cover.height<=320);assert.equal(cover.pageId,'cover-whiteboard-p0');
    assert.equal(await page.evaluate(async()=>(await qa.db.getPage('cover-whiteboard-p0')).strokes[0].points[0].x),-500);
  });
  await check('PDF first-page previews include background images and handwriting',async()=>{
    const nb=await page.evaluate(async()=>{
      const nb=await qa.fixture('cover-pdf',1);await qa.db.savePage({...await qa.db.getPage('cover-pdf-p0'),pdfPageImage:qa.coverImage,strokes:qa.ink(2)});return qa.db.saveNotebook({...nb,isPdf:true,coverId:'thumbnail'});
    });await mount(nb);const cover=await waitCover(nb.id);assert.ok(cover.dataUrl);assert.equal(cover.pageId,'cover-pdf-p0');
  });
  await check('Existing color covers remain color covers and receive no thumbnail jobs',async()=>{
    const nb=await fixture('cover-existing-color',1);await mount(nb);
    assert.equal(await page.evaluate(()=>qa.covers.getNotebookCoverQueueSnapshot().queued),0);
    await page.evaluate(nb=>qa.mountCard(nb),nb);await page.waitForSelector('.bn-gn-book-cover');
    assert.equal(await page.locator('.bn-gn-thumbnail-placeholder').count(),0);assert.equal(await page.locator('.bn-gn-thumbnail-cover').count(),0);
  });
  await check('App receives a refreshed cover after leaving the editor and preserves notebook metadata',async()=>{
    await page.evaluate(()=>qa.mountApp());await page.waitForFunction(()=>qa.library?.notebooks.some(nb=>nb.id==='cover-live'));
    await page.evaluate(()=>qa.library.onOpenNotebook('cover-live'));await page.waitForFunction(()=>qa.toolbar?.notebookTitle==='Synthetic engineering notes');
    await page.evaluate(()=>qa.boards.get('cover-live-p0').onStrokesChange(qa.ink(12)));await flush();
    await page.evaluate(()=>qa.toolbar.onBackToLibrary());await page.waitForFunction(()=>!document.querySelector('.bn-editor-container'));
    const cover=await waitCover('cover-live');
    await page.waitForFunction(url=>qa.library.notebooks.find(nb=>nb.id==='cover-live')?.firstPageThumbnail?.dataUrl===url,cover.dataUrl);
    const nb=await page.evaluate(()=>qa.library.notebooks.find(nb=>nb.id==='cover-live'));assert.equal(nb.name,'Synthetic engineering notes');assert.equal(nb.pageCount,2);
  });
  await check('Mouse handwriting refreshes the first-page cover automatically after returning Home',async()=>{
    const nb=await page.evaluate(async()=>qa.db.saveNotebook({...await qa.fixture('cover-mouse-auto',1),coverId:'thumbnail'}));
    await page.evaluate(()=>qa.mountApp());await page.waitForFunction(()=>qa.library?.notebooks.some(nb=>nb.id==='cover-mouse-auto'));
    await page.evaluate(()=>qa.library.onOpenNotebook('cover-mouse-auto'));await page.waitForFunction(()=>qa.boards.has('cover-mouse-auto-p0')&&qa.toolbar);
    await page.evaluate(()=>{qa.toolbar.setActiveTool('pen');qa.toolbar.setActiveColor('#ff0000');qa.toolbar.setActiveWidth(12);});
    await page.waitForFunction(()=>qa.toolbar.activeTool==='pen'&&qa.toolbar.activeColor==='#ff0000');
    const box=await page.locator('.bn-layer-active').boundingBox();
    await page.mouse.move(box.x+50,box.y+50);await page.mouse.down();await page.mouse.move(box.x+180,box.y+100,{steps:8});await page.mouse.up();
    await page.waitForFunction(async()=>(await qa.db.getPage('cover-mouse-auto-p0')).strokes.length===1);await flush();
    const before=await page.evaluate(()=>qa.db.getPage('cover-mouse-auto-p0'));
    await page.evaluate(()=>qa.toolbar.onBackToLibrary());await page.waitForFunction(()=>!!qa.library&&!document.querySelector('.bn-editor-container'));
    const nbWithCover=await waitAutomaticCover('cover-mouse-auto');
    await page.waitForFunction(url=>qa.library.notebooks.find(nb=>nb.id==='cover-mouse-auto')?.firstPageThumbnail?.dataUrl===url,nbWithCover.firstPageThumbnail.dataUrl);
    assert.deepEqual(await page.evaluate(()=>qa.db.getPage('cover-mouse-auto-p0')),before);
    assert.equal(await page.evaluate(async url=>{const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;for(let i=0;i<data.length;i+=4)if(data[i]>160&&data[i+1]<130&&data[i+2]<130)return true;return false;},nbWithCover.firstPageThumbnail.dataUrl),true);
    await page.evaluate(nb=>qa.mountCard(nb),nbWithCover);await page.waitForSelector('.bn-gn-firstpage-img');
    assert.equal(await page.locator('.bn-gn-firstpage-img').getAttribute('src'),nbWithCover.firstPageThumbnail.dataUrl);
    if(process.env.BETTERNOTE_QA_SCREENSHOTS==='1')await page.locator('.bn-gn-notebook-card').screenshot({path:path.join(preview,'betternote-mouse-first-page-cover.png')});
  });

  await check('Pen handwriting also refreshes its cover automatically without forcing the queue',async()=>{
    const nb=await page.evaluate(async()=>qa.db.saveNotebook({...await qa.fixture('cover-pen-auto',1),coverId:'thumbnail'}));await openInApp(nb.id);
    await page.evaluate(()=>qa.toolbar.setActiveTool('pen'));await page.waitForFunction(()=>qa.toolbar.activeTool==='pen');
    await page.evaluate(()=>{
      const canvas=document.querySelector('.bn-layer-active'),rect=canvas.getBoundingClientRect();
      for(const[type,x,y]of[['pointerdown',50,50],['pointermove',180,120],['pointerup',180,120]])canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'pen',pointerId:81,button:0,buttons:type==='pointerup'?0:1,pressure:type==='pointerup'?0:0.5,clientX:rect.left+x,clientY:rect.top+y}));
    });await flush();const before=await page.evaluate(()=>qa.db.getPage('cover-pen-auto-p0'));
    assert.equal(before.strokes.length,1);await goHome();const updated=await waitAutomaticCover(nb.id);assert.ok(updated.firstPageThumbnail.dataUrl);
    assert.deepEqual(await page.evaluate(()=>qa.db.getPage('cover-pen-auto-p0')),before);
  });
  await check('A new first page is chosen by position even when its ID sorts after the old first page',async()=>{
    const nb=await page.evaluate(async()=>{
      const nb=await qa.fixture('cover-index-order',2),p=await qa.db.getPage('cover-index-order-p0');
      const inserted=await qa.db.mutateNotebookPages(nb.id,{kind:'insert',atIndex:0,page:{...p,id:'cover-index-order-zz',strokes:qa.ink(3)}});
      return qa.db.saveNotebook({...inserted.notebook,coverId:'thumbnail'});
    });await openInApp(nb.id);await goHome();const updated=await waitAutomaticCover(nb.id);
    assert.equal(updated.firstPageThumbnail.pageId,'cover-index-order-zz');
    assert.deepEqual(await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('cover-index-order')).map(p=>[p.id,p.pageIndex,p.strokes.length])),[['cover-index-order-zz',0,3],['cover-index-order-p0',1,0],['cover-index-order-p1',2,0]]);
  });

  // Measure only synthetic Thumbnail operations; ordinary note saves keep running.
  await page.evaluate(()=>{
    qa.startCoverMetrics=async(ids,holdFirst=false)=>{
      if(location.href!=='https://betternote-phase1.invalid/'||qa.restoreCoverMetrics)throw Error('Isolated cover metrics required');
      const targets=new Set(ids),connection=await qa.db.openDB(),transaction=connection.transaction,post=Worker.prototype.postMessage,terminate=Worker.prototype.terminate;
      const metrics={reads:0,writes:0,posts:[],terminated:0,held:false},urls=new Map();let heldWorker=null;
      for(const id of ids)urls.set(id,(await qa.db.getNotebookById(id)).firstPageThumbnail?.dataUrl);
      connection.transaction=function(stores,mode,...rest){
        const tx=transaction.call(connection,stores,mode,...rest),objectStore=tx.objectStore.bind(tx);
        tx.objectStore=name=>{
          const store=objectStore(name);
          if(name==='pages'&&mode==='readonly'){
            const index=store.index.bind(store);store.index=indexName=>{const result=index(indexName);if(indexName==='notebookPage'){const get=result.get.bind(result);result.get=key=>{if(Array.isArray(key)&&targets.has(key[0]))metrics.reads++;return get(key);};}return result;};
          }
          if(name==='notebooks'&&mode==='readwrite'){
            const put=store.put.bind(store);store.put=value=>{if(targets.has(value.id)&&value.firstPageThumbnail?.dataUrl!==urls.get(value.id)){metrics.writes++;urls.set(value.id,value.firstPageThumbnail?.dataUrl);}return put(value);};
          }
          return store;
        };return tx;
      };
      Worker.prototype.postMessage=function(data,...rest){
        if(data?.requestId&&targets.has(data.page?.notebookId)){
          metrics.posts.push({id:data.page.notebookId,strokes:data.page.strokes.length});
          if(holdFirst&&!metrics.held){metrics.held=true;heldWorker=this;return;}
        }
        return post.call(this,data,...rest);
      };
      Worker.prototype.terminate=function(){if(this===heldWorker)metrics.terminated++;return terminate.call(this);};
      qa.coverMetrics=metrics;qa.restoreCoverMetrics=()=>{connection.transaction=transaction;Worker.prototype.postMessage=post;Worker.prototype.terminate=terminate;qa.restoreCoverMetrics=null;};
    };
  });
  await check('Pauses between first-page edits do no thumbnail work until Documents shows, then render only the latest page',async()=>{
    const nb=await page.evaluate(async()=>qa.db.saveNotebook({...await qa.fixture('cover-home-only',1),coverId:'thumbnail'}));
    await openInApp(nb.id);await goHome();const original=await waitAutomaticCover(nb.id);
    await page.evaluate(()=>{qa.boards.delete('cover-home-only-p0');qa.library.onOpenNotebook('cover-home-only');});await page.waitForFunction(()=>qa.boards.has('cover-home-only-p0')&&qa.toolbar);
    await page.evaluate(()=>qa.startCoverMetrics(['cover-home-only']));
    try{
      for(const count of [4,9,17]){await page.evaluate(count=>qa.boards.get('cover-home-only-p0').onStrokesChange(qa.ink(count)),count);await flush();await page.waitForTimeout(800);}
      const editing=await page.evaluate(async()=>({metrics:qa.coverMetrics,queue:qa.covers.getNotebookCoverQueueSnapshot(),page:await qa.db.getPage('cover-home-only-p0'),nb:await qa.db.getNotebookById('cover-home-only'),save:qa.local.getLocalSaveSnapshot().status}));
      assert.equal(editing.metrics.reads,0);assert.equal(editing.metrics.writes,0);assert.deepEqual(editing.metrics.posts,[]);assert.equal(editing.queue.paused,true);assert.equal(editing.page.strokes.length,17);assert.equal(editing.save,'saved');assert.equal(editing.nb.firstPageThumbnail.dataUrl,original.firstPageThumbnail.dataUrl);
      await goHome();const updated=await waitAutomaticCover(nb.id);
      await page.waitForFunction(url=>qa.library.notebooks.find(nb=>nb.id==='cover-home-only')?.firstPageThumbnail?.dataUrl===url,updated.firstPageThumbnail.dataUrl);
      const metrics=await page.evaluate(()=>qa.coverMetrics);assert.deepEqual(metrics.posts,[{id:'cover-home-only',strokes:17}]);assert.equal(metrics.writes,1);
      assert.notEqual(updated.firstPageThumbnail.dataUrl,original.firstPageThumbnail.dataUrl);assert.deepEqual(await page.evaluate(()=>qa.db.getPage('cover-home-only-p0')),editing.page);
    }finally{await page.evaluate(()=>qa.restoreCoverMetrics?.());}
  });
  await check('Reopening an unchanged notebook or editing page two causes no cover reads, renders or writes',async()=>{
    const nb=await page.evaluate(async()=>qa.db.saveNotebook({...await qa.fixture('cover-home-unchanged',2),coverId:'thumbnail'}));
    await openInApp(nb.id);await goHome();const original=await waitAutomaticCover(nb.id);
    await page.evaluate(()=>{qa.boards.delete('cover-home-unchanged-p0');qa.library.onOpenNotebook('cover-home-unchanged');});await page.waitForFunction(()=>qa.boards.has('cover-home-unchanged-p0')&&qa.toolbar);
    await page.evaluate(()=>qa.startCoverMetrics(['cover-home-unchanged']));
    try{
      await showPages();await page.evaluate(()=>qa.thumbnails.onSelectPage(1));await page.waitForFunction(()=>qa.boards.has('cover-home-unchanged-p1'));
      await page.evaluate(()=>qa.boards.get('cover-home-unchanged-p1').onStrokesChange(qa.ink(6)));await flush();await page.waitForTimeout(800);
      await goHome();await page.waitForTimeout(900);
      const metrics=await page.evaluate(()=>qa.coverMetrics);assert.equal(metrics.reads,0);assert.equal(metrics.writes,0);assert.deepEqual(metrics.posts,[]);
      assert.equal(await page.evaluate(async()=>(await qa.db.getNotebookById('cover-home-unchanged')).firstPageThumbnail.dataUrl),original.firstPageThumbnail.dataUrl);
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('cover-home-unchanged-p1')).strokes.length),6);
    }finally{await page.evaluate(()=>qa.restoreCoverMetrics?.());}
  });
  await check('Dirty covers wait across tab switches and refresh once per notebook after Home',async()=>{
    const ids=await page.evaluate(async()=>{
      const ids=['cover-home-tab-a','cover-home-tab-b'];for(const id of ids)await qa.db.saveNotebook({...await qa.fixture(id,1),coverId:'thumbnail'});return ids;
    });
    for(const id of ids){await openInApp(id);await goHome();await waitAutomaticCover(id);}
    await page.evaluate(()=>{qa.boards.delete('cover-home-tab-a-p0');qa.library.onOpenNotebook('cover-home-tab-a');});await page.waitForFunction(()=>qa.boards.has('cover-home-tab-a-p0')&&qa.toolbar);
    await page.evaluate(()=>qa.startCoverMetrics(['cover-home-tab-a','cover-home-tab-b']));
    try{
      await page.evaluate(()=>qa.boards.get('cover-home-tab-a-p0').onStrokesChange(qa.ink(3)));await flush();
      await page.evaluate(()=>{qa.boards.delete('cover-home-tab-b-p0');qa.tabs.onSelectTab('cover-home-tab-b');});await page.waitForFunction(()=>qa.boards.has('cover-home-tab-b-p0')&&qa.toolbar);
      await page.evaluate(()=>qa.boards.get('cover-home-tab-b-p0').onStrokesChange(qa.ink(7)));await flush();
      await page.evaluate(()=>{qa.boards.delete('cover-home-tab-a-p0');qa.tabs.onSelectTab('cover-home-tab-a');});await page.waitForFunction(()=>qa.toolbar&&qa.boards.has('cover-home-tab-a-p0'));
      await page.evaluate(()=>qa.boards.get('cover-home-tab-a-p0').onStrokesChange(qa.ink(5)));await flush();await page.waitForTimeout(900);
      const editing=await page.evaluate(()=>qa.coverMetrics);assert.equal(editing.reads,0);assert.equal(editing.writes,0);assert.deepEqual(editing.posts,[]);
      await goHome();for(const id of ids)await waitAutomaticCover(id);
      const posts=await page.evaluate(()=>qa.coverMetrics.posts);assert.deepEqual(posts.sort((a,b)=>a.id.localeCompare(b.id)),[{id:ids[0],strokes:5},{id:ids[1],strokes:7}]);
      assert.equal(await page.evaluate(()=>qa.coverMetrics.writes),2);
    }finally{await page.evaluate(()=>qa.restoreCoverMetrics?.());}
  });
  await check('Opening a notebook interrupts its running cover worker and later Home retries from the newest saved page',async()=>{
    const nb=await page.evaluate(async()=>qa.db.saveNotebook({...await qa.fixture('cover-home-interrupt',1),coverId:'thumbnail'}));await openInApp(nb.id);
    await page.evaluate(()=>qa.startCoverMetrics(['cover-home-interrupt'],true));
    try{
      await goHome();await page.waitForFunction(()=>qa.coverMetrics.held&&qa.covers.getNotebookCoverQueueSnapshot().running==='cover-home-interrupt');
      await page.evaluate(()=>{qa.boards.delete('cover-home-interrupt-p0');qa.library.onOpenNotebook('cover-home-interrupt');});await page.waitForFunction(()=>qa.toolbar&&qa.boards.has('cover-home-interrupt-p0')&&qa.covers.getNotebookCoverQueueSnapshot().running===null);
      assert.equal(await page.evaluate(()=>qa.coverMetrics.terminated),1);assert.equal(await page.evaluate(()=>qa.covers.getNotebookCoverQueueSnapshot().failed),0);
      await page.evaluate(()=>qa.boards.get('cover-home-interrupt-p0').onStrokesChange(qa.ink(11)));await flush();const before=await page.evaluate(()=>qa.db.getPage('cover-home-interrupt-p0'));await page.waitForTimeout(900);
      assert.equal(await page.evaluate(()=>qa.coverMetrics.posts.length),1);assert.equal(await page.evaluate(()=>qa.coverMetrics.writes),0);
      await goHome();const updated=await waitAutomaticCover(nb.id);
      assert.equal(updated.firstPageThumbnail.pageUpdatedAt,before.updatedAt);assert.equal(await page.evaluate(()=>qa.coverMetrics.posts.length),2);assert.equal(await page.evaluate(()=>qa.coverMetrics.posts[1].strokes),11);
      assert.equal(await page.evaluate(()=>qa.coverMetrics.writes),1);assert.deepEqual(await page.evaluate(()=>qa.db.getPage('cover-home-interrupt-p0')),before);
    }finally{await page.evaluate(()=>qa.restoreCoverMetrics?.());}
  });

};
