import { getSetting, saveSetting, getBackupMetadata } from './db.js';
import { getLocalSaveSnapshot } from './localSaveService.js';
import { restoreBackup, isRecoveryEditorActive, subscribeRecoveryEditor } from './backupRecoveryService.js';
import { DRIVE_SYNC_BASE_KEY, freshSyncBase } from './backupSyncCore.js';
import { syncPathKey, syncRevision, syncCandidates, syncWriteGuard } from '../../electron/backupSyncProtocol.js';
import { t } from './i18n.js';
const configured = async () => await getSetting('gdrive_backup_method') === 'desktop' ? await getSetting('gdrive_backup_path') : null;
const role = (target,kind) => (target.roles || [target.kind]).includes(kind);
export const createDriveSyncService = ({ read = (folder,options) => window.electronAPI?.scanBackupFolder?.(folder,options),
  capabilities = () => window.electronAPI?.getDriveSyncCapabilities?.(),
  getMetadata = getBackupMetadata, getPath = configured, getBase = () => getSetting(DRIVE_SYNC_BASE_KEY),
  putBase = value => saveSetting(DRIVE_SYNC_BASE_KEY,value), recover = restoreBackup,
  editorActive = isRecoveryEditorActive, localState = getLocalSaveSnapshot } = {}) => {
  const listeners = new Set();
  let snapshot=Object.freeze({status:'idle',received:0,conflicts:0}),timer,wake,runner,offEditor;
  const publish = next => { snapshot=Object.freeze({...snapshot,...next});for(const listener of listeners){try{listener();}catch(_){}} };
  const journalFor = async path => {
    let journal=await getBase();if(journal?.version===1&&journal.path===syncPathKey(path))return journal;
    journal=freshSyncBase(path);
    // Adopt a previously CONFIRMED own backup as ancestry, never a same-name/time guess.
    const checkpoint=await getSetting('backup_v2_checkpoint');
    const target=checkpoint?.targets?.find(item=>role(item,'drive')&&syncPathKey(item.targetDir)===journal.path&&!item.error&&item.lastDataSuccess);
    if(target)for(const[id,note]of Object.entries(target.notebooks||{}))if(note.editable?.hash&&note.editable.revision&&!note.backupConflict){
      Object.defineProperty(journal.entries,id,{enumerable:true,writable:true,configurable:true,value:{localRevision:note.editable.revision,remoteHash:note.editable.hash}});
    }
    await putBase(journal);return journal;
  };
  const pending = (reason,extra={}) => {publish({status:reason==='drive-sync-legacy'?'legacy':'pending',reason,...extra});return {driveSyncGuard:{ready:false,reason}};};
  const beforeBackup = async (options={}) => {
    let path;try{path=await getPath();}catch(_){return pending('backup-read-failed');}
    if(!path){publish({status:'idle',received:0,conflicts:0});return {skipBackup:!!options.checkDriveOnly};}
    try{
      let journal=await journalFor(path);
      const support=await Promise.resolve().then(capabilities).catch(()=>null);
      if(support?.protocol!==1)return {...pending('drive-sync-restart'),excludeDrive:true,skipBackup:!!options.checkDriveOnly};
      publish({status:'checking',reason:null});
      let deviceId=await getSetting('drive_sync_device_id');
      if(!deviceId){deviceId=crypto.randomUUID();await saveSetting('drive_sync_device_id',deviceId);}
      let remote=await read(path,{syncMode:'preview',syncDeviceId:deviceId});
      if(!remote?.success)return {...pending(remote?.reason||'backup-reader-unavailable'),skipBackup:!!options.checkDriveOnly};
      let metadata=await getMetadata(),changed=false;
      if(remote.resumingOwn){
        const entries=Object.fromEntries(metadata.notebooks.map(note=>[note.id,Object.hasOwn(remote.entries,note.id)?remote.entries[note.id]:null]));
        return {driveSyncGuard:{ready:true,manifestHash:remote.manifestHash,deviceId,entries},acceptedReceives:journal.receives||{}};
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
            return {encoded,sync:{path,remoteHash:item.remoteHash,copyLabel:t('driveSyncCopyLabel')}};
          }
        }));
        changed=result.notebooksCount>0;
        publish({received:result.receivedCount||0,conflicts:result.conflictsCount||0});
        if(result.pendingReason)return {...pending(result.pendingReason),skipBackup:!!options.checkDriveOnly&&!changed};
        remote=await read(path,{syncMode:'preview',syncDeviceId:deviceId});
        if(!remote?.success)return pending(remote?.reason||'backup-read-failed');
        journal=await journalFor(path);metadata=await getMetadata();
      }
      if(syncPathKey(await getPath())!==syncPathKey(path))return pending('drive-sync-destination-changed');
      const guard={...syncWriteGuard(metadata,remote,journal),deviceId};
      if(!guard.ready)return {...pending(guard.reason),skipBackup:!!options.checkDriveOnly&&!changed};
      if(changed)publish({status:snapshot.conflicts?'conflict':'current'});
      else publish({status:snapshot.conflicts?'conflict':snapshot.received?'current':'idle'});
      return {driveSyncGuard:guard,acceptedReceives:journal.receives||{},skipBackup:!!options.checkDriveOnly&&!changed};
    }catch(error){return {...pending(error.code||'backup-read-failed'),skipBackup:!!options.checkDriveOnly};}
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
  const acknowledged = async ({paths,targets,notebooks}) => {
    const path=await getPath();if(!path||syncPathKey(path)!==syncPathKey(paths.driveBackupPath))return;
    const journal=await journalFor(path),drive=targets.find(item=>role(item,'drive')&&item.dataSuccess&&!item.error);
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
    if(changed)await putBase(journal);
  };
  return {beforeBackup,beforePrune,acknowledged,getSnapshot:()=>snapshot,subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},
    start(run){if(timer)return;runner=run;timer=setInterval(()=>{if(!document.hidden)Promise.resolve(runner({checkDriveOnly:true})).catch(()=>{});},60000);
      offEditor=subscribeRecoveryEditor(active=>{if(active)return;clearTimeout(wake);wake=setTimeout(()=>Promise.resolve(runner({checkDriveOnly:true})).catch(()=>{}),1000);});},
    stop(){clearInterval(timer);clearTimeout(wake);timer=null;offEditor?.();offEditor=null;}
  };
};
