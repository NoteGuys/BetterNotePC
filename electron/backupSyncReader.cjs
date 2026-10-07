const fsDefault=require('node:fs').promises,path=require('node:path');
const {createHash}=require('node:crypto');
const hash=value=>createHash('sha256').update(value).digest('hex');
const fault=code=>Object.assign(new Error(code),{code});
const stamp=value=>value&&[value.size,value.mtimeMs,value.ctimeMs,value.ino].join(':');
function createBackupSyncReader({fs=fsDefault,deadlineMs=30000,maxFileBytes=256*1048576,onProgress=()=>{}}={}){
  const timed=async promise=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(fault('backup-read-timeout')),deadlineMs);})]);}finally{clearTimeout(timer);}};
  const optional=async file=>{try{return await timed(fs.stat(file));}catch(error){if(error.code==='ENOENT')return null;throw error;}};
  return {async execute({folderPath,syncMode,syncNotebookId,manifestHash,syncDeviceId}={}){
    try{
      if(typeof folderPath!=='string'||!path.isAbsolute(folderPath)||!['preview','note'].includes(syncMode))throw fault('invalid-backup-request');
      const root=path.resolve(folderPath),rootStat=await optional(root);
      if(rootStat&&!rootStat.isDirectory())throw fault('backup-folder-unavailable');
      const canonicalRoot=rootStat?await timed(fs.realpath(root)):root;
      const within=relative=>{const file=path.resolve(canonicalRoot,relative),rest=path.relative(canonicalRoot,file);if(!rest||rest==='..'||rest.startsWith('..'+path.sep)||path.isAbsolute(rest))throw fault('unsafe-backup-path');return file;};
      let bytesRead=0;
      const read=async(relative,limit,hashOnly=false)=>{
        const file=within(relative),before=await optional(file);if(!before)return null;
        if(!before.isFile()||before.size<=0||before.size>limit)throw fault('backup-too-large');
        const real=await timed(fs.realpath(file)),rest=path.relative(canonicalRoot,real);
        if(rest==='..'||rest.startsWith('..'+path.sep)||path.isAbsolute(rest))throw fault('unsafe-backup-path');
        const opening=fs.open(file,'r');let handle;
        try{handle=await timed(opening);}catch(error){opening.then(late=>late.close().catch(()=>{}),()=>{});throw error;}
        bytesRead+=before.size;if(bytesRead>512*1048576)throw fault('backup-too-large');
        const bytes=Buffer.allocUnsafe(hashOnly?Math.min(1048576,before.size):before.size),hasher=createHash('sha256');
        try{
          if(stamp(await timed(handle.stat()))!==stamp(before))throw fault('backup-changed-during-read');
          for(let offset=0;offset<before.size;){const bufferOffset=hashOnly?0:offset;const value=await timed(handle.read(bytes,bufferOffset,Math.min(1048576,before.size-offset),offset));if(!value.bytesRead)throw fault('backup-changed-during-read');hasher.update(bytes.subarray(bufferOffset,bufferOffset+value.bytesRead));offset+=value.bytesRead;onProgress({stage:'reading',bytesDone:offset,totalBytes:before.size});}
          if((await timed(handle.read(Buffer.alloc(1),0,1,before.size))).bytesRead||stamp(await timed(handle.stat()))!==stamp(before)||stamp(await optional(file))!==stamp(before))throw fault('backup-changed-during-read');
        }finally{await timed(handle.close());}
        return hashOnly?hasher.digest('hex'):bytes;
      };
      const manifestFile='Full_System/backup_manifest.json',raw=await read(manifestFile,8*1048576);
      if(!raw){
        if(await optional(within('Full_System/BetterNote_Latest_Backup.json'))||await optional(within('Editable_Notes')))throw fault('drive-sync-legacy');
        if(syncMode==='note')throw fault('backup-changed-during-read');
        return {success:true,folder:folderPath,manifestHash:null,notes:[],folders:[]};
      }
      const signature=hash(raw);
      if(syncMode==='note'&&manifestHash!==signature)throw fault('backup-changed-during-read');
      const manifest=JSON.parse(raw.toString('utf8'));
      if(manifest.syncPending){
        if(manifest.version!==2||typeof syncDeviceId!=='string'||manifest.syncPending.deviceId!==syncDeviceId||syncMode!=='preview')throw fault('backup-incomplete');
        const intents=manifest.syncPending.notebooks||{},entries=Object.create(null);
        if(!manifest.notebooks||Array.isArray(manifest.notebooks)||Object.keys(manifest.notebooks).length+Object.keys(intents).length>20000)throw fault('invalid-backup-manifest');
        for(const id of new Set([...Object.keys(manifest.notebooks),...Object.keys(intents)])){
          const artifact=Object.hasOwn(manifest.notebooks,id)?manifest.notebooks[id]?.editable:null,intent=Object.hasOwn(intents,id)?intents[id]:null;
          const relative=artifact?.path||intent?.path,parts=String(relative||'').replace(/\\/g,'/').split('/');
          if(parts.length!==2||parts[0]!=='Editable_Notes'||!parts[1].endsWith('--'+hash(id).slice(0,32)+'.bnote')||/[<>:"|?*\x00-\x1f]/.test(parts[1]))throw fault('unsafe-backup-path');
          const actual=await read(relative,maxFileBytes,true);
          const allowed=intent?[intent.previousHash,intent.nextHash]:[artifact?.hash];
          if(!allowed.includes(actual))throw fault('backup-changed-during-read');
          entries[id]=actual;
        }
        if(hash(await read(manifestFile,8*1048576))!==signature)throw fault('backup-changed-during-read');
        return {success:true,folder:folderPath,manifestHash:signature,notes:[],folders:[],resumingOwn:true,entries};
      }
      if(manifest.version!==2||!manifest.notebooks||typeof manifest.notebooks!=='object'||Array.isArray(manifest.notebooks)||
        !Array.isArray(manifest.activeIds)||new Set(manifest.activeIds).size!==manifest.activeIds.length||
        !/^[a-f0-9]{64}$/.test(manifest.fullHash||'')||!Number.isFinite(manifest.lastDataSuccess)||manifest.lastDataSuccess<=0)throw fault('backup-incomplete');
      const fullStat=await optional(within('Full_System/BetterNote_Latest_Backup.json'));
      if(!fullStat?.isFile()||fullStat.size!==manifest.fullSize)throw fault('backup-incomplete');
      const [folderToken,noteTokens]=JSON.parse(manifest.fullRevision||'null');
      if(typeof folderToken!=='string'||!Array.isArray(noteTokens)||noteTokens.length!==manifest.activeIds.length||noteTokens.length>10000)throw fault('backup-incomplete');
      const active=new Set(manifest.activeIds),tokens=new Map(noteTokens.map(token=>[JSON.parse(token)[0],token]));
      if(tokens.size!==active.size)throw fault('backup-incomplete');
      for(const id of active)if(!tokens.has(id)||!Object.hasOwn(manifest.notebooks,id)||manifest.notebooks[id]?.editable?.revision!==tokens.get(id))throw fault('backup-incomplete');
      let folders=JSON.parse(folderToken).map(row=>({id:row[0],name:row[1],parentId:row[2],updatedAt:row[3],isDeleted:row[4],color:row[5],icon:row[6],isFavorite:row[7]}));
      const {validateLibrary,validateNotebook}=await import('./backupValidation.js');
      if(manifest.syncFolders!==undefined){
        if(!Array.isArray(manifest.syncFolders)||manifest.syncFolders.length>10000)throw fault('invalid-backup-manifest');
        const token=JSON.stringify([...manifest.syncFolders].sort((a,b)=>String(a.id).localeCompare(String(b.id))).map(folder=>
          [folder.id,folder.name,folder.parentId||null,folder.updatedAt||0,!!folder.isDeleted,folder.color,folder.icon,!!folder.isFavorite]));
        if(token!==folderToken)throw fault('backup-incomplete');
        folders=manifest.syncFolders;
      }
      validateLibrary(folders,[]);
      const notes=[];
      for(const[id,entry]of Object.entries(manifest.notebooks)){
        const artifact=entry?.editable,parts=String(artifact?.path||'').replace(/\\/g,'/').split('/');
        if(parts.length!==2||parts[0]!=='Editable_Notes'||!parts[1].endsWith('--'+hash(id).slice(0,32)+'.bnote')||/[<>:"|?*\x00-\x1f]/.test(parts[1])||
          !/^[a-f0-9]{64}$/.test(artifact?.hash||'')||!Number.isSafeInteger(artifact?.size)||artifact.size<=0||artifact.size>maxFileBytes||typeof artifact.revision!=='string')throw fault('invalid-backup-manifest');
        if(!active.has(id))continue; // Deleted/retained historical entries do not silently recreate notebooks.
        const row=JSON.parse(artifact.revision);
        if(!Array.isArray(row)||row[0]!==id)throw fault('invalid-backup-manifest');
        notes.push({id,name:row[2],folderId:row[3],updatedAt:row[1],pageCount:row[4],isDeleted:row[5],hash:artifact.hash,revision:artifact.revision,size:artifact.size});
      }
      if(syncMode==='preview')return {success:true,folder:folderPath,manifestHash:signature,notes,folders};
      const entry=Object.hasOwn(manifest.notebooks,syncNotebookId)?manifest.notebooks[syncNotebookId]:null;
      if(!active.has(syncNotebookId)||!entry)throw fault('backup-changed-during-read');
      const bytes=await read(entry.editable.path,maxFileBytes);
      if(!bytes||hash(bytes)!==entry.editable.hash||bytes.length!==entry.editable.size)throw fault('backup-incomplete');
      const note=validateNotebook(JSON.parse(bytes.toString('utf8')));
      if(note.id!==syncNotebookId)throw fault('notebook-identity-mismatch');
      const {syncRevision}=await import('./backupSyncProtocol.js');
      if(syncRevision(note)!==entry.editable.revision)throw fault('backup-incomplete');
      if(hash(await read(manifestFile,8*1048576))!==signature)throw fault('backup-changed-during-read');
      // Transfer bytes instead of cloning a rich notebook object through the renderer.
      const {recoverMissingNotebookFolders}=await import('./backupValidation.js');
      const repaired=recoverMissingNotebookFolders(folders,[note]);
      const encoded=Buffer.from(JSON.stringify({notebooks:repaired.notebooks,folders}));
      return {success:true,folder:folderPath,manifestHash:signature,remoteHash:entry.editable.hash,encoded:new Uint8Array(encoded)};
    }catch(error){return {success:false,reason:error.code||'invalid-backup-data'};}
  }};
}
module.exports={createBackupSyncReader};
