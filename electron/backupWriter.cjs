// Runs inside a Node worker. Disk I/O and JSON serialization never run in the Electron UI process.
const nodeFs=require('node:fs').promises,path=require('node:path');
const {deviceFolder,validDeviceId}=require('./backupDevices.cjs');
const {isLegacySummary}=require('./backupLegacy.cjs');
const {createHash,randomUUID}=require('node:crypto');
const hash=value=>createHash('sha256').update(value).digest('hex');
const fault=code=>Object.assign(new Error(code),{code});
const notebookConflict=code=>['newer-backup-exists','conflicting-backup-revision'].includes(code);
const hasNotebookIssues=target=>Object.keys(target.notebookIssues||target.manifest&&readNotebookIssues(target.manifest)||{}).length>0;
const readNotebookIssues=manifest=>Object.fromEntries(Object.entries(manifest.notebooks||{})
 .filter(([,entry])=>entry.backupConflict).map(([id,entry])=>[id,entry.backupConflict]));
const parse=buffer=>JSON.parse(buffer.toString('utf8'));
const noteValid=value=>value&&typeof value.id==='string'&&value.id.length>0&&Array.isArray(value.pages);
const fullValid=value=>value&&Array.isArray(value.notebooks)&&value.notebooks.every(noteValid);
const fullRelative=manifest=>manifest.fullPath||'Full_System/BetterNote_Latest_Backup.json';
const cleanName=value=>String(value||'Untitled').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/[ .]+$/g,'').slice(0,48)||'Untitled';
const contentFingerprint=note=>hash(JSON.stringify([
 note.name,note.folderId||null,!!note.isDeleted,note.templateId,note.paperSize,note.orientation,note.pdfBase64,
 note.pages.map(page=>[page.id,page.pageIndex,page.strokes||[],page.textElements||[],page.imageElements||[],
  page.pdfPageImage,page.pageWidth,page.pageHeight,page.templateId,page.paperColor])
]));
const revision=n=>JSON.stringify([n.id,Number(n.updatedAt)||0,n.name||'',n.folderId||null,Number(n.pageCount)||0,!!n.isDeleted]);
const header=n=>({id:n.id,name:n.name,folderId:n.folderId,updatedAt:n.updatedAt,pageCount:n.pageCount,isDeleted:n.isDeleted});
const pdfBuffer=value=>{
 if(typeof value!=='string')return null;
 const encoded=value.replace(/^data:.*?;base64,/,'').trim();
 if(!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)||encoded.length%4===1)throw fault('invalid-pdf');
 const buffer=Buffer.from(encoded,'base64');
 if(!buffer.subarray(0,5).equals(Buffer.from('%PDF-'))||!buffer.subarray(-1024).includes(Buffer.from('%%EOF')))throw fault('invalid-pdf');
 return buffer;
};
function createBackupWriter({localDir,driveCandidates=[],fs=nodeFs,deadlineMs=10000,retention=3,now=Date.now,beforeReplace=async()=>{}}){
 if(!path.isAbsolute(localDir))throw fault('absolute-local-folder-required');
 let session=null,sequence=Promise.resolve(),report=()=>{},activeCommand=null;
 const outstanding=new Map(),digestCache=new Map();
 const read=async file=>{try{return await fs.readFile(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}};
 const stat=async file=>{try{return await fs.stat(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}};
 const within=(root,relative)=>{
  const full=path.resolve(root,relative);
  if(!full.toLowerCase().startsWith(path.resolve(root).toLowerCase()+path.sep))throw fault('unsafe-backup-path');
  return full;
 };
 const signature=value=>value&&[value.size,value.mtimeMs,value.ctimeMs,value.ino].join(':');
 const remember=(file,digest,value)=>{
  const key=file.toLowerCase();digestCache.delete(key);digestCache.set(key,{digest,signature:signature(value)});
  if(digestCache.size>512)digestCache.delete(digestCache.keys().next().value);
 };
 const emit=event=>{try{report({jobId:activeCommand?.jobId||null,...event});}catch(_){}};
 const timed=async(task,timeout=deadlineMs)=>{
  let timer;try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(fault('destination-timeout')),timeout);})]);}
  finally{clearTimeout(timer);}
 };
 const canonical=async root=>{
  try{return await timed(fs.realpath(root),Math.min(deadlineMs,1000));}catch(error){if(error.code==='ENOENT')return path.resolve(root);if(error.code==='destination-timeout')throw error;return path.resolve(root);}
 };
 const resolveTargets=async request=>{
  const command=typeof request==='string'?{customBackupPath:request}:request||{};
  const chosen=command.localBackupPath??command.customBackupPath??localDir;
  if(typeof chosen!=='string'||!path.isAbsolute(chosen))throw fault('absolute-backup-folder-required');
  const selectedDrive=command.driveBackupPath||null;
  if(selectedDrive&&(typeof selectedDrive!=='string'||!path.isAbsolute(selectedDrive)))throw fault('absolute-backup-folder-required');
  // A selected local folder replaces the default. Drive is an explicitly separate destination.
  const specs=[{root:path.resolve(chosen),kind:'local',roles:['local']}];
  if(selectedDrive)specs.push({root:path.resolve(selectedDrive),kind:'drive',roles:['drive']});
  const result=[];
  for(const spec of specs){
   let resolved;
   try{resolved=await canonical(spec.root);}catch(error){resolved=path.resolve(spec.root);spec.error=error.code||'destination-unavailable';}
   const selectedRoot=resolved;
   if(command.backupDevice){
    if(!validDeviceId(command.backupDevice.id))throw fault('invalid-backup-device');
    resolved=deviceFolder(selectedRoot,command.backupDevice.id);
    if(!spec.error)try{let ancestor=resolved;while(!await timed(stat(ancestor),1000)){const parent=path.dirname(ancestor);if(parent===ancestor)throw fault('backup-folder-unavailable');ancestor=parent;}
     const real=await timed(fs.realpath(ancestor),1000);
     if(await timed(stat(selectedRoot),1000)){const link=path.relative(selectedRoot,real);if(link==='..'||link.startsWith('..'+path.sep)||path.isAbsolute(link))throw fault('unsafe-backup-path');}
     const expected=path.relative(ancestor,resolved);
     resolved=path.resolve(real,expected);const rest=path.relative(path.resolve(real,path.relative(ancestor,selectedRoot)),resolved);
     if(rest==='..'||rest.startsWith('..'+path.sep)||path.isAbsolute(rest))throw fault('unsafe-backup-path');
    }catch(error){spec.error=error.code||'backup-folder-unavailable';}
    spec.selectedRoot=selectedRoot;spec.backupDevice={id:command.backupDevice.id,name:String(command.backupDevice.name||'').slice(0,80)};
   }
   const key=resolved.toLowerCase();
   const old=result.find(target=>target.key===key);
   if(old)old.roles=[...new Set([...old.roles,...spec.roles])];
   else result.push({...spec,key,root:resolved});
  }
  return result;
 };
 const verifyRoot=async root=>{const value=await stat(root);if(value&&!value.isDirectory())throw fault('ENOTDIR');};
 const safeManifest=raw=>{
  if(!raw)return{version:2,notebooks:Object.create(null),lastSync:null,lastDataSuccess:null,fullRevision:null};
  const parsed=parse(raw);
  if(!parsed||typeof parsed!=='object')throw fault('invalid-backup-manifest');
  if(parsed.version!==2)return{version:2,notebooks:Object.create(null),lastSync:null,lastDataSuccess:null,fullRevision:null};
  if(!parsed.notebooks||typeof parsed.notebooks!=='object'||Array.isArray(parsed.notebooks))throw fault('invalid-backup-manifest');
  if(parsed.fullPath&&!/^Full_System[\\/]Backup--[a-f0-9]{64}\.json$/.test(parsed.fullPath))throw fault('unsafe-backup-path');
  for(const[id,entry]of Object.entries(parsed.notebooks)){
   if(!entry||typeof entry!=='object')throw fault('invalid-backup-manifest');
   for(const kind of ['editable','pdf'])if(entry[kind]){
    const artifact=entry[kind],parts=String(artifact.path||'').replace(/\\/g,'/').split('/');
    const directory=kind==='editable'?'Editable_Notes':'PDF_Documents',extension=kind==='editable'?'.bnote':'.pdf';
    if(parts.length!==2||parts[0]!==directory||/[<>:"|?*\x00-\x1f]/.test(parts[1])||
     !parts[1].endsWith('--'+hash(id).slice(0,32)+extension)||typeof artifact.hash!=='string'||!/^[a-f0-9]{64}$/.test(artifact.hash))throw fault('unsafe-backup-path');
   }
  }
  return parsed;
 };
 const entryFor=(target,id)=>Object.hasOwn(target.manifest?.notebooks||{},id)?target.manifest.notebooks[id]:undefined;
 const setEntry=(target,id,entry)=>Object.defineProperty(target.manifest.notebooks,id,{value:entry,enumerable:true,writable:true,configurable:true});
 const targetAction=async(target,operation,{errorField='error',sizeHint=0,notebookInfo=null}={})=>{
  if(target.error&&errorField==='error')return;
  const rootKey=target.key||target.root.toLowerCase();
  if(outstanding.has(rootKey)){target[errorField]='destination-busy';return;}
  let expired=false,timer,expire;
  const started=Date.now();let allowanceMs=deadlineMs;
  const timeout=new Promise((_,reject)=>{expire=()=>{expired=true;reject(fault('destination-timeout'));};});
  const budget=bytes=>{
   // A later small manifest write must not shorten the budget granted for a large snapshot.
   allowanceMs=Math.max(allowanceMs,Math.min(90000,deadlineMs+Math.ceil(Math.max(sizeHint,bytes||0)/1048576)*150));
   clearTimeout(timer);timer=setTimeout(expire,Math.max(1,started+allowanceMs-Date.now()));
  };
  const current=()=>!expired;current.budget=budget;budget(sizeHint);
  current.beforeInstall=async()=>{
   if(target.legacySources)for(const item of target.legacySources){
    if(signature(await stat(item.file))!==item.stamp)throw fault('backup-changed-externally');
   }
   if(target.syncGuardHash===undefined)return;
   const raw=await read(within(target.root,'Full_System/backup_manifest.json'));
   if((raw?hash(raw):null)!==target.syncGuardHash)throw fault('backup-changed-externally');
  };
  current.installed=(file,value)=>{const source=target.legacySources?.find(item=>item.file===file);if(source)source.stamp=signature(value);};
  const task=Promise.resolve().then(async()=>{
   try{await operation(current);}catch(error){
    const code=error.code||error.message||'backup-write-failed';
    if(!notebookInfo||!notebookConflict(code)||!current())throw error;
    target.notebookIssues||=Object.create(null);
    Object.defineProperty(target.notebookIssues,notebookInfo.id,{enumerable:true,configurable:true,writable:true,value:{
     id:notebookInfo.id,name:notebookInfo.name||'',error:code,incomingRevision:revision(notebookInfo),
     incomingUpdatedAt:Number(notebookInfo.updatedAt)||0,backupUpdatedAt:Number(error.backupUpdatedAt)||0
    }});
    const old=entryFor(target,notebookInfo.id)||{};
    setEntry(target,notebookInfo.id,{...old,name:old.name||notebookInfo.name,pageCount:old.pageCount||notebookInfo.pages.length,
     backupConflict:target.notebookIssues[notebookInfo.id]});
    await saveManifest(target,current);
   }
  });
  outstanding.set(rootKey,task);
  task.then(()=>{if(outstanding.get(rootKey)===task)outstanding.delete(rootKey);},
   ()=>{if(outstanding.get(rootKey)===task)outstanding.delete(rootKey);});
  try{await Promise.race([task,timeout]);}
  catch(error){expired=true;target[errorField]=error.code||error.message||'backup-write-failed';}
  finally{clearTimeout(timer);}
 };
 const writeBytes=async(handle,bytes,current,event)=>{
  for(let offset=0;offset<bytes.length;){
   if(!current())throw fault('backup-cancelled');
   const size=Math.min(1048576,bytes.length-offset),written=await handle.write(bytes,offset,size,null);
   if(!written.bytesWritten)throw fault('EIO');
   offset+=written.bytesWritten;emit({...event,bytesDone:offset,totalBytes:bytes.length});
  }
  await handle.sync();
 };
 const verifyInstalled=async(file,bytes)=>{
  const before=await stat(file),checked=await fs.readFile(file),after=await stat(file);
  if(!checked.equals(bytes))throw fault('installed-backup-verification-failed');
  if(signature(before)!==signature(after))throw fault('backup-changed-externally');
  remember(file,hash(bytes),after);
 };
 const verifyManagedPath=async(root,file)=>{
  let ancestor=file;
  while(!await stat(ancestor)){const parent=path.dirname(ancestor);if(parent===ancestor)throw fault('unsafe-backup-path');ancestor=parent;}
  const remainder=path.relative(root,await fs.realpath(ancestor));
  if(remainder==='..'||remainder.startsWith('..'+path.sep)||path.isAbsolute(remainder))throw fault('unsafe-backup-path');
 };
 const historyDirectory=relative=>relative==='Full_System/backup_manifest.json'?
  path.join('Backup_History','Manifests'):relative==='Full_System/BetterNote_Latest_Backup.json'?
  path.join('Backup_History','System_Copies'):path.join(path.dirname(relative),'.history',path.basename(relative));
 const atomic=async(root,relative,bytes,validate,current=()=>true,keep=retention,options={})=>{
  const file=within(root,relative),previous=Object.hasOwn(options,'previous')?options.previous:await read(file);
  current.budget?.((bytes.length+(previous?.length||0))*4);
  if(previous&&validate&&!options.previousValidated&&!validate(previous))throw fault('invalid-existing-backup');
  if(validate&&!options.newValidated&&!validate(bytes))throw fault('invalid-new-backup');
  if(previous&&previous.equals(bytes)){
   await current.beforeInstall?.();
   await verifyInstalled(file,bytes);
   return{path:relative,hash:hash(bytes),size:bytes.length,skipped:true};
  }
  if(!current())throw fault('backup-cancelled');
  await fs.mkdir(path.dirname(file),{recursive:true});
  const temporary=file+'.pending-'+randomUUID();let installed=false;
  try{
   const handle=await fs.open(temporary,'wx');
   try{await writeBytes(handle,bytes,current,{stage:'writing',fileName:path.basename(file),targetDir:root});}
   finally{await handle.close();}
   emit({stage:'verifying',fileName:path.basename(file),targetDir:root,bytesDone:0,totalBytes:bytes.length});
   if(!(await fs.readFile(temporary)).equals(bytes))throw fault('backup-verification-failed');
   if(!current())throw fault('backup-cancelled');
   if(previous&&keep){
    const history=within(root,historyDirectory(relative));
    await verifyManagedPath(root,history);
    await fs.mkdir(history,{recursive:true});const archive=path.join(history,hash(previous)+'.previous');
    if(!await read(archive)){
     const archived=await fs.open(archive,'wx');
     try{await writeBytes(archived,previous,current,{stage:'keeping-version',fileName:path.basename(file),targetDir:root});}
     finally{await archived.close();}
    }
    if(!(await fs.readFile(archive)).equals(previous))throw fault('history-verification-failed');
   }
   await beforeReplace({file,temporary,relative});
   await current.beforeInstall?.();
   if(!current())throw fault('backup-cancelled');
   const latest=await read(file);
   if(!!latest!==!!previous||(latest&&!latest.equals(previous)))throw fault('backup-changed-externally');
   await fs.rename(temporary,file);installed=true;
   await verifyInstalled(file,bytes);
   const digest=hash(bytes);
   if(previous&&keep){
    const history=within(root,historyDirectory(relative));
    const stamp=new Date(now());await fs.utimes(path.join(history,hash(previous)+'.previous'),stamp,stamp);
    const archives=(await fs.readdir(history)).filter(name=>name.endsWith('.previous'));
    const dated=await Promise.all(archives.map(async name=>({name,time:(await fs.stat(path.join(history,name))).mtimeMs})));
    dated.sort((a,b)=>b.time-a.time||b.name.localeCompare(a.name));
    for(const old of dated.slice(keep))await fs.unlink(path.join(history,old.name));
   }
   current?.installed?.(file,await stat(file));
   emit({stage:'verified',fileName:path.basename(file),targetDir:root,bytesDone:bytes.length,totalBytes:bytes.length});
   return{path:relative,hash:digest,size:bytes.length,skipped:false};
  }finally{if(!installed)await fs.unlink(temporary).catch(()=>{});}
 };
 const manifestRefs=manifest=>{
  const refs=new Map();
  if(manifest.fullPath&&path.basename(manifest.fullPath)==='Backup--'+manifest.fullHash+'.json')refs.set(manifest.fullPath,manifest.fullHash);
  for(const[id,entry]of Object.entries(manifest.notebooks||{}))for(const kind of ['editable','pdf']){
   const artifact=entry[kind],extension=kind==='editable'?'.bnote':'.pdf';
   if(artifact?.path&&path.basename(artifact.path).endsWith('--'+artifact.hash+'--'+hash(id).slice(0,32)+extension))refs.set(artifact.path,artifact.hash);
  }
  return refs;
 };
 const manifestHistory=async root=>{
  const result=[];
  for(const directory of [within(root,'Backup_History/Manifests'),within(root,'Full_System/.history/backup_manifest.json')]){
   for(const name of await fs.readdir(directory).catch(error=>{if(error.code==='ENOENT')return[];throw error;})){
    if(!/^[a-f0-9]{64}\.previous$/.test(name))continue;
    const file=path.join(directory,name),raw=await read(file);if(!raw||hash(raw)!==name.slice(0,64))continue;
    try{const manifest=safeManifest(raw);if(manifest.fullPath&&manifest.fullHash&&manifest.fullRevision)result.push({file,manifest,time:(await stat(file)).mtimeMs});}catch(_){}
   }
  }
  return result;
 };
 // A history manifest retains its original logical paths. Only explicit historical
 // recovery can resolve those paths inside Backup_History; current reads stay strict.
 const archiveOldFiles=async(target,current,history)=>{
  // Migrate verified convenience copies left by the previous app version as well.
  const legacyCopies=within(target.root,'Full_System/.history/BetterNote_Latest_Backup.json');
  for(const name of await fs.readdir(legacyCopies).catch(error=>{if(error.code==='ENOENT')return[];throw error;})){
   if(!/^[a-f0-9]{64}\.previous$/.test(name))continue;
   const source=path.join(legacyCopies,name),relative=path.join('Backup_History','System_Copies',name),dest=within(target.root,relative);
   await verifyManagedPath(target.root,source);await verifyManagedPath(target.root,dest);
   const before=await stat(source),bytes=await read(source);if(!bytes||hash(bytes)!==name.slice(0,64))continue;
   try{if(!fullValid(parse(bytes)))continue;}catch(_){continue;}
   const existing=await read(dest);if(existing&&hash(existing)!==hash(bytes))continue;
   await atomic(target.root,relative,bytes,null,current,0);
   await fs.utimes(dest,new Date(before.mtimeMs),new Date(before.mtimeMs));
   await current.beforeInstall?.();if(!current())return;
   if(signature(before)===signature(await stat(source))&&hash(await fs.readFile(source))===hash(bytes))await fs.unlink(source);
  }
  for(const item of history){
   const relative=path.join('Backup_History','Manifests',path.basename(item.file));
   if(item.file===within(target.root,relative))continue;
   await verifyManagedPath(target.root,item.file);await verifyManagedPath(target.root,within(target.root,relative));
   const bytes=await read(item.file);if(!bytes||hash(bytes)!==path.basename(item.file).slice(0,64))continue;
   const existing=await read(within(target.root,relative));if(existing&&hash(existing)!==hash(bytes))continue;
   await atomic(target.root,relative,bytes,null,current,0);
   await fs.utimes(within(target.root,relative),new Date(item.time),new Date(item.time));
   await current.beforeInstall?.();if(!current())return;
   if(hash(await fs.readFile(item.file))===hash(bytes))await fs.unlink(item.file);
  }
  const latest=new Set(manifestRefs(target.manifest).keys());
  const older=new Map(history.flatMap(item=>[...manifestRefs(item.manifest)]));
  for(const[relative,digest]of older){
   if(latest.has(relative))continue;
   const source=within(target.root,relative),before=await stat(source);if(!before?.isFile())continue;
   current.budget?.(before.size*6);
   const bytes=await read(source);if(!bytes||hash(bytes)!==digest||signature(before)!==signature(await stat(source)))continue;
   const archivedRelative=path.join('Backup_History',relative),archive=within(target.root,archivedRelative);
   // Do not overwrite user-modified history or follow directories outside the destination.
   await verifyManagedPath(target.root,source);await verifyManagedPath(target.root,archive);
   const existing=await read(archive);if(existing&&hash(existing)!==digest)continue;
   await atomic(target.root,archivedRelative,bytes,null,current,0);
   await current.beforeInstall?.();if(!current())return;
   const latestBytes=await read(source);
   if(latestBytes&&hash(latestBytes)===digest&&signature(before)===signature(await stat(source))){await fs.unlink(source);digestCache.delete(source.toLowerCase());}
  }
 };
 const saveManifest=async(target,current)=>{
  if(target.staging)return; // Publish only a complete generation, never a partly written list.
  const raw=await read(within(target.root,'Full_System/backup_manifest.json'));
  let previous;try{previous=raw&&safeManifest(raw);}catch(_){}
  // PDF updates belong to the same data generation and must not evict recovery history.
  const newGeneration=previous?.fullPath&&previous.fullPath!==target.manifest.fullPath;
  const saved=await atomic(target.root,'Full_System/backup_manifest.json',
   Buffer.from(JSON.stringify(target.manifest)),buffer=>{try{return!!safeManifest(buffer);}catch(_){return false;}},current,raw&&(!previous?.fullPath||newGeneration)?Number.MAX_SAFE_INTEGER:0);
  target.legacyManifest=false;if(target.syncGuardHash!==undefined)target.syncGuardHash=saved.hash;
  try{
   const history=await manifestHistory(target.root),groups=new Set([target.manifest.fullPath]),kept=[],expired=[];
   history.sort((a,b)=>(b.manifest.generation||0)-(a.manifest.generation||0)||b.time-a.time||b.file.localeCompare(a.file));
   for(const item of history){
    if(!groups.has(item.manifest.fullPath)&&kept.length<retention){groups.add(item.manifest.fullPath);kept.push(item);}else expired.push(item);
   }
   const protectedFiles=new Set([target.manifest,...kept.map(item=>item.manifest)].flatMap(value=>[...manifestRefs(value).keys()]));
   const owned=new Map([...(previous?.fullPath===target.manifest.fullPath&&!target.namesUpgraded?[...manifestRefs(previous)].filter(([relative])=>relative.startsWith('PDF_Documents'+path.sep)):[]),...expired.flatMap(item=>[...manifestRefs(item.manifest)])]);
   for(const item of expired){await current.beforeInstall?.();if(!current())break;
    const bytes=await read(item.file);if(bytes&&hash(bytes)===path.basename(item.file).slice(0,64))await fs.unlink(item.file);
   }
   for(const[relative,digest]of owned){
    if(protectedFiles.has(relative))continue;await current.beforeInstall?.();if(!current())break;
    for(const location of [relative,path.join('Backup_History',relative)]){
     const file=within(target.root,location);await verifyManagedPath(target.root,file);const bytes=await read(file);if(!bytes||hash(bytes)!==digest)continue;
     await current.beforeInstall?.();if(!current())break;
     await fs.unlink(file);digestCache.delete(file.toLowerCase());
    }
   }
   await archiveOldFiles(target,current,kept);
  }catch(_){} // Retention cleanup cannot invalidate the newly committed backup.
  return saved;
 };
 const configureSyncGuard=async(target,command,raw,current)=>{
  target.syncGuardHash=raw?hash(raw):null;
  const guard=(target.roles||[target.kind]).includes('drive')?command.driveSyncGuard:command.localSyncGuard;if(!guard)return;
  if(!guard.ready)throw fault(guard.reason||'drive-sync-pending');
  if((raw?hash(raw):null)!==guard.manifestHash)throw fault('backup-changed-externally');
   target.syncGuardHash=guard.manifestHash;target.syncExpected=Object.assign(Object.create(null),guard.entries||{});target.syncDeviceId=guard.deviceId;target.syncFolders=guard.folders;
   const indexed=raw&&parse(raw)?.notebooks;
   for(const info of command.metadata?.notebooks||[])if(!Object.hasOwn(target.syncExpected,info.id)){
    if(indexed&&Object.hasOwn(indexed,info.id))throw fault('drive-sync-pending');
    target.syncExpected[info.id]=null;
   }
   if(guard.legacyUpgrade){
    if(raw&&!isLegacySummary(parse(raw)))throw fault('backup-changed-externally');
    if(!Array.isArray(guard.legacyUpgrade.files)||!guard.legacyUpgrade.files.length||guard.legacyUpgrade.files.length>10002)throw fault('invalid-backup-manifest');
    current.budget(guard.legacyUpgrade.files.reduce((sum,item)=>sum+(Number(item.size)||0),0)*6);
    target.legacySources=[];target.legacyManifest=!!raw;
    for(const item of guard.legacyUpgrade.files){
     const parts=String(item.path||'').replace(/\\/g,'/').split('/');
     if(parts.length!==2||!['Full_System','Editable_Notes'].includes(parts[0])||parts[1]==='backup_manifest.json'||
       !/^[a-f0-9]{64}$/.test(item.hash||'')||!Number.isSafeInteger(item.size)||item.size<=0)throw fault('unsafe-backup-path');
     const file=within(target.root,item.path),before=await stat(file);
     if(!before?.isFile()||before.size!==item.size)throw fault('backup-changed-externally');
     const handle=await fs.open(file,'r'),buffer=Buffer.allocUnsafe(Math.min(1048576,item.size)),hasher=createHash('sha256');
     try{
      for(let offset=0;offset<item.size;){
       if(!current())throw fault('backup-cancelled');
       const chunk=await handle.read(buffer,0,Math.min(buffer.length,item.size-offset),offset);
       if(!chunk.bytesRead)throw fault('backup-changed-externally');
       hasher.update(buffer.subarray(0,chunk.bytesRead));offset+=chunk.bytesRead;
       emit({stage:'checking',targetDir:target.root,fileName:path.basename(file),bytesDone:offset,totalBytes:item.size});
      }
     }finally{await handle.close();}
     const after=await stat(file);
     if(hasher.digest('hex')!==item.hash||signature(before)!==signature(after))throw fault('backup-changed-externally');
     target.legacySources.push({file,stamp:signature(after)});
    }
    target.syncExpected=Object.create(null);
    for(const info of command.metadata.notebooks){
     const file=within(target.root,path.join('Editable_Notes',cleanName(info.name)+'--'+hash(info.id).slice(0,32)+'.bnote'));
     const existing=await read(file),source=guard.legacyUpgrade.files.find(item=>within(target.root,item.path)===file);
     if(existing&&(!source||hash(existing)!==source.hash))throw fault('backup-changed-externally');
     target.syncExpected[info.id]=existing?hash(existing):null;
    }
   }
 };
 const artifactMatches=async(target,artifact,token,{deep=false,current}={})=>{
  if(!artifact||artifact.revision!==token||!artifact.path||!artifact.hash)return false;
  try{
   const file=within(target.root,artifact.path),value=await stat(file);
   if(!value?.isFile()||(artifact.size!==undefined&&value.size!==artifact.size))return false;
   const remembered=digestCache.get(file.toLowerCase());
   if(!deep&&remembered?.signature===signature(value))return remembered.digest===artifact.hash;
   current?.budget?.(value.size*3);
   emit({stage:'checking',targetDir:target.root,fileName:path.basename(file),bytesDone:0,totalBytes:value.size});
   const raw=await read(file);if(!raw)return false;
   const after=await stat(file);
   if(signature(value)!==signature(after)){digestCache.delete(file.toLowerCase());return false;}
   const digest=hash(raw);remember(file,digest,after);
   return digest===artifact.hash;
  }catch(_){return false;}
 };
 const upgradeArtifactNames=async(target,id,current)=>{
  const entry=entryFor(target,id);if(!entry)return;
  for(const kind of ['editable','pdf']){
   const artifact=entry[kind];if(!artifact?.path||!path.basename(artifact.path).startsWith('Notebook-'))continue;
   if(!await artifactMatches(target,artifact,artifact.revision,{current}))throw fault('backup-changed-externally');
   const bytes=await fs.readFile(within(target.root,artifact.path));if(hash(bytes)!==artifact.hash)throw fault('backup-changed-externally');
   const relative=path.join(kind==='editable'?'Editable_Notes':'PDF_Documents',cleanName(entry.name)+'--'+artifact.hash+'--'+hash(id).slice(0,32)+(kind==='editable'?'.bnote':'.pdf'));
   entry[kind]={...artifact,...await atomic(target.root,relative,bytes,null,current,0)};target.namesUpgraded=true;
  }
 };
 const fullArtifact=target=>({path:fullRelative(target.manifest),hash:target.manifest.fullHash,
  size:target.manifest.fullSize,revision:target.manifest.fullRevision});
 const targetResult=target=>({
  targetDir:target.root,selectedRoot:target.selectedRoot,backupDevice:target.backupDevice,kind:target.kind,roles:target.roles||[target.kind],success:!target.error&&!hasNotebookIssues(target)&&!target.partial,
  dataSuccess:!target.error&&!hasNotebookIssues(target)&&!!target.manifest?.fullRevision,error:target.error||null,
  notebookIssues:target.notebookIssues||target.manifest&&readNotebookIssues(target.manifest)||{},partial:!!target.partial||hasNotebookIssues(target),
  pdfError:target.pdfError||null,lastSuccess:target.manifest?.lastSync||null,
  lastDataSuccess:target.manifest?.lastDataSuccess||target.manifest?.lastSync||null,
  verifiedAt:target.manifest?.verifiedAt||null,fullSize:target.manifest?.fullSize||0,
  notebooks:target.manifest?.notebooks||{},fullRevision:target.manifest?.fullRevision||null,
  verifiedEditableIds:target.verifiedEditableIds||[],verifiedPdfIds:target.verifiedPdfIds||[],syncManifestHash:target.syncGuardHash
 });
 const refreshPartial=(target,ids)=>{
  target.partial=ids.some(id=>{const entry=entryFor(target,id);return!entry?.pdf||entry.pdf.revision!==entry.editable?.revision;});
 };
 const begin=async command=>{
  if(session&&now()-session.started<300000)return{success:false,reason:'already-writing'};
  if(!command.jobId||!Array.isArray(command.metadata?.notebooks)||!Array.isArray(command.metadata?.folders))throw fault('invalid-backup-request');
  if(!command.backupDevice&&!command.metadata.notebooks.length&&!command.metadata.folders.length)return{success:false,reason:'empty-library'};
  session={id:command.jobId,started:now(),metadata:command.metadata,metadataRevision:command.metadataRevision,phase:command.phase||'all',
   targets:await resolveTargets(command),incoming:new Map()};
  for(const target of session.targets)await targetAction(target,async current=>{
   await verifyRoot(target.root);
   const rawManifest=await read(within(target.root,'Full_System/backup_manifest.json'));
   await configureSyncGuard(target,command,rawManifest,current);target.manifest=safeManifest(rawManifest);target.staging=true;
   if(target.backupDevice){
    if(target.manifest.backupDevice&&target.manifest.backupDevice.id!==target.backupDevice.id)throw fault('backup-device-mismatch');
    target.manifest.backupDevice=target.backupDevice;
   }
   target.acceptedReceives=command.acceptedReceives||{};target.clockAuthorized=new Set(target.backupDevice?command.metadata.notebooks.map(info=>info.id):[]);
   target.folderRestoreAuthorized=!!target.manifest.fullRevision&&command.folderReceives?.[target.root]===target.manifest.fullRevision||!!target.backupDevice;
   const estimated=Object.values(target.manifest.notebooks).reduce((sum,entry)=>sum+(entry.editable?.size||0),0);
   current.budget(estimated*4);
   target.prior=new Map();target.priorFingerprints=new Map();target.priorHashes=new Map();target.notebookIssues=Object.fromEntries(Object.entries(readNotebookIssues(target.manifest))
    .filter(([id])=>command.metadata.notebooks.some(info=>info.id===id)));target.verifiedEditableIds=[];target.verifiedPdfIds=[];
   const unchanged=target.manifest.fullRevision===command.metadataRevision&&await artifactMatches(target,fullArtifact(target),command.metadataRevision,{current});
   if(!unchanged){
    const raw=await read(within(target.root,fullRelative(target.manifest)));
    if(raw){const full=parse(raw);if(!fullValid(full))throw fault('invalid-existing-backup');
     for(const note of full.notebooks){target.prior.set(note.id,Number(note.updatedAt)||0);target.priorFingerprints.set(note.id,contentFingerprint(note));target.priorHashes.set(note.id,hash(JSON.stringify(note)));}
    }
   }
   if(target.syncDeviceId&&!unchanged){
    target.manifest.syncPending={deviceId:target.syncDeviceId,jobId:session.id,
     notebooks:target.manifest.syncPending?.deviceId===target.syncDeviceId?target.manifest.syncPending.notebooks||{}:{}};
    await saveManifest(target,current);
   }
   // Existing files remain untouched while this generation is being prepared.
   for(const info of command.metadata.notebooks){
    const entry=entryFor(target,info.id);
    if(!entry?.backupConflict&&await artifactMatches(target,entry?.editable,revision(info),{current}))target.verifiedEditableIds.push(info.id);
    if(entry?.pdf&&await artifactMatches(target,entry.pdf,entry.pdf.revision,{current}))target.verifiedPdfIds.push(info.id);
   }
  });
  const needsPdfIds=command.metadata.notebooks.filter(info=>command.forcePdf||session.targets.some(target=>
   !target.error&&(!target.verifiedPdfIds?.includes(info.id)||entryFor(target,info.id)?.pdf?.revision!==revision(info)))).map(info=>info.id);
  return{success:session.targets.some(target=>!target.error),jobId:session.id,needsPdfIds,targets:session.targets.map(targetResult)};
 };
 const reuse=async command=>{
  const info=command.notebook;
  if(!session||command.jobId!==session.id||!info?.id)throw fault('unknown-backup-job');
  session.incoming.set(info.id,header(info));
  for(const target of session.targets)await targetAction(target,async current=>{
   if(!await artifactMatches(target,entryFor(target,info.id)?.editable,revision(info),{current}))throw fault('editable-backup-changed');
   const receive=Object.hasOwn(target.acceptedReceives||{},info.id)?target.acceptedReceives[info.id]:null;
   if(target.syncExpected||receive&&path.resolve(receive.targetDir).toLowerCase()===target.root.toLowerCase()&&target.priorHashes.get(info.id)===receive.previousHash)target.clockAuthorized.add(info.id);
   await upgradeArtifactNames(target,info.id,current);
  });
  return{success:session.targets.some(target=>!target.error),targets:session.targets.map(targetResult)};
 };
 const notebook=async command=>{
  let bytes, note=command.notebook;
  if(command.notebookEncoded !== undefined){
   if(!(command.notebookEncoded instanceof ArrayBuffer)||!command.notebookEncoded.byteLength||command.notebookEncoded.byteLength>272*1048576)throw fault('invalid-notebook-snapshot');
   bytes=Buffer.from(command.notebookEncoded);
   try{note=parse(bytes);}catch(_){throw fault('invalid-notebook-snapshot');}
  }
  if(!session||command.jobId!==session.id||!noteValid(note)||!note.pages.length)throw fault('invalid-notebook-snapshot');
  bytes ||= Buffer.from(JSON.stringify(note));
  const token=revision(note),incomingHash=hash(bytes);
  session.incoming.set(note.id,header(note));
  for(const target of session.targets)await targetAction(target,async current=>{
   const old=entryFor(target,note.id)||{};
   if(!command.pdfBase64&&old.editable?.revision===token&&old.editable.hash===incomingHash&&await artifactMatches(target,old.editable,token,{current})){
    if(target.syncExpected&&old.backupConflict){delete old.backupConflict;delete target.notebookIssues[note.id];setEntry(target,note.id,old);await saveManifest(target,current);}
    await upgradeArtifactNames(target,note.id,current);return;
   }
   const stem=cleanName(note.name)+'--'+hash(note.id).slice(0,32);
   const oldRelative=old.editable?.path||path.join('Editable_Notes',stem+'.bnote'),existing=await read(within(target.root,oldRelative));
   const relative=path.join('Editable_Notes',cleanName(note.name)+'--'+incomingHash+'--'+hash(note.id).slice(0,32)+'.bnote');
   let authorized=!!target.backupDevice;
   if(target.syncExpected){
    if(!Object.hasOwn(target.syncExpected,note.id)||(existing?hash(existing):null)!==target.syncExpected[note.id])throw fault('backup-changed-externally');
    authorized=true;
   }else{
    const receive=Object.hasOwn(target.acceptedReceives||{},note.id)?target.acceptedReceives[note.id]:null;
    if(receive&&path.resolve(receive.targetDir).toLowerCase()===target.root.toLowerCase()&&existing&&
      (hash(existing)===receive.previousHash||hash(existing)===incomingHash&&target.priorHashes.get(note.id)===receive.previousHash))authorized=true;
   }
   if(authorized)target.clockAuthorized.add(note.id);
   if(!authorized&&(target.prior.get(note.id)||0)>(Number(note.updatedAt)||0))throw Object.assign(fault('newer-backup-exists'),{backupUpdatedAt:target.prior.get(note.id)});
   if(!authorized&&target.prior.has(note.id)&&target.prior.get(note.id)===(Number(note.updatedAt)||0)&&target.priorFingerprints.get(note.id)!==contentFingerprint(note))throw Object.assign(fault('conflicting-backup-revision'),{backupUpdatedAt:target.prior.get(note.id)});
   if(existing){const previous=parse(existing);
    if(!noteValid(previous)||previous.id!==note.id)throw fault('notebook-identity-mismatch');
    if(!authorized&&(Number(previous.updatedAt)||0)>(Number(note.updatedAt)||0))throw Object.assign(fault('newer-backup-exists'),{backupUpdatedAt:previous.updatedAt});
    if(!authorized&&(Number(previous.updatedAt)||0)===(Number(note.updatedAt)||0)&&contentFingerprint(previous)!==contentFingerprint(note))throw Object.assign(fault('conflicting-backup-revision'),{backupUpdatedAt:previous.updatedAt});
   }
   if(target.syncDeviceId){
    target.manifest.syncPending||={deviceId:target.syncDeviceId,jobId:session.id,notebooks:{}};
    Object.defineProperty(target.manifest.syncPending.notebooks,note.id,{enumerable:true,writable:true,configurable:true,value:{path:relative,previousHash:existing?hash(existing):null,nextHash:incomingHash}});
    await saveManifest(target,current);
   }
   const editable=await atomic(target.root,relative,bytes,buffer=>{try{return noteValid(parse(buffer))&&parse(buffer).id===note.id;}catch(_){return false;}},
    current,retention,{newValidated:true});
   const entry={...old,name:note.name,revision:token,updatedAt:note.updatedAt,pageCount:note.pages.length,
    editable:{...editable,revision:token,savedAt:editable.skipped?old.editable?.savedAt||now():now()}};
   const pdf=pdfBuffer(command.pdfBase64);
   if(pdf){
    const saved=await atomic(target.root,path.join('PDF_Documents',cleanName(note.name)+'--'+hash(pdf)+'--'+hash(note.id).slice(0,32)+'.pdf'),pdf,
     buffer=>buffer.subarray(0,5).equals(Buffer.from('%PDF-')),current);
    entry.pdf={...saved,revision:token,contentRevision:command.pdfRevision,savedAt:now()};entry.pdfError=null;
   }else if(entry.pdf&&entry.pdf.contentRevision===command.pdfRevision&&await artifactMatches(target,entry.pdf,entry.pdf.revision,{current})){
    entry.pdf={...entry.pdf,revision:token};entry.pdfError=null;
   }else{target.partial=true;entry.pdfError=command.pdfError||'pending';}
   if(old.editable?.path!==entry.editable.path||old.pdf?.path!==entry.pdf?.path)target.namesUpgraded=true;
   delete entry.backupConflict;delete target.notebookIssues[note.id];
   setEntry(target,note.id,entry);await saveManifest(target,current);
  },{sizeHint:bytes.length*4,notebookInfo:note});
  return{success:session.targets.some(target=>!target.error),targets:session.targets.map(targetResult)};
 };
 const finish=async command=>{
  if(!session||command.jobId!==session.id)throw fault('unknown-backup-job');
  const job=session,version=command.metadataRevision||job.metadataRevision;
  try{
   for(const target of job.targets)await targetAction(target,async current=>{
    // Leave the complete snapshot unchanged until every notebook is safe to include.
    if(hasNotebookIssues(target))return;
    if(job.incoming.size!==job.metadata.notebooks.length)throw fault('incomplete-notebook-set');
    for(const[id,info]of job.incoming)if(!await artifactMatches(target,entryFor(target,id)?.editable,revision(info),{current}))throw fault('incomplete-editable-backup');
    const ids=[...job.incoming.keys()];refreshPartial(target,ids);
    const scopeHash=hash(JSON.stringify([[...job.metadata.folders].sort((a,b)=>String(a.id).localeCompare(String(b.id))),
     [...job.incoming.keys()].sort().map(id=>[id,entryFor(target,id)?.editable?.hash])]));
    const alreadyCurrent=target.manifest.fullScopeHash===scopeHash&&target.manifest.fullRevision===version&&await artifactMatches(target,fullArtifact(target),version,{current});
    let completedSnapshotIds;
    const priorCompletedAt=target.manifest.lastDataSuccess||0;
    if(!alreadyCurrent){
     const fullPath=within(target.root,fullRelative(target.manifest));
     current.budget(((await stat(fullPath))?.size||0)*6);
     const previousRaw=await read(fullPath);
     current.budget((previousRaw?.length||0)*6);
     if(previousRaw&&target.manifest.fullHash&&hash(previousRaw)!==target.manifest.fullHash)throw fault('backup-changed-externally');
     const previous=previousRaw?parse(previousRaw):{notebooks:[],folders:[]};
     if(!fullValid(previous))throw fault('invalid-existing-backup');
     const merged=new Map(previous.notebooks.map(note=>[note.id,note]));
     for(const[id,info]of job.incoming){
      const artifact=entryFor(target,id)?.editable,old=merged.get(id);let note=old;
      if(!old||hash(JSON.stringify(old))!==artifact.hash)note=parse(await fs.readFile(within(target.root,artifact.path)));
      if(!noteValid(note)||note.id!==id)throw fault('incomplete-editable-backup');
      if(old&&!target.clockAuthorized?.has(id)&&(Number(old.updatedAt)||0)>(Number(note.updatedAt)||0))throw fault('newer-backup-exists');
      if(old&&!target.clockAuthorized?.has(id)&&(Number(old.updatedAt)||0)===(Number(note.updatedAt)||0)&&contentFingerprint(old)!==contentFingerprint(note))throw fault('conflicting-backup-revision');
      merged.set(id,note);
     }
     const {reconcileFolders,folderToken}=await import('./folderSyncProtocol.js');
     const previousFolders=new Map((previous.folders||[]).map(folder=>[folder.id,folder]));
     const expectedFolders=new Map((target.syncFolders||[]).map(folder=>[folder.id,folderToken(folder)]));
     const ancestry=Object.create(null);
     for(const folder of job.metadata.folders){
      const old=previousFolders.get(folder.id);
      const accepted=target.folderRestoreAuthorized||old&&expectedFolders.get(folder.id)===folderToken(old);
      if(old&&!accepted&&(Number(old.updatedAt)||0)>(Number(folder.updatedAt)||0)&&!folder.permanentlyDeleted)throw fault('folder-backup-newer');
      if(accepted&&old)ancestry[folder.id]={local:folderToken(old),remote:null};
     }
     const folders=target.backupDevice?job.metadata.folders:reconcileFolders(previous.folders||[],job.metadata.folders,ancestry).folders;
     if(target.backupDevice)for(const id of merged.keys())if(!job.incoming.has(id))merged.delete(id);
     const full={version:1,appName:'BetterNote',exportDate:new Date(now()).toISOString(),folders,notebooks:[...merged.values()],...(target.backupDevice?{backupDevice:target.backupDevice,deletedNotebooks:job.metadata.deletedNotebooks||[]}: {})};
     const fullBytes=Buffer.from(JSON.stringify(full)),relative=path.join('Full_System','Backup--'+hash(fullBytes)+'.json');
     const saved=await atomic(target.root,relative,fullBytes,
      buffer=>{try{return fullValid(parse(buffer));}catch(_){return false;}},current,retention,
      {newValidated:true});
     target.manifest.fullPath=relative;
     target.manifest.fullHash=saved.hash;target.manifest.fullSize=saved.size;
     completedSnapshotIds=new Set(full.notebooks.map(note=>note.id));
     target.manifest.lastDataSuccess=now();target.manifest.generation=(Number(target.manifest.generation)||0)+1;
    }else target.manifest.lastDataSuccess||=target.manifest.lastSync||now();
    const activeIds=new Set(ids),retiredIds=[];
    for(const[id,entry]of Object.entries(target.manifest.notebooks)){
     if(activeIds.has(id)||!entry.editable?.path||!Number.isFinite(entry.editable.savedAt)||
       entry.editable.savedAt>priorCompletedAt||entry.editable.savedAt<=0)continue;
     if(await stat(within(target.root,entry.editable.path)))continue;
     if(!completedSnapshotIds){
      const fullPath=within(target.root,fullRelative(target.manifest));
      current.budget(((await stat(fullPath))?.size||0)*6);
      const raw=await read(fullPath);
      if(!raw||hash(raw)!==target.manifest.fullHash)throw fault('backup-changed-externally');
      const full=parse(raw);if(!fullValid(full))throw fault('invalid-existing-backup');
      completedSnapshotIds=new Set(full.notebooks.map(note=>note.id));
     }
     if(!completedSnapshotIds.has(id))retiredIds.push(id);
    }
    // Repair metadata only: retained notebook files and history are never deleted here.
    for(const id of retiredIds)delete target.manifest.notebooks[id];
    if(target.backupDevice)for(const id of Object.keys(target.manifest.notebooks))if(!activeIds.has(id))delete target.manifest.notebooks[id];
    if(target.backupDevice)target.manifest.deletedNotebooks=job.metadata.deletedNotebooks||[];
    const wasPending=!!target.manifest.syncPending;delete target.manifest.syncPending;
    target.manifest.syncFolders=job.metadata.folders;
    target.manifest.fullScopeHash=scopeHash;target.manifest.fullRevision=version;target.manifest.activeIds=ids;target.manifest.verifiedAt=now();
    if(!target.partial)target.manifest.lastSync=target.manifest.lastDataSuccess;
    target.staging=false;
    if(!alreadyCurrent||retiredIds.length||wasPending||target.namesUpgraded)await saveManifest(target,current);
    else await archiveOldFiles(target,current,await manifestHistory(target.root)).catch(()=>{});
    // A readable convenience copy is not used as the commit record.
    const committedBytes=await read(within(target.root,fullRelative(target.manifest)));
    if(committedBytes)await atomic(target.root,'Full_System/BetterNote_Latest_Backup.json',committedBytes,null,current,retention).catch(()=>{});
   });
   const targets=job.targets.map(targetResult),dataSuccess=targets.length>0&&targets.every(target=>target.dataSuccess);
   return{success:job.phase==='data'?dataSuccess:targets.length>0&&targets.every(target=>target.success),
    dataSuccess,pdfComplete:targets.every(target=>target.success),partial:targets.some(target=>target.success||target.partial),
    targets,timestamp:now(),folderWritten:dataSuccess,cloudUploadVerified:false};
  }finally{session=null;}
 };
 const pdf=async command=>{
  if(session)return{success:false,reason:'data-backup-in-progress'};
  if(!command.notebookId||!command.revision)throw fault('invalid-pdf-request');
  const targets=await resolveTargets(command);
  for(const target of targets)await targetAction(target,async current=>{
   await verifyRoot(target.root);
   const rawManifest=await read(within(target.root,'Full_System/backup_manifest.json'));
   await configureSyncGuard(target,command,rawManifest,current);target.manifest=safeManifest(rawManifest);
   const entry=entryFor(target,command.notebookId);
   if(target.syncExpected&&entry?.editable?.hash!==target.syncExpected[command.notebookId])throw fault('pdf-backup-superseded');
   if(command.blockedNotebookTargets?.includes(target.root))return;
   if(entry?.editable?.revision!==command.revision)throw fault('pdf-backup-superseded');
   if(command.pdfError){setEntry(target,command.notebookId,{...entry,pdfError:command.pdfError});target.pdfError=command.pdfError;await saveManifest(target,current);return;}
   // A new destination can need a PDF while another already has its verified copy.
   // Keep the existing copy byte-for-byte unless an explicit rebuild was requested.
   if(!command.forcePdf&&entry.pdf?.revision===command.revision&&entry.pdf.contentRevision===command.pdfRevision&&await artifactMatches(target,entry.pdf,command.revision,{current}))return;
   const bytes=command.pdfBytes instanceof ArrayBuffer ? Buffer.from(command.pdfBytes) : pdfBuffer(command.pdfBase64);if(!bytes||bytes.length>272*1048576||!bytes.subarray(0,5).equals(Buffer.from('%PDF-'))||!bytes.subarray(-1024).includes(Buffer.from('%%EOF')))throw fault('invalid-pdf');
   const stem=cleanName(entry.name)+'--'+hash(command.notebookId).slice(0,32);
   const saved=await atomic(target.root,path.join('PDF_Documents',cleanName(entry.name)+'--'+hash(bytes)+'--'+hash(command.notebookId).slice(0,32)+'.pdf'),bytes,
    buffer=>buffer.subarray(0,5).equals(Buffer.from('%PDF-')),current);
   setEntry(target,command.notebookId,{...entry,pdfError:null,pdf:{...saved,revision:command.revision,contentRevision:command.pdfRevision,savedAt:now()}});
   refreshPartial(target,target.manifest.activeIds||Object.keys(target.manifest.notebooks));
   if(!target.partial)target.manifest.lastSync=now();
   await saveManifest(target,current);
  },{errorField:'pdfError',sizeHint:typeof command.pdfBase64==='string'?command.pdfBase64.length*3:0});
  for(const target of targets){if(!target.manifest)continue;refreshPartial(target,target.manifest.activeIds||Object.keys(target.manifest.notebooks));}
  return{success:targets.length>0&&targets.every(target=>!target.pdfError),targets:targets.map(targetResult),cloudUploadVerified:false};
 };
 const inspect=async command=>{
  const targets=await resolveTargets(command),files=[];
  for(const target of targets)await targetAction(target,async current=>{
   await verifyRoot(target.root);target.manifest=safeManifest(await read(within(target.root,'Full_System/backup_manifest.json')));
   target.manifest={...target.manifest,notebooks:JSON.parse(JSON.stringify(target.manifest.notebooks))};
   for(const entry of Object.values(target.manifest.notebooks))for(const kind of ['editable','pdf']){
    const artifact=entry[kind];
    if(artifact&&!await artifactMatches(target,artifact,artifact.revision,{deep:!!command.deepVerify,current})){
     entry[kind]={...artifact,revision:null};if(kind==='pdf')entry.pdfError='backup-file-unavailable';target.partial=true;
    }
   }
   if(target.manifest.fullHash&&!await artifactMatches(target,fullArtifact(target),target.manifest.fullRevision,{deep:!!command.deepVerify,current})){
    target.manifest.fullRevision=null;target.partial=true;
   }
   if(!command.includeFiles)return;
   const addFile=async({id,name,relative,kind,token,legacy=false,pageCount})=>{
    const file=within(target.root,relative),value=await stat(file);if(!value?.isFile())return;
    files.push({notebookId:id||null,notebookName:name,fileName:path.basename(file),fullPath:file,relativeFolder:path.dirname(relative),
     targetDir:target.root,roles:target.roles,fileSizeBytes:value.size,formattedSize:formatSize(value.size),lastModified:value.mtimeMs,
     pageCount,kind,revision:token||null,legacy,pdfError:kind==='pdf'?entryFor(target,id)?.pdfError||null:null});
   };
   for(const[id,entry]of Object.entries(target.manifest.notebooks))for(const kind of ['editable','pdf']){
    const artifact=entry[kind];if(artifact?.path)await addFile({id,name:entry.name,relative:artifact.path,kind,token:artifact.revision,pageCount:entry.pageCount});
   }
   if(command.includeLegacy!==false){
    const listed=new Set(files.filter(file=>file.targetDir===target.root).map(file=>file.fullPath.toLowerCase()));
    for(const[directory,extension,kind]of [['Editable_Notes','.bnote','editable'],['PDF_Documents','.pdf','pdf'],[path.join('Backup_History','Editable_Notes'),'.bnote','editable'],[path.join('Backup_History','PDF_Documents'),'.pdf','pdf']]){
     const names=await fs.readdir(within(target.root,directory)).catch(error=>{if(error.code==='ENOENT')return[];throw error;});
     for(const name of names.filter(name=>name.toLowerCase().endsWith(extension))){
      const file=within(target.root,path.join(directory,name));if(listed.has(file.toLowerCase()))continue;
      let legacy=null;
      if(kind==='editable'){try{const value=parse(await fs.readFile(file));if(noteValid(value))legacy=value;}catch(_){}}
      await addFile({id:legacy?.id,name:legacy?.name||path.basename(name,extension),relative:path.join(directory,name),kind,legacy:true,pageCount:legacy?.pages.length});
     }
    }
   }
   await addFile({id:'full_system_backup',name:'Full System JSON',relative:fullRelative(target.manifest),kind:'system',token:target.manifest.fullRevision});
  });
  const local=targets.find(target=>target.roles.includes('local'));
  return{success:targets.some(target=>!target.error),targets:targets.map(targetResult),files,documentsDir:path.resolve(localDir),
   targetDir:local?.root||path.resolve(localDir),isGoogleDrive:false,lastSync:local?.manifest?.lastDataSuccess||local?.manifest?.lastSync||null,
   totalFiles:files.length,totalSizeBytes:files.reduce((sum,file)=>sum+file.fileSizeBytes,0),
   formattedTotalSize:formatSize(files.reduce((sum,file)=>sum+file.fileSizeBytes,0)),exists:files.length>0,cloudUploadVerified:false};
 };
 const formatSize=bytes=>bytes>=1048576?(bytes/1048576).toFixed(1)+' MB':(bytes/1024).toFixed(1)+' KB';
 const prune=async command=>{
  if(!Array.isArray(command.notebookIds)||!command.notebookIds.length||command.notebookIds.some(id=>typeof id!=='string'||!id))throw fault('notebook-id-required');
  if(session)return{success:false,reason:'already-writing'};
  const ids=new Set(command.notebookIds),targets=await resolveTargets(command);
  for(const target of targets)await targetAction(target,async current=>{
   const rawManifest=await read(within(target.root,'Full_System/backup_manifest.json'));
   await configureSyncGuard(target,command,rawManifest,current);target.manifest=safeManifest(rawManifest);
   const relative=fullRelative(target.manifest),fullPath=within(target.root,relative);target.staging=true;
   current.budget(((await stat(fullPath))?.size||0)*8);
   const raw=await read(fullPath);if(raw&&target.manifest.fullHash&&hash(raw)!==target.manifest.fullHash)throw fault('backup-changed-externally');const full=raw?parse(raw):null;
   if(full&&!fullValid(full))throw fault('invalid-existing-backup');
   const folder=within(target.root,'Editable_Notes'),toRemove=[];
   const names=await fs.readdir(folder).catch(error=>{if(error.code==='ENOENT')return[];throw error;});
   for(const name of names.filter(name=>name.endsWith('.bnote'))){
    const file=within(target.root,path.join('Editable_Notes',name)),note=parse(await fs.readFile(file));
    if(!noteValid(note))throw fault('invalid-existing-backup');if(ids.has(note.id)){
     if(target.syncExpected&&entryFor(target,note.id)?.editable?.path===path.join('Editable_Notes',name)&&(!Object.hasOwn(target.syncExpected,note.id)||hash(await fs.readFile(file))!==target.syncExpected[note.id]))throw fault('backup-changed-externally');
     toRemove.push(file);
    }
   }
   for(const id of ids){const artifact=entryFor(target,id)?.pdf;if(artifact?.path)toRemove.push(within(target.root,artifact.path));}
   if(target.syncDeviceId){target.manifest.syncPending={deviceId:target.syncDeviceId,jobId:'prune',notebooks:{}};await saveManifest(target,current);}
   if(full){full.notebooks=full.notebooks.filter(note=>!ids.has(note.id));const fullBytes=Buffer.from(JSON.stringify(full)),nextRelative=path.join('Full_System','Backup--'+hash(fullBytes)+'.json');const saved=await atomic(target.root,nextRelative,fullBytes,
    buffer=>{try{return fullValid(parse(buffer));}catch(_){return false;}},current,retention,{newValidated:true});target.manifest.fullPath=nextRelative;
    target.manifest.fullHash=saved.hash;target.manifest.fullSize=saved.size;
   }
   for(const id of ids)delete target.manifest.notebooks[id];
   if(Array.isArray(target.manifest.activeIds))target.manifest.activeIds=target.manifest.activeIds.filter(id=>!ids.has(id));
   if(full){
    const rows=[...(full.folders||[])].sort((a,b)=>String(a.id).localeCompare(String(b.id))).map(folder=>[folder.id,folder.name,folder.parentId||null,folder.updatedAt||0,!!folder.isDeleted,folder.color,folder.icon,!!folder.isFavorite,!!folder.permanentlyDeleted,folder.createdAt||0,folder.restoreParentId||null]);
    const active=new Set(target.manifest.activeIds||Object.keys(target.manifest.notebooks));
    target.manifest.fullRevision=JSON.stringify([JSON.stringify(rows),full.notebooks.filter(note=>active.has(note.id)).sort((a,b)=>String(a.id).localeCompare(String(b.id))).map(revision)]);
    target.manifest.syncFolders=full.folders||[];target.manifest.lastDataSuccess=now();target.manifest.generation=(Number(target.manifest.generation)||0)+1;delete target.manifest.fullScopeHash;
   }else target.manifest.fullRevision=null;
   delete target.manifest.syncPending;target.staging=false;await saveManifest(target,current);
   if(full)await atomic(target.root,'Full_System/BetterNote_Latest_Backup.json',Buffer.from(JSON.stringify(full)),null,current,retention).catch(()=>{});
   for(const file of toRemove){if(!current())throw fault('backup-cancelled');await current.beforeInstall?.();await fs.unlink(file).catch(error=>{if(error.code!=='ENOENT')throw error;});digestCache.delete(file.toLowerCase());}
  });
  return{success:targets.every(target=>!target.error),targets:targets.map(targetResult)};
 };
 const execute=(command,onProgress=()=>{})=>{
  const result=sequence.then(async()=>{
   report=onProgress;activeCommand=command;
   try{
    if(command.action==='begin')return await begin(command);
    if(command.action==='reuse')return await reuse(command);
    if(command.action==='notebook')return await notebook(command);
    if(command.action==='finish')return await finish(command);
    if(command.action==='pdf')return await pdf(command);
    if(command.action==='inspect')return await inspect(command);
    if(command.action==='prune')return await prune(command);
    if(command.action==='abort'&&session?.id===command.jobId){session=null;return{success:true};}
    throw fault('unsupported-backup-action');
   }catch(error){return{success:false,reason:error.code||error.message};}
   finally{report=()=>{};activeCommand=null;}
  });
  sequence=result.catch(()=>{});return result;
 };
 return{execute,atomic,resolveTargets};
}
module.exports={createBackupWriter,notebookBackupRevision:revision};
