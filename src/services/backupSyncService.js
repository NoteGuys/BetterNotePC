import { getSetting, saveSetting, getBackupMetadata } from './db.js';
import { getLocalSaveSnapshot } from './localSaveService.js';
import { restoreBackup, isRecoveryEditorActive, subscribeRecoveryEditor } from './backupRecoveryService.js';
import { DRIVE_SYNC_BASE_KEY, freshSyncBase } from './backupSyncCore.js';
import { syncPathKey, syncRevision, syncCandidates, syncWriteGuard } from '../../electron/backupSyncProtocol.js';
import { folderToken } from '../../electron/folderSyncProtocol.js';
import { t } from './i18n.js';
const configured = async () => await getSetting('gdrive_backup_method') === 'desktop' ? await getSetting('gdrive_backup_path') : null;
const role = (target,kind) => (target.roles || [target.kind]).includes(kind);
export const createDriveSyncService = ({ kind = 'drive', read = (folder,options) => window.electronAPI?.scanBackupFolder?.(folder,options),
  capabilities = () => window.electronAPI?.getDriveSyncCapabilities?.(),
  getMetadata = getBackupMetadata, getPath = configured, getBase = () => getSetting(kind === 'local' ? 'local_sync_base_v1' : DRIVE_SYNC_BASE_KEY),
  putBase = value => saveSetting(kind === 'local' ? 'local_sync_base_v1' : DRIVE_SYNC_BASE_KEY,value), recover = restoreBackup,
  editorActive = isRecoveryEditorActive, localState = getLocalSaveSnapshot } = {}) => {
  const listeners = new Set();
  let snapshot=Object.freeze({status:'idle',received:0,conflicts:0}),timer,wake,runner,offEditor;
  const publish = next => { snapshot=Object.freeze({...snapshot,...next});for(const listener of listeners){try{listener();}catch(_){}} };
  const journalFor = async path => {
    let journal=await getBase();if(journal?.version===1&&journal.path===syncPathKey(path))return journal;
    journal=freshSyncBase(path);
    // Adopt a previously CONFIRMED own backup as ancestry, never a same-name/time guess.
    const checkpoint=await getSetting('backup_v2_checkpoint');
    const target=checkpoint?.targets?.find(item=>role(item,kind)&&syncPathKey(item.targetDir)===journal.path&&!item.error&&item.lastDataSuccess);
    if(target)for(const[id,note]of Object.entries(target.notebooks||{}))if(note.editable?.hash&&note.editable.revision&&!note.backupConflict){
      Object.defineProperty(journal.entries,id,{enumerable:true,writable:true,configurable:true,value:{localRevision:note.editable.revision,remoteHash:note.editable.hash}});
    }
    await putBase(journal);return journal;
  };
  const receivedProofs = async journal => ({acceptedReceives:{...await getSetting('backup_restore_receives_v1'),...journal.receives},
    folderReceives:await getSetting('backup_restore_folders_v1') || {}});
  const pending = (reason,extra={}) => {publish({status:reason==='drive-sync-legacy'?'legacy':'pending',reason,...extra});return {driveSyncGuard:{ready:false,reason}};};
  const prepareBackup = async (options={}) => {
    let path;try{path=await getPath();}catch(_){return pending('backup-read-failed');}
    if(!path){publish({status:'idle',received:0,conflicts:0});return {skipBackup:!!options.checkDriveOnly,...await receivedProofs({})};}
    try{
      const expectedConfiguredPath=kind === 'local' ? (await getSetting('local_backup_path')) || null : undefined;
      if(kind==='local'&&expectedConfiguredPath&&syncPathKey(expectedConfiguredPath)!==syncPathKey(path))return pending('drive-sync-destination-changed');
      let journal=await journalFor(path);
      const support=await Promise.resolve().then(capabilities).catch(()=>null);
      if(kind==='drive'&&support?.protocol!==1)return {...pending('drive-sync-restart'),excludeDrive:true,skipBackup:!!options.checkDriveOnly};
      publish({status:'checking',reason:null});
      let deviceId=await getSetting('drive_sync_device_id');
      if(!deviceId){deviceId=crypto.randomUUID();await saveSetting('drive_sync_device_id',deviceId);}
      let remote=await read(path,{syncMode:'preview',syncDeviceId:deviceId});
      if(!remote?.success && ['drive-sync-legacy','backup-incomplete'].includes(remote?.reason)){
        if(editorActive()||localState().status!=='saved')return {...pending('drive-sync-waiting'),skipBackup:!!options.checkDriveOnly};
        publish({status:'receiving'});
        const legacy=await read(path,{previewOnly:false});
        if(!legacy?.success||!legacy.data||!(legacy.legacyUpgrade||legacy.repairUpgrade))return {...pending(legacy?.reason||'invalid-backup-data'),skipBackup:!!options.checkDriveOnly};
        const incoming=new Map(legacy.data.notebooks.map(note=>[note.id,note]));
        const hashes=new Map(legacy.notebooks.map(note=>[note.id,note.contentHash]));
        const received=await recover(async()=>incoming.size?({syncStream:true,ids:[...incoming.keys()],
          isCurrent:async()=>syncPathKey(await getPath())===syncPathKey(path),
          load:async id=>({data:{folders:legacy.data.folders,notebooks:[incoming.get(id)]},folder:path,
            sync:{path,kind,expectedConfiguredPath,remoteHash:hashes.get(id),copyLabel:t('driveSyncCopyLabel')}})
        }):({data:{folders:legacy.data.folders,notebooks:[]},sync:{path,kind,expectedConfiguredPath,foldersOnly:true}}));
        if(received.pendingReason)return {...pending(received.pendingReason),skipBackup:!!options.checkDriveOnly};
        journal=await journalFor(path);
        if(syncPathKey(await getPath())!==syncPathKey(path))return pending('drive-sync-destination-changed');
        publish({status:'current',reason:null});
        return {driveSyncGuard:{ready:true,manifestHash:(legacy.legacyUpgrade||legacy.repairUpgrade).manifestHash,
          ...(legacy.legacyUpgrade?{legacyUpgrade:legacy.legacyUpgrade}:{entries:legacy.repairUpgrade.entries,folders:legacy.data.folders}),deviceId},...await receivedProofs(journal)};
      }
      if(!remote?.success)return {...pending(remote?.reason||'backup-reader-unavailable'),skipBackup:!!options.checkDriveOnly};
      let metadata=await getMetadata(),changed=false;
      if(remote.resumingOwn){
        const entries=Object.fromEntries(metadata.notebooks.map(note=>[note.id,Object.hasOwn(remote.entries,note.id)?remote.entries[note.id]:null]));
        return {driveSyncGuard:{ready:true,manifestHash:remote.manifestHash,deviceId,entries},...await receivedProofs(journal)};
      }
      const folderChanged = remote.folders?.some(folder => journal.folders?.[folder.id]?.remote !== folderToken(folder));
      if (folderChanged && remote.folders.length) {
        if(editorActive()||localState().status!=='saved')return {...pending('drive-sync-waiting'),skipBackup:!!options.checkDriveOnly};
        const proof = remote.manifestHash;
        const received = await recover(async()=>({data:{folders:remote.folders,notebooks:[]},sync:{path,kind,expectedConfiguredPath,foldersOnly:true}}));
        changed = received.foldersCount > 0;
        remote = await read(path,{syncMode:'preview',syncDeviceId:deviceId});
        if(!remote?.success || remote.manifestHash !== proof)return pending(remote?.reason||'backup-changed-externally');
        journal = await journalFor(path); metadata = await getMetadata();
      }
      const ids=syncCandidates(metadata,remote,journal);
      if(ids.length){
        if(editorActive()||localState().status!=='saved'){
          publish({status:'waiting'});return {driveSyncGuard:{ready:false,reason:'drive-sync-waiting'},skipBackup:!!options.checkDriveOnly};
        }
        publish({status:'receiving'});
        const manifestHash=remote.manifestHash;
        const result=await recover(async()=>({syncStream:true,ids,
          isCurrent:async()=>syncPathKey(await getPath())===syncPathKey(path),
          load:async id=>{
            const item=await read(path,{syncMode:'note',syncNotebookId:id,manifestHash,syncDeviceId:deviceId});
            if(!item?.success)throw Object.assign(new Error(),{code:item?.reason||'backup-read-failed'});
            if(!(item.encoded instanceof Uint8Array))throw Object.assign(new Error(),{code:'invalid-backup-data'});
            const encoded=item.encoded.byteOffset===0&&item.encoded.byteLength===item.encoded.buffer.byteLength
              ? item.encoded.buffer:item.encoded.slice().buffer;
            return {encoded,sync:{path,kind,expectedConfiguredPath,remoteHash:item.remoteHash,copyLabel:t('driveSyncCopyLabel')}};
          }
        }));
        changed ||= result.notebooksCount>0;
        publish({received:result.receivedCount||0,conflicts:result.conflictsCount||0});
        if(result.pendingReason)return {...pending(result.pendingReason),skipBackup:!!options.checkDriveOnly&&!changed};
        remote=await read(path,{syncMode:'preview',syncDeviceId:deviceId});
        if(!remote?.success)return pending(remote?.reason||'backup-read-failed');
        journal=await journalFor(path);metadata=await getMetadata();
      }
      if(syncPathKey(await getPath())!==syncPathKey(path))return pending('drive-sync-destination-changed');
      const guard={...syncWriteGuard(metadata,remote,journal),deviceId,folders:remote.folders};
      if(!guard.ready)return {...pending(guard.reason),skipBackup:!!options.checkDriveOnly&&!changed};
      if(changed)publish({status:snapshot.conflicts?'conflict':'current'});
      else publish({status:snapshot.conflicts?'conflict':snapshot.received?'current':'idle'});
      return {driveSyncGuard:guard,...await receivedProofs(journal),skipBackup:!!options.checkDriveOnly&&!changed};
    }catch(error){return {...pending(error.code||'backup-read-failed'),skipBackup:!!options.checkDriveOnly};}
  };
  const beforeBackup = async options => {
    const prepared = await prepareBackup(options);
    // A blocked/temporarily unavailable Drive must not block a verified local restore.
    if (prepared.skipBackup || prepared.acceptedReceives) return prepared;
    return {...prepared,...await receivedProofs({})};
  };
  const beforePrune=async ids=>{
    let path;try{
      path=await getPath();if(!path)return {};
      const journal=await journalFor(path),support=await Promise.resolve().then(capabilities).catch(()=>null);
      if(support?.protocol!==1)return {...pending('drive-sync-restart'),excludeDrive:true};
      let deviceId=await getSetting('drive_sync_device_id');
      if(!deviceId){deviceId=crypto.randomUUID();await saveSetting('drive_sync_device_id',deviceId);}
      const remote=await read(path,{syncMode:'preview',syncDeviceId:deviceId});
      if(!remote?.success||remote.resumingOwn)return pending(remote?.reason||'drive-sync-pending');
      const byId=new Map(remote.notes.map(note=>[note.id,note]));
      for(const id of ids){const base=Object.hasOwn(journal.entries||{},id)?journal.entries[id]:null,there=byId.get(id);
        if(there&&(!base||base.remoteHash!==there.hash)||!there&&base)return pending('drive-sync-pending');
      }
      if(syncPathKey(await getPath())!==syncPathKey(path))return pending('drive-sync-destination-changed');
      return {driveSyncGuard:{ready:true,deviceId,manifestHash:remote.manifestHash,entries:Object.fromEntries(remote.notes.map(note=>[note.id,note.hash]))}};
    }catch(error){return pending(error.code||'backup-read-failed');}
  };
  const acknowledged = async ({paths,targets,notebooks,folders}) => {
    const path=await getPath(),expectedPath=kind==='local'?targets.find(item=>role(item,'local'))?.targetDir:paths.driveBackupPath;if(!path||syncPathKey(path)!==syncPathKey(expectedPath))return;
    const journal=await journalFor(path),drive=targets.find(item=>role(item,kind)&&item.dataSuccess&&!item.error);
    const local=targets.find(item=>role(item,'local')&&item.dataSuccess&&!item.error);let changed=false;
    for(const note of notebooks){
      const revision=syncRevision(note),artifact=drive&&Object.hasOwn(drive.notebooks||{},note.id)?drive.notebooks[note.id]?.editable:null;
      if(artifact?.revision===revision&&artifact.hash){
        if(!Object.hasOwn(journal.entries,note.id)||journal.entries[note.id]?.remoteHash!==artifact.hash||journal.entries[note.id]?.localRevision!==revision){
          Object.defineProperty(journal.entries,note.id,{enumerable:true,writable:true,configurable:true,value:{localRevision:revision,remoteHash:artifact.hash}});changed=true;
        }
      }
      if(journal.receives?.[note.id]&&local?.notebooks?.[note.id]?.editable?.revision===revision){delete journal.receives[note.id];changed=true;}
    }
    if (drive && folders) {
      journal.folders = Object.fromEntries(folders.map(folder=>[folder.id,{local:folderToken(folder),remote:folderToken(folder)}])); changed = true;
    }
    if (local) {
      const receipts = {...await getSetting('backup_restore_receives_v1')};
      for (const note of notebooks) if (local.notebooks?.[note.id]?.editable?.revision === syncRevision(note)) delete receipts[note.id];
      await saveSetting('backup_restore_receives_v1',receipts);
      const folderReceipts = {...await getSetting('backup_restore_folders_v1')}; delete folderReceipts[local.targetDir];
      await saveSetting('backup_restore_folders_v1',folderReceipts);
    }
    if(changed)await putBase(journal);
  };
  return {beforeBackup,beforePrune,acknowledged,getSnapshot:()=>snapshot,subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},
    start(run){if(timer)return;runner=run;timer=setInterval(()=>{if(!document.hidden)Promise.resolve(runner({checkDriveOnly:true})).catch(()=>{});},60000);
      offEditor=subscribeRecoveryEditor(active=>{if(active)return;clearTimeout(wake);wake=setTimeout(()=>Promise.resolve(runner({checkDriveOnly:true})).catch(()=>{}),1000);});},
    stop(){clearInterval(timer);clearTimeout(wake);timer=null;offEditor?.();offEditor=null;}
  };
};
