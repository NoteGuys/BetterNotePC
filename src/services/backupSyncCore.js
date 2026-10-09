import { syncRevision, syncContent, syncDecision, syncPathKey } from '../../electron/backupSyncProtocol.js';
import { reconcileFolders } from '../../electron/folderSyncProtocol.js';
import { validateLibrary, validateNotebook } from '../../electron/backupValidation.js';
export const DRIVE_SYNC_BASE_KEY = 'drive_sync_base_v1';
export const freshSyncBase = path => ({version:1,path:syncPathKey(path),entries:{}});
export async function planSyncedNotebook({incoming,local,base,remoteHash,folders,localFolders,folderBase,copyLabel,uuid=()=>crypto.randomUUID()}) {
  if (local) local=validateNotebook(local);
  const action=syncDecision({local,remote:{hash:remoteHash},base,equalContent:!!local&&syncContent(local)===syncContent(incoming)});
  if(action==='missing-local')return {action,notebooks:[],folders:[],expected:[],entry:null};
  const expected=[{id:incoming.id,revision:local?syncRevision(local):null}],notebooks=[];
  const folderPlan = reconcileFolders(localFolders,folders,folderBase);
  const folderMap = new Map(folderPlan.folders.map(folder=>[folder.id,folder])), added=folderPlan.folders;
  validateLibrary(added,[]);
  let note=incoming;
  if(note.folderId&&(!folderMap.has(note.folderId)||folderMap.get(note.folderId).isDeleted))note={...note,folderId:folderPlan.destination(folderMap.get(note.folderId)?.restoreParentId),updatedAt:Math.max(Date.now(),(note.updatedAt||0)+1)};
  if(action==='conflict'){
    const id=uuid(),now=Math.max(Date.now(),(local.updatedAt||0)+1);
    const copy={...local,id,name:(local.name||'Untitled')+' ('+copyLabel+')',isDeleted:false,updatedAt:now,createdAt:now,
      syncConflictOf:local.id,folderId:folderPlan.remaps[local.folderId] || (folderMap.get(local.folderId)?.permanentlyDeleted ? folderPlan.destination(local.folderId) : local.folderId),pages:local.pages.map(page=>({...page,id:uuid(),notebookId:id}))};
    delete copy.firstPageThumbnail;
    expected.push({id,revision:null});notebooks.push(copy);
  }
  // Align harmless timestamp/normalization differences to the verified source, not to either clock.
  if(!local||action==='receive'||action==='conflict'||syncRevision(local)!==syncRevision(note))notebooks.push(note);
  validateLibrary([...folderMap.values()],notebooks);
  return {action,notebooks,folders:added,folderPlan,expected,entry:{localRevision:syncRevision(notebooks.includes(note)?note:local),remoteHash},conflict:action==='conflict'};
}
