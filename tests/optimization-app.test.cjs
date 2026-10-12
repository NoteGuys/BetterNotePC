const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process');
test('Actual app startup, diagnostics export and normal close work in an isolated profile',{timeout:60000},async()=>{
 const qa=process.env.BETTERNOTE_QA_TEMP;assert.ok(qa,'Isolated QA folder required');const root=await fs.mkdtemp(path.join(qa,'optimization-app-'));
 const run=(root,entry)=>{
  const {app,ipcMain,dialog,session}=require('electron'),fs=require('node:fs'),path=require('node:path');
  process.on('uncaughtException',error=>{fs.writeFileSync(path.join(root,'error.txt'),String(error.stack));app.exit(1);});
  for(const folder of ['profile','session','documents'])fs.mkdirSync(path.join(root,folder),{recursive:true});
  app.setPath('userData',path.join(root,'profile'));app.setPath('sessionData',path.join(root,'session'));app.setPath('documents',path.join(root,'documents'));
  const handle=ipcMain.handle.bind(ipcMain);ipcMain.handle=(channel,handler)=>handle(channel,['save-auto-backup','scan-backup-folder','get-backup-status-details','restore-backup-from-folder'].includes(channel)?async()=>({success:false,reason:'qa-backup-disabled'}):handler);
  app.whenReady().then(()=>session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_details,reply)=>reply({cancel:true})));
  dialog.showSaveDialog=async()=>({canceled:false,filePath:path.join(root,'export.jsonl')});
  app.on('browser-window-created',(_event,window)=>{
   window.show=()=>{};window.maximize=()=>{};
   window.webContents.once('did-finish-load',async()=>{
    try{
     const result=await window.webContents.executeJavaScript(`(async()=>{const info=await window.electronAPI.getAppInfo();await window.electronAPI.recordPerformance([{event:'performance',category:'ink',count:1,p95:2,filename:'QA-PRIVATE-NOTE'}]);const exported=await window.electronAPI.exportDiagnostics();return {info,exported};})()`);
     setTimeout(()=>{
      try{const log=fs.readFileSync(path.join(root,'profile','diagnostics','performance.jsonl'),'utf8'),report=fs.readFileSync(path.join(root,'export.jsonl'),'utf8');fs.writeFileSync(path.join(root,'result.json'),JSON.stringify({...result,log,report}));window.close();}catch(error){console.error(error.message);app.exit(1);}
     },3000);
    }catch(error){console.error(error.message);app.exit(1);}
   });
  });
  setTimeout(()=>app.exit(2),45000).unref();require(entry);
 };
 const helper=path.join(root,'run.cjs');await fs.writeFile(helper,'('+run.toString()+')('+JSON.stringify(root)+','+JSON.stringify(path.resolve(__dirname,'../electron/main.cjs'))+');');
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 // Require a normal exit after window.close; forced termination is failure cleanup only.
 // The parent owns and cleans up only the helper it just launched, including children.
 const child=spawn(require('electron'),[helper],{env,windowsHide:true});let stderr='';child.stdout.resume();child.stderr.on('data',d=>stderr=(stderr+d).slice(-1800));
 let spawnError;child.on('error',error=>{spawnError=error;});
 try {
  const deadline=Date.now()+45000;
  while(true){
   if(spawnError)throw spawnError;
   try{await fs.access(path.join(root,'result.json'));break;}catch(error){if(error.code!=='ENOENT')throw error;}
   if(child.exitCode!==null)throw Error('App QA '+child.exitCode+': '+stderr);
   if(Date.now()>deadline)throw Error('App QA startup/export timeout: '+stderr);
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('App QA normal close did not exit')),15000);
   const done=code=>{clearTimeout(timer);code===0?resolve():reject(Error('App QA exit '+code+': '+stderr));};
   if(child.exitCode!==null)done(child.exitCode);else child.once('exit',done);
  });
 }finally{
  if(child.pid && child.exitCode===null)await new Promise(resolve=>{
   const cleanup=spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
   cleanup.on('error',()=>{child.kill();resolve();});cleanup.on('exit',resolve);
  });
 }
 const result=JSON.parse(await fs.readFile(path.join(root,'result.json'),'utf8'));
 assert.equal(result.exported.success,true);assert.ok(result.report.includes('startup'));assert.equal(result.log.includes('QA-PRIVATE-NOTE'),false);assert.equal(result.report.includes('QA-PRIVATE-NOTE'),false);
});
