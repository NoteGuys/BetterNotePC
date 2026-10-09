// Shared decisions only; serialization runs in native/browser workers, never the editor.
export const syncPathKey = path => String(path || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
export const syncRevision = note => JSON.stringify([note.id,Number(note.updatedAt)||0,note.name||'',note.folderId||null,Number(note.pageCount)||0,!!note.isDeleted]);
export const syncContent = note => JSON.stringify(note, (key,value) => {
  if (['updatedAt','createdAt','firstPageThumbnail','thumbnailUrl','thumbnailUpdatedAt'].includes(key)) return undefined;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(name=>[name,value[name]])) : value;
});
export const syncDecision = ({ local, remote, base, equalContent = false }) => {
  if (!remote) return local && base ? 'missing-remote' : 'local-only';
  if (!local) return base ? 'missing-local' : 'receive';
  if (equalContent) return 'equal';
  if (!base) return 'conflict';
  const hereChanged=syncRevision(local)!==base.localRevision, thereChanged=remote.hash!==base.remoteHash;
  return thereChanged ? hereChanged ? 'conflict' : 'receive' : hereChanged ? 'send' : 'equal';
};
export const syncCandidates = (metadata, remote, bases) => {
  const local=new Map(metadata.notebooks.map(note=>[note.id,note]));
  return remote.notes.filter(note => {
    const here=local.get(note.id),base=Object.hasOwn(bases.entries||{},note.id)?bases.entries[note.id]:null;
    return !here || !base || note.hash!==base.remoteHash;
  }).map(note=>note.id);
};
export const syncWriteGuard = (metadata, remote, bases) => {
  const entries=Object.create(null);
  const remoteById=new Map(remote.notes.map(note=>[note.id,note]));
  for(const note of metadata.notebooks){
    const there=remoteById.get(note.id),base=Object.hasOwn(bases.entries||{},note.id)?bases.entries[note.id]:null;
    if(there && (!base || base.remoteHash!==there.hash) || !there && base) return { ready:false,reason:'drive-sync-pending' };
    entries[note.id]=there?.hash||null;
  }
  return {ready:true,manifestHash:remote.manifestHash,entries};
};
