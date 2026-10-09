// Route only bundled PDF files through the restricted native resource protocol.
export const localAssetUrl = value => {
  if (!globalThis.window?.electronAPI?.isElectron || globalThis.location?.protocol !== 'file:') return value;
  const url = new URL(value, globalThis.location.href);
  if (url.protocol !== 'file:') return value;
  const name = decodeURIComponent(url.pathname).split('/').at(-1);
  return 'betternote-assets://app/assets/' + encodeURIComponent(name);
};
