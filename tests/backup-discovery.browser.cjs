// Phase 3.1: real Library UI + IndexedDB + reader worker, isolated synthetic data only.
const fs = require('node:fs'), disk = fs.promises, path = require('node:path'), assert = require('node:assert/strict');
const esbuild = require('esbuild');
const { chromium } = require(process.env.BETTERNOTE_PLAYWRIGHT_PATH || 'playwright');
const { createBackupReaderClient } = require('../electron/backupReaderClient.cjs');
const { createBackupWriter } = require('../electron/backupWriter.cjs');
const root = fs.realpathSync(path.resolve(__dirname, '..')), qaRoot = process.env.BETTERNOTE_QA_TEMP;
if (!qaRoot || !path.isAbsolute(qaRoot)) throw Error('Set BETTERNOTE_QA_TEMP to the isolated QA folder.');
const origin = 'https://betternote-phase3.invalid/', passed = [];
const entry = "import React,{useState} from 'react';import{createRoot}from'react-dom/client';\n" +
"import * as db from './src/services/db.js';import * as lang from './src/services/i18n.js';\n" +
"import{autoBackupService as backup}from'./src/services/autoBackupService.js';import{LibraryView}from'./src/components/Library/LibraryView.jsx';\n" +
"window.qa={db,lang,backup,alerts:[],scans:[]};window.alert=message=>qa.alerts.push(message);window.confirm=()=>true;\n" +
"window.electronAPI={isElectron:true,scanBackupFolder:async(folder,options)=>{qa.scans.push({folder,options});return window.scanBridge(folder,options);}};\n" +
"const renderer=createRoot(document.getElementById('root'));\n" +
"function Harness(){const[notes,setNotes]=useState(qa.notes);qa.setNotes=setNotes;return <LibraryView notebooks={notes}folders={[]}currentTheme='dark'currentFolderId={null}folderChain={[]}onNavigateFolder={()=>{}}onOpenNotebook={()=>{}}onUpdateNotebook={()=>{}}/>;}\n" +
"qa.start=async(folder)=>{await db.saveSetting('local_backup_path',folder);await db.saveNotebook({id:'local-existing',name:'Same name',pageCount:1});await db.savePage({id:'local-page',notebookId:'local-existing',pageIndex:0,strokes:[{points:[{x:1,y:2}]}]});qa.notes=await db.getAllNotebooks();renderer.render(<Harness/>);};qa.stop=()=>renderer.unmount();";
(async () => {
 const fixture = await disk.mkdtemp(path.join(qaRoot, 'betternote-phase3-browser-')), chosen = path.join(fixture, 'chosen');
 const full = path.join(chosen, 'Full_System', 'BetterNote_Latest_Backup.json');
 await disk.mkdir(path.dirname(full), { recursive: true });
 const remote = { id:'remote-new',name:'Same name',updatedAt:2,pageCount:1,pages:[{id:'remote-page',notebookId:'remote-new',pageIndex:0,strokes:[{points:[{x:12,y:34}]}],imageElements:[],textElements:[]}] };
 const write = notes => disk.writeFile(full, JSON.stringify({ version:1,appName:'BetterNote',folders:[],notebooks:notes }));
 await write([remote]); const client = createBackupReaderClient(); let browser, paused;
 const check = async (name, work) => { await work(); passed.push(name); console.log('PASS ' + name); };
 try {
  const assets = path.join(root, 'dist/assets'), worker = fs.readdirSync(assets).find(name => /^notebookCover\.worker-.*\.js$/.test(name));
  if (!worker) throw Error('Run npm run build first.');
  const plugin = { name:'qa-worker',setup(build) {
    require('./helpers/recovery-worker.cjs').setupRecoveryWorker(build);
   build.onResolve({filter:/pdf\.worker\.min\.mjs\?url$/},()=>({path:'pdf',namespace:'qa-url'}));
   build.onLoad({filter:/.*/,namespace:'qa-url'},()=>({contents:"export default '/unused-worker.mjs';",loader:'js'}));
   build.onResolve({filter:/notebookCover\.worker\.js\?worker&inline$/},()=>({path:'cover',namespace:'qa-cover'}));
   build.onLoad({filter:/.*/,namespace:'qa-cover'},()=>({contents:fs.readFileSync(path.join(assets,worker),'utf8'),loader:'js'}));
  } };
  const compiled = await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},bundle:true,write:false,format:'iife',platform:'browser',
    define:{'process.env.NODE_ENV':'"production"'},plugins:[plugin],logLevel:'silent'});
  browser = await chromium.launch({headless:true,executablePath:process.env.BETTERNOTE_QA_BROWSER,env:{...process.env,TEMP:qaRoot,TMP:qaRoot}});
  const context = await browser.newContext({viewport:{width:1360,height:1000}});
  await context.route('**/*',route=>route.request().url()===origin ? route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><div id="root"></div>'}) : route.abort());
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeFunction('scanBridge', async (folder, options) => {
    if (typeof folder !== 'string' || !path.resolve(folder).startsWith(fixture + path.sep)) throw Error('Refusing a non-QA recovery folder');
    if (paused) await paused.promise;
    return client.execute({folderPath:folder,previewOnly:options?.previewOnly === true});
  });
  await page.goto(origin); await page.addStyleTag({content:fs.readFileSync(path.join(root,'src/index.css'),'utf8')});
  await page.addScriptTag({content:compiled.outputFiles[0].text}); await page.evaluate(folder => qa.start(folder), chosen);
  await check('Different notebook IDs are detected even when their names are identical', async () => {
    const label = await page.evaluate(()=>qa.lang.TRANSLATIONS.en.cloudBackupRestoreNow);
    await page.getByRole('button',{name:label,exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>qa.scans[0].folder),chosen);
    assert.equal(await page.evaluate(()=>qa.scans[0].options.previewOnly),true);
  });
  await check('Discovery returns only metadata instead of image and handwriting payloads', async () => {
    const result = await page.evaluate(()=>qa.backup.scanAvailableBackups(null,{previewOnly:true}));
    assert.equal(result.success,true); assert.equal(result.data,undefined); assert.equal(result.notebooks[0].id,'remote-new');
    assert.ok(!JSON.stringify(result).includes('"points"'));
  });
  await check('Thumbnail and edit-time changes do not restart the library backup scan', async () => {
    const count = await page.evaluate(()=>qa.scans.length);
    await page.evaluate(()=>qa.setNotes(qa.notes.map(n=>({...n,thumbnailUrl:'',updatedAt:n.updatedAt+1}))));
    await page.waitForTimeout(2600); assert.equal(await page.evaluate(()=>qa.scans.length),count);
  });
  await check('A newer editable file is selected without writing anything to the local notebook database', async () => {
    const directory=path.join(chosen,'Editable_Notes');await disk.mkdir(directory,{recursive:true});
    const newer={...remote,updatedAt:8,pages:[{...remote.pages[0],strokes:[...remote.pages[0].strokes,{points:[{x:90,y:91}]}]}]};
    await disk.writeFile(path.join(directory,'latest.bnote'),JSON.stringify(newer));
    const before=await page.evaluate(()=>qa.db.getBackupNotebookSnapshot('local-existing'));
    const result=await page.evaluate(()=>qa.backup.scanAvailableBackups());
    assert.equal(result.success,true);assert.equal(result.data.notebooks[0].pages[0].strokes.length,2);
    assert.deepEqual(await page.evaluate(()=>qa.db.getBackupNotebookSnapshot('local-existing')),before);
  });
  await check('A configured unavailable Drive folder does not silently read the Local backup', async () => {
    await page.evaluate(async folder=>{await qa.db.saveSetting('gdrive_backup_method','desktop');await qa.db.saveSetting('gdrive_backup_path',folder);},path.join(fixture,'missing-drive'));
    const result=await page.evaluate(()=>qa.backup.scanAvailableBackups());assert.equal(result.success,false);assert.equal(result.reason,'not-found');
    await page.evaluate(()=>qa.db.saveSetting('gdrive_backup_method',null));
  });
  await check('Failed recovery reports its real reason in every supported language and preserves local data', async () => {
    const broken={...remote,pageCount:9};await write([broken]);
    const before=await page.evaluate(()=>qa.db.getBackupNotebookSnapshot('local-existing'));
    for(const language of ['en','th','zh','ru']){
      await page.evaluate(language=>qa.lang.setAppLanguage(language),language);
      const label=await page.evaluate(()=>qa.lang.TRANSLATIONS[qa.lang.getAppLanguage()].cloudBackupRestoreNow);
      const count=await page.evaluate(()=>qa.alerts.length);await page.getByRole('button',{name:label,exact:true}).click();
      await page.waitForFunction(count=>qa.alerts.length>count,count);
      const expected=await page.evaluate(()=>qa.lang.TRANSLATIONS[qa.lang.getAppLanguage()].backupReadInvalid);
      assert.ok((await page.evaluate(()=>qa.alerts.at(-1))).includes(expected));
    }
    assert.deepEqual(await page.evaluate(()=>qa.db.getBackupNotebookSnapshot('local-existing')),before);
    assert.equal(await page.evaluate(async()=>(await qa.db.getAllNotebooks()).some(note=>note.id==='remote-new')),false);
  });
  await check('A success response without a recovery payload cannot claim that notebooks were restored', async () => {
    const result=await page.evaluate(async()=>{
      const original=window.electronAPI.scanBackupFolder;
      window.electronAPI.scanBackupFolder=async()=>({success:true,notebooks:[]});
      try{return await qa.backup.restoreFromCloudBackup();}finally{window.electronAPI.scanBackupFolder=original;}
    });
    assert.equal(result.success,false);assert.equal(result.reason,'backup-read-failed');
  });
  await check('Both real Restore from Folder buttons recover deleted-folder notes and explain the Documents placement in four languages', async () => {
    const sources = [];
    for (const role of ['local','drive']) {
      const directory=path.join(fixture,'current-v2-'+role),id='qa-orphan-'+role;
      const note={...remote,id,name:role+' recovered note',folderId:'previously-deleted',pages:remote.pages.map((page,index)=>({...page,id:id+'-p'+index,notebookId:id}))};
      const writer=createBackupWriter({localDir:directory,driveCandidates:[]});
      const metadata={folders:[],notebooks:[{...note,pages:undefined}]};
      assert.equal((await writer.execute({action:'begin',jobId:'qa-'+role,metadata,metadataRevision:'qa-'+role,phase:'data'})).success,true);
      assert.equal((await writer.execute({action:'notebook',jobId:'qa-'+role,notebook:note,pdfRevision:'pending'})).success,true);
      assert.equal((await writer.execute({action:'finish',jobId:'qa-'+role,metadataRevision:'qa-'+role})).success,true);
      sources.push({role,directory,note});
    }
    await page.evaluate(async sources=>{await qa.db.saveSetting('local_backup_path',sources[0].directory);await qa.db.saveSetting('gdrive_backup_method','desktop');await qa.db.saveSetting('gdrive_backup_path',sources[1].directory);},sources);
    for (const language of ['en','th','zh','ru']) for (const source of sources) {
      await page.evaluate(language=>qa.lang.setAppLanguage(language),language);
      await page.locator('.bn-backup-indicator').click();await page.locator('.bn-backup-hub').waitFor();
      if(source.role==='drive')await page.locator('.bn-backup-hub-tabs [role="tab"]').nth(1).click();
      const label=await page.evaluate(()=>qa.lang.t('backupRestoreFromFolder')),count=await page.evaluate(()=>qa.alerts.length);
      await page.locator('.bn-backup-hub').getByRole('button',{name:label,exact:true}).click();
      await page.waitForFunction(count=>qa.alerts.length>count,count);
      assert.equal(await page.evaluate(()=>qa.alerts.at(-1)),await page.evaluate(()=>qa.lang.t('backupRecoveryMissingFolders','',{count:1})));
      const restored=await page.evaluate(id=>qa.db.getBackupNotebookSnapshot(id),source.note.id);assert.equal(restored.folderId,null);assert.deepEqual(restored.pages,source.note.pages);
      assert.equal(await page.evaluate(()=>qa.scans.at(-1).folder),source.directory);
      await page.locator('.bn-backup-hub .bn-modal-close-btn').click();
    }
  });
  await check('Drive Restore skips two verified obsolete references and reports this in every selected language', async () => {
    const directory=path.join(fixture,'stale-drive'),writer=createBackupWriter({localDir:directory,driveCandidates:[]});
    const ids=['qa-stale-current','qa-stale-old-a','qa-stale-old-b'],notes=ids.map(id=>({...remote,id,name:id,folderId:null,pages:remote.pages.map((page,index)=>({...page,id:id+'-p'+index,notebookId:id}))}));
    const round=async (records,jobId)=>{
      const metadata={folders:[],notebooks:records.map(({pages,...header})=>header)};
      assert.equal((await writer.execute({action:'begin',jobId,metadata,metadataRevision:jobId,phase:'data'})).success,true);
      for(const notebook of records)assert.equal((await writer.execute({action:'notebook',jobId,notebook,pdfRevision:'pending'})).success,true);
      assert.equal((await writer.execute({action:'finish',jobId,metadataRevision:jobId})).success,true);
    };
    await round(notes,'old-complete');const manifestFile=path.join(directory,'Full_System/backup_manifest.json'),prior=JSON.parse(await disk.readFile(manifestFile,'utf8'));
    assert.equal((await writer.execute({action:'prune',notebookIds:ids.slice(1)})).success,true);await round([notes[0]],'latest-complete');
    const latest=JSON.parse(await disk.readFile(manifestFile,'utf8'));for(const id of ids.slice(1))latest.notebooks[id]=prior.notebooks[id];await disk.writeFile(manifestFile,JSON.stringify(latest));
    const before=await disk.readFile(manifestFile,'utf8');await page.evaluate(directory=>qa.db.saveSetting('gdrive_backup_path',directory),directory);
    for(const language of ['en','th','zh','ru']){
      await page.evaluate(language=>qa.lang.setAppLanguage(language),language);await page.locator('.bn-backup-indicator').click();await page.locator('.bn-backup-hub').waitFor();
      await page.locator('.bn-backup-hub-tabs [role="tab"]').nth(1).click();const label=await page.evaluate(()=>qa.lang.t('backupRestoreFromFolder')),count=await page.evaluate(()=>qa.alerts.length);
      await page.locator('.bn-backup-hub').getByRole('button',{name:label,exact:true}).click();await page.waitForFunction(count=>qa.alerts.length>count,count);
      assert.equal(await page.evaluate(()=>qa.alerts.at(-1)),await page.evaluate(()=>qa.lang.t('backupRecoveryRetiredEntries','',{count:2})));
      const stored=await page.evaluate(id=>qa.db.getBackupNotebookSnapshot(id),ids[0]);assert.deepEqual(stored.pages,notes[0].pages);
      assert.equal(await page.evaluate(async ids=>(await qa.db.getAllNotebooks()).some(note=>ids.includes(note.id)),ids.slice(1)),false);
      await page.locator('.bn-backup-hub .bn-modal-close-btn').click();
    }
    assert.equal(await disk.readFile(manifestFile,'utf8'),before);
  });
  await check('The settings dialog still opens while a background backup read is waiting', async () => {
    await page.evaluate(()=>qa.lang.setAppLanguage('en'));
    let resume;paused={promise:new Promise(resolve=>{resume=resolve;})};
    await page.evaluate(()=>{qa.waitingScan=qa.backup.scanAvailableBackups();});
    const tooltip=await page.evaluate(()=>qa.lang.TRANSLATIONS.en.librarySettingsBtnTooltip);
    await page.getByRole('button',{name:tooltip,exact:true}).click();await page.locator('.bn-settings-title').waitFor();
    resume();paused=null;await page.evaluate(()=>qa.waitingScan);
  });
  await check('No renderer errors occur in the recovery checks', async () => {
    await page.evaluate(()=>qa.stop());assert.deepEqual(errors,[]);
  });
  console.log(JSON.stringify({passed:passed.length,failed:0,fixtureDirectory:fixture}));
 } finally { if(browser)await browser.close();await client.close(); }
})().catch(error=>{console.error(error.stack);console.log(JSON.stringify({passed:passed.length}));process.exitCode=1;});
