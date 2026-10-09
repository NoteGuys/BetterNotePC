import { localAssetUrl } from './localAssetUrl.js';
// Resolve bundled resources in the window before passing URLs into blob workers.
export const fontUrls = import.meta.glob('../../node_modules/pdfjs-dist/standard_fonts/*.{pfb,ttf}', { eager:true, query:'?url', import:'default' });
export const cmapUrls = import.meta.glob('../../node_modules/pdfjs-dist/cmaps/*.bcmap', { eager:true, query:'?url', import:'default' });
export const pdfAssets = () => ({fontUrls:Object.fromEntries(Object.entries(fontUrls).map(([k,v])=>[k,localAssetUrl(v)])),cmapUrls:Object.fromEntries(Object.entries(cmapUrls).map(([k,v])=>[k,localAssetUrl(v)]))});
