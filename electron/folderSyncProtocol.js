// Folder metadata only. Deletion records travel with backups; they contain no pages.
export const folderToken = folder => JSON.stringify([folder.id, folder.name, folder.parentId || null,
  folder.updatedAt || 0, !!folder.isDeleted, folder.color, folder.icon, !!folder.isFavorite,
  !!folder.permanentlyDeleted, folder.createdAt || 0, folder.restoreParentId || null]);
export const folderStateToken = folders => JSON.stringify([...folders].sort((a,b)=>String(a.id).localeCompare(String(b.id))).map(folderToken));
export function reconcileFolders(localFolders, incomingFolders, base = {}) {
  const map = new Map(localFolders.map(folder=>[folder.id,{...folder}])), remaps = Object.create(null);
  // Older installations shared sample IDs. Relocate the local sample and its
  // children before receiving the source's original hierarchy.
  for (const incoming of incomingFolders) {
    const local = map.get(incoming.id);
    if (/^folder-demo-[12]$/.test(incoming.id) && local && local.createdAt && incoming.createdAt && local.createdAt !== incoming.createdAt) {
      const id = 'folder-local-' + incoming.id + '-' + local.createdAt;
      remaps[local.id] = id;
      map.delete(local.id); map.set(id,{...local,id});
    }
  }
  for (const [id,folder] of map) if (remaps[folder.parentId]) map.set(id,{...folder,parentId:remaps[folder.parentId]});
  for (const incoming of incomingFolders) {
    const local = map.get(incoming.id), ancestor = Object.hasOwn(base,incoming.id) ? base[incoming.id] : null;
    let selected = incoming;
    if (local?.permanentlyDeleted) selected = local;
    else if (!incoming.permanentlyDeleted && local) {
      const localUnchanged = ancestor?.local === folderToken(local), remoteUnchanged = ancestor?.remote === folderToken(incoming);
      if (remoteUnchanged && !localUnchanged) selected = local;
      else if (!localUnchanged && (!ancestor || !remoteUnchanged)) {
        const l = [Number(local.updatedAt)||Number(local.createdAt)||0,folderToken(local)];
        const r = [Number(incoming.updatedAt)||Number(incoming.createdAt)||0,folderToken(incoming)];
        if (l[0] > r[0] || l[0] === r[0] && l[1] > r[1]) selected = local;
      }
    }
    map.set(incoming.id,{...selected});
  }
  const destination = id => {
    const seen = new Set();
    while (id) {
      if (seen.has(id)) return null;
      seen.add(id); const folder = map.get(id);
      if (!folder) return null;
      if (!folder.permanentlyDeleted && !folder.isDeleted) return id;
      id = folder.restoreParentId || folder.parentId;
    }
    return null;
  };
  for (const [id,folder] of map) {
    let parentId = folder.permanentlyDeleted ? null : map.get(folder.parentId)?.permanentlyDeleted ? destination(folder.parentId) : map.has(folder.parentId) ? folder.parentId : null;
    const seen = new Set([id]); let cursor = parentId;
    while (cursor) { if (seen.has(cursor)) { parentId = null; break; } seen.add(cursor); cursor = map.get(cursor)?.parentId; }
    if ((folder.parentId || null) !== parentId) map.set(id,{...folder,parentId});
  }
  const journal = {...base};
  for (const incoming of incomingFolders) Object.defineProperty(journal,incoming.id,{enumerable:true,configurable:true,writable:true,
    value:{local:folderToken(map.get(incoming.id)),remote:folderToken(incoming)}});
  return {folders:[...map.values()],remaps,journal,destination};
}
