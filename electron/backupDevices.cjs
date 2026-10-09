const path=require('node:path');
const validDeviceId=id=>typeof id==='string'&&/^[a-z0-9-]{8,80}$/.test(id);
const deviceFolder=(root,id)=>{if(!validDeviceId(id))throw Object.assign(Error(),{code:'invalid-backup-device'});return path.join(root,'Devices',id);};
// Reader-worker discovery reads bounded metadata only. Recovery verifies the selected set.
async function listBackupDevices({fs,timed,root}){
 const canonical=await timed(fs.realpath(root)),choices=[];
 const contained=(base,file)=>{const r=path.relative(base,file);return r!=='..'&&!r.startsWith('..'+path.sep)&&!path.isAbsolute(r);};
 const add=async(folder,legacy=false)=>{
  const real=await timed(fs.realpath(folder));if(!contained(canonical,real))return;
  try{const file=path.join(real,'Full_System','backup_manifest.json'),stat=await timed(fs.stat(file));
   if(!stat.isFile()||stat.size<=0||stat.size>8*1048576||!contained(real,await timed(fs.realpath(file))))return;
   const m=JSON.parse((await timed(fs.readFile(file))).toString('utf8'));
   choices.push({folder:real,deviceId:m.backupDevice?.id||null,deviceName:typeof m.backupDevice?.name==='string'?m.backupDevice.name.slice(0,80):null,legacy:legacy&&!m.backupDevice?.id,
    savedAt:m.lastDataSuccess||0,count:Array.isArray(m.activeIds)?m.activeIds.length:Object.keys(m.notebooks||{}).length});
  }catch(e){if(e.code==='ENOENT'&&legacy){try{if((await timed(fs.stat(path.join(real,'Editable_Notes')))).isDirectory())choices.push({folder:real,legacy:true,count:0,savedAt:0});}catch(_){} }
   else if(e.code==='backup-read-timeout')throw e;}
 };
 await add(canonical,true);let entries=[];const devices=path.join(canonical,'Devices');
 try{const real=await timed(fs.realpath(devices));if(!contained(canonical,real))throw Object.assign(Error(),{code:'unsafe-backup-path'});entries=await timed(fs.readdir(real,{withFileTypes:true}));}
 catch(e){if(e.code!=='ENOENT')throw e;}
 const managed=entries.filter(e=>e.isDirectory()&&validDeviceId(e.name));if(managed.length>64)throw Object.assign(Error(),{code:'backup-too-large'});
 for(const e of managed)await add(deviceFolder(canonical,e.name));
 return choices.sort((a,b)=>b.savedAt-a.savedAt);
}
module.exports={validDeviceId,deviceFolder,listBackupDevices};
