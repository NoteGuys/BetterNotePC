// Isolated, synthetic-data regression checks. Never opens the installed app.
// Requires esbuild (already in the project) and a Playwright runtime supplied by
// BETTERNOTE_PLAYWRIGHT_PATH. No dependency installation or real Drive access.
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const esbuild = require('esbuild');
const { chromium } = require(process.env.BETTERNOTE_PLAYWRIGHT_PATH || 'playwright');
const root = fs.realpathSync(path.resolve(__dirname, '..'));
const preview = process.env.BETTERNOTE_QA_TEMP;
if (!preview || !path.isAbsolute(preview) || !fs.statSync(preview).isDirectory()) throw new Error('Set BETTERNOTE_QA_TEMP to an existing isolated QA directory.');
const origin = 'https://betternote-phase1.invalid/';
let thumbnailWorkerFactorySource = '';
const results = [];
const captures = new Map([
  ['CanvasBoard', "window.qa.boards.set(props.page.id, props);"],
  ['WhiteboardBoard', "window.qa.boards.set(props.page.id, props);"],
  ['EditorToolbar', 'window.qa.toolbar = props;'],
  ['ThumbnailSidebar', 'window.qa.thumbnails = props;'],
  ['AddPageModal', 'window.qa.addPage = props;'],
  ['DocumentTabBar', 'window.qa.tabs = props;']
]);
const targetPaths = new Map([...captures.keys()].map(name => [path.join(root, 'src', 'components', 'Editor', name + '.jsx'), name]));
targetPaths.delete(path.join(root, 'src', 'components', 'Editor', 'DocumentTabBar.jsx'));
targetPaths.set(path.join(root, 'src', 'components', 'Common', 'DocumentTabBar.jsx'), 'DocumentTabBar');
const plugin = {
  name: 'capture-real-component-props',
  setup(build) {
    require('./helpers/recovery-worker.cjs').setupRecoveryWorker(build);
    build.onResolve({ filter: /^qa-original:/ }, args => ({ path: args.path.slice('qa-original:'.length), namespace: 'qa-original' }));
    build.onLoad({ filter: /.*/, namespace: 'qa-original' }, args => ({ contents: fs.readFileSync(args.path, 'utf8'), loader: 'jsx', resolveDir: path.dirname(args.path) }));
    build.onResolve({ filter: /notebookCover\.worker\.js\?worker&inline$/ }, () => ({ path:'thumbnail-worker-factory', namespace:'qa-thumbnail-worker' }));
    build.onLoad({ filter: /.*/, namespace:'qa-thumbnail-worker' }, () => ({ contents:thumbnailWorkerFactorySource, loader:'js' }));
    build.onLoad({ filter: /\.jsx$/ }, args => {
      const name = targetPaths.get(args.path);
      if (name) return { contents:
        "import React from 'react'; import {" + name + " as Actual} from " + JSON.stringify('qa-original:' + args.path) + ";" +
        "export const " + name + " = props => {" + captures.get(name) + "return React.createElement(Actual, props);};",
        loader: 'jsx', resolveDir: path.dirname(args.path)
      };
      // App close-protocol checks do not exercise library/cloud/import UI.
      if (args.path.endsWith(path.join('Library', 'LibraryView.jsx'))) return { contents: 'export const LibraryView = props => {window.qa.library=props;return null;};', loader: 'jsx' };
    });
  }
};
const entry = [
  "import React from 'react'; import {createRoot} from 'react-dom/client';",
  "import * as db from './src/services/db.js';",
  "import * as local from './src/services/localSaveService.js';",
  "import * as history from './src/services/notebookHistoryService.js';",
  "import * as lang from './src/services/i18n.js';",
  "import {NoteEditor} from './src/components/Editor/NoteEditor.jsx';",
  "import {DocumentTabBar} from './src/components/Common/DocumentTabBar.jsx';",
  "import {App} from './src/App.jsx';",
  "import {NotebookCard} from './src/components/Library/NotebookCard.jsx';",
  "import * as names from './src/utils/notebookNames.js';",
  "import * as covers from './src/services/notebookCoverService.js';",
  "import {NewItemModal} from './src/components/Library/NewItemModal.jsx';",
  "window.qa={db,local,lang,history,names,covers,boards:new Map(),replies:[],alerts:[]}; let renderer;",
  "window.alert=message=>qa.alerts.push(message); window.confirm=()=>true;",
  "window.electronAPI={isElectron:true,saveBackup:async()=>({success:false,reason:'synthetic QA only'}),onCloseSaveRequest:f=>{qa.closeRequest=f;return()=>{qa.closeRequest=null;};},onCloseSaveCancelled:f=>{qa.closeCancel=f;return()=>{};},setLocalSaveGuardReady:s=>{qa.closeReady=s;},completeCloseSaveRequest:r=>qa.replies.push(r)};",
  "qa.unmount=()=>{if(renderer){renderer.unmount();renderer=null;}qa.boards.clear();qa.toolbar=null;qa.thumbnails=null;qa.library=null;qa.tabs=null;};",
  "qa.mountEditor=(notebook,initialPageIndex=0)=>{qa.unmount();renderer=createRoot(document.getElementById('root'));renderer.render(React.createElement(React.Fragment,null,React.createElement(DocumentTabBar,{tabs:[{id:notebook.id,title:'Synthetic QA notebook',pageIndex:initialPageIndex}],activeTabId:notebook.id,onSelectTab(){},onCloseTab(){},onGoHome(){}}),React.createElement(NoteEditor,{notebook,initialPageIndex,onBackToLibrary(){},onNotebookUpdated(){}})));};",
  "qa.mountApp=()=>{qa.unmount();renderer=createRoot(document.getElementById('root'));renderer.render(React.createElement(App));};",
  "qa.mountCard=notebook=>{qa.unmount();qa.menuCalls=[];renderer=createRoot(document.getElementById('root'));renderer.render(React.createElement('div',{style:{padding:'50px',width:'240px'}},React.createElement(NotebookCard,{notebook,onRename:n=>qa.menuCalls.push(['rename',n]),onDuplicate:id=>qa.menuCalls.push(['duplicate',id]),onExportPdf:n=>qa.menuCalls.push(['export',n]),onMoveToFolder:n=>qa.menuCalls.push(['move',n]),onShare:n=>qa.menuCalls.push(['share',n]),onCopyLink:n=>qa.menuCalls.push(['link',n]),onDelete:id=>qa.menuCalls.push(['trash',id])})));};",
  "qa.mountNewNotebook=()=>{qa.unmount();qa.createdNotebook=null;qa.newClosed=false;renderer=createRoot(document.getElementById('root'));const Harness=()=>{const [open,setOpen]=React.useState(true);qa.setNewModalOpen=setOpen;return React.createElement(NewItemModal,{isOpen:open,onCreateNotebook:nb=>{qa.createdNotebook=nb;},onCreateFolder(){},onClose:()=>{qa.newClosed=true;setOpen(false);}});};renderer.render(React.createElement(Harness));};",
  "qa.mountTabBar=(tabs,activeId=tabs[0]?.id)=>{qa.unmount();qa.tabClicks=[];qa.closedTabs=[];renderer=createRoot(document.getElementById('root'));const Harness=()=>{const [items,setItems]=React.useState(tabs),[active,setActive]=React.useState(activeId);qa.setTabActive=setActive;return React.createElement(DocumentTabBar,{tabs:items,activeTabId:active,onSelectTab:id=>{qa.tabClicks.push(id);setActive(id);},onCloseTab:id=>{qa.closedTabs.push(id);setItems(old=>old.filter(tab=>tab.id!==id));setActive(old=>old===id?null:old);},onGoHome:()=>setActive(null)});};renderer.render(React.createElement(Harness));};",
  "qa.ink=(count)=>Array.from({length:count},(_,i)=>({id:'qa-stroke-'+i,tool:'pen',color:'#2563eb',width:3,points:[{x:30+i*15,y:30,pressure:0.5},{x:80+i*15,y:70,pressure:0.5}]}));",
  "qa.fixture=async(id,count=3)=>{const nb=await db.saveNotebook({id,name:'Synthetic QA notebook',pageCount:count,templateId:'blank',updatedAt:1});for(let i=0;i<count;i++)await db.savePage({id:id+'-p'+i,notebookId:id,pageIndex:i,templateId:'blank',pageWidth:480,pageHeight:620,strokes:[],textElements:[],imageElements:[],updatedAt:1});return nb;};",
  "qa.fault=async({store,method='put',key,once=false,throwRead=false})=>{const connection=await db.openDB(),original=connection.transaction.bind(connection);let triggered=0;connection.transaction=(...args)=>{const tx=original(...args),getStore=tx.objectStore.bind(tx);tx.objectStore=name=>{const target=getStore(name);if(name===store){if(throwRead&&args[1]==='readonly'){const getIndex=target.index.bind(target);target.index=indexName=>{const index=getIndex(indexName);index.getAll=()=>{throw new Error('Synthetic read failure');};return index;};}else if(args[1]==='readwrite'){const action=target[method].bind(target);target[method]=value=>{const req=action(value);const id=typeof value==='object'?value.id||value.key:value;if((!key||key===id)&&(!once||!triggered)){triggered++;req.addEventListener('success',()=>tx.abort(),{once:true});}return req;};}}return target;};return tx;};return()=>{connection.transaction=original;return triggered;};};",
  "qa.holdCommit=async()=>{const connection=await db.openDB(),original=connection.transaction.bind(connection),descriptor=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');if(!descriptor?.set)throw new Error('Native IDB oncomplete setter is required');let armed=true;qa.releaseCommit=null;qa.restoreCommit=()=>{connection.transaction=original;};connection.transaction=(...args)=>{const tx=original(...args),stores=Array.isArray(args[0])?args[0]:[args[0]];if(armed&&args[1]==='readwrite'&&stores.includes('pages')){armed=false;Object.defineProperty(tx,'oncomplete',{configurable:true,get:()=>descriptor.get.call(tx),set:handler=>descriptor.set.call(tx,event=>{qa.releaseCommit=()=>handler.call(tx,event);})});}return tx;};};",
  "qa.clearSynthetic=async()=>{if(location.href!==" + JSON.stringify(origin) + ")throw new Error('Refusing non-QA origin');qa.unmount();await local.flushLocalSaves();history.notebookHistoryStore.clear();const connection=await db.openDB();await new Promise((resolve,reject)=>{const tx=connection.transaction(['folders','notebooks','pages','settings'],'readwrite');for(const name of ['folders','notebooks','pages','settings'])tx.objectStore(name).clear();tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});};"
].join('\n');

(async () => {
  if(process.env.BETTERNOTE_QA_BUILT_WORKER==='1'){
    const assets=path.join(root,'dist/assets'),builtWorkers=fs.readdirSync(assets).filter(name=>/^notebookCover\.worker-.*\.js$/.test(name));
    if(builtWorkers.length!==1)throw new Error('Build the inline thumbnail worker before checking its production bundle.');
    thumbnailWorkerFactorySource=fs.readFileSync(path.join(assets,builtWorkers[0]),'utf8');
  }else{
    const thumbnailWorker=await esbuild.build({entryPoints:[path.join(root,'src/utils/notebookCover.worker.js')],bundle:true,write:false,format:'iife',platform:'browser',logLevel:'silent'});
    thumbnailWorkerFactorySource='const source='+JSON.stringify(thumbnailWorker.outputFiles[0].text)+';export default function(){const url=URL.createObjectURL(new Blob([source],{type:"text/javascript"}));try{return new Worker(url);}finally{URL.revokeObjectURL(url);}}';
  }
  const compiled = await esbuild.build({
    stdin: { contents: entry, resolveDir: root, sourcefile: 'phase1-in-memory.jsx', loader: 'jsx' },
    bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"production"' }, plugins: [plugin]
  });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BETTERNOTE_QA_BROWSER ? { executablePath: process.env.BETTERNOTE_QA_BROWSER } : {}),
    env: { ...process.env, TEMP: preview, TMP: preview }
  });
  try {
    const context = await browser.newContext({ acceptDownloads: false, viewport: { width: 1360, height: 1000 } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', route => route.request().url() === origin
      ? route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head></head><body><div id="root" style="height:100vh"></div></body></html>' })
      : route.abort());
    await page.goto(origin);
    assert.equal(page.url(), origin);
    await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'src/index.css'), 'utf8') });
    await page.addScriptTag({ content: compiled.outputFiles[0].text });
    const check = async (name, work) => {
      let timer;
      try {
        await Promise.race([work(), new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Timed out: ' + name)), 20000);
        })]);
      } finally { clearTimeout(timer); }
      results.push({ name, passed: true });
      process.stdout.write('PASS ' + name + '\n');
    };
    const fixture = (id, count = 3) => page.evaluate(([id,count]) => qa.fixture(id,count), [id,count]);
    const flush = () => page.evaluate(() => qa.local.flushLocalSaves());
    const mount = async (nb, index = 0) => {
      await page.evaluate(([nb,index]) => qa.mountEditor(nb,index), [nb,index]);
      await page.waitForFunction(() => qa.toolbar && qa.boards.size);
    };
    const showThumbnails = async () => {
      await page.evaluate(() => qa.toolbar.setShowThumbnails(true));
      await page.waitForFunction(() => !!qa.thumbnails);
    };
    if(process.env.BETTERNOTE_QA_SHAPE_ONLY==='1') {
      await require('./shape-editor.browser.cjs')({page,fixture,mount,flush,check});
      assert.deepEqual(errors,[]);await page.evaluate(()=>qa.unmount());await flush();await context.close();
      console.log(JSON.stringify({tests:results.length,passed:results.length,rendererErrors:errors,syntheticDatabaseOnly:true}));return;
    }
    if(process.env.BETTERNOTE_QA_INK_SESSION_ONLY==='1') {
      await require('./ink-session-editor.browser.cjs')({page,fixture,mount,flush,check});
      assert.deepEqual(errors,[]);await page.evaluate(()=>qa.unmount());await flush();await context.close();
      console.log(JSON.stringify({tests:results.length,passed:results.length,rendererErrors:errors,syntheticDatabaseOnly:true}));return;
    }
    if(process.env.BETTERNOTE_QA_HIGHLIGHTER_ONLY==='1') {
      await require('./highlighter-ui.browser.cjs')({page,fixture,mount,flush,check,preview});
      assert.deepEqual(errors,[]);await page.evaluate(()=>qa.unmount());await flush();await context.close();
      console.log(JSON.stringify({tests:results.length,passed:results.length,rendererErrors:errors,syntheticDatabaseOnly:true}));return;
    }
    await check('Fresh database is seeded once, with complete sample records', async () => {
      assert.deepEqual(await page.evaluate(async () => {
        await qa.db.seedInitialData(); const nb=await qa.db.getNotebookById('nb-welcome-1');
        return { folders:(await qa.db.getAllFolders()).length,pages:(await qa.db.getPagesByNotebookId(nb.id)).length,marker:await qa.db.getSetting('initialDataSeeded') };
      }), { folders:2,pages:2,marker:true });
    });
    await check('Existing welcome handwriting is preserved even with no folders and no legacy seed marker', async () => {
      assert.equal(await page.evaluate(async () => {
        const p=await qa.db.getPage('nb-welcome-1_page_0');p.strokes=qa.ink(4);await qa.db.savePage(p);
        const db=await qa.db.openDB();await new Promise((resolve,reject)=>{const tx=db.transaction(['folders','settings'],'readwrite');tx.objectStore('folders').clear();tx.objectStore('settings').delete('initialDataSeeded');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
        await qa.db.seedInitialData();return (await qa.db.getPage(p.id)).strokes.length;
      }),4);
    });
    await check('Deleting all samples after initialization does not recreate them', async () => {
      assert.equal(await page.evaluate(async () => {
        const db=await qa.db.openDB();await new Promise((resolve,reject)=>{const tx=db.transaction(['folders','notebooks','pages'],'readwrite');for(const name of ['folders','notebooks','pages'])tx.objectStore(name).clear();tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
        await qa.db.seedInitialData();return (await qa.db.getAllNotebooks()).length;
      }),0);
    });
    await check('Seed failure rolls back folders, notebook, pages and initialization marker together', async () => {
      assert.deepEqual(await page.evaluate(async () => {
        await qa.clearSynthetic(); const restore=await qa.fault({store:'pages',method:'add',once:true});
        let rejected=false;try{await qa.db.seedInitialData();}catch(_){rejected=true;}finally{restore();}
        return {rejected,folders:(await qa.db.getAllFolders()).length,notebooks:(await qa.db.getAllNotebooks()).length,pages:(await qa.db.getPagesByNotebookId('nb-welcome-1')).length,marker:await qa.db.getSetting('initialDataSeeded')};
      }),{rejected:true,folders:0,notebooks:0,pages:0,marker:null});
    });
    await check('Page save and notebook modification time commit together', async () => {
      await fixture('native');
      assert.equal(await page.evaluate(async () => {
        const before=await qa.db.getNotebookById('native'),p=await qa.db.getPage('native-p0');
        await qa.db.savePage({...p,strokes:qa.ink(2)});
        return (await qa.db.getPage(p.id)).strokes.length===2&&(await qa.db.getNotebookById('native')).updatedAt>before.updatedAt;
      }),true);
    });
    await check('Page request success followed by transaction abort is reported as failure and rolls back notebook time', async () => {
      assert.deepEqual(await page.evaluate(async () => {
        const p=await qa.db.getPage('native-p0'),nb=await qa.db.getNotebookById('native');
        const restore=await qa.fault({store:'pages',key:p.id});let rejected=false;
        try{await qa.db.savePage({...p,strokes:qa.ink(5)});}catch(_){rejected=true;}finally{restore();}
        return {rejected,strokes:(await qa.db.getPage(p.id)).strokes.length,notebookUnchanged:(await qa.db.getNotebookById(nb.id)).updatedAt===nb.updatedAt,pending:qa.db.getPendingWriteCount()};
      }),{rejected:true,strokes:2,notebookUnchanged:true,pending:0});
    });
    for (const [name,store,key,operation,verify] of [
      ['Folder save waits for transaction commit','folders','abort-folder',()=>qa.db.saveFolder({id:'abort-folder',name:'QA'}),async()=>!(await qa.db.getAllFolders()).some(f=>f.id==='abort-folder')],
      ['Notebook save waits for transaction commit','notebooks','abort-notebook',()=>qa.db.saveNotebook({id:'abort-notebook',name:'QA'}),async()=>!await qa.db.getNotebookById('abort-notebook')],
      ['Settings save waits for transaction commit','settings','abort-setting',()=>qa.db.saveSetting('abort-setting','QA'),async()=>await qa.db.getSetting('abort-setting')===null]
    ]) {
      await check(name,async()=>{
        assert.deepEqual(await page.evaluate(async ({store,key,op,verify})=>{
          const restore=await qa.fault({store,key});let rejected=false;
          try{await(0,eval)('('+op+')')();}catch(_){rejected=true;}finally{restore();}
          return{rejected,unchanged:await(0,eval)('('+verify+')')()};
        },{store,key,op:operation.toString(),verify:verify.toString()}),{rejected:true,unchanged:true});
      });
    }
    await check('Moving a notebook cannot claim success after an aborted transaction', async () => {
      assert.deepEqual(await page.evaluate(async()=>{
        const restore=await qa.fault({store:'notebooks',key:'native'});let rejected=false;
        try{await qa.db.moveNotebookToFolder('native','new-folder');}catch(_){rejected=true;}finally{restore();}
        return{rejected,moved:!!(await qa.db.getNotebookById('native')).folderId};
      }),{rejected:true,moved:false});
    });
    await check('A stale notebook metadata update cannot move its modification time backwards', async()=>{
      assert.equal(await page.evaluate(async()=>{
        const before=await qa.db.getNotebookById('native');
        const saved=await qa.db.saveNotebook({...before,updatedAt:1});
        return saved.updatedAt>before.updatedAt&&(await qa.db.getNotebookById('native')).updatedAt===saved.updatedAt;
      }),true);
    });
    await check('Page deletion waits for commit and rolls back on abort', async()=>{
      assert.deepEqual(await page.evaluate(async()=>{
        const restore=await qa.fault({store:'pages',method:'delete',key:'native-p0'});let rejected=false;
        try{await qa.db.deletePage('native-p0');}catch(_){rejected=true;}finally{restore();}
        return{rejected,exists:!!await qa.db.getPage('native-p0')};
      }),{rejected:true,exists:true});
    });
    await check('Notebook deletion rolls back notebook and all pages together',async()=>{
      assert.deepEqual(await page.evaluate(async()=>{
        const restore=await qa.fault({store:'pages',method:'delete',key:'native-p0'});let rejected=false;
        try{await qa.db.deleteNotebook('native');}catch(_){rejected=true;}finally{restore();}
        return{rejected,exists:!!await qa.db.getNotebookById('native'),pages:(await qa.db.getPagesByNotebookId('native')).length};
      }),{rejected:true,exists:true,pages:3});
    });
    await check('Removing a folder preserves notebooks, media and nested folders in its parent',async()=>{
      assert.deepEqual(await page.evaluate(async()=>{
        await qa.db.saveFolder({id:'parent',name:'QA parent'});
        await qa.db.saveFolder({id:'remove',name:'QA remove',parentId:'parent'});
        await qa.db.saveFolder({id:'child',name:'QA child',parentId:'remove'});
        await qa.db.saveNotebook({id:'folder-note',name:'QA folder notebook',folderId:'remove'});
        await qa.db.savePage({id:'folder-note-p',notebookId:'folder-note',pageIndex:0,strokes:qa.ink(2),imageElements:[{id:'image',src:'synthetic',locked:true}]});
        await qa.db.deleteFolder('remove');const p=await qa.db.getPage('folder-note-p');
        return{folderGone:!(await qa.db.getAllFolders()).some(f=>f.id==='remove'),notebookParent:(await qa.db.getNotebookById('folder-note')).folderId,childParent:(await qa.db.getAllFolders()).find(f=>f.id==='child').parentId,strokes:p.strokes.length,locked:p.imageElements[0].locked};
      }),{folderGone:true,notebookParent:'parent',childParent:'parent',strokes:2,locked:true});
    });
    await check('Folder deletion and content moves roll back together if either cannot be saved',async()=>{
      assert.deepEqual(await page.evaluate(async()=>{
        await qa.db.saveFolder({id:'folder-fail',name:'QA'});await qa.db.saveNotebook({id:'folder-fail-nb',name:'QA',folderId:'folder-fail'});
        const restore=await qa.fault({store:'notebooks',key:'folder-fail-nb'});let rejected=false;
        try{await qa.db.deleteFolder('folder-fail');}catch(_){rejected=true;}finally{restore();}
        return{rejected,folderExists:(await qa.db.getAllFolders()).some(f=>f.id==='folder-fail'),notebookParent:(await qa.db.getNotebookById('folder-fail-nb')).folderId};
      }),{rejected:true,folderExists:true,notebookParent:'folder-fail'});
    });
    await check('Inserting a page changes page order and page count atomically without index collisions',async()=>{
      assert.deepEqual(await page.evaluate(async()=>{
        const result=await qa.db.mutateNotebookPages('native',{kind:'insert',afterPageId:'native-p0',page:{id:'native-new',notebookId:'native',strokes:[],textElements:[],imageElements:[]}});
        return{ids:result.pages.map(p=>p.id),indexes:(await qa.db.getPagesByNotebookId('native')).map(p=>p.pageIndex),count:(await qa.db.getNotebookById('native')).pageCount};
      }),{ids:['native-p0','native-new','native-p1','native-p2'],indexes:[0,1,2,3],count:4});
    });
    await check('Failed insertion leaves all original indexes and notebook page count unchanged',async()=>{
      assert.deepEqual(await page.evaluate(async()=>{
        const restore=await qa.fault({store:'pages',key:'native-p2'});let rejected=false;
        try{await qa.db.mutateNotebookPages('native',{kind:'insert',afterPageId:'native-p0',page:{id:'failed-new',notebookId:'native',strokes:[]}});}catch(_){rejected=true;}finally{restore();}
        return{rejected,ids:(await qa.db.getPagesByNotebookId('native')).map(p=>p.id),count:(await qa.db.getNotebookById('native')).pageCount};
      }),{rejected:true,ids:['native-p0','native-new','native-p1','native-p2'],count:4});
    });
    await check('Failed deletion leaves the removed page and all original indexes intact',async()=>{
      assert.deepEqual(await page.evaluate(async()=>{
        const restore=await qa.fault({store:'pages',key:'native-p1'});let rejected=false;
        try{await qa.db.mutateNotebookPages('native',{kind:'delete',pageId:'native-new'});}catch(_){rejected=true;}finally{restore();}
        return{rejected,ids:(await qa.db.getPagesByNotebookId('native')).map(p=>p.id),count:(await qa.db.getNotebookById('native')).pageCount};
      }),{rejected:true,ids:['native-p0','native-new','native-p1','native-p2'],count:4});
    });
    await check('A queued ink save with an old page index preserves the actual new position',async()=>{
      assert.equal(await page.evaluate(async()=>{
        const p=await qa.db.getPage('native-p1');
        await qa.local.pageSaveQueue.enqueue({...p,pageIndex:1,strokes:qa.ink(3)});
        await qa.local.flushLocalSaves();
        const stored=await qa.db.getPage(p.id);return stored.pageIndex===2&&stored.strokes.length===3;
      }),true);
    });
    await check('Delayed edits cannot recreate a page that was intentionally deleted',async()=>{
      assert.deepEqual(await page.evaluate(async()=>{
        const p=await qa.db.getPage('native-new');await qa.db.mutateNotebookPages('native',{kind:'delete',pageId:p.id});
        let rejected=false;try{await qa.local.pageSaveQueue.enqueue({...p,strokes:qa.ink(2)});}catch(_){rejected=true;}
        qa.local.pageSaveQueue.forgetDeletedPage(p.id);
        return{rejected,exists:!!await qa.db.getPage(p.id),status:qa.local.getLocalSaveSnapshot().status};
      }),{rejected:true,exists:false,status:'saved'});
    });

    await check('Undo/Redo reverses page deletion before reversing earlier handwriting on the same IDs',async()=>{
      const nb=await fixture('editor-delete');await mount(nb,1);await showThumbnails();
      await page.evaluate(()=>qa.boards.get('editor-delete-p1').onBatchUpdatePage({strokes:qa.ink(1),textElements:[{id:'qa-text',text:'Synthetic',x:30,y:100}],imageElements:[]}));
      await flush();await page.evaluate(()=>qa.thumbnails.onDeletePage(0));
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.deepEqual(await page.evaluate(async()=>({edited:(await qa.db.getPage('editor-delete-p1')).strokes.length,index:(await qa.db.getPage('editor-delete-p1')).pageIndex,count:(await qa.db.getPagesByNotebookId('editor-delete')).length})),{edited:1,index:1,count:3});
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('editor-delete-p1')).strokes.length),0);
      await page.evaluate(()=>qa.toolbar.onRedo());await page.evaluate(()=>qa.toolbar.onRedo());await flush();
      assert.deepEqual(await page.evaluate(async()=>({edited:(await qa.db.getPage('editor-delete-p1')).strokes.length,text:(await qa.db.getPage('editor-delete-p1')).textElements.length,index:(await qa.db.getPage('editor-delete-p1')).pageIndex,count:(await qa.db.getPagesByNotebookId('editor-delete')).length,other:(await qa.db.getPage('editor-delete-p2')).strokes.length})),{edited:1,text:1,index:0,count:2,other:0});
    });
    await check('Undo removes a duplicated page before earlier ink; Redo restores the same copy ID',async()=>{
      const nb=await fixture('editor-duplicate');await mount(nb,1);await showThumbnails();
      await page.evaluate(()=>qa.boards.get('editor-duplicate-p1').onStrokesChange(qa.ink(1)));await flush();
      await page.evaluate(()=>qa.thumbnails.onDuplicatePage(0));
      const copyId=await page.evaluate(()=>qa.thumbnails.pages.find(p=>!p.id.startsWith('editor-duplicate-p')).id);
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.deepEqual(await page.evaluate(async()=>({edited:(await qa.db.getPage('editor-duplicate-p1')).strokes.length,index:(await qa.db.getPage('editor-duplicate-p1')).pageIndex,pages:(await qa.db.getPagesByNotebookId('editor-duplicate')).length})),{edited:1,index:1,pages:3});
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('editor-duplicate-p1')).strokes.length),0);
      await page.evaluate(()=>qa.toolbar.onRedo());await page.evaluate(()=>qa.toolbar.onRedo());await flush();
      assert.ok(await page.evaluate(async id=>!!await qa.db.getPage(id),copyId));
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('editor-duplicate-p1')).pageIndex),2);
    });
    await check('Rapid editor edits keep chronological Undo/Redo order before persistence finishes',async()=>{
      const nb=await fixture('editor-rapid');await mount(nb);
      await page.evaluate(()=>{const props=qa.boards.get('editor-rapid-p0');void props.onStrokesChange(qa.ink(1));void props.onStrokesChange(qa.ink(2));});
      await flush();await page.waitForFunction(()=>qa.toolbar.canUndo);
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('editor-rapid-p0')).strokes.length),1);
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('editor-rapid-p0')).strokes.length),0);
      await page.evaluate(()=>qa.toolbar.onRedo());await page.evaluate(()=>qa.toolbar.onRedo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('editor-rapid-p0')).strokes.length),2);
    });
    await check('Deleted pages restore complete media, handwriting, text, locked images and metadata',async()=>{
      const nb=await fixture('editor-history');
      const expected=await page.evaluate(async()=>{
        const p=await qa.db.getPage('editor-history-p0');
        const src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="blue"/></svg>');
        await qa.db.savePage({...p,paperColor:'#fef3c7',sizeId:'A3',orientation:'landscape',isFavorite:true,pdfPageImage:src,pdfPageNumber:7});
        qa.richUpdates={strokes:qa.ink(2),textElements:[{id:'text',text:'Synthetic QA only',x:20,y:110,width:120,height:32}],imageElements:[{id:'image',src,x:40,y:150,width:60,height:60,locked:true}]};
        return {...await qa.db.getPage(p.id),...qa.richUpdates};
      });
      await mount(nb);await showThumbnails();
      await page.evaluate(()=>qa.boards.get('editor-history-p0').onBatchUpdatePage(qa.richUpdates));await flush();
      await page.evaluate(()=>qa.thumbnails.onDeletePage(0));
      assert.equal(await page.evaluate(async()=>!!await qa.db.getPage('editor-history-p0')),false);
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      const restored=await page.evaluate(async()=>await qa.db.getPage('editor-history-p0'));
      delete expected.updatedAt;delete restored.updatedAt;
      assert.deepEqual(restored,expected);
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.deepEqual(await page.evaluate(async()=>{const p=await qa.db.getPage('editor-history-p0');return{strokes:p.strokes.length,text:p.textElements.length,images:p.imageElements.length,favorite:p.isFavorite,background:!!p.pdfPageImage};}),{strokes:0,text:0,images:0,favorite:true,background:true});
      await page.evaluate(()=>qa.toolbar.onRedo());await page.evaluate(()=>qa.toolbar.onRedo());await flush();
      assert.equal(await page.evaluate(async()=>!!await qa.db.getPage('editor-history-p0')),false);
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('editor-history-p1')).strokes.length),0);
    });
    await check('Failed editor save stays visible across unmount/remount and retries through the real status button',async()=>{
      const nb=await fixture('editor-retry');await mount(nb);
      await page.evaluate(async()=>{qa.restoreFault=await qa.fault({store:'pages',key:'editor-retry-p0'});await qa.boards.get('editor-retry-p0').onStrokesChange(qa.ink(1));});
      await page.waitForSelector('.bn-local-save-status-error');
      await page.evaluate(()=>qa.boards.get('editor-retry-p0').onStrokesChange(qa.ink(2)));
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('editor-retry-p0')).strokes.length),0);
      await mount(nb);
      assert.equal(await page.evaluate(()=>qa.boards.get('editor-retry-p0').page.strokes.length),2);
      if(process.env.BETTERNOTE_QA_SCREENSHOTS==='1')await page.screenshot({path:path.join(preview,'betternote-phase1-save-retry.png')});
      await page.evaluate(()=>qa.restoreFault());
      await page.getByRole('button',{name:'Retry saving',exact:true}).click();
      await page.waitForSelector('.bn-local-save-status-saved');await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('editor-retry-p0')).strokes.length),2);
      if(process.env.BETTERNOTE_QA_SCREENSHOTS==='1')await page.screenshot({path:path.join(preview,'betternote-phase1-saved.png')});
    });
    await check('Undoing content keeps subsequent favorite changes intact',async()=>{
      const nb=await fixture('editor-metadata');await mount(nb);
      await page.evaluate(()=>qa.boards.get('editor-metadata-p0').onStrokesChange(qa.ink(1)));
      await showThumbnails();
      await page.evaluate(()=>qa.toolbar.onToggleFavoriteCurrentPage());await flush();
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.deepEqual(await page.evaluate(async()=>{const p=await qa.db.getPage('editor-metadata-p0');return{strokes:p.strokes.length,favorite:p.isFavorite};}),{strokes:0,favorite:true});
    });
    await check('Read failure and hotkeys while retrying preserve both stored pages and existing Undo history',async()=>{
      const nb=await fixture('editor-load');await mount(nb);
      await page.evaluate(()=>qa.boards.get('editor-load-p0').onStrokesChange(qa.ink(1)));await flush();
      await page.evaluate(async()=>{qa.restoreRead=await qa.fault({store:'pages',throwRead:true});});
      await page.evaluate(nb=>qa.mountEditor(nb),nb);await page.waitForSelector('.bn-local-load-error');
      await page.keyboard.press('Control+z');
      assert.equal(await page.evaluate(()=>qa.history.notebookHistoryStore.forNotebook('editor-load').getSnapshot().pointer),0);
      await page.evaluate(()=>qa.restoreRead());
      await page.getByRole('button',{name:'Try opening again',exact:true}).click();
      await page.waitForFunction(()=>qa.boards.size>0&&qa.toolbar?.canUndo);
      assert.equal(await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('editor-load')).length),3);
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('editor-load-p0')).strokes.length),0);
    });
    await check('Local save labels follow English, Thai, Chinese and Russian settings',async()=>{
      const expected={en:'Saved on this device',th:'เซฟในเครื่องแล้ว',zh:'已保存到此设备',ru:'Сохранено на устройстве'};
      for(const [language,label]of Object.entries(expected)){
        await page.evaluate(language=>qa.lang.setAppLanguage(language),language);
        await page.waitForFunction(label=>document.querySelector('.bn-local-save-status')?.textContent.includes(label),label);
      }
      await page.evaluate(()=>qa.lang.setAppLanguage('en'));
    });
    await check('App close protocol preserves failed saves and retries before acknowledging close',async()=>{
      const nb=await fixture('app-close',1);
      await page.evaluate(async()=>{
        qa.restoreClose=await qa.fault({store:'pages',key:'app-close-p0'});
        const p=await qa.db.getPage('app-close-p0');
        await qa.local.pageSaveQueue.enqueue({...p,strokes:qa.ink(2)}).catch(()=>{});
        qa.mountApp();
      });
      await page.waitForFunction(()=>!!qa.closeRequest&&!!qa.closeReady&&!!document.querySelector('.bn-document-tab-bar'));
      await page.evaluate(()=>qa.closeRequest({requestId:1}));
      assert.equal(await page.evaluate(()=>qa.replies.at(-1).success),false);
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('app-close-p0')).strokes.length),0);
      await page.evaluate(()=>qa.restoreClose());
      await page.evaluate(()=>qa.closeRequest({requestId:2}));
      assert.equal(await page.evaluate(()=>qa.replies.at(-1).success),true);
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('app-close-p0')).strokes.length),2);
      await page.evaluate(()=>qa.closeCancel());
    });
    await check('Concurrent notebook creation keeps the existing automatic unique-name behavior',async()=>{
      assert.deepEqual(await page.evaluate(async()=>{
        const saved=await Promise.all([0,1,2].map(i=>qa.db.saveNotebook({id:'names-'+i,name:'Phase one names'},{ensureUniqueName:true})));
        return saved.map(nb=>nb.name).sort();
      }),['Phase one names','Phase one names(1)','Phase one names(2)']);
    });
    await check('A cyclic folder parent is handled without leaving its notebook unreachable',async()=>{
      assert.deepEqual(await page.evaluate(async()=>{
        await qa.db.saveFolder({id:'cycle-a',parentId:'cycle-b',name:'QA'});
        await qa.db.saveFolder({id:'cycle-b',parentId:'cycle-a',name:'QA'});
        await qa.db.saveNotebook({id:'cycle-nb',folderId:'cycle-a',name:'QA'});
        await qa.db.deleteFolder('cycle-a');
        return{notebookParent:(await qa.db.getNotebookById('cycle-nb')).folderId,childParent:(await qa.db.getAllFolders()).find(f=>f.id==='cycle-b').parentId};
      }),{notebookParent:null,childParent:null});
    });
    await check('The actual editor still protects the last remaining page from deletion',async()=>{
      const nb=await fixture('editor-last',1);await mount(nb);await showThumbnails();
      await page.evaluate(()=>qa.thumbnails.onDeletePage(0));
      assert.equal(await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('editor-last')).length),1);
    });
    await check('Actual pen pointer events still produce a committed stroke through the new save queue',async()=>{
      const nb=await fixture('editor-pointer',1);await mount(nb);
      await page.waitForSelector('.bn-layer-active');
      await page.evaluate(()=>{
        const canvas=document.querySelector('.bn-layer-active'),rect=canvas.getBoundingClientRect();
        const pointer=(type,x,y,pressure)=>new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'pen',pointerId:1,button:0,
          buttons:type==='pointerup'?0:1,pressure,clientX:rect.left+x*rect.width/480,clientY:rect.top+y*rect.height/620});
        canvas.dispatchEvent(pointer('pointerdown',50,50,.5));
        const move=pointer('pointermove',100,100,.5);
        Object.defineProperty(move,'getCoalescedEvents',{value:()=>[pointer('pointermove',70,60,.3),pointer('pointermove',90,80,.7)]});
        canvas.dispatchEvent(move);
        canvas.dispatchEvent(pointer('pointerup',120,110,0));
      });
      await page.waitForFunction(async()=>(await qa.db.getPage('editor-pointer-p0')).strokes.length===1);
      await flush();
      const saved=await page.evaluate(async()=>(await qa.db.getPage('editor-pointer-p0')).strokes);
      const expected=[[50,50,.5],[70,60,.3],[90,80,.7],[100,100,.5],[120,110,.5]];
      assert.equal(saved[0].points.length,expected.length);
      saved[0].points.forEach((point,i)=>{
        assert.ok(Math.abs(point.x-expected[i][0])<.001);
        assert.ok(Math.abs(point.y-expected[i][1])<.001);
        assert.ok(Math.abs(point.pressure-expected[i][2])<.001);
      });
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('editor-pointer-p0')).strokes.length),0);
      await page.evaluate(()=>qa.toolbar.onRedo());await flush();
      assert.deepEqual(await page.evaluate(async()=>(await qa.db.getPage('editor-pointer-p0')).strokes),saved);
      await mount(nb);
      assert.deepEqual(await page.evaluate(async()=>(await qa.db.getPage('editor-pointer-p0')).strokes),saved);
    });
    await check('Undo/Redo of insertion and earlier ink keeps exact page order and count',async()=>{
      const nb=await fixture('editor-insert');await mount(nb,1);await showThumbnails();
      await page.evaluate(()=>qa.boards.get('editor-insert-p1').onStrokesChange(qa.ink(1)));await flush();
      await page.evaluate(()=>qa.thumbnails.onInsertPageAfter(0));
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.deepEqual(await page.evaluate(async()=>{const p=await qa.db.getPage('editor-insert-p1');return{index:p.pageIndex,strokes:p.strokes.length,count:(await qa.db.getPagesByNotebookId('editor-insert')).length};}),{index:1,strokes:1,count:3});
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('editor-insert-p1')).strokes.length),0);
      await page.evaluate(()=>qa.toolbar.onRedo());await page.evaluate(()=>qa.toolbar.onRedo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('editor-insert-p1')).pageIndex),2);
    });
    await check('App accepts already committed page structure without a redundant notebook write',async()=>{
      const nb=await fixture('app-structure');await page.evaluate(()=>qa.mountApp());
      await page.waitForFunction(()=>qa.library?.notebooks.some(nb=>nb.id==='app-structure'));
      await page.evaluate(()=>qa.library.onOpenNotebook('app-structure'));
      await page.waitForFunction(()=>qa.boards.has('app-structure-p0')&&qa.toolbar);
      await page.evaluate(()=>qa.toolbar.onOpenAddPage());
      await page.waitForFunction(()=>qa.addPage?.isOpen);
      await page.evaluate(async()=>{
        await qa.db.waitForPendingWrites();const db=await qa.db.openDB(),original=db.transaction.bind(db);qa.structureWrites=0;
        db.transaction=(...args)=>{const tx=original(...args),getStore=tx.objectStore.bind(tx);tx.objectStore=name=>{const store=getStore(name);if(name==='notebooks'&&args[1]==='readwrite'){const put=store.put.bind(store);store.put=value=>{if(value.id==='app-structure')qa.structureWrites++;return put(value);};}return store;};return tx;};
        qa.restoreStructure=()=>{db.transaction=original;};
      });
      await page.evaluate(()=>qa.addPage.onAddPage({sizeId:'A4',orientation:'portrait',templateId:'blank',insertPosition:'after',pageWidth:480,pageHeight:620}));
      await page.evaluate(async()=>{await qa.db.waitForPendingWrites();qa.restoreStructure();});
      assert.equal(await page.evaluate(()=>qa.structureWrites),1);
      await page.evaluate(()=>qa.toolbar.onBackToLibrary());
      await page.waitForFunction(()=>qa.library?.notebooks.find(nb=>nb.id==='app-structure')?.pageCount===4);
    });
    await check('App reports an individual folder-delete failure without an uncaught error or loss of contents',async()=>{
      await page.evaluate(async()=>{
        await qa.db.saveFolder({id:'app-folder-fail',name:'QA folder'});
        await qa.db.saveNotebook({id:'app-folder-fail-nb',name:'QA',folderId:'app-folder-fail'});
        qa.mountApp();
      });
      await page.waitForFunction(()=>qa.library?.folders.some(f=>f.id==='app-folder-fail'));
      assert.deepEqual(await page.evaluate(async()=>{
        const restore=await qa.fault({store:'notebooks',key:'app-folder-fail-nb'});
        let result;try{result=await qa.library.onDeleteFolder('app-folder-fail');}finally{restore();}
        return{result,folderExists:(await qa.db.getAllFolders()).some(f=>f.id==='app-folder-fail'),notebookParent:(await qa.db.getNotebookById('app-folder-fail-nb')).folderId,alert:qa.alerts.at(-1)};
      }),{result:false,folderExists:true,notebookParent:'app-folder-fail',alert:'The folder could not be removed. Its contents have been kept.'});
    });

    await check('Added pages can be undone and redone with the same ID, size and later handwriting',async()=>{
      const nb=await fixture('history-add',1);await mount(nb);
      await page.evaluate(()=>qa.addPage.onAddPage({sizeId:'A3',orientation:'landscape',templateId:'dotted',pageWidth:700,pageHeight:480,insertPosition:'after'}));
      const added=await page.evaluate(async()=>{const pages=await qa.db.getPagesByNotebookId('history-add');return pages[1];});
      await page.waitForFunction(id=>qa.boards.has(id),added.id);
      await page.evaluate(id=>qa.boards.get(id).onStrokesChange(qa.ink(2)),added.id);await flush();
      await page.evaluate(()=>qa.toolbar.onUndo());await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.equal(await page.evaluate(async id=>!!await qa.db.getPage(id),added.id),false);
      assert.equal(await page.evaluate(async()=>(await qa.db.getNotebookById('history-add')).pageCount),1);
      await page.evaluate(()=>qa.toolbar.onRedo());await page.evaluate(()=>qa.toolbar.onRedo());await flush();
      const restored=await page.evaluate(async id=>await qa.db.getPage(id),added.id);
      assert.equal(restored.id,added.id);assert.equal(restored.sizeId,'A3');assert.equal(restored.orientation,'landscape');
      assert.equal(restored.pageWidth,700);assert.equal(restored.pageHeight,480);assert.equal(restored.templateId,'dotted');
      assert.equal(restored.strokes.length,2);
    });
    await check('A new edit after undoing an added page clears its Redo without recreating the page',async()=>{
      const nb=await fixture('history-branch',1);await mount(nb);
      await page.evaluate(()=>qa.boards.get('history-branch-p0').onStrokesChange(qa.ink(1)));await flush();
      await page.evaluate(()=>qa.addPage.onAddPage({templateId:'blank',pageWidth:480,pageHeight:620}));
      const id=await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('history-branch'))[1].id);
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      await page.waitForFunction(()=>qa.boards.get('history-branch-p0')?.page.strokes.length===1);
      await page.evaluate(()=>qa.boards.get('history-branch-p0').onStrokesChange(qa.ink(2)));await flush();
      await page.waitForFunction(()=>qa.toolbar.canRedo===false);
      assert.equal(await page.evaluate(()=>qa.toolbar.onRedo()),false);
      assert.equal(await page.evaluate(async id=>!!await qa.db.getPage(id),id),false);
      assert.equal(await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('history-branch')).length),1);
    });
    await check('Deleting the first, middle or last page restores its original ID and page order',async()=>{
      for(const index of [0,1,2]){
        const id='history-position-'+index,nb=await fixture(id);await mount(nb,index);await showThumbnails();
        await page.evaluate(index=>qa.thumbnails.onDeletePage(index),index);
        for(let round=0;round<2;round++){
          await page.evaluate(()=>qa.toolbar.onUndo());await flush();
          assert.deepEqual(await page.evaluate(async id=>(await qa.db.getPagesByNotebookId(id)).map(p=>({id:p.id,index:p.pageIndex})),id),
            [0,1,2].map(i=>({id:id+'-p'+i,index:i})));
          assert.equal(await page.evaluate(async id=>(await qa.db.getNotebookById(id)).pageCount,id),3);
          await page.evaluate(()=>qa.toolbar.onRedo());await flush();
          assert.equal(await page.evaluate(async id=>(await qa.db.getNotebookById(id)).pageCount,id),2);
        }
      }
    });
    await check('Consecutive page deletions restore and remove pages in chronological order',async()=>{
      const nb=await fixture('history-multiple',4);await mount(nb);await showThumbnails();
      await page.evaluate(()=>qa.thumbnails.onDeletePage(0));
      await page.evaluate(()=>qa.thumbnails.onDeletePage(1));
      await page.evaluate(()=>qa.toolbar.onUndo());await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.deepEqual(await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('history-multiple')).map(p=>p.id)),[0,1,2,3].map(i=>'history-multiple-p'+i));
      await page.evaluate(()=>qa.toolbar.onRedo());await page.evaluate(()=>qa.toolbar.onRedo());await flush();
      assert.deepEqual(await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('history-multiple')).map(p=>p.id)),['history-multiple-p1','history-multiple-p3']);
    });
    await check('Undo/Redo of a duplicated rich page keeps its complete content and permanent copy ID',async()=>{
      const nb=await fixture('history-rich-copy',1);
      await page.evaluate(async()=>{const p=await qa.db.getPage('history-rich-copy-p0');await qa.db.savePage({...p,strokes:qa.ink(2),textElements:[{id:'text',text:'Synthetic',x:50,y:60}],imageElements:[{id:'img',src:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',x:10,y:100,width:50,height:50,locked:true}],isFavorite:true,paperColor:'#fdf6e3'});});
      await mount(nb);await showThumbnails();
      await page.evaluate(()=>qa.thumbnails.onDuplicatePage(0));
      const before=await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('history-rich-copy'))[1]);
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.equal(await page.evaluate(async id=>!!await qa.db.getPage(id),before.id),false);
      await page.evaluate(()=>qa.toolbar.onRedo());await flush();
      const after=await page.evaluate(async id=>await qa.db.getPage(id),before.id);
      delete before.updatedAt;delete after.updatedAt;assert.deepEqual(after,before);
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('history-rich-copy-p0')).strokes.length),2);
    });
    await check('Favorite changes on a new page survive undoing and redoing its insertion',async()=>{
      const nb=await fixture('history-favorite',1);await mount(nb);
      await page.evaluate(()=>qa.addPage.onAddPage({templateId:'blank',pageWidth:480,pageHeight:620}));
      await page.evaluate(()=>qa.toolbar.onToggleFavoriteCurrentPage());await flush();
      const id=await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('history-favorite'))[1].id);
      await page.evaluate(()=>qa.toolbar.onUndo());await page.evaluate(()=>qa.toolbar.onRedo());await flush();
      assert.equal(await page.evaluate(async id=>(await qa.db.getPage(id)).isFavorite,id),true);
    });
    await check('A failed deletion leaves its prior handwriting history intact',async()=>{
      const nb=await fixture('history-delete-fail');await mount(nb);await showThumbnails();
      await page.evaluate(()=>qa.boards.get('history-delete-fail-p0').onStrokesChange(qa.ink(1)));await flush();
      assert.equal(await page.evaluate(async()=>{
        const restore=await qa.fault({store:'pages',method:'delete',key:'history-delete-fail-p0'});
        try{return await qa.thumbnails.onDeletePage(0);}finally{restore();}
      }),false);
      assert.equal(await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('history-delete-fail')).length),3);
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('history-delete-fail-p0')).strokes.length),0);
    });
    await check('A failed Undo restore keeps the deleted-page action available for retry',async()=>{
      const nb=await fixture('history-undo-fail');await mount(nb);await showThumbnails();
      await page.evaluate(()=>qa.boards.get('history-undo-fail-p0').onStrokesChange(qa.ink(1)));await flush();
      await page.evaluate(()=>qa.thumbnails.onDeletePage(0));
      assert.equal(await page.evaluate(async()=>{
        const restore=await qa.fault({store:'pages',method:'add',key:'history-undo-fail-p0'});
        try{return await qa.toolbar.onUndo();}finally{restore();}
      }),false);
      assert.equal(await page.evaluate(async()=>!!await qa.db.getPage('history-undo-fail-p0')),false);
      assert.equal(await page.evaluate(()=>qa.history.notebookHistoryStore.forNotebook('history-undo-fail').getSnapshot().pointer),1);
      assert.equal(await page.evaluate(()=>qa.toolbar.onUndo()),true);await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('history-undo-fail-p0')).strokes.length),1);
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('history-undo-fail-p0')).strokes.length),0);
    });
    await check('A failed Redo deletion keeps the restored page and the Redo cursor unchanged',async()=>{
      const nb=await fixture('history-redo-fail');await mount(nb);await showThumbnails();
      await page.evaluate(()=>qa.thumbnails.onDeletePage(0));await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.equal(await page.evaluate(async()=>{
        const restore=await qa.fault({store:'pages',method:'delete',key:'history-redo-fail-p0'});
        try{return await qa.toolbar.onRedo();}finally{restore();}
      }),false);
      assert.equal(await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('history-redo-fail')).length),3);
      assert.equal(await page.evaluate(()=>qa.history.notebookHistoryStore.forNotebook('history-redo-fail').getSnapshot().pointer),-1);
      await page.evaluate(()=>qa.toolbar.onRedo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('history-redo-fail')).length),2);
    });
    await check('Failed removal of an added page can retry Undo without losing the page',async()=>{
      const nb=await fixture('history-added-fail',1);await mount(nb);
      await page.evaluate(()=>qa.addPage.onAddPage({templateId:'blank',pageWidth:480,pageHeight:620}));
      const id=await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('history-added-fail'))[1].id);
      assert.equal(await page.evaluate(async id=>{
        const restore=await qa.fault({store:'pages',method:'delete',key:id});
        try{return await qa.toolbar.onUndo();}finally{restore();}
      },id),false);
      assert.equal(await page.evaluate(async id=>!!await qa.db.getPage(id),id),true);
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.equal(await page.evaluate(async id=>!!await qa.db.getPage(id),id),false);
    });
    await check('An unsaved edit blocks page deletion until saving is retried successfully',async()=>{
      const nb=await fixture('history-unsaved');await mount(nb);await showThumbnails();
      await page.evaluate(async()=>{qa.restoreUnsaved=await qa.fault({store:'pages',key:'history-unsaved-p0'});await qa.boards.get('history-unsaved-p0').onStrokesChange(qa.ink(2));});
      assert.equal(await page.evaluate(()=>qa.thumbnails.onDeletePage(0)),false);
      assert.equal(await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('history-unsaved')).length),3);
      assert.equal(await page.evaluate(()=>qa.history.notebookHistoryStore.forNotebook('history-unsaved').getSnapshot().stack.length),1);
      await page.evaluate(async()=>{qa.restoreUnsaved();await qa.local.pageSaveQueue.retry('history-unsaved');});
      await page.evaluate(()=>qa.thumbnails.onDeletePage(0));await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('history-unsaved-p0')).strokes.length),2);
    });
    await check('Rapid mixed Undo and Redo requests execute once each in order',async()=>{
      const nb=await fixture('history-rapid-mixed',1);await mount(nb);
      await page.evaluate(()=>qa.boards.get('history-rapid-mixed-p0').onStrokesChange(qa.ink(1)));await flush();
      await page.evaluate(()=>qa.addPage.onAddPage({templateId:'blank',pageWidth:480,pageHeight:620}));
      await page.evaluate(async()=>{const undo=qa.toolbar.onUndo;await Promise.all([undo(),undo()]);});await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('history-rapid-mixed-p0')).strokes.length),0);
      assert.equal(await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('history-rapid-mixed')).length),1);
      await page.evaluate(async()=>{const redo=qa.toolbar.onRedo;await Promise.all([redo(),redo()]);});await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('history-rapid-mixed-p0')).strokes.length),1);
      assert.equal(await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('history-rapid-mixed')).length),2);
    });
    await check('Editor unmount/remount preserves each notebook independent Undo and Redo branches',async()=>{
      const a=await fixture('history-switch-a',1),b=await fixture('history-switch-b',1);await mount(a);
      await page.evaluate(()=>qa.boards.get('history-switch-a-p0').onStrokesChange(qa.ink(1)));
      await page.evaluate(()=>qa.boards.get('history-switch-a-p0').onStrokesChange(qa.ink(2)));await flush();
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      await mount(b);await page.evaluate(()=>qa.boards.get('history-switch-b-p0').onStrokesChange(qa.ink(3)));await flush();
      await mount(a);await page.waitForFunction(()=>qa.toolbar.canUndo&&qa.toolbar.canRedo);
      await page.evaluate(()=>qa.toolbar.onRedo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('history-switch-a-p0')).strokes.length),2);
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('history-switch-b-p0')).strokes.length),3);
      await mount(b);await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('history-switch-b-p0')).strokes.length),0);
    });
    await check('Redo of a deleted page survives switching to another notebook and back',async()=>{
      const a=await fixture('history-deleted-switch'),b=await fixture('history-other-switch',1);await mount(a);await showThumbnails();
      await page.evaluate(()=>qa.boards.get('history-deleted-switch-p0').onStrokesChange(qa.ink(1)));await flush();
      await page.evaluate(()=>qa.thumbnails.onDeletePage(0));await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      await mount(b);await mount(a);await page.waitForFunction(()=>qa.toolbar.canRedo);
      await page.evaluate(()=>qa.toolbar.onRedo());await flush();
      assert.equal(await page.evaluate(async()=>!!await qa.db.getPage('history-deleted-switch-p0')),false);
      await mount(b);await mount(a);await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('history-deleted-switch-p0')).strokes.length),1);
    });

    await check('Real App tabs keep separate Undo and Redo histories after switching and going Home',async()=>{
      const a=await fixture('app-history-a',1),b=await fixture('app-history-b',1);
      await page.evaluate(async([a,b])=>{
        await qa.db.saveNotebook({...a,name:'Session history A'});await qa.db.saveNotebook({...b,name:'Session history B'});
        qa.mountApp();
      },[a,b]);
      await page.waitForFunction(()=>qa.library?.notebooks.some(nb=>nb.id==='app-history-a'));
      await page.evaluate(()=>qa.library.onOpenNotebook('app-history-a'));
      await page.waitForFunction(()=>qa.toolbar?.notebookTitle==='Session history A');
      await page.evaluate(()=>qa.boards.get('app-history-a-p0').onStrokesChange(qa.ink(1)));
      await page.evaluate(()=>qa.boards.get('app-history-a-p0').onStrokesChange(qa.ink(2)));await flush();
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      await page.evaluate(()=>qa.tabs.onGoHome());await page.waitForFunction(()=>!!qa.library);
      await page.evaluate(()=>qa.library.onOpenNotebook('app-history-b'));
      await page.waitForFunction(()=>qa.toolbar?.notebookTitle==='Session history B');
      await page.evaluate(()=>qa.boards.get('app-history-b-p0').onStrokesChange(qa.ink(3)));await flush();
      await page.getByRole('tab',{name:/Session history A/}).click();
      await page.waitForFunction(()=>qa.toolbar?.notebookTitle==='Session history A'&&qa.toolbar.canRedo);
      await page.evaluate(()=>qa.toolbar.onRedo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('app-history-a-p0')).strokes.length),2);
      await page.getByRole('tab',{name:/Session history B/}).click();
      await page.waitForFunction(()=>qa.toolbar?.notebookTitle==='Session history B'&&qa.toolbar.canUndo);
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('app-history-b-p0')).strokes.length),0);
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('app-history-a-p0')).strokes.length),2);
    });
    await check('A page Undo in progress remains coherent when its editor is unmounted and reopened',async()=>{
      const a=await fixture('history-pending-undo',1),b=await fixture('history-pending-other',1);await mount(a);
      await page.evaluate(()=>qa.addPage.onAddPage({templateId:'blank',pageWidth:480,pageHeight:620}));
      await page.evaluate(async()=>{await qa.holdCommit();qa.pendingUndo=qa.toolbar.onUndo();});
      await page.waitForFunction(()=>typeof qa.releaseCommit==='function');
      await mount(b);await page.evaluate(()=>qa.boards.get('history-pending-other-p0').onStrokesChange(qa.ink(1)));await page.evaluate(()=>qa.local.pageSaveQueue.flush('history-pending-other'));
      await page.evaluate(a=>qa.mountEditor(a),a);
      await page.waitForFunction(()=>qa.history.notebookHistoryStore.forNotebook('history-pending-undo').getSnapshot().busy&&qa.toolbar===null);
      await page.evaluate(async()=>{qa.restoreCommit();qa.releaseCommit();await qa.pendingUndo;});
      await page.waitForFunction(()=>qa.toolbar?.canRedo&&qa.boards.has('history-pending-undo-p0'));
      assert.equal(await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('history-pending-undo')).length),1);
      await page.evaluate(()=>qa.toolbar.onRedo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('history-pending-undo')).length),2);
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('history-pending-other-p0')).strokes.length),1);
    });
    await check('Adding a page during a tab switch records its history before the notebook reopens',async()=>{
      const a=await fixture('history-pending-add',1),b=await fixture('history-pending-add-other',1);await mount(a);
      await page.evaluate(async()=>{
        await qa.holdCommit();
        qa.pendingAdd=qa.addPage.onAddPage({templateId:'dotted',pageWidth:480,pageHeight:620});
      });
      await page.waitForFunction(()=>typeof qa.releaseCommit==='function');
      await mount(b);await page.evaluate(a=>qa.mountEditor(a),a);
      await page.waitForFunction(()=>qa.toolbar===null);
      await page.evaluate(async()=>{qa.restoreCommit();qa.releaseCommit();await qa.pendingAdd;});
      await page.waitForFunction(()=>qa.toolbar?.canUndo&&qa.boards.size>0);
      assert.equal(await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('history-pending-add')).length),2);
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('history-pending-add')).length),1);
      await page.evaluate(()=>qa.toolbar.onRedo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('history-pending-add'))[1].templateId),'dotted');
    });
    await check('Handwriting arriving while an insertion commits queues behind it without losing content',async()=>{
      const nb=await fixture('history-pending-ink',1);await mount(nb);
      await page.evaluate(()=>qa.boards.get('history-pending-ink-p0').onStrokesChange(qa.ink(1)));await flush();
      await page.evaluate(async()=>{
        await qa.holdCommit();
        qa.pendingAdd=qa.addPage.onAddPage({templateId:'blank',pageWidth:480,pageHeight:620});
      });
      await page.waitForFunction(()=>typeof qa.releaseCommit==='function');
      await page.evaluate(()=>{
        qa.pendingInk=qa.boards.get('history-pending-ink-p0').onStrokesChange(qa.ink(2));
        qa.restoreCommit();qa.releaseCommit();
      });
      await page.evaluate(async()=>{await Promise.all([qa.pendingAdd,qa.pendingInk]);});await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('history-pending-ink-p0')).strokes.length),2);
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPage('history-pending-ink-p0')).strokes.length),1);
      assert.equal(await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('history-pending-ink')).length),2);
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      assert.equal(await page.evaluate(async()=>(await qa.db.getPagesByNotebookId('history-pending-ink')).length),1);
    });
    await check('Deleted whiteboard pages restore their full metadata and negative-coordinate content',async()=>{
      const nb=await fixture('history-whiteboard',2);
      const expected=await page.evaluate(async()=>{
        const p=await qa.db.getPage('history-whiteboard-p0');
        await qa.db.savePage({...p,templateId:'whiteboard',sizeId:'whiteboard',strokes:[{...qa.ink(1)[0],points:[{x:-500,y:-300,pressure:0.4},{x:900,y:1200,pressure:0.7}]}],imageElements:[],textElements:[{id:'whiteboard-text',text:'Synthetic whiteboard',x:-200,y:-400,width:140,height:32}],paperColor:'#ffffff'});
        return await qa.db.getPage(p.id);
      });
      await mount(nb);await showThumbnails();await page.evaluate(()=>qa.thumbnails.onDeletePage(0));
      await page.evaluate(()=>qa.toolbar.onUndo());await flush();
      const actual=await page.evaluate(async()=>await qa.db.getPage('history-whiteboard-p0'));
      delete actual.updatedAt;delete expected.updatedAt;assert.deepEqual(actual,expected);
    });

    await check('App close waits for queued Undo through a transaction-free gap before acknowledging save',async()=>{
      const nb=await fixture('app-history-close',1);await page.evaluate(()=>qa.mountApp());
      await page.waitForFunction(()=>qa.library?.notebooks.some(nb=>nb.id==='app-history-close'));
      await page.evaluate(()=>qa.library.onOpenNotebook('app-history-close'));
      await page.waitForFunction(()=>qa.boards.has('app-history-close-p0')&&qa.toolbar);
      await page.evaluate(()=>qa.boards.get('app-history-close-p0').onStrokesChange(qa.ink(1)));await flush();
      await page.evaluate(()=>qa.addPage.onAddPage({templateId:'blank',pageWidth:480,pageHeight:620}));
      await page.evaluate(async()=>{
        await qa.holdCommit();qa.firstCloseUndo=qa.toolbar.onUndo();
        const session=qa.history.notebookHistoryStore.forNotebook('app-history-close');
        qa.closeGap=session.run(()=>new Promise(resolve=>{qa.releaseCloseGap=resolve;}));
        qa.secondCloseUndo=qa.toolbar.onUndo();
      });
      await page.waitForFunction(()=>typeof qa.releaseCommit==='function');
      await page.evaluate(()=>{qa.pendingClose=qa.closeRequest({requestId:777});});
      await page.waitForSelector('.bn-local-close-overlay');
      assert.equal(await page.evaluate(()=>qa.replies.some(r=>r.requestId===777)),false);
      await page.evaluate(()=>{qa.restoreCommit();qa.releaseCommit();});
      await page.waitForFunction(()=>typeof qa.releaseCloseGap==='function'&&qa.db.getPendingWriteCount()===0);
      assert.equal(await page.evaluate(()=>qa.local.getLocalSaveSnapshot().status),'saving');
      assert.equal(await page.evaluate(()=>qa.replies.some(r=>r.requestId===777)),false);
      await page.evaluate(()=>qa.releaseCloseGap());
      await page.evaluate(async()=>{await Promise.all([qa.firstCloseUndo,qa.closeGap,qa.secondCloseUndo,qa.pendingClose]);});
      assert.equal(await page.evaluate(()=>qa.replies.find(r=>r.requestId===777).success),true);
      assert.deepEqual(await page.evaluate(async()=>({count:(await qa.db.getPagesByNotebookId('app-history-close')).length,ink:(await qa.db.getPage('app-history-close-p0')).strokes.length})),{count:1,ink:0});
      await page.evaluate(()=>qa.closeCancel());await flush();
    });

    await require('./language-tabs.browser.cjs')({page, fixture, mount, flush, check, preview});
    await require('./thumbnail-cover.browser.cjs')({page, fixture, mount, flush, check, preview});
    await require('./highlighter-ui.browser.cjs')({page, fixture, mount, flush, check, preview});
    await require('./ink-session-editor.browser.cjs')({page,fixture,mount,flush,check});
    await require('./shape-editor.browser.cjs')({page,fixture,mount,flush,check});
    assert.deepEqual(errors,[], 'Unexpected renderer errors');
    await page.evaluate(()=>qa.unmount());await flush();
    await context.close();
    await check('The production thumbnail worker renders handwriting from a local file origin',async()=>{
      const fixtureFile=path.join(fs.realpathSync(preview),'betternote-thumbnail-protocol.html');
      fs.writeFileSync(fixtureFile,'<!doctype html><meta charset="utf-8"><body>Isolated thumbnail protocol test</body>');
      const isolated=await browser.newContext({acceptDownloads:false});
      try{
        await isolated.route(/^https?:\/\//,route=>route.abort());const localPage=await isolated.newPage();localPage.on('pageerror',error=>errors.push(error.message));
        await localPage.goto(require('node:url').pathToFileURL(fixtureFile).href);
        await localPage.addScriptTag({content:esbuild.transformSync(thumbnailWorkerFactorySource,{format:'iife',globalName:'ThumbnailFactory'}).code});
        const result=await localPage.evaluate(()=>new Promise((resolve,reject)=>{
          const worker=new ThumbnailFactory.default();let timer;
          const finish=(error,result)=>{clearTimeout(timer);worker.terminate();error?reject(Error('Local thumbnail worker failed')):resolve(result);};
          worker.onerror=event=>{event.preventDefault();finish(true);};
          worker.onmessage=async event=>{
            if(event.data.error){finish(true);return;}
            try{const {width,height,bytes}=event.data;const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'})),canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();const pixels=ctx.getImageData(0,0,width,height).data;let red=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>180&&pixels[i+1]<100&&pixels[i+2]<100)red++;finish(false,{width,height,red});}catch(_){finish(true);}
          };
          timer=setTimeout(()=>finish(true),10000);
          worker.postMessage({requestId:1,templateId:'blank',page:{pageWidth:480,pageHeight:620,strokes:[{id:'synthetic-file-ink',tool:'pen',color:'#ff0000',width:20,points:[{x:20,y:30,pressure:1},{x:180,y:150,pressure:1}]}],textElements:[],imageElements:[]}});
        }));
        assert.ok(result.width<=320&&result.height<=320);assert.ok(result.red>100);
      }finally{await isolated.close();}
    });
    assert.deepEqual(errors,[], 'Unexpected renderer errors, including local-file Thumbnail');
    console.log(JSON.stringify({tests:results.length,passed:results.length,results,rendererErrors:errors,syntheticDatabaseOnly:true,realAppStarted:false,realDriveAccess:false}));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode=1; });
