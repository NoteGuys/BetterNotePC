const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const {chromium}=require(process.env.BETTERNOTE_PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),base=process.env.BETTERNOTE_QA_TEMP;if(!base)throw Error('Isolated QA required');
(async()=>{
 const dir=fs.mkdtempSync(path.join(base,'daily-update-'));
 const entry=["import React from'react';import{createRoot}from'react-dom/client';import{useDailyUpdateNotice}from'./src/services/useDailyUpdateNotice.js';import{UpdateToast}from'./src/components/Common/UpdateToast.jsx';import{setAppLanguage,TRANSLATIONS}from'./src/services/i18n.js';import{clearCheckDate}from'./src/services/updateService.js';",
 "let root=createRoot(document.getElementById('root'));window.qa={language:'en',calls:0,result:{success:true,status:'available',hasUpdate:true}};window.electronAPI={getAppInfo:async()=>({version:'1.2.1',distribution:'store'}),checkStoreUpdate:async()=>{qa.calls++;return qa.result;}};",
 "const Harness=()=>{const[home,setHome]=React.useState(qa.home),[counter,setCounter]=React.useState(0);qa.setHome=setHome;qa.bump=()=>setCounter(c=>c+1);const{notice,dismiss}=useDailyUpdateNotice(home,{startupMs:1000});return <><div>{counter}</div><UpdateToast notice={notice} visible={home} onDismiss={dismiss}/></>;};",
 "qa.mount=(home=true,reset=true)=>{if(reset){localStorage.clear();clearCheckDate();qa.calls=0;}qa.home=home;setAppLanguage(qa.language);root.render(<Harness key={++qa.key}/>);};qa.key=0;qa.word=k=>TRANSLATIONS[qa.language][k];"].join('\n');
 const code=await esbuild.build({stdin:{resolveDir:root,contents:entry,loader:'jsx'},bundle:true,write:false,platform:'browser',format:'iife',logLevel:'silent'});
 const browser=await chromium.launch({executablePath:process.env.BETTERNOTE_QA_BROWSER,headless:true});let checks=0;
 try{
  const context=await browser.newContext({viewport:{width:1000,height:700}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',r=>r.request().url()==='https://daily.invalid/'?r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}):r.abort());
  await page.goto('https://daily.invalid/');await page.clock.install({time:new Date('2026-10-09T12:00:00Z')});await page.clock.pauseAt(new Date('2026-10-09T12:00:01Z'));await page.addScriptTag({content:code.outputFiles[0].text});
  const mount=async(home=true,reset=true)=>{await page.evaluate(([home,reset])=>qa.mount(home,reset),[home,reset]);await page.waitForTimeout(30);};
  await mount();assert.equal(await page.locator('.bn-update-toast').count(),0);await page.clock.runFor(1001);await page.locator('.bn-update-toast').waitFor();checks++;
  const rect=await page.locator('.bn-update-toast').boundingBox();assert.ok(Math.abs(1000-rect.x-rect.width-24)<1);assert.ok(Math.abs(700-rect.y-rect.height-24)<1);checks++;
  await page.clock.runFor(2000);await page.evaluate(()=>qa.bump());await page.clock.runFor(2998);assert.equal(await page.locator('.bn-update-toast').count(),1);await page.clock.runFor(5);assert.equal(await page.locator('.bn-update-toast').count(),0);checks++;
  await mount(true,false);await page.clock.runFor(1001);assert.equal(await page.locator('.bn-update-toast').count(),0);assert.equal(await page.evaluate(()=>qa.calls),1);checks++;
  await mount(false);await page.clock.runFor(1001);assert.equal(await page.locator('.bn-update-toast').count(),0);await page.evaluate(()=>qa.setHome(true));await page.locator('.bn-update-toast').waitFor();await page.clock.runFor(5001);assert.equal(await page.locator('.bn-update-toast').count(),0);checks++;
  for(const result of [{success:true,status:'current',hasUpdate:false},{success:false,status:'unavailable',hasUpdate:false}]){
   await page.evaluate(r=>qa.result=r,result);await mount();await page.clock.runFor(1001);assert.equal(await page.locator('.bn-update-toast').count(),0);assert.equal(await page.evaluate(()=>qa.calls),1);checks++;
  }
  await page.evaluate(()=>qa.result={success:true,status:'available',hasUpdate:true});
  for(const language of ['th','zh','ru']){await page.evaluate(l=>qa.language=l,language);await mount();await page.clock.runFor(1001);await page.getByText(await page.evaluate(()=>qa.word('updateToastAvailable')),{exact:true}).waitFor();await page.clock.runFor(5001);checks++;}
  await page.clock.runFor(24*60*60*1000);await page.waitForTimeout(30);assert.equal(await page.evaluate(()=>qa.calls),2);checks++;
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:checks,errors,dir,syntheticOnly:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
