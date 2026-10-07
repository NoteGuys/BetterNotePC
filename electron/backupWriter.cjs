// Runs inside a Node worker. Disk I/O and JSON serialization never run in the Electron UI process.
const nodeFs=require('node:fs').promises,path=require('node:path');
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
 const atomic=async(root,relative,bytes,validate,current=()=>true,keep=retention,options={})=>{
  const file=within(root,relative),previous=Object.hasOwn(options,'previous')?options.previous:await read(file);
  current.budget?.((bytes.length+(previous?.length||0))*4);
  if(previous&&validate&&!options.previousValidated&&!validate(previous))throw fault('invalid-existing-backup');
  if(validate&&!options.newValidated&&!validate(bytes))throw fault('invalid-new-backup');
  if(previous&&previous.equals(bytes)){
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
    const history=within(root,path.join(path.dirname(relative),'.history',path.basename(relative)));
    await fs.mkdir(history,{recursive:true});const archive=path.join(history,hash(previous)+'.previous');
    if(!await read(archive)){
     const archived=await fs.open(archive,'wx');
     try{await writeBytes(archived,previous,current,{stage:'keeping-version',fileName:path.basename(file),targetDir:root});}
     finally{await archived.close();}
    }
    if(!(await fs.readFile(archive)).equals(previous))throw fault('history-verification-failed');
   }
   await beforeReplace({file,temporary,relative});
   if(!current())throw fault('backup-cancelled');
   const latest=await read(file);
   if(!!latest!==!!previous||(latest&&!latest.equals(previous)))throw fault('backup-changed-externally');
   await fs.rename(temporary,file);installed=true;
   await verifyInstalled(file,bytes);
   const digest=hash(bytes);
   if(previous&&keep){
    const history=within(root,path.join(path.dirname(relative),'.history',path.basename(relative)));
    const stamp=new Date(now());await fs.utimes(path.join(history,hash(previous)+'.previous'),stamp,stamp);
    const archives=(await fs.readdir(history)).filter(name=>name.endsWith('.previous'));
    const dated=await Promise.all(archives.map(async name=>({name,time:(await fs.stat(path.join(history,name))).mtimeMs})));
    dated.sort((a,b)=>b.time-a.time||b.name.localeCompare(a.name));
    for(const old of dated.slice(keep))await fs.unlink(path.join(history,old.name));
   }
   emit({stage:'verified',fileName:path.basename(file),targetDir:root,bytesDone:bytes.length,totalBytes:bytes.length});
   return{path:relative,hash:digest,size:bytes.length,skipped:false};
  }finally{if(!installed)await fs.unlink(temporary).catch(()=>{});}
 };
 const saveManifest=(target,current)=>atomic(target.root,'Full_System/backup_manifest.json',
  Buffer.from(JSON.stringify(target.manifest)),buffer=>{try{return!!safeManifest(buffer);}catch(_){return false;}},current,0);
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
 const fullArtifact=target=>({path:'Full_System/BetterNote_Latest_Backup.json',hash:target.manifest.fullHash,
  size:target.manifest.fullSize,revision:target.manifest.fullRevision});
 const targetResult=target=>({
  targetDir:target.root,kind:target.kind,roles:target.roles||[target.kind],success:!target.error&&!hasNotebookIssues(target)&&!target.partial,
  dataSuccess:!target.error&&!hasNotebookIssues(target)&&!!target.manifest?.fullRevision,error:target.error||null,
  notebookIssues:target.notebookIssues||target.manifest&&readNotebookIssues(target.manifest)||{},partial:!!target.partial||hasNotebookIssues(target),
  pdfError:target.pdfError||null,lastSuccess:target.manifest?.lastSync||null,
  lastDataSuccess:target.manifest?.lastDataSuccess||target.manifest?.lastSync||null,
  verifiedAt:target.manifest?.verifiedAt||null,fullSize:target.manifest?.fullSize||0,
  notebooks:target.manifest?.notebooks||{},fullRevision:target.manifest?.fullRevision||null,
  verifiedEditableIds:target.verifiedEditableIds||[],verifiedPdfIds:target.verifiedPdfIds||[]
 });
 const refreshPartial=(target,ids)=>{
  target.partial=ids.some(id=>{const entry=entryFor(target,id);return!entry?.pdf||entry.pdf.revision!==entry.editable?.revision;});
 };
 const begin=async command=>{
  if(session&&now()-session.started<300000)return{success:false,reason:'already-writing'};
  if(!command.jobId||!Array.isArray(command.metadata?.notebooks)||!Array.isArray(command.metadata?.folders))throw fault('invalid-backup-request');
  if(!command.metadata.notebooks.length&&!command.metadata.folders.length)return{success:false,reason:'empty-library'};
  session={id:command.jobId,started:now(),metadata:command.metadata,metadataRevision:command.metadataRevision,phase:command.phase||'all',
   targets:await resolveTargets(command),incoming:new Map()};
  for(const target of session.targets)await targetAction(target,async current=>{
   await verifyRoot(target.root);target.manifest=safeManifest(await read(within(target.root,'Full_System/backup_manifest.json')));
   const estimated=Object.values(target.manifest.notebooks).reduce((sum,entry)=>sum+(entry.editable?.size||0),0);
   current.budget(estimated*4);
   target.prior=new Map();target.priorFingerprints=new Map();target.notebookIssues=Object.fromEntries(Object.entries(readNotebookIssues(target.manifest))
    .filter(([id])=>command.metadata.notebooks.some(info=>info.id===id)));target.verifiedEditableIds=[];target.verifiedPdfIds=[];
   const unchanged=target.manifest.fullRevision===command.metadataRevision&&await artifactMatches(target,fullArtifact(target),command.metadataRevision,{current});
   if(!unchanged){
    const raw=await read(within(target.root,'Full_System/BetterNote_Latest_Backup.json'));
    if(raw){const full=parse(raw);if(!fullValid(full))throw fault('invalid-existing-backup');
     for(const note of full.notebooks){target.prior.set(note.id,Number(note.updatedAt)||0);target.priorFingerprints.set(note.id,contentFingerprint(note));}
    }
   }
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
  });
  return{success:session.targets.some(target=>!target.error),targets:session.targets.map(targetResult)};
 };
 const notebook=async command=>{
  const note=command.notebook;
  if(!session||command.jobId!==session.id||!noteValid(note)||!note.pages.length)throw fault('invalid-notebook-snapshot');
  const token=revision(note),bytes=Buffer.from(JSON.stringify(note)),incomingHash=hash(bytes);
  session.incoming.set(note.id,header(note));
  for(const target of session.targets)await targetAction(target,async current=>{
   if((target.prior.get(note.id)||0)>(Number(note.updatedAt)||0))throw Object.assign(fault('newer-backup-exists'),{backupUpdatedAt:target.prior.get(note.id)});
   if(target.prior.has(note.id)&&target.prior.get(note.id)===(Number(note.updatedAt)||0)&&target.priorFingerprints.get(note.id)!==contentFingerprint(note))throw Object.assign(fault('conflicting-backup-revision'),{backupUpdatedAt:target.prior.get(note.id)});
   const old=entryFor(target,note.id)||{};
   if(!command.pdfBase64&&old.editable?.revision===token&&old.editable.hash===incomingHash&&await artifactMatches(target,old.editable,token,{current}))return;
   const stem='Notebook-'+cleanName(note.name)+'--'+hash(note.id).slice(0,32);
   const relative=old.editable?.path||path.join('Editable_Notes',stem+'.bnote'),existing=await read(within(target.root,relative));
   if(existing){const previous=parse(existing);
    if(!noteValid(previous)||previous.id!==note.id)throw fault('notebook-identity-mismatch');
    if((Number(previous.updatedAt)||0)>(Number(note.updatedAt)||0))throw Object.assign(fault('newer-backup-exists'),{backupUpdatedAt:previous.updatedAt});
    if((Number(previous.updatedAt)||0)===(Number(note.updatedAt)||0)&&contentFingerprint(previous)!==contentFingerprint(note))throw Object.assign(fault('conflicting-backup-revision'),{backupUpdatedAt:previous.updatedAt});
   }
   const editable=await atomic(target.root,relative,bytes,buffer=>{try{return noteValid(parse(buffer))&&parse(buffer).id===note.id;}catch(_){return false;}},
    current,retention,{previous:existing,previousValidated:true,newValidated:true});
   const entry={...old,name:note.name,revision:token,updatedAt:note.updatedAt,pageCount:note.pages.length,
    editable:{...editable,revision:token,savedAt:editable.skipped?old.editable?.savedAt||now():now()}};
   const pdf=pdfBuffer(command.pdfBase64);
   if(pdf){
    const saved=await atomic(target.root,old.pdf?.path||path.join('PDF_Documents',stem+'.pdf'),pdf,
     buffer=>buffer.subarray(0,5).equals(Buffer.from('%PDF-')),current);
    entry.pdf={...saved,revision:token,contentRevision:command.pdfRevision,savedAt:now()};entry.pdfError=null;
   }else if(entry.pdf?.contentRevision===command.pdfRevision&&await artifactMatches(target,entry.pdf,entry.pdf.revision,{current})){
    entry.pdf={...entry.pdf,revision:token};entry.pdfError=null;
   }else{target.partial=true;entry.pdfError=command.pdfError||'pending';}
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
     const fullPath=within(target.root,'Full_System/BetterNote_Latest_Backup.json');
     current.budget(((await stat(fullPath))?.size||0)*6);
     const previousRaw=await read(fullPath);
     current.budget((previousRaw?.length||0)*6);
     const previous=previousRaw?parse(previousRaw):{notebooks:[],folders:[]};
     if(!fullValid(previous))throw fault('invalid-existing-backup');
     const merged=new Map(previous.notebooks.map(note=>[note.id,note]));
     for(const[id,info]of job.incoming){
      const artifact=entryFor(target,id)?.editable,old=merged.get(id);let note=old;
      if(!old||hash(JSON.stringify(old))!==artifact.hash)note=parse(await fs.readFile(within(target.root,artifact.path)));
      if(!noteValid(note)||note.id!==id)throw fault('incomplete-editable-backup');
      if(old&&(Number(old.updatedAt)||0)>(Number(note.updatedAt)||0))throw fault('newer-backup-exists');
      if(old&&(Number(old.updatedAt)||0)===(Number(note.updatedAt)||0)&&contentFingerprint(old)!==contentFingerprint(note))throw fault('conflicting-backup-revision');
      merged.set(id,note);
     }
     const folders=new Map((previous.folders||[]).map(folder=>[folder.id,folder]));
     for(const folder of job.metadata.folders){
      const old=folders.get(folder.id);if(old&&(Number(old.updatedAt)||0)>(Number(folder.updatedAt)||0))throw fault('newer-backup-exists');folders.set(folder.id,folder);
     }
     const full={version:1,appName:'BetterNote',exportDate:new Date(now()).toISOString(),folders:[...folders.values()],notebooks:[...merged.values()]};
     const saved=await atomic(target.root,'Full_System/BetterNote_Latest_Backup.json',Buffer.from(JSON.stringify(full)),
      buffer=>{try{return fullValid(parse(buffer));}catch(_){return false;}},current,retention,
      {previous:previousRaw,previousValidated:true,newValidated:true});
     target.manifest.fullHash=saved.hash;target.manifest.fullSize=saved.size;
     completedSnapshotIds=new Set(full.notebooks.map(note=>note.id));
     target.manifest.lastDataSuccess=now();
    }else target.manifest.lastDataSuccess||=target.manifest.lastSync||now();
    const activeIds=new Set(ids),retiredIds=[];
    for(const[id,entry]of Object.entries(target.manifest.notebooks)){
     if(activeIds.has(id)||!entry.editable?.path||!Number.isFinite(entry.editable.savedAt)||
       entry.editable.savedAt>priorCompletedAt||entry.editable.savedAt<=0)continue;
     if(await stat(within(target.root,entry.editable.path)))continue;
     if(!completedSnapshotIds){
      const fullPath=within(target.root,'Full_System/BetterNote_Latest_Backup.json');
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
    target.manifest.fullScopeHash=scopeHash;target.manifest.fullRevision=version;target.manifest.activeIds=ids;target.manifest.verifiedAt=now();
    if(!target.partial)target.manifest.lastSync=target.manifest.lastDataSuccess;
    if(!alreadyCurrent||retiredIds.length)await saveManifest(target,current);
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
   await verifyRoot(target.root);target.manifest=safeManifest(await read(within(target.root,'Full_System/backup_manifest.json')));
   const entry=entryFor(target,command.notebookId);
   if(command.blockedNotebookTargets?.includes(target.root))return;
   if(entry?.editable?.revision!==command.revision)throw fault('pdf-backup-superseded');
   if(command.pdfError){setEntry(target,command.notebookId,{...entry,pdfError:command.pdfError});target.pdfError=command.pdfError;await saveManifest(target,current);return;}
   const bytes=pdfBuffer(command.pdfBase64);if(!bytes)throw fault('invalid-pdf');
   const stem='Notebook-'+cleanName(entry.name)+'--'+hash(command.notebookId).slice(0,32);
   const saved=await atomic(target.root,entry.pdf?.path||path.join('PDF_Documents',stem+'.pdf'),bytes,
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
    for(const[directory,extension,kind]of [['Editable_Notes','.bnote','editable'],['PDF_Documents','.pdf','pdf']]){
     const names=await fs.readdir(within(target.root,directory)).catch(error=>{if(error.code==='ENOENT')return[];throw error;});
     for(const name of names.filter(name=>name.toLowerCase().endsWith(extension))){
      const file=within(target.root,path.join(directory,name));if(listed.has(file.toLowerCase()))continue;
      let legacy=null;
      if(kind==='editable'){try{const value=parse(await fs.readFile(file));if(noteValid(value))legacy=value;}catch(_){}}
      await addFile({id:legacy?.id,name:legacy?.name||path.basename(name,extension),relative:path.join(directory,name),kind,legacy:true,pageCount:legacy?.pages.length});
     }
    }
   }
   await addFile({id:'full_system_backup',name:'Full System JSON',relative:'Full_System/BetterNote_Latest_Backup.json',kind:'system',token:target.manifest.fullRevision});
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
   target.manifest=safeManifest(await read(within(target.root,'Full_System/backup_manifest.json')));
   const relative='Full_System/BetterNote_Latest_Backup.json',fullPath=within(target.root,relative);
   current.budget(((await stat(fullPath))?.size||0)*8);
   const raw=await read(fullPath),full=raw?parse(raw):null;
   if(full&&!fullValid(full))throw fault('invalid-existing-backup');
   const folder=within(target.root,'Editable_Notes'),toRemove=[];
   const names=await fs.readdir(folder).catch(error=>{if(error.code==='ENOENT')return[];throw error;});
   for(const name of names.filter(name=>name.endsWith('.bnote'))){
    const file=within(target.root,path.join('Editable_Notes',name)),note=parse(await fs.readFile(file));
    if(!noteValid(note))throw fault('invalid-existing-backup');if(ids.has(note.id))toRemove.push(file);
   }
   for(const id of ids){const artifact=entryFor(target,id)?.pdf;if(artifact?.path)toRemove.push(within(target.root,artifact.path));}
   if(full){full.notebooks=full.notebooks.filter(note=>!ids.has(note.id));const saved=await atomic(target.root,relative,Buffer.from(JSON.stringify(full)),
    buffer=>{try{return fullValid(parse(buffer));}catch(_){return false;}},current,retention,{previous:raw,previousValidated:true,newValidated:true});
    target.manifest.fullHash=saved.hash;target.manifest.fullSize=saved.size;
   }
   for(const id of ids)delete target.manifest.notebooks[id];
   if(Array.isArray(target.manifest.activeIds))target.manifest.activeIds=target.manifest.activeIds.filter(id=>!ids.has(id));
   target.manifest.fullRevision=null;await saveManifest(target,current);
   for(const file of toRemove){if(!current())throw fault('backup-cancelled');await fs.unlink(file).catch(error=>{if(error.code!=='ENOENT')throw error;});digestCache.delete(file.toLowerCase());}
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
