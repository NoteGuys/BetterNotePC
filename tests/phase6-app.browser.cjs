const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.BETTERNOTE_PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),base=process.env.BETTERNOTE_QA_TEMP;
if(!base||!path.isAbsolute(base))throw Error('Isolated QA directory required');
(async()=>{
 const dir=fs.mkdtempSync(path.join(base,'phase6-app-')),bootstrap=path.join(dir,'main.cjs');
 fs.mkdirSync(path.join(dir,'docs'));fs.mkdirSync(path.join(dir,'temp'));
 fs.writeFileSync(bootstrap,"const{app,session}=require('electron'),path=require('node:path');const dir=process.argv.at(-1);app.setPath('userData',path.join(dir,'profile'));app.setPath('sessionData',path.join(dir,'session'));app.setPath('documents',path.join(dir,'docs'));app.setPath('temp',path.join(dir,'temp'));app.getVersion=()=>"+JSON.stringify(require('../package.json').version)+";app.whenReady().then(()=>{session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,cb)=>cb({cancel:true}));});require("+JSON.stringify(path.join(root,'electron/main.cjs'))+");");
 const artifactAsar=process.env.BETTERNOTE_QA_ARTIFACT_ASAR;
 if(artifactAsar){
  assert.ok(path.isAbsolute(artifactAsar)&&artifactAsar.endsWith('app.asar'));
  const pkg=JSON.parse(require('@electron/asar').extractFile(artifactAsar,'package.json').toString());
  assert.equal(pkg.version,require('../package.json').version);
  let source=fs.readFileSync(bootstrap,'utf8');
  source=source.replace("app.getVersion=()=>","app.getAppPath=()=>"+JSON.stringify(artifactAsar)+";app.getVersion=()=>");
  source=source.replace(JSON.stringify(path.join(root,'electron/main.cjs')),JSON.stringify(path.join(artifactAsar,'electron/main.cjs')));
  fs.writeFileSync(bootstrap,source);
 }
 const packed=process.env.BETTERNOTE_QA_PACKAGE_ROOT;
 let executablePath=path.join(root,'node_modules/electron/dist/electron.exe'),args=[bootstrap,dir],appRoot=root;
 if(packed){
   appRoot=path.join(packed,'resources/app');
   if(!fs.existsSync(path.join(packed,'resources/app.asar'))) {
   const packageFile=path.join(appRoot,'package.json'),config=JSON.parse(fs.readFileSync(packageFile,'utf8'));
   if(!['electron/main.cjs','electron/qa-bootstrap.cjs'].includes(config.main))throw Error('Unexpected QA package entry');
   const packagedBootstrap=fs.readFileSync(bootstrap,'utf8').replace(JSON.stringify(path.join(root,'electron/main.cjs')),JSON.stringify(path.join(appRoot,'electron/main.cjs')));
   fs.writeFileSync(path.join(appRoot,'electron/qa-bootstrap.cjs'),packagedBootstrap.replace(JSON.stringify(path.join(appRoot,'electron/main.cjs')),JSON.stringify('./main.cjs')));config.main='electron/qa-bootstrap.cjs';fs.writeFileSync(packageFile,JSON.stringify(config));
   if(process.env.BETTERNOTE_QA_PACKAGE_ASAR==='1'){
     const asar=require('@electron/asar');
     const archive=path.join(packed,'resources/app.asar');
     const entries=fs.readdirSync(appRoot,{recursive:true,withFileTypes:true});
     const filenames=entries.map(e=>path.join(e.parentPath,e.name)),metadata={};
     for(const file of filenames){const stat=fs.lstatSync(file);metadata[file]={stat,type:stat.isFile()?'file':stat.isDirectory()?'directory':'link'};}
     await asar.createPackageFromFiles(appRoot,archive,filenames,metadata);
     const isolatedRoot=path.resolve(packed),expected=path.resolve(root,'scratch/phase6-package/win-unpacked');
     assert.equal(isolatedRoot,expected);
     fs.renameSync(appRoot,path.join(packed,'resources/qa-app-source'));
   }
   }
   if(process.env.BETTERNOTE_QA_PACKAGE_REFRESH==='1'){
     const source=path.join(packed,'resources/qa-app-source');
     assert.equal(path.resolve(packed),path.resolve(root,'scratch/phase6-package/win-unpacked'));
     await fs.promises.cp(path.join(root,'dist'),path.join(source,'dist'),{recursive:true,force:true});
     await fs.promises.cp(path.join(root,'electron'),path.join(source,'electron'),{recursive:true,force:true});
     const entries=fs.readdirSync(source,{recursive:true,withFileTypes:true}),filenames=entries.map(e=>path.join(e.parentPath,e.name)),metadata={};
     for(const file of filenames){const stat=fs.lstatSync(file);metadata[file]={stat,type:stat.isFile()?'file':stat.isDirectory()?'directory':'link'};}
     await require('@electron/asar').createPackageFromFiles(source,path.join(packed,'resources/app.asar'),filenames,metadata);
   }
   executablePath=path.join(packed,'BetterNotePC.exe');args=[dir];
 }
 const env={...process.env,TEMP:path.join(dir,'temp'),TMP:path.join(dir,'temp')};delete env.ELECTRON_RUN_AS_NODE;delete env.BETTERNOTE_GOOGLE_OAUTH_FILE;
 const app=await _electron.launch({executablePath,args,env,timeout:30000});
 try{
  const page=await app.firstWindow(),errors=[],consoleErrors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().slice(0,200));});
  await page.waitForFunction(()=>document.querySelectorAll('button').length>5,{timeout:30000});
  const prefs=await app.evaluate(({BrowserWindow})=>{const p=BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();return{webSecurity:p.webSecurity,sandbox:p.sandbox,nodeIntegration:p.nodeIntegration,contextIsolation:p.contextIsolation};});
  assert.deepEqual(prefs,{webSecurity:true,sandbox:true,nodeIntegration:false,contextIsolation:true});
  const info=await page.evaluate(()=>electronAPI.getAppInfo());assert.equal(info.version,require('../package.json').version);
  if(process.env.BETTERNOTE_QA_ICON_PROBE){
   const handle=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getNativeWindowHandle().readBigUInt64LE().toString());
   // The packaged executable embeds the same ICO; the probe reads Windows' live WM_GETICON handles.
   const expected=path.join(root,'app-icon.ico');
   const output=require('node:child_process').execFileSync(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',process.env.BETTERNOTE_QA_ICON_PROBE,'-WindowHandle',handle,'-ExpectedIcon',expected,'-OutputDirectory',dir],{windowsHide:true,encoding:'utf8',timeout:15000});
   const result=JSON.parse(output.trim());assert.ok(result.every(icon=>icon.matchesBetterNote));
   fs.writeFileSync(path.join(dir,'window-icons.json'),JSON.stringify(result,null,2));
   console.log('PASS real Windows small/large window icons match BetterNote (WM_GETICON pixel comparison)');
  }

  if(process.env.BETTERNOTE_QA_DAILY_NATIVE==='1'){
   const result=await page.evaluate(()=>electronAPI.checkStoreUpdate());assert.equal(result.status,'unavailable');assert.equal(result.hasUpdate,false);
   const installedRoot=await app.evaluate(({app})=>app.getAppPath());
   const script=(installedRoot.endsWith('.asar')?require('@electron/asar').extractFile(installedRoot,'electron/storeUpdateCheck.ps1').toString('utf8'):fs.readFileSync(path.join(installedRoot,'electron/storeUpdateCheck.ps1'),'utf8')).replace(/^\uFEFF/,'');
   const command='& {\n'+script+'\n} -ProbeRuntime';
   const stdout=await new Promise((resolve,reject)=>require('node:child_process').execFile(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-Sta','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{windowsHide:true,timeout:16000,maxBuffer:8192},(error,output)=>error?reject(error):resolve(output)));
   const probe=JSON.parse(stdout.toString().trim());
   assert.equal(probe.status,'runtime-ready');console.log('PASS packaged Store-check preload IPC and WinRT helper loaded from ASAR');
  }
  await page.evaluate(()=>localStorage.setItem('qa-existing-profile','retained'));
  await page.reload();await page.waitForFunction(()=>document.querySelectorAll('button').length>5);assert.equal(await page.evaluate(()=>localStorage.getItem('qa-existing-profile')),'retained');
  const fonts=await page.evaluate(async()=>{await document.fonts.ready;return Promise.all(['Inter','Sarabun','Caveat','Plus Jakarta Sans'].map(async name=>({name,count:(await document.fonts.load('600 16px "'+name+'"','ทดสอบ Test')).length})));});
  assert.ok(fonts.every(f=>f.count>0));console.log('PASS offline bundled fonts, unchanged file origin and secure main/preload');
  const worker=fs.readdirSync(path.join(root,'dist/assets')).find(n=>n.startsWith('pdf.worker.min-')&&n.endsWith('.mjs'));
  const resources=await page.evaluate(async worker=>{
    const ok=await fetch('betternote-assets://app/assets/'+worker);
    const denied=await fetch('betternote-assets://app/package.json');return{ok:ok.status,denied:denied.status};
  },worker);assert.deepEqual(resources,{ok:200,denied:404});
  const inspected=await page.evaluate(folder=>electronAPI.saveBackup({action:'inspect',localBackupPath:folder,driveBackupPath:null}),path.join(dir,'docs'));
  assert.equal(inspected.success,true,JSON.stringify({reason:inspected.reason}));
  const nativePdf=await page.evaluate(async()=>{
    const begin=await electronAPI.exportPdfDocument({action:'begin',pages:1});
    if(!begin.id)return begin;
    const appended=await electronAPI.exportPdfDocument({action:'append',id:begin.id,pages:1,start:0,html:'<!doctype html><style>@page{size:100mm 100mm;margin:0}</style><div>QA packaged PDF ทดสอบ</div>'});
    if(appended.error)return appended;
    const result=await electronAPI.exportPdfDocument({action:'finish',id:begin.id});
    return {error:result.error,pages:result.pages,bytes:result.bytes?.byteLength};
  });
  assert.equal(nativePdf.error,undefined,JSON.stringify(nativePdf));assert.equal(nativePdf.pages,1);assert.ok(nativePdf.bytes>1000);
  console.log('PASS packaged backup worker and native PDF merge worker');
  const bnoteFile=path.join(dir,'docs','ทดสอบ % #.bnote');
  await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({filePath:file});},bnoteFile);
  const nativeBnote=await page.evaluate(async()=>{
   const text=JSON.stringify({format:'BetterNote_Document',version:1,notebook:{id:'packed-note',name:'Packed QA',pageCount:91},pages:Array.from({length:91},(_,i)=>({id:'p'+i,notebookId:'packed-note',pageIndex:i,textElements:[{text:'ภาษาไทย '+i}],strokes:[],imageElements:[]}))});
   const bytes=new TextEncoder().encode(text).buffer;
   const begin=await electronAPI.saveBnote({action:'begin',name:'ทดสอบ.bnote',size:bytes.byteLength});if(!begin.success)return begin;
   const chunk=await electronAPI.saveBnote({action:'chunk',id:begin.id,offset:0,bytes});if(!chunk.success)return chunk;
   return electronAPI.saveBnote({action:'finish',id:begin.id});
  });
  assert.equal(nativeBnote.success,true,JSON.stringify(nativeBnote));assert.equal(JSON.parse(fs.readFileSync(bnoteFile,'utf8')).pages.length,91);
  await page.evaluate(()=>{const input=document.createElement('input');input.type='file';input.id='qa-bnote-file';document.body.append(input);});
  await page.locator('#qa-bnote-file').setInputFiles(bnoteFile);
  const readBack=await page.evaluate(async()=>JSON.parse(await document.querySelector('#qa-bnote-file').files[0].text()));assert.equal(readBack.pages.length,91);assert.equal(readBack.pages[90].textElements[0].text,'ภาษาไทย 90');
  console.log('PASS actual sandbox/preload IPC .bnote save, worker in ASAR and immediate file-input readback');
  await page.locator('input[accept=".bnote"]').setInputFiles(bnoteFile);
  await page.waitForFunction(()=>document.body.textContent.includes('Packed QA'),{},{timeout:15000});
  assert.ok(!consoleErrors.some(s=>s.includes('bnote.worker')&&s.includes('Refused')));
  console.log('PASS packaged production Library imports the just-saved .bnote under actual file origin/CSP');

  if(artifactAsar){
   await page.locator('.bn-sidebar-nav button').nth(2).click();
   await page.waitForSelector('.bn-guide-category-grid');
   assert.equal(await page.locator('.bn-guide-category-grid > button').count(),10);
   assert.ok((await page.locator('.bn-guide-meta').innerText()).includes('55'));
   await page.locator('.bn-guide-popular button').first().click();
   await page.waitForFunction(()=>document.querySelector('.bn-guide-article img')?.naturalWidth>0);
   const guideImages=await page.evaluate(async files=>{
    for(const file of files){const result=await fetch(new URL('user-guide/'+file,location.href));if(!result.ok)throw Error('Guide image unavailable: '+file);const bytes=await result.arrayBuffer();if(new Uint8Array(bytes)[0]!==137)throw Error('Invalid PNG '+file);}return files.length;
   },fs.readdirSync(path.join(root,'public/user-guide')).filter(n=>n.endsWith('.png')));
   assert.equal(guideImages,44);await page.screenshot({path:path.join(dir,'packaged-guide.png')});
   await page.locator('.bn-sidebar-nav button').first().click();
   await page.locator('button.bn-gn-icon-btn').filter({has:page.locator('svg.lucide-settings')}).click();
   await page.locator('.bn-settings-tab-item').last().click();
   await page.waitForFunction(()=>document.body.innerText.includes('Version 1.3.0.0'));
   await page.screenshot({path:path.join(dir,'packaged-version.png')});
   await page.locator('.bn-modal-close-btn').click();
   console.log('PASS actual release guide opens offline with 10 categories, 55 lessons and all 44 images; Settings shows 1.3.0.0');
  }
  const rejected=await page.evaluate(()=>electronAPI.scanBackupFolder('relative'));assert.equal(rejected.reason,'invalid-request');
  const denied=await page.evaluate(()=>electronAPI.openExternal('file:///C:/Windows'));assert.equal(denied.success,false);
  assert.equal((await page.evaluate(()=>electronAPI.openGoogleSignIn())).reason,'coming-soon');
  await page.evaluate(()=>window.open('https://example.com','_blank'));await new Promise(r=>setTimeout(r,150));assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length),1);
  const before=page.url();await page.evaluate(()=>{location.href='file:///C:/Windows/not-an-app.html';});await new Promise(r=>setTimeout(r,100));assert.equal(page.url(),before);
  assert.deepEqual(errors,[]);console.log('PASS restricted PDF resources, navigation, popup denial and native payload validation');
  console.log(JSON.stringify({dir,fonts,consoleErrors,syntheticOnly:true}));
 }finally{await app.evaluate(({app})=>app.exit());await app.close().catch(()=>{});}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
