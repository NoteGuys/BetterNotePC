// Native UI and IndexedDB tests; only called by the isolated synthetic harness.
const assert = require('node:assert/strict');
const path = require('path');
module.exports = async ({page, fixture, mount, flush, check, preview}) => {
  const menuKeys = ['rename','duplicate','exportPdf','move','moveToTrash'];
  const legacyName = 'Physics(1) (สำเนา)(1) (สำเนา)';
  const cardNotebook = await page.evaluate(async name => {
    const notebook = await qa.fixture('language-card',1);
    return qa.db.saveNotebook({...notebook,name});
  },legacyName);
  await page.evaluate(nb=>qa.mountCard(nb),cardNotebook);
  await page.waitForSelector('.bn-gn-chevron-btn');
  await page.locator('.bn-gn-chevron-btn').click();
  for (const locale of ['en','th','zh','ru']) {
    await check('Open notebook menu and old copy suffix react immediately to ' + locale,async()=>{
      const expected=await page.evaluate(({locale,keys,name})=>{
        qa.lang.setAppLanguage(locale);
        return {labels:keys.map(key=>qa.lang.TRANSLATIONS[locale][key]),name:qa.names.localizeNotebookCopyName(name,qa.lang.TRANSLATIONS[locale].notebookCopySuffix)};
      },{locale,keys:menuKeys,name:legacyName});
      await page.waitForFunction(label=>document.querySelector('.bn-gn-action-item span')?.textContent===label,expected.labels[0]);
      assert.deepEqual(await page.locator('.bn-gn-action-item span').allTextContents(),expected.labels);
      assert.equal(await page.locator('.bn-gn-book-name').textContent(),expected.name);
      assert.equal(await page.evaluate(async()=>(await qa.db.getNotebookById('language-card')).name),legacyName);
    });
  }
  await check('Localized menu buttons still pass the original notebook or ID to each action',async()=>{
    const actions=['rename','duplicate','export','move','trash'];
    for(let i=0;i<actions.length;i++) {
      if(i)await page.locator('.bn-gn-chevron-btn').click();
      await page.locator('.bn-gn-action-item').nth(i).click();
      const last=await page.evaluate(()=>qa.menuCalls.at(-1));
      assert.equal(last[0],actions[i]);
      if(['duplicate','trash'].includes(actions[i])) assert.equal(last[1],cardNotebook.id);
      else {assert.equal(last[1].id,cardNotebook.id);assert.equal(last[1].name,legacyName);}
    }
  });
  await check('Editor title, tabs and export subtitle translate legacy names without changing export filenames',async()=>{
    await page.evaluate(()=>qa.lang.setAppLanguage('en'));await mount(cardNotebook);
    // MountEditor normally uses a generic synthetic tab title; remount it with the raw stored title.
    await page.evaluate(nb=>qa.mountTabBar([{id:nb.id,title:nb.name,pageIndex:2}],nb.id),cardNotebook);
    await page.waitForFunction(()=>document.querySelector('.bn-tab-title')?.textContent==='Physics(1) (Copy)(1) (Copy)');
    assert.ok((await page.locator('.bn-tab-close-btn').getAttribute('aria-label')).includes('Close tab Physics(1) (Copy)(1) (Copy)'));
    await mount(cardNotebook);
    assert.equal(await page.locator('.bn-toolbar-title').textContent(),'Physics(1) (Copy)(1) (Copy)');
    await page.locator('.bn-toolbar-title').click();
    assert.equal(await page.locator('.bn-title-input').inputValue(),legacyName);
    await page.locator('.bn-title-input').press('Enter');
    await flush();
    assert.equal(await page.evaluate(async()=>(await qa.db.getNotebookById('language-card')).name),legacyName);
    await page.evaluate(()=>qa.toolbar.onOpenExport());
    await page.waitForSelector('.bn-modal-subtitle');
    assert.ok((await page.locator('.bn-modal-subtitle').textContent()).includes('Physics(1) (Copy)(1) (Copy)'));
    // Intercept the save picker entirely in memory; no .bnote file is written.
    await page.evaluate(()=>{
      qa.originalSavePicker=window.showSaveFilePicker;
      window.showSaveFilePicker=async options=>({createWritable:async()=>({write:async blob=>{qa.exportName=options.suggestedName;qa.exportPayload=JSON.parse(await blob.text());},close:async()=>{}})});
    });
    try {
      await page.getByRole('button',{name:'Download .bnote',exact:true}).click();
      await page.waitForFunction(()=>!!qa.exportName&&!!qa.exportPayload);
      assert.equal(await page.evaluate(()=>qa.exportName),legacyName+'.bnote');
      assert.equal(await page.evaluate(()=>qa.exportPayload.notebook.name),legacyName);
    } finally {
      await page.evaluate(()=>{if(qa.originalSavePicker)window.showSaveFilePicker=qa.originalSavePicker;else delete window.showSaveFilePicker;delete qa.exportPayload;delete qa.exportName;});
    }
    assert.equal(await page.evaluate(async()=>(await qa.db.getNotebookById('language-card')).name),legacyName);
  });
  for(const locale of ['en','th','zh','ru']) {
    await check('New notebook copies use the selected ' + locale + ' suffix and preserve page content',async()=>{
      const result=await page.evaluate(async locale=>{
        qa.unmount();qa.lang.setAppLanguage(locale);
        const nb=await qa.fixture('copy-'+locale,1);
        const original=await qa.db.saveNotebook({...nb,name:'Source '+locale+' (สำเนา)'});
        const before=await qa.db.getPage(nb.id+'-p0');
        before.strokes=qa.ink(3);before.textElements=[{id:'copy-text',text:'Synthetic QA',x:10,y:20}];
        before.imageElements=[{id:'copy-image',locked:true,x:3,y:4,width:8,height:9,src:'data:image/png;base64,synthetic'}];
        await qa.db.savePage(before);
        const label=qa.lang.t('notebookCopySuffix');const copy=await qa.db.duplicateNotebook(nb.id,{copySuffix:label});
        const after=(await qa.db.getPagesByNotebookId(copy.id))[0];
        return {name:copy.name,expected:'Source '+locale+' ('+label+') ('+label+')',stored:(await qa.db.getNotebookById(nb.id)).name,original:original.name,
          equal:JSON.stringify([before.strokes,before.textElements,before.imageElements])===JSON.stringify([after.strokes,after.textElements,after.imageElements]),differentIds:before.id!==after.id&&before.notebookId!==after.notebookId};
      },locale);
      assert.equal(result.name,result.expected);assert.equal(result.stored,result.original);assert.equal(result.equal,true);assert.equal(result.differentIds,true);
    });
  }
  await check('Mixed-language legacy copies reserve their displayed names; new copies receive the next free number',async()=>{
    assert.deepEqual(await page.evaluate(async()=>{
      const original=await qa.fixture('copy-collision',1);await qa.db.saveNotebook({...original,name:'Unique QA'});
      await qa.db.saveNotebook({id:'copy-collision-old',name:'Unique QA (สำเนา)',pageCount:1});
      await qa.db.saveNotebook({id:'copy-collision-old1',name:'Unique QA (副本)(1)',pageCount:1});
      const first=await qa.db.duplicateNotebook(original.id,{copySuffix:'Copy'});
      const second=await qa.db.duplicateNotebook(original.id,{copySuffix:'สำเนา'});
      return {first:first.name,second:second.name,old:(await qa.db.getNotebookById('copy-collision-old')).name,old1:(await qa.db.getNotebookById('copy-collision-old1')).name};
    }),{first:'Unique QA (Copy)(2)',second:'Unique QA (สำเนา)(3)',old:'Unique QA (สำเนา)',old1:'Unique QA (副本)(1)'});
  });
  await check('Ordinary create/rename uniqueness keeps its existing behavior',async()=>{
    assert.deepEqual(await page.evaluate(async()=>{
      const a=await qa.db.saveNotebook({id:'normal-name-a',name:'Normal QA'},{ensureUniqueName:true});
      const b=await qa.db.saveNotebook({id:'normal-name-b',name:'Normal QA'},{ensureUniqueName:true});
      const c=await qa.db.saveNotebook({id:'normal-name-c',name:'Normal QA'},{ensureUniqueName:true});
      return[a.name,b.name,c.name];
    }),['Normal QA','Normal QA(1)','Normal QA(2)']);
  });
  await check('Library duplicate success and missing-notebook failure use English when English is selected',async()=>{
    await page.evaluate(()=>{qa.lang.setAppLanguage('en');qa.mountApp();});
    await page.waitForFunction(()=>qa.library?.notebooks.some(nb=>nb.id==='copy-collision'));
    await page.evaluate(()=>qa.library.onDuplicateNotebook('copy-collision'));
    assert.ok((await page.evaluate(()=>qa.alerts.at(-1))).startsWith('Duplicated successfully!'));
    assert.ok((await page.evaluate(()=>qa.alerts.at(-1))).includes('(Copy)'));
    await page.evaluate(()=>qa.library.onDuplicateNotebook('missing-synthetic-notebook'));
    assert.equal(await page.evaluate(()=>qa.alerts.at(-1)), 'Cannot duplicate: The notebook to duplicate could not be found.');
  });
  await check('Editor duplicate action uses the selected language too',async()=>{
    await page.evaluate(()=>qa.lang.setAppLanguage('ru'));await mount(cardNotebook);
    await page.evaluate(()=>qa.toolbar.onDuplicateNotebook());
    const alert=await page.evaluate(()=>qa.alerts.at(-1));
    assert.ok(alert.includes('(Копия)'));assert.ok(!alert.includes('สำเนา'));
  });

  const tabFixture = Array.from({length:9},(_,i)=>({id:'tab-'+i,title:'Notebook '+(i+1)+' — Engineering notes',pageIndex:i}));
  const mountTabs=async active=>{
    await page.evaluate(({tabs,active})=>{qa.lang.setAppLanguage('en');qa.mountTabBar(tabs,active);},{tabs:tabFixture,active});
    await page.waitForFunction(()=>qa.tabs?.tabs.length===9&&document.querySelector('.bn-tab-item')?.getBoundingClientRect().width>0);
  };
  const settleWidth=async()=>{await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));};
  for(const width of [1920,1360,1024]) {
    await check('All nine tabs and their close buttons remain clickable at '+width+' pixels',async()=>{
      await page.setViewportSize({width,height:1000});await mountTabs('tab-0');await settleWidth();
      for(let i=0;i<9;i++) {
        const target=page.locator('[data-notebook-id="tab-'+i+'"]');
        await target.locator('.bn-tab-title').click();
        await page.waitForFunction(id=>qa.tabs.activeTabId===id,'tab-'+i);
        const hits=await page.evaluate(()=>{
          const list=document.querySelector('.bn-tab-list'),bounds=list.getBoundingClientRect();
          return [...list.querySelectorAll('.bn-tab-item')].map(tab=>{
            const rect=tab.getBoundingClientRect(),close=tab.querySelector('.bn-tab-close-btn').getBoundingClientRect();
            const body=document.elementFromPoint(rect.left+12,rect.top+rect.height/2)?.closest('.bn-tab-item');
            const closeHit=document.elementFromPoint(close.left+close.width/2,close.top+close.height/2)?.closest('.bn-tab-close-btn');
            return {id:tab.dataset.notebookId,body:body?.dataset.notebookId,close:closeHit?.closest('.bn-tab-item')?.dataset.notebookId,visible:rect.left>=bounds.left-1&&rect.right<=bounds.right+1};
          });
        });
        for(const hit of hits){assert.equal(hit.body,hit.id);assert.equal(hit.close,hit.id);assert.equal(hit.visible,true);}
      }
      assert.deepEqual(await page.evaluate(()=>qa.tabClicks),tabFixture.map(tab=>tab.id));
      assert.equal(await page.locator('.bn-tab-item').count(),9);
      assert.equal(await page.evaluate(()=>document.querySelector('.bn-tab-list').scrollLeft),0);
    });
  }
  await check('Closing each of nine overlapping tabs affects only that tab and does not also select it',async()=>{
    await page.setViewportSize({width:1024,height:1000});
    for(let i=0;i<9;i++){
      await mountTabs('tab-4');await settleWidth();
      await page.locator('[data-notebook-id="tab-'+i+'"] .bn-tab-close-btn').click();
      await page.waitForFunction(()=>qa.tabs.tabs.length===8);
      assert.deepEqual(await page.evaluate(()=>qa.closedTabs),['tab-'+i]);
      assert.deepEqual(await page.evaluate(()=>qa.tabClicks),[]);
      assert.equal(await page.locator('[data-notebook-id="tab-'+i+'"]').count(),0);
    }
  });
  await check('Keyboard navigation wraps across all nine tabs and exposes the complete title',async()=>{
    await mountTabs('tab-0');await settleWidth();
    const first=page.locator('[data-notebook-id="tab-0"]');await first.focus();await first.press('End');
    await page.waitForFunction(()=>qa.tabs.activeTabId==='tab-8');
    await page.locator('[data-notebook-id="tab-8"]').press('ArrowRight');
    await page.waitForFunction(()=>qa.tabs.activeTabId==='tab-0');
    await page.locator('[data-notebook-id="tab-0"]').press('ArrowLeft');
    await page.waitForFunction(()=>qa.tabs.activeTabId==='tab-8');
    assert.ok((await page.locator('[data-notebook-id="tab-8"]').getAttribute('aria-label')).includes('Engineering notes (Page 9)'));
    await page.locator('[data-notebook-id="tab-8"] .bn-tab-close-btn').press('Enter');
    await page.waitForFunction(()=>qa.tabs.tabs.length===8);
    assert.deepEqual(await page.evaluate(()=>qa.closedTabs),['tab-8']);
  });
  await check('On a very narrow screen only the tab strip scrolls and the active tab stays accessible',async()=>{
    await page.setViewportSize({width:700,height:1000});await mountTabs('tab-8');await settleWidth();
    assert.equal(await page.evaluate(()=>{
      const list=document.querySelector('.bn-tab-list'),active=document.querySelector('.bn-tab-item-active'),a=active.getBoundingClientRect(),b=list.getBoundingClientRect();
      return list.scrollLeft>0&&a.left>=b.left-1&&a.right<=b.right+1&&window.scrollY===0;
    }),true);
    await page.locator('[data-notebook-id="tab-8"]').press('Home');
    await page.waitForFunction(()=>qa.tabs.activeTabId==='tab-0');
    assert.equal(await page.evaluate(()=>document.querySelector('.bn-tab-list').scrollLeft),0);
  });
  await check('Home and light theme retain visible, clickable overlapping tabs',async()=>{
    await page.setViewportSize({width:1024,height:1000});await mountTabs('tab-4');await settleWidth();
    await page.evaluate(()=>document.documentElement.dataset.theme='light');
    await page.locator('.bn-tab-home-btn').click();
    await page.waitForFunction(()=>qa.tabs.activeTabId===null);
    await page.locator('[data-notebook-id="tab-7"] .bn-tab-title').click();
    await page.waitForFunction(()=>qa.tabs.activeTabId==='tab-7');
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.bn-tab-item:not(.bn-tab-item-active)')).backgroundColor==='rgb(212, 222, 237)');
    assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.bn-tab-item:not(.bn-tab-item-active)')).backgroundColor),'rgb(212, 222, 237)');
    if(process.env.BETTERNOTE_QA_SCREENSHOTS==='1') await page.screenshot({path:path.join(preview,'betternote-nine-tabs-light.png')});
    await page.evaluate(()=>document.documentElement.dataset.theme='dark');
  });
  await check('Language changes resize the tab strip without covering any close button',async()=>{
    await page.setViewportSize({width:1024,height:1000});await mountTabs('tab-4');
    for(const locale of ['en','th','zh','ru']){
      await page.evaluate(locale=>qa.lang.setAppLanguage(locale),locale);await settleWidth();
      await page.locator('[data-notebook-id="tab-3"] .bn-tab-close-btn').click();
      await page.waitForFunction(()=>qa.tabs.tabs.length===8);assert.deepEqual(await page.evaluate(()=>qa.closedTabs),['tab-3']);
      await mountTabs('tab-4');
    }
    if(process.env.BETTERNOTE_QA_SCREENSHOTS==='1')await page.screenshot({path:path.join(preview,'betternote-nine-tabs-dark.png')});
  });

  let notebooks;
  await check('App opens nine notebook tabs and saves their page positions without dropping the first five',async()=>{
    await page.setViewportSize({width:1360,height:1000});
    notebooks=await page.evaluate(async()=>{
      await qa.clearSynthetic();qa.lang.setAppLanguage('en');
      localStorage.removeItem('betternote_open_tabs');localStorage.removeItem('betternote_notebook_page_cache');
      const books=[];for(let i=0;i<10;i++){const nb=await qa.fixture('nine-book-'+i,1);books.push(await qa.db.saveNotebook({...nb,name:'Notebook '+(i+1)}));}
      qa.mountApp();return books;
    });
    await page.waitForFunction(()=>qa.library?.notebooks.length===10);
    for(let i=0;i<9;i++){
      await page.evaluate(id=>qa.library.onOpenNotebook(id),notebooks[i].id);
      await page.waitForFunction(id=>qa.toolbar?.notebookTitle==='Notebook '+(Number(id.split('-').at(-1))+1)&&qa.boards.has(id+'-p0'),notebooks[i].id);
    }
    assert.equal(await page.locator('.bn-tab-item').count(),9);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('betternote_open_tabs')).length),9);
    // Renderer creates only the active notebook's writing area, not nine editors.
    assert.equal(await page.locator('.bn-editor-container').count(),1);
    assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('.bn-tab-item')].map(t=>t.dataset.notebookId)),notebooks.slice(0,9).map(nb=>nb.id));
  });
  await check('Undo and Redo survive switching between the first and ninth real App tabs',async()=>{
    await page.locator('[data-notebook-id="nine-book-0"] .bn-tab-title').click();
    await page.waitForFunction(()=>qa.toolbar?.notebookTitle==='Notebook 1'&&qa.boards.has('nine-book-0-p0'));
    await page.evaluate(()=>qa.boards.get('nine-book-0-p0').onStrokesChange(qa.ink(1)));await flush();
    await page.evaluate(()=>qa.boards.get('nine-book-0-p0').onStrokesChange(qa.ink(2)));await flush();
    await page.evaluate(()=>qa.toolbar.onUndo());await flush();
    await page.locator('[data-notebook-id="nine-book-8"] .bn-tab-title').click();
    await page.waitForFunction(()=>qa.toolbar?.notebookTitle==='Notebook 9'&&qa.boards.has('nine-book-8-p0'));
    await page.evaluate(()=>qa.boards.get('nine-book-8-p0').onStrokesChange(qa.ink(3)));await flush();
    await page.locator('[data-notebook-id="nine-book-0"] .bn-tab-title').click();
    await page.waitForFunction(()=>qa.toolbar?.notebookTitle==='Notebook 1'&&qa.toolbar.canRedo);
    await page.evaluate(()=>qa.toolbar.onRedo());await flush();
    assert.equal(await page.evaluate(async()=>(await qa.db.getPage('nine-book-0-p0')).strokes.length),2);
    assert.equal(await page.evaluate(async()=>(await qa.db.getPage('nine-book-8-p0')).strokes.length),3);
  });
  await check('All nine tabs restore on reopening App, including first and ninth notebooks',async()=>{
    await page.evaluate(()=>qa.mountApp());
    await page.waitForFunction(()=>qa.library?.notebooks.length===10&&qa.tabs?.tabs.length===9);
    assert.equal(await page.locator('.bn-tab-item').count(),9);
    await page.locator('[data-notebook-id="nine-book-8"] .bn-tab-title').click();
    await page.waitForFunction(()=>qa.toolbar?.notebookTitle==='Notebook 9');
    assert.equal(await page.evaluate(()=>qa.boards.get('nine-book-8-p0').page.strokes.length),3);
    assert.equal(await page.locator('.bn-editor-container').count(),1);
  });
  await check('Opening a tenth notebook closes the least recently used tab while preserving its saved data',async()=>{
    await page.evaluate(()=>qa.toolbar.onBackToLibrary());
    await page.waitForFunction(()=>qa.library?.notebooks.length===10&&!document.querySelector('.bn-editor-container'));
    const oldest=await page.evaluate(()=>[...qa.tabs.tabs].sort((a,b)=>(a.lastAccessed||0)-(b.lastAccessed||0))[0].id);
    await page.evaluate(()=>qa.library.onOpenNotebook('nine-book-9'));
    await page.waitForFunction(()=>qa.toolbar?.notebookTitle==='Notebook 10');
    assert.equal(await page.locator('.bn-tab-item').count(),9);
    assert.equal(await page.locator('[data-notebook-id="'+oldest+'"]').count(),0);
    assert.equal(await page.evaluate(async id=>!!await qa.db.getNotebookById(id)&& (await qa.db.getPagesByNotebookId(id)).length===1,oldest),true);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('betternote_open_tabs')).length),9);
  });
};
