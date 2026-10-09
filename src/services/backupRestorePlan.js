import { syncContent, syncRevision } from '../../electron/backupSyncProtocol.js';
import { validateNotebook } from '../../electron/backupValidation.js';
import { planSyncedNotebook } from './backupSyncCore.js';

export const RESTORE_CONTENT_BASE_KEY = 'backup_restore_content_base_v1';
const annotations = ['strokes', 'textElements', 'imageElements', 'drawings', 'textBlocks', 'images'];
export const restoredContentHash = async note => {
  const bytes = new TextEncoder().encode(syncContent(note));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    byte => byte.toString(16).padStart(2, '0')).join('');
};

// For backups predating the receipt, replacement is safe only when every existing
// annotation survives unchanged, in order, on the same pages and backgrounds.
export function retainsLocalContent(local, incoming) {
  if (local.id !== incoming.id || local.pages.length !== incoming.pages.length ||
      syncContent({...local, pages: []}) !== syncContent({...incoming, pages: []})) return false;
  return local.pages.every((page, index) => {
    const remote = incoming.pages[index];
    const metadata = value => Object.fromEntries(Object.entries(value).filter(([key]) => !annotations.includes(key)));
    if (syncContent(metadata(page)) !== syncContent(metadata(remote))) return false;
    return annotations.every(key => {
      const here = page[key] || [], there = remote[key] || [];
      if (here.length > there.length) return false;
      let cursor = 0;
      for (const item of here) {
        const content = syncContent(item);
        while (cursor < there.length && syncContent(there[cursor]) !== content) cursor++;
        if (cursor === there.length) return false;
        cursor++;
      }
      return true;
    });
  });
}

// Only manual recovery uses this receipt. Automatic backup and sync decisions
// retain their existing guards. Clock values and equal names never prove ancestry.
export async function planRestoredNotebook({ contentBase, ...input }) {
  const local = input.local ? validateNotebook(input.local) : null;
  const unchanged = !!local && typeof contentBase === 'string' &&
    await restoredContentHash(local) === contentBase;
  const safe = !!local && (unchanged || retainsLocalContent(local, input.incoming));
  const plan = await planSyncedNotebook({...input, local,
    base: safe ? {localRevision: syncRevision(local), remoteHash: null} : null});
  const accepted = plan.notebooks.find(note => note.id === input.incoming.id) || local;
  return {...plan, contentBase: accepted ? await restoredContentHash(accepted) : null};
}
