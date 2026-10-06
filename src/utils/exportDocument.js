import { renderStroke } from './inkingEngine.js';
import { renderPaperBackground } from './paperRenderer.js';
import { PAPER_TEMPLATES } from '../data/templates.js';
import { isWhiteboardPage, getWhiteboardContentBounds } from './whiteboard.js';
import { SvgCanvas, escapeXml } from './svgCanvas.js';

const MAX_IMAGE_PIXELS = 16000000;
const MAX_IMAGE_EDGE = 8192;
const yieldToUi = () => new Promise(resolve => setTimeout(resolve, 0));

const getBounds = (page, templateId) => {
  if (isWhiteboardPage(page, templateId)) {
    return getWhiteboardContentBounds(page, document.createElement('canvas').getContext('2d'), true);
  }
  return { x: 0, y: 0, width: Math.max(100, Number(page.pageWidth) || 1200),
    height: Math.max(100, Number(page.pageHeight) || 1600) };
};

const imageMarkup = async images => {
  const result = [];
  for (const image of images) {
    if (!image.src) continue;
    // Every currently supported image insertion stores a data URL.
    // Do not fetch files, network locations or backup folders during export.
    if (!/^data:image\//i.test(image.src)) throw new Error('รูปภาพนี้ยังไม่พร้อมสำหรับการส่งออกแบบออฟไลน์');
    const x = Number.isFinite(image.x) ? image.x : 0, y = Number.isFinite(image.y) ? image.y : 0;
    if (!(image.width > 0 && image.height > 0)) throw new Error('ขนาดรูปภาพสำหรับส่งออกไม่ถูกต้อง');
    result.push('<image x="' + x + '" y="' + y + '" width="' + image.width + '" height="' +
      image.height + '" preserveAspectRatio="none" href="' + escapeXml(image.src) + '"/>');
    if (result.length % 20 === 0) await yieldToUi();
  }
  return result.join('');
};

export const renderExportPageSvg = async (page, templateId = 'ruled') => {
  if (document.fonts?.ready) await document.fonts.ready;
  const bounds = getBounds(page, templateId);
  const paper = new SvgCanvas(), ink = new SvgCanvas();
  if (isWhiteboardPage(page, templateId)) {
    paper.fillStyle = '#ffffff'; paper.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
  } else if (!page.pdfPageImage) {
    const template = PAPER_TEMPLATES.find(t => t.id === (page.templateId || templateId)) || PAPER_TEMPLATES[0];
    renderPaperBackground(paper, bounds.width, bounds.height, template);
  }
  const background = page.pdfPageImage ? await imageMarkup([{ src: page.pdfPageImage,
    x: 0, y: 0, width: bounds.width, height: bounds.height }]) : paper.toString();
  const under = await imageMarkup((page.imageElements || []).filter(image => image.layer !== 'over'));
  let sliceStarted = performance.now();
  for (const stroke of page.strokes || []) {
    renderStroke(ink, stroke);
    if (performance.now() - sliceStarted > 8) { await yieldToUi(); sliceStarted = performance.now(); }
  }
  const over = await imageMarkup((page.imageElements || []).filter(image => image.layer === 'over'));
  const texts = [];
  for (const text of page.textElements || []) {
    const size = text.fontSize || 20;
    const family = (text.fontFamily || 'Inter') + ', Segoe UI, Leelawadee UI, sans-serif';
    const lines = String(text.text || '').split('\n');
    // Match the editor's padded, top-aligned text boxes. Native text shaping
    // preserves Thai vowels and tone marks, with local Windows font fallbacks.
    texts.push('<text x="' + (text.x + 4) + '" y="' + (text.y + 4) +
      '" dominant-baseline="text-before-edge" font-family="' + escapeXml(family) +
      '" font-size="' + size + '" font-weight="' + (text.bold ? 'bold' : '500') +
      '" fill="' + escapeXml(text.color || '#000000') + '" xml:space="preserve">' +
      lines.map((line, index) => '<tspan x="' + (text.x + 4) + '" dy="' +
        (index === 0 ? 0 : size * 1.35) + '">' + escapeXml(line) + '</tspan>').join('') + '</text>');
  }
  const content = background + under + ink.toString() + over + texts.join('');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="' +
    [bounds.x, bounds.y, bounds.width, bounds.height].join(' ') + '">' + content + '</svg>';
  return { svg, bounds };
};

export const buildExportDocument = async (notebook, pages, dimensions, onProgress) => {
  const styles = [], body = [];
  for (let index = 0; index < pages.length; index++) {
    if (onProgress) onProgress(index + 1, pages.length);
    const { svg } = await renderExportPageSvg(pages[index], notebook.templateId);
    const { pdfW, pdfH } = dimensions(pages[index], notebook.templateId);
    styles.push('@page bn' + index + '{size:' + pdfW + 'pt ' + pdfH + 'pt;margin:0}');
    body.push('<section class="page" style="page:bn' + index + ';width:' + pdfW +
      'pt;height:' + pdfH + 'pt">' + svg + '</section>');
    await yieldToUi();
  }
  return '<!doctype html><html lang="th"><head><meta charset="utf-8">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;; ' +
    'img-src data:; style-src &apos;unsafe-inline&apos;; base-uri &apos;none&apos;">' +
    '<title>' + escapeXml(notebook.name || 'Notebook') + '</title><style>' +
    'html,body{margin:0;padding:0}.page{break-after:page;overflow:hidden}' +
    '.page:last-child{break-after:auto}svg{display:block}*{print-color-adjust:exact}' +
    styles.join('') + '</style></head><body>' + body.join('') + '</body></html>';
};

export const downloadExportBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 40000);
};

const loadSvg = svg => new Promise((resolve, reject) => {
  const image = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const finish = error => {
    clearTimeout(timer); URL.revokeObjectURL(url);
    image.onload = image.onerror = null;
    if (error) reject(error); else resolve(image);
  };
  const timer = setTimeout(() => finish(new Error('โหลดภาพสำหรับส่งออกไม่สำเร็จ')), 15000);
  image.onload = () => finish();
  image.onerror = () => finish(new Error('โหลดภาพสำหรับส่งออกไม่สำเร็จ'));
  image.src = url;
});

const canvasBlob = (canvas, mime) => new Promise((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('สร้างไฟล์ภาพไม่สำเร็จ')), mime, 0.95);
});

// Write the actual print density into the image, including when the memory limit
// reduces the requested density. This changes only the new exported file.
const withDensity = async (blob, dpi) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (blob.type === 'image/jpeg') {
    if (bytes[2] === 0xff && bytes[3] === 0xe0 && bytes[6] === 0x4a && bytes[7] === 0x46) {
      bytes[13] = 1;
      const view = new DataView(bytes.buffer);
      view.setUint16(14, Math.round(dpi)); view.setUint16(16, Math.round(dpi));
    }
    return new Blob([bytes], { type: blob.type });
  }
  const chunk = new Uint8Array(21), view = new DataView(chunk.buffer);
  view.setUint32(0, 9); chunk.set([112, 72, 89, 115], 4);
  const density = Math.round(dpi / 0.0254);
  view.setUint32(8, density); view.setUint32(12, density); chunk[16] = 1;
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, 17)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  view.setUint32(17, (crc ^ 0xffffffff) >>> 0);
  // Chromium already includes pHYs: replace it instead of creating duplicate chunks.
  const output = [bytes.subarray(0, 33), chunk];
  for (let offset = 33; offset < bytes.length;) {
    const length = new DataView(bytes.buffer).getUint32(offset);
    const end = offset + length + 12;
    if (!(bytes[offset + 4] === 112 && bytes[offset + 5] === 72 && bytes[offset + 6] === 89 && bytes[offset + 7] === 115)) {
      output.push(bytes.subarray(offset, end));
    }
    offset = end;
  }
  return new Blob(output, { type: blob.type });
};

export const renderExportPageImage = async (page, templateId, dimensions, { format = 'png', dpi = 300 } = {}) => {
  if (!['png', 'jpeg'].includes(format) || ![150, 300, 600].includes(Number(dpi))) {
    throw new Error('ตัวเลือกส่งออกภาพไม่ถูกต้อง');
  }
  const { svg, bounds } = await renderExportPageSvg(page, templateId);
  const { pdfW } = dimensions(page, templateId);
  const requestedScale = pdfW / 72 * Number(dpi) / bounds.width;
  const scale = Math.min(requestedScale, MAX_IMAGE_EDGE / bounds.width, MAX_IMAGE_EDGE / bounds.height,
    Math.sqrt(MAX_IMAGE_PIXELS / (bounds.width * bounds.height)));
  const width = Math.max(1, Math.floor(bounds.width * scale));
  const height = Math.max(1, Math.floor(bounds.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  try {
    const image = await loadSvg(svg.replace('width="100%" height="100%"',
      'width="' + width + '" height="' + height + '"'));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('ไม่สามารถเตรียมภาพส่งออกได้');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    const actualDpi = width / (pdfW / 72);
    const blob = await withDensity(await canvasBlob(canvas, 'image/' + format), actualDpi);
    return { blob, width, height, dpi: Math.round(actualDpi), limited: scale < requestedScale - 0.000001 };
  } finally { canvas.width = canvas.height = 1; }
};
