// Separate public distribution repository: never link the app's source tree here.
export const COMMUNITY_DOWNLOADS = 'https://github.com/NoteGuys/BetterNote-Releases/releases';
export const COMMUNITY_FEEDBACK = 'https://github.com/NoteGuys/BetterNote-Releases/issues';
export const openCommunityLink = async target => {
  if (![COMMUNITY_DOWNLOADS, COMMUNITY_FEEDBACK].includes(target)) return false;
  try {
    if (window.electronAPI?.openExternal) return (await window.electronAPI.openExternal(target))?.success === true;
    return Boolean(window.open(target, '_blank', 'noopener,noreferrer'));
  } catch { return false; }
};
