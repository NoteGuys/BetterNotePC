// A small Canvas-compatible recorder, used only by manual exports.
// Reuse the existing ink/paper renderers so nibs, pressure and colors stay identical.
export const escapeXml = value => String(value ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

const number = value => {
  if (!Number.isFinite(value)) throw new Error('พบตำแหน่งที่ไม่ถูกต้องในหน้าส่งออก');
  return String(Math.round(value * 1000000) / 1000000);
};

export class SvgCanvas {
  constructor() {
    this.elements = [];
    this.path = [];
    this.stack = [];
    this.state = { fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, lineCap: 'butt',
      lineJoin: 'miter', globalAlpha: 1, globalCompositeOperation: 'source-over', font: '12px sans-serif' };
  }
  save() { this.stack.push({ ...this.state }); }
  restore() { if (this.stack.length) this.state = this.stack.pop(); }
  beginPath() { this.path = []; }
  closePath() { this.path.push('Z'); }
  moveTo(x, y) { this.path.push('M ' + number(x) + ' ' + number(y)); }
  lineTo(x, y) { this.path.push('L ' + number(x) + ' ' + number(y)); }
  quadraticCurveTo(cx, cy, x, y) {
    this.path.push('Q ' + [cx, cy, x, y].map(number).join(' '));
  }
  arc(cx, cy, radius, start, end, anticlockwise = false) {
    const sweep = anticlockwise ? 0 : 1;
    const sx = cx + radius * Math.cos(start), sy = cy + radius * Math.sin(start);
    if (!this.path.length) this.moveTo(sx, sy); else this.lineTo(sx, sy);
    if (Math.abs(end - start) >= Math.PI * 2 - 0.000001) {
      const mx = cx + radius * Math.cos(start + Math.PI), my = cy + radius * Math.sin(start + Math.PI);
      this.path.push('A ' + [radius, radius, 0, 1, sweep, mx, my].map(number).join(' '));
      this.path.push('A ' + [radius, radius, 0, 1, sweep, sx, sy].map(number).join(' '));
    } else {
      const ex = cx + radius * Math.cos(end), ey = cy + radius * Math.sin(end);
      this.path.push('A ' + [radius, radius, 0, Math.abs(end - start) > Math.PI ? 1 : 0, sweep, ex, ey].map(number).join(' '));
    }
  }
  style() {
    return ' opacity="' + number(this.globalAlpha) + '"' +
      (this.globalCompositeOperation === 'multiply' ? ' style="mix-blend-mode:multiply"' : '');
  }
  stroke() {
    if (!this.path.length) return;
    this.elements.push('<path d="' + this.path.join(' ') + '" fill="none" stroke="' +
      escapeXml(this.strokeStyle) + '" stroke-width="' + number(this.lineWidth) +
      '" stroke-linecap="' + escapeXml(this.lineCap) + '" stroke-linejoin="' +
      escapeXml(this.lineJoin) + '"' + this.style() + '/>');
  }
  fill() {
    if (this.path.length) this.elements.push('<path d="' + this.path.join(' ') +
      '" fill="' + escapeXml(this.fillStyle) + '"' + this.style() + '/>');
  }
  fillRect(x, y, width, height) {
    this.elements.push('<rect x="' + number(x) + '" y="' + number(y) + '" width="' +
      number(width) + '" height="' + number(height) + '" fill="' + escapeXml(this.fillStyle) +
      '"' + this.style() + '/>');
  }
  fillText(text, x, y) {
    const match = this.font.match(/(\d+(?:\.\d+)?)px\s+(.+)/);
    this.elements.push('<text x="' + number(x) + '" y="' + number(y) + '" font-size="' +
      (match ? match[1] : '12') + '" font-family="' + escapeXml(match?.[2] || 'sans-serif') +
      '" fill="' + escapeXml(this.fillStyle) + '"' + this.style() + '>' + escapeXml(text) + '</text>');
  }
  toString() { return this.elements.join(''); }
}
for (const property of ['fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin',
  'globalAlpha', 'globalCompositeOperation', 'font']) {
  Object.defineProperty(SvgCanvas.prototype, property, {
    get() { return this.state[property]; },
    set(value) { this.state[property] = value; }
  });
}
