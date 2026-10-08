const {Worker}=require('node:worker_threads'),path=require('node:path'),{randomUUID}=require('node:crypto');
function createBnoteSaver({dialog,getWindow,workerFactory=()=>new Worker(path.join(__dirname,'bnoteSave.worker.cjs')),timeoutMs=120000}){
 let worker=null,session=null,request=0,pending=new Map(),choosing=false;
 const stop=()=>{const old=worker,temp=session?.temp;worker=null;session=null;for(const done of pending.values())done({success:false,reason:'bnote-save-failed'});pending.clear();
  if(old)old.terminate().then(()=>temp && require('node:fs/promises').unlink(temp).catch(()=>{})).catch(()=>{});
 };
 const call=command=>{
  if(!worker){worker=workerFactory();const instance=worker;worker.on('message',data=>{if(worker===instance)pending.get(data.requestId)?.(data);});worker.on('error',()=>{if(worker===instance)stop();});worker.on('exit',()=>{if(worker===instance)stop();});}
  return new Promise(resolve=>{const requestId=++request;let timer=setTimeout(stop,timeoutMs);pending.set(requestId,result=>{clearTimeout(timer);pending.delete(requestId);resolve(result);});try{worker.postMessage({...command,requestId});}catch(_){stop();}});
 };
 const execute=async command=>{
  if(command?.action==='begin'){
   if(session || choosing)return{success:false,reason:'bnote-save-busy'};
   if(typeof command.name!=='string' || !Number.isInteger(command.size) || command.size<1 || command.size>272*1048576)return{success:false,reason:'bnote-save-failed'};
   choosing=true;
   try{
    const name=command.name.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,180).replace(/\.bnote$/i,'')+'.bnote';
    const result=await dialog.showSaveDialog(getWindow(),{defaultPath:name,filters:[{name:'BetterNote document',extensions:['bnote']}]});
    if(result.canceled || !result.filePath)return{success:false,cancelled:true};
    const file=/\.bnote$/i.test(result.filePath)?result.filePath:result.filePath+'.bnote';
    if(!path.isAbsolute(file))return{success:false,reason:'bnote-save-failed'};
    const id=randomUUID();session={id,busy:true,temp:file+'.pending-'+id};
    const saved=await call({action:'begin',path:file,size:command.size,id});
    if(!saved.success){stop();return saved;}
    session.busy=false;return{success:true,id};
   }catch(_){stop();return{success:false,reason:'bnote-save-failed'};}finally{choosing=false;}
  }
  if(!session || command?.id!==session.id || session.busy || !['chunk','finish','abort'].includes(command.action))return{success:false,reason:'bnote-save-failed'};
  session.busy=true;const result=await call(command);
  if(!result.success || command.action!=='chunk')stop();else session.busy=false;
  return result;
 };
 return{execute,dispose:stop};
}
function registerBnoteSave({ipcMain,dialog,getWindow}){const saver=createBnoteSaver({dialog,getWindow});ipcMain.handle('save-bnote-file',(_event,command)=>saver.execute(command));getWindow().on('closed',saver.dispose);return saver;}
module.exports={createBnoteSaver,registerBnoteSave};
