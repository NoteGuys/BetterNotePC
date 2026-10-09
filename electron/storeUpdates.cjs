const fs=require('node:fs/promises'),path=require('node:path'),{execFile}=require('node:child_process');
const IDENTITY='JustStone.3453441DD0CC3';
function createStoreUpdateChecker({isStore=()=>false,platform=process.platform,run=execFile,readScript=()=>fs.readFile(path.join(__dirname,'storeUpdateCheck.ps1'),'utf8')}={}){
 let pending=null,script=null,child=null,disposed=false;
 const unavailable=()=>({success:false,status:'unavailable',hasUpdate:false,reason:'store-unavailable'});
 const check=()=>{
  if(disposed || platform!=='win32' || !isStore())return Promise.resolve(unavailable());
  if(pending)return pending;
  pending=(async()=>{
   try{
    script ||= (await readScript()).replace(/^\uFEFF/,'');
    if(disposed)return unavailable();
    const command='& {\n'+script+'\n} -ExpectedIdentity '+JSON.stringify(IDENTITY);
    const encoded=Buffer.from(command,'utf16le').toString('base64');
    const output=await new Promise((resolve,reject)=>{child=run(path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),
     ['-NoLogo','-NoProfile','-NonInteractive','-Sta','-ExecutionPolicy','Bypass','-EncodedCommand',encoded],
     {windowsHide:true,timeout:16000,maxBuffer:8192,encoding:'utf8'},(error,stdout)=>{child=null;error?reject(error):resolve(stdout);});});
    if(disposed)return unavailable();
    const result=JSON.parse(output.trim());
    if(!['available','current'].includes(result.status) || result.packageName!==IDENTITY || !Number.isInteger(result.count) || result.count<0 || result.count>100 ||
       result.hasUpdate!==(result.count>0) || (result.status==='available')!==result.hasUpdate)return unavailable();
    return{success:true,status:result.status,hasUpdate:result.hasUpdate,source:'microsoft-store'};
   }catch(_){return unavailable();}
  })().finally(()=>{pending=null;});
  return pending;
 };
 return{check,dispose(){disposed=true;child?.kill();}};
}
function registerStoreUpdates({ipcMain,getWindow,isStore}){const checker=createStoreUpdateChecker({isStore});ipcMain.handle('check-store-update',()=>checker.check());getWindow().on('closed',checker.dispose);return checker;}
module.exports={createStoreUpdateChecker,registerStoreUpdates,IDENTITY};
