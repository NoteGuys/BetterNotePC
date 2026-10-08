// PDF parsing and rasterization run inside an offline application worker.
import * as pdfjs from 'pdfjs-dist';
import { WorkerMessageHandler } from 'pdfjs-dist/build/pdf.worker.mjs';
globalThis.pdfjsWorker = { WorkerMessageHandler };

class CanvasFactory {
  create(width, height) { const canvas = new OffscreenCanvas(Math.ceil(width), Math.ceil(height)); return { canvas, context: canvas.getContext('2d') }; }
  reset(target, width, height) { target.canvas.width = Math.ceil(width); target.canvas.height = Math.ceil(height); }
  destroy(target) { target.canvas.width = target.canvas.height = 1; target.canvas = target.context = null; }
}
class FilterFactory {
  addFilter(maps) { if (!maps) return 'none'; throw Error('pdf-native-filter-required'); }
  addAlphaFilter() { throw Error('pdf-native-filter-required'); }
  addLuminosityFilter() { throw Error('pdf-native-filter-required'); }
  addHCMFilter() { throw Error('pdf-native-filter-required'); }
  destroy() {}
}
// Embedded fonts use worker FontFaceSet; standard fonts use their local outlines.
let fontUrls={},cmapUrls={};
export const configurePdfAssets = assets => { if(assets){fontUrls=assets.fontUrls||{};cmapUrls=assets.cmapUrls||{};} };
const asset = async (urls, name) => {
  const key = Object.keys(urls).find(key => key.endsWith('/' + name));
  if (!key) throw Error('PDF font unavailable');
  const response = await fetch(urls[key]); if (!response.ok) throw Error('PDF font unavailable');
  return new Uint8Array(await response.arrayBuffer());
};
class StandardFontDataFactory { fetch({ filename }) { return asset(fontUrls, filename); } }
class CMapReaderFactory { async fetch({ name }) { return { cMapData: await asset(cmapUrls, name + '.bcmap'), compressionType: 1 }; } }

export const openRasterPdf = bytes => pdfjs.getDocument({
  data: bytes, CanvasFactory, FilterFactory, StandardFontDataFactory, CMapReaderFactory,
  useWorkerFetch: false, useSystemFonts: false, ownerDocument: { fonts: globalThis.fonts },
  isEvalSupported: false, isImageDecoderSupported: false, stopAtErrors: true, verbosity: 0
}).promise;

const dataUrl = blob => new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
});
export const rasterPdfPage = async (doc, number, { preview = false, maxPixels = 4000000, maxEdge = 4096 } = {}) => {
  const page = await doc.getPage(number), viewport = page.getViewport({ scale: 2 });
  const scale = preview ? Math.min(1, 960 / Math.max(viewport.width, viewport.height))
    : Math.min(1, Math.sqrt(maxPixels / (viewport.width * viewport.height)), maxEdge / viewport.width, maxEdge / viewport.height);
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(viewport.width * scale)), Math.max(1, Math.round(viewport.height * scale)));
  const ctx = canvas.getContext('2d', { alpha: false });
  let thumbnail;
  try {
    await page.render({ canvasContext: ctx, viewport, transform: scale === 1 ? undefined : [scale,0,0,scale,0,0], background: 'rgb(255,255,255)' }).promise;
    const image = await dataUrl(await canvas.convertToBlob({ type: 'image/jpeg', quality: preview ? .76 : .86 }));
    if (preview) {
      const factor = Math.min(1, 320 / Math.max(canvas.width, canvas.height));
      thumbnail = new OffscreenCanvas(Math.max(1, Math.round(canvas.width * factor)), Math.max(1, Math.round(canvas.height * factor)));
      thumbnail.getContext('2d').drawImage(canvas,0,0,thumbnail.width,thumbnail.height);
    }
    return { dataUrl: image, thumbnailUrl: thumbnail ? await dataUrl(await thumbnail.convertToBlob({type:'image/jpeg',quality:.76})) : null,
      width: viewport.width, height: viewport.height, rasterWidth: canvas.width, rasterHeight: canvas.height };
  } finally { canvas.width = canvas.height = 1; if (thumbnail) thumbnail.width = thumbnail.height = 1; page.cleanup(); }
};
export const pdfBytesFromUrl = async url => {
  if (!/^data:application\/pdf(?:;[^,]*)?;base64,/i.test(url || '')) throw Error('PDF source unavailable');
  return new Uint8Array(await (await fetch(url)).arrayBuffer());
};
export const pdfOriginalDataUrl = bytes => dataUrl(new Blob([bytes], { type: 'application/pdf' }));
