import { prepareBackup, validateLibrary } from '../../electron/backupValidation.js';
import { restoreBackupAtomic, getBackupNotebookSnapshot, getAllFolders, getAllNotebooks, getSetting } from './db.js';
import { DRIVE_SYNC_BASE_KEY, freshSyncBase, planSyncedNotebook } from './backupSyncCore.js';
import { RESTORE_CONTENT_BASE_KEY, planRestoredNotebook } from './backupRestorePlan.js';
import { syncPathKey } from '../../electron/backupSyncProtocol.js';
import { reconcileFolders, folderToken } from '../../electron/folderSyncProtocol.js';

let commitRequest = null;
self.onmessage = async event => {
  if (event.data.commit) {
    if (commitRequest?.id === event.data.commit) { const ready = commitRequest;commitRequest = null;ready.resolve(); }
    return;
  }
  let {operationId, data, file, encoded, sync, copyLabel, requireCommit} = event.data;
  try {
    if (file) {
      if (!Number.isFinite(file.size) || file.size <= 0 || file.size > 256 * 1048576) throw Object.assign(new Error(), { code: 'backup-too-large' });
      data = JSON.parse(await file.text());
    }
    if (encoded) {
      if (!(encoded instanceof ArrayBuffer) || encoded.byteLength > 512 * 1048576) throw Object.assign(new Error(), { code: 'backup-too-large' });
      data = JSON.parse(new TextDecoder().decode(encoded));
    }
    self.postMessage({progress:{stage:'planning',notebooksDone:0,totalNotebooks:data?.notebooks?.length||0}});
    const prepared = prepareBackup(data);data = null;encoded = null;
    const localFolders = await getAllFolders({includeRetired:true});
    const checkpoint = await getSetting('backup_v2_checkpoint');
    const localTarget = checkpoint?.targets?.find(target => (target.roles || [target.kind]).includes('local') && !target.error && target.lastDataSuccess);
    const receipts = Object.assign(Object.create(null),await getSetting('backup_restore_receives_v1'));
    const folderReceipts = {...await getSetting('backup_restore_folders_v1')};
    if (localTarget?.fullRevision) folderReceipts[localTarget.targetDir] = localTarget.fullRevision;
    const expectedFolders = localFolders.map(folder=>({id:folder.id,token:folderToken(folder)}));
    const expectedIds = new Set(localFolders.map(folder=>folder.id));
    for (const folder of prepared.folders) if (!expectedIds.has(folder.id)) expectedFolders.push({id:folder.id,token:null});
    let folderPlan, resultData, options = {expectedFolders,folderCount:localFolders.length};
    const settingsUpdates = [];
    if (sync) {
      if (prepared.notebooks.length !== (sync.foldersOnly ? 0 : 1)) throw Object.assign(new Error(), { code: 'invalid-backup-data' });
      const journalKey=sync.kind==='local'?'local_sync_base_v1':DRIVE_SYNC_BASE_KEY;
      let journal = await getSetting(journalKey);
      if (!journal || journal.version !== 1 || journal.path !== syncPathKey(sync.path)) journal = freshSyncBase(sync.path);
      folderPlan = reconcileFolders(localFolders,prepared.folders,journal.folders);
      if (sync.foldersOnly) {
        resultData = {folders:folderPlan.folders,notebooks:[]};
        journal = {...journal,folders:folderPlan.journal};
      } else {
        const incoming = prepared.notebooks[0], local = await getBackupNotebookSnapshot(incoming.id);
        const plan = await planSyncedNotebook({ incoming, local, base: Object.hasOwn(journal.entries||{},incoming.id)?journal.entries[incoming.id]:null,
          remoteHash: sync.remoteHash, folders: prepared.folders, localFolders, folderBase:journal.folders, copyLabel: sync.copyLabel });
        if (!plan.entry) { self.postMessage({ result: { notebooks: [], notebooksCount: 0, skipped: true } }); return; }
        folderPlan = plan.folderPlan;
        journal = {...journal,folders:folderPlan.journal,entries:{...journal.entries,[incoming.id]:plan.entry},receives:Object.assign(Object.create(null),journal.receives)};
        const previousHash = localTarget?.notebooks?.[incoming.id]?.editable?.hash;
        if (plan.notebooks.some(note=>note.id===incoming.id) && previousHash) {
          journal.receives[incoming.id] = {targetDir:localTarget.targetDir,previousHash};
          receipts[incoming.id] = {targetDir:localTarget.targetDir,previousHash};
        }
        resultData = {folders:plan.folders,notebooks:plan.notebooks};
        options.expectedRevisions = plan.expected;
        options.resultExtras = {conflictsCount:plan.conflict?1:0,receivedCount:plan.notebooks.some(note=>note.id===incoming.id)?1:0};
      }
      options.path = sync.path;
      options.sourceKind = sync.kind; options.expectedConfiguredPath=sync.expectedConfiguredPath;
      settingsUpdates.push({key:journalKey,value:journal});
    } else {
      folderPlan = reconcileFolders(localFolders,prepared.folders);
      // Manual recovery copies only divergent local work; unchanged received content can advance.
      // Hash content in this worker; never copy rich notebook objects on the UI thread.
      const notebooks=[],expected=[];let conflicts=0,processed=0;
      const savedBases=await getSetting(RESTORE_CONTENT_BASE_KEY);
      const contentBases=Object.assign(Object.create(null),savedBases?.version===1?savedBases.entries:null);
      for(const incoming of prepared.notebooks){
        const local=await getBackupNotebookSnapshot(incoming.id);
        const bytes=new TextEncoder().encode(JSON.stringify(incoming));
        const remoteHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
        const plan=await planRestoredNotebook({incoming,local,remoteHash,folders:prepared.folders,localFolders,copyLabel:copyLabel||'Local copy',
          contentBase:Object.hasOwn(contentBases,incoming.id)?contentBases[incoming.id]:null});
        if(plan.contentBase)contentBases[incoming.id]=plan.contentBase;
        notebooks.push(...plan.notebooks);expected.push(...plan.expected);conflicts+=plan.conflict?1:0;
        self.postMessage({progress:{stage:'planning',notebooksDone:++processed,totalNotebooks:prepared.notebooks.length}});
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      settingsUpdates.push({key:RESTORE_CONTENT_BASE_KEY,value:{version:1,entries:contentBases}});
      resultData={folders:folderPlan.folders,notebooks};
      options.expectedRevisions=expected;
      options.resultExtras={conflictsCount:conflicts};
      for (const note of resultData.notebooks) {
        const previousHash = localTarget?.notebooks?.[note.id]?.editable?.hash;
        if (previousHash) receipts[note.id] = {targetDir:localTarget.targetDir,previousHash};
      }
    }
    const plannedFolders = new Map(folderPlan.folders.map(folder=>[folder.id,folder]));
    if (localTarget) for (const note of await getAllNotebooks()) {
      const mapped = folderPlan.remaps[note.folderId] || note.folderId;
      if (mapped !== note.folderId || plannedFolders.get(mapped)?.permanentlyDeleted) {
        const previousHash = localTarget.notebooks?.[note.id]?.editable?.hash;
        if (previousHash) receipts[note.id] = {targetDir:localTarget.targetDir,previousHash};
      }
    }
    validateLibrary(folderPlan.folders,resultData.notebooks);
    const previousFolders = new Map(localFolders.map(folder=>[folder.id,folderToken(folder)]));
    resultData.folders = folderPlan.folders.filter(folder=>previousFolders.get(folder.id)!==folderToken(folder));
    options.folderPlan = resultData.folders.length ? folderPlan : null;
    options.settingsUpdates = [...settingsUpdates,{key:'backup_restore_receives_v1',value:receipts},{key:'backup_restore_folders_v1',value:folderReceipts}];
    if (requireCommit) await new Promise(resolve=>{
      commitRequest = {id:operationId,resolve};self.postMessage({phase:'ready'});
    });
    self.postMessage({ phase: 'writing' });
    const result = await restoreBackupAtomic(resultData, operationId, options);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: (typeof error.code === 'string' ? error.code : null) || (error instanceof SyntaxError ? 'invalid-backup-data' : 'backup-recovery-write-failed') });
  }
};
