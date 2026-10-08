const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const {chromium}=require(process.env.BETTERNOTE_PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),base=process.env.BETTERNOTE_QA_TEMP;
if(!base||!path.isAbsolute(base))throw Error('Isolated directory required');
(async()=>{
 const dir=fs.mkdtempSync(path.join(base,'phase6-updates-'));
 const entry=[
 "import React from 'react';import{createRoot}from'react-dom/client';",
 "import{SettingsModal}from'./src/components/Library/SettingsModal.jsx';import{UpdateNotificationModal}from'./src/components/Common/UpdateNotificationModal.jsx';",
 "import{TRANSLATIONS,setAppLanguage}from'./src/services/i18n.js';import{clearCheckDate}from'./src/services/updateService.js';",
 "let root=createRoot(document.getElementById('root'));",
 "window.qa={word:key=>TRANSLATIONS[qa.language][key],mount:lang=>{qa.language=lang;setAppLanguage(lang);clearCheckDate();root.render(<SettingsModal key={qa.language+'-'+Date.now()} isOpen onClose={()=>{}} onOpenUpdateModal={data=>qa.result=data}/>);},",
 "modal:()=>root.render(<UpdateNotificationModal isOpen onClose={()=>qa.closed=true} updateData={{currentVersion:'1.2.1',latestVersion:'1.2.2',distribution:'installer',updateUrl:'https://github.com/NoteGuys/BetterNotePC/releases',bugFixes:[],features:[]}}/>)};"
 ].join('\n');
 const code=await esbuild.build({stdin:{resolveDir:root,loader:'jsx',contents:entry},bundle:true,write:false,format:'iife',platform:'browser',logLevel:'silent',plugins:[{name:'workers',setup:require('./helpers/recovery-worker.cjs').setupRecoveryWorker}]});
 const browser=await chromium.launch({executablePath:process.env.BETTERNOTE_QA_BROWSER,headless:true});
 try{
  const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let status='offline',fetches=0;
  await context.route('https://phase6.invalid/',r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));
  await context.route('https://raw.githubusercontent.com/**',r=>{fetches++;return status==='offline'?r.abort():r.fulfill({contentType:'application/json',body:JSON.stringify({version:status==='available'?'1.2.2':'1.2.1'})});});
  await page.goto('https://phase6.invalid/');await page.evaluate(()=>{window.electronAPI={isElectron:true,getAppInfo:async()=>({version:'1.2.1',distribution:'installer'}),openExternal:async()=>({success:false})};});
  await page.addScriptTag({content:code.outputFiles[0].text});
  for(const language of ['en','th','zh','ru']){
   await page.evaluate(lang=>qa.mount(lang),language);
   await page.locator('.bn-settings-tab-item').last().click();
   const check=await page.evaluate(()=>qa.word('updateCheckNow'));
   await page.getByRole('button',{name:check,exact:true}).click();
   const failure=await page.evaluate(()=>qa.word('updateConnectError'));await page.getByText(failure,{exact:true}).waitFor();
   assert.equal(await page.getByText(await page.evaluate(()=>qa.word('updatePreviewDialog')),{exact:true}).count(),0);
   status='current';await page.getByRole('button',{name:check,exact:true}).click();await page.getByText(await page.evaluate(()=>qa.word('updateIsLatest').replace('{version}','1.2.1')),{exact:true}).waitFor();
   status='available';await page.getByRole('button',{name:check,exact:true}).click();await page.waitForFunction(()=>qa.result?.status==='available');await page.evaluate(()=>qa.result=null);
   status='offline';
  }
  for(const language of ['en','th','zh','ru']){
   await page.evaluate(()=>{electronAPI.getAppInfo=async()=>({version:'1.2.1',distribution:'store'});qa.opened=[];electronAPI.openExternal=async url=>{qa.opened.push(url);return{success:true};};});
   await page.evaluate(lang=>qa.mount(lang),language);await page.locator('.bn-settings-tab-item').last().click();
   const before=fetches;await page.getByRole('button',{name:await page.evaluate(()=>qa.word('updateStoreCheck')),exact:true}).click();
   await page.getByText(await page.evaluate(()=>qa.word('updateStoreOpened')),{exact:true}).waitFor();
   assert.equal(fetches,before);assert.deepEqual(await page.evaluate(()=>qa.opened),['ms-windows-store://pdp/?productid=9N9NH9GHFV8J']);
  }
  await page.evaluate(()=>{electronAPI.openExternal=async()=>({success:false});});
  await page.evaluate(()=>qa.modal());
  await page.getByRole('button',{name:await page.evaluate(()=>qa.word('updateOpenReleases')),exact:true}).click();
  await page.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>qa.closed||false),false);
  const fix=await page.evaluate(()=>qa.word('updateFix1'));assert.equal(await page.getByText(fix,{exact:true}).count(),0);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:21,fetches,errors,syntheticOnly:true,dir}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});