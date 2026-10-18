// Synthetic profile only: exercises real Settings, guide, editor and IndexedDB.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const {chromium}=require(process.env.BETTERNOTE_PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),base=process.env.BETTERNOTE_QA_TEMP;
if(!base||!path.isAbsolute(base))throw Error('Set an isolated QA directory');
const entry=`import React from 'react';import{createRoot}from'react-dom/client';
import{SettingsModal}from'./src/components/Library/SettingsModal.jsx';import UserGuide from'./src/components/Guide/UserGuide.jsx';
import{NoteEditor}from'./src/components/Editor/NoteEditor.jsx';import{DocumentTabBar}from'./src/components/Common/DocumentTabBar.jsx';
import{App}from'./src/App.jsx';import BackupStatusModal from'./src/components/Library/BackupStatusModal.jsx';
import{TRANSLATIONS,setAppLanguage}from'./src/services/i18n.js';import{applyLanguageToDom}from'./src/services/languageCatalog.js';
import{lessons,categories}from'./src/components/Guide/guideContent.js';import*as db from'./src/services/db.js';import*as local from'./src/services/localSaveService.js';
import{autoBackupService as backup}from'./src/services/autoBackupService.js';
backup.startScheduledSync=()=>{};let root;window.qa={db,local,lessons,categories,urls:[],mode:'settings',nb:null};
window.electronAPI={isElectron:true,getAppInfo:async()=>({version:'1.3.1',distribution:'store'}),selectFolder:async options=>{qa.folderTitle=options.title;return null;},exportDiagnostics:async options=>{qa.reportTitle=options.title;return {success:true};},openExternal:async url=>{qa.urls.push(url);return{success:!qa.failLink};},saveBackup:async()=>({success:false,reason:'QA disabled'})};window.alert=()=>{};
qa.word=key=>TRANSLATIONS[qa.lang][key];qa.change=code=>{qa.lang=code;setAppLanguage(code);applyLanguageToDom(code);};
qa.mount=mode=>{if(root)root.unmount();root=createRoot(document.getElementById('root'));qa.mode=mode;
root.render(mode==='settings'?<SettingsModal isOpen onClose={()=>qa.closed=true}/>:mode==='guide'?<UserGuide/>:mode==='app'?<App/>:mode==='backup'?<BackupStatusModal isOpen onClose={()=>{}} notebooks={[qa.nb]}/>:<><DocumentTabBar tabs={[{id:qa.nb.id,title:qa.nb.name,pageIndex:0}]} activeTabId={qa.nb.id} onSelectTab={()=>{}} onCloseTab={()=>{}} onGoHome={()=>{}}/><NoteEditor notebook={qa.nb} onBackToLibrary={()=>{}} onNotebookUpdated={()=>{}}/></>);};
qa.seed=async()=>{qa.nb={id:'language-qa',name:'محاضرة Physics 12 $&',pageCount:1,templateId:'blank',paperSize:'A4',updatedAt:123,createdAt:123};await db.saveNotebook(qa.nb);await db.savePage({id:'language-p0',notebookId:qa.nb.id,pageIndex:0,templateId:'blank',pageWidth:1200,pageHeight:1600,strokes:[{id:'s1',tool:'pen',color:'#2563eb',width:3,points:[{x:30,y:40,pressure:.5},{x:80,y:90,pressure:.5}]}],textElements:[],imageElements:[]});};
qa.snapshot=async()=>JSON.stringify([await db.getAllNotebooks(),await db.getPagesByNotebookId(qa.nb.id)]);`;
(async()=>{
const dir=fs.mkdtempSync(path.join(base,'languages-')),errors=[],passed=[];
const code=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},bundle:true,write:false,format:'iife',platform:'browser',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"','import.meta.env.BASE_URL':'"./"'},plugins:[{name:'workers',setup:require('./helpers/recovery-worker.cjs').setupRecoveryWorker}],logLevel:'silent'});
const browser=await chromium.launch({headless:true,executablePath:process.env.BETTERNOTE_QA_BROWSER});
try{
const context=await browser.newContext({viewport:{width:1368,height:912},hasTouch:true}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const css=['src/index.css','src/components/Guide/UserGuide.css','src/localization.css'].map(p=>fs.readFileSync(path.join(root,p),'utf8')).join('\n');
await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<div id="root"></div>'});if(url.pathname.startsWith('/user-guide/'))return route.fulfill({path:path.join(root,'public',url.pathname)});return route.abort();});
await page.goto('https://language-qa.invalid/');await page.addStyleTag({content:css});await page.addScriptTag({content:code.outputFiles[0].text});await page.evaluate(()=>qa.seed());const before=await page.evaluate(()=>qa.snapshot());
const check=async(name,fn)=>{await fn();passed.push(name);console.log('PASS '+name);};
const word=key=>page.evaluate(key=>qa.word(key),key);
for(const lang of ['en','th','zh','ru','ar','es','de']){
await check('Settings '+lang+' switch, keyboard selection, stored choice and localized release notes',async()=>{
 await page.evaluate(lang=>{qa.change(lang);qa.mount('settings');},lang);await page.locator('.bn-settings-window').waitFor();
 await page.locator('.bn-settings-tab-item').nth(3).click();assert.equal(await page.locator('.bn-language-card').count(),7);
 const selected=page.locator('.bn-language-card[aria-pressed=true]');assert.equal(await selected.innerText(),await page.evaluate(()=>qa.word(qa.lang==='ar'?'langArabic':qa.lang==='es'?'langSpanish':qa.lang==='de'?'langGerman':{en:'langEnglish',th:'langThai',zh:'langChinese',ru:'langRussian'}[qa.lang])+'\n'+qa.word('inUse')+'\n'+qa.word(qa.lang==='ar'?'langArabicDesc':qa.lang==='es'?'langSpanishDesc':qa.lang==='de'?'langGermanDesc':{en:'langEnglishDesc',th:'langThaiDesc',zh:'langChineseDesc',ru:'langRussianDesc'}[qa.lang])));
 await selected.focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>localStorage.getItem('betternote_language')),lang);
 assert.equal(await page.evaluate(()=>document.documentElement.dir),lang==='ar'?'rtl':'ltr');
 await page.screenshot({path:path.join(dir,'settings-'+lang+'.png')});
 await page.locator('.bn-settings-tab-item').nth(4).click();assert.equal(await page.locator('.bn-settings-body li').count(),10);assert.ok((await page.locator('.bn-settings-body').innerText()).includes(await word('updateFix1')));
 await page.getByRole('button',{name:await word('diagnosticSave'),exact:true}).click();assert.equal(await page.evaluate(()=>qa.reportTitle),await word('diagnosticSave'));
 const box=await page.locator('.bn-settings-window').boundingBox();assert.ok(box.width>=900&&box.x>=0&&box.y>=0&&box.y+box.height<=913,JSON.stringify(box));
});
}
await check('GitHub circle and links open distribution releases/issues, failures are visible on any tab',async()=>{
 await page.locator('.bn-settings-tab-item').nth(0).click();await page.locator('.bn-github-circle').click();await page.locator('.bn-community-actions button').nth(1).click();
 assert.deepEqual(await page.evaluate(()=>qa.urls.slice(-2)),['https://github.com/NoteGuys/BetterNote-Releases/releases','https://github.com/NoteGuys/BetterNote-Releases/issues']);
 await page.evaluate(()=>qa.failLink=true);await page.locator('.bn-github-circle').click();await page.locator('.bn-settings-community [role=alert]').waitFor();assert.equal(await page.locator('.bn-settings-community [role=alert]').innerText(),await word('externalOpenFailed'));
 await page.evaluate(()=>qa.failLink=false);await page.locator('.bn-github-circle').click();await page.waitForFunction(()=>!document.querySelector('.bn-settings-community [role=alert]'));
});
for(const lang of ['ar','es','de'])await check('All guide lessons, annotations, native search and independent direction '+lang,async()=>{
 await page.evaluate(lang=>{qa.change(lang);qa.mount('guide');},lang);await page.locator('.bn-guide-category-grid').waitFor();
 assert.equal(await page.locator('.bn-guide').getAttribute('dir'),lang==='ar'?'rtl':'ltr');
 const categories=await page.evaluate(()=>qa.categories.map(c=>({id:c.id,title:c[qa.lang]})));
 for(const category of categories){await page.locator('.bn-guide-brand').click();await page.locator('.bn-guide-category-grid button').filter({hasText:category.title}).click();
 const titles=await page.evaluate(id=>qa.lessons.filter(l=>l.category===id).map(l=>({id:l.id,title:l.title[qa.lang]})),category.id);
 for(const item of titles){await page.locator('.bn-guide-lesson-list button').filter({hasText:item.title}).click();assert.equal(await page.locator('.bn-guide h1').innerText(),item.title);
 assert.ok(await page.locator('.bn-guide-steps li').count()>=3);assert.ok((await page.locator('.bn-guide-legend').first().innerText()).trim());
 await page.locator('.bn-guide-breadcrumb button').last().click();}}
 await page.locator('.bn-guide-brand').click();await page.locator('.bn-guide-search input').fill({ar:'استعادة',es:'restaurar',de:'Sicherung'}[lang]);assert.ok(await page.locator('.bn-guide-lesson-list button').count()>0);
 await page.locator('.bn-guide-lesson-list button').first().click();await page.screenshot({path:path.join(dir,'guide-'+lang+'.png')});
 await page.locator('.bn-guide-header select').selectOption('en');assert.equal(await page.locator('.bn-guide').getAttribute('dir'),'ltr');assert.ok((await page.locator('.bn-guide h1').innerText()).length);assert.equal(await page.evaluate(()=>localStorage.getItem('betternote_language')),lang);
});
await check('Settings tabs and guide fit Surface and narrow layouts in both directions and themes',async()=>{
 for(const width of [1368,1024,800,540])for(const lang of ['ar','de'])for(const theme of ['dark','light']){
 await page.setViewportSize({width,height:912});await page.evaluate(({lang,theme})=>{qa.change(lang);document.documentElement.setAttribute('data-theme',theme);qa.mount('settings');},{lang,theme});
 await page.locator('.bn-settings-tab-item').nth(3).click();
 assert.equal(await page.locator('.bn-settings-window').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'settings '+width+lang+theme);
 const done=page.locator('.bn-settings-footer button');assert.ok(await done.isVisible());const box=await done.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width&&box.y>=0&&box.y+box.height<=912);
 await page.evaluate(()=>qa.mount('guide'));await page.locator('.bn-guide').waitFor();assert.equal(await page.locator('.bn-guide').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'guide '+width+lang+theme);
 if(width===800)await page.screenshot({path:path.join(dir,'surface-'+lang+'-'+theme+'.png')});
 }
 for(const height of [600,480]){await page.setViewportSize({width:800,height});await page.evaluate(()=>{qa.change('ar');qa.mount('settings');});await page.locator('.bn-settings-tab-item').nth(3).click();const box=await page.locator('.bn-settings-footer button').boundingBox();assert.ok(box.y>=0&&box.y+box.height<=height,'short Settings '+JSON.stringify(box));}
});
await check('Editor geometry and toolbar positions stay unchanged across seven UI languages',async()=>{
 await page.setViewportSize({width:1368,height:912});await page.evaluate(()=>{qa.change('en');qa.mount('editor');});await page.locator('.bn-layer-active').waitFor();await page.waitForTimeout(250);
 const geometry=()=>page.locator('.bn-layer-active').evaluate(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,width:e.width,height:e.height}));const initial=await geometry();
 for(const lang of ['ar','es','de','en','th','zh','ru']){await page.evaluate(lang=>qa.change(lang),lang);await page.waitForTimeout(80);assert.equal(await page.locator('.bn-editor-container').getAttribute('dir'),'ltr');assert.deepEqual(await geometry(),initial);
 const tools=await page.locator('.bn-tool-btn').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().width>0).map(e=>Math.round(e.getBoundingClientRect().y)));assert.equal(new Set(tools).size,1,'one toolbar row '+lang);}
 await page.evaluate(()=>qa.local.flushLocalSaves());assert.equal(await page.evaluate(()=>qa.snapshot()),before);
 await page.screenshot({path:path.join(dir,'editor.png')});
});
await check('Library and backup dialogs render native labels without changing data',async()=>{
 await page.evaluate(()=>qa.db.saveSetting('initialDataSeeded',true));
 for(const lang of ['ar','es','de']){
 await page.evaluate(lang=>{qa.change(lang);qa.mount('app');},lang);await page.locator('.bn-gn-book-name').filter({hasText:'Physics'}).waitFor();
 assert.equal(await page.locator('.bn-gn-title').innerText(),await word('libraryDocuments'));await page.screenshot({path:path.join(dir,'library-'+lang+'.png')});
 await page.evaluate(()=>qa.mount('backup'));await page.locator('.bn-backup-hub').waitFor();assert.ok((await page.locator('.bn-backup-hub').innerText()).includes(await word('backupRestoreFromFolder')));
 await page.getByRole('button',{name:await word('backupChooseFolder'),exact:true}).click();assert.equal(await page.evaluate(()=>qa.folderTitle),await word('backupFolderPicker'));
 await page.screenshot({path:path.join(dir,'backup-'+lang+'.png')});
 }
 assert.equal(await page.evaluate(()=>qa.snapshot()),before);
});
await check('A fresh renderer restores the chosen language, Settings and direction',async()=>{
 await page.evaluate(()=>qa.change('ar'));await page.reload();await page.addStyleTag({content:css});await page.addScriptTag({content:code.outputFiles[0].text});
 await page.evaluate(async()=>{qa.nb=await qa.db.getNotebookById('language-qa');qa.lang=localStorage.getItem('betternote_language');qa.mount('app');});
 await page.locator('.bn-gn-title').waitFor();assert.equal(await page.locator('.bn-gn-title').innerText(),await word('libraryDocuments'));assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl');
 assert.equal(await page.evaluate(()=>qa.snapshot()),before);
});
await check('No renderer exceptions or changes to stored notebook content',async()=>{assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>qa.snapshot()),before);});
console.log(JSON.stringify({passed:passed.length,failed:0,artifacts:dir}));
}finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
