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
  constructor({ explicitRoundCaps = false } = {}) {
    this.explicitRoundCaps = explicitRoundCaps;
    this.elements = [];
    this.path = [];
    this.stack = [];
    this.roundCaps = new Map();
    this.capColor = null;
    this.state = { fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, lineCap: 'butt',
      lineJoin: 'miter', globalAlpha: 1, globalCompositeOperation: 'source-over', font: '12px sans-serif' };
  }
  save() { this.flushRoundCaps(); this.stack.push({ ...this.state }); }
  restore() { this.flushRoundCaps(); if (this.stack.length) this.state = this.stack.pop(); }
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
    if (this.capColor !== this.strokeStyle) this.flushRoundCaps();
    // Pressure handwriting consists of many short, independently stroked curves.
    // Explicit endpoint disks preserve the Canvas round caps in PDF readers that
    // render these tiny strokes with visible butt-ended seams. Only opaque,
    // simple segments qualify: translucent markers and angular shapes keep
    // their original compositing and joins.
    const simpleRound = this.explicitRoundCaps && this.lineCap === 'round' && this.globalAlpha === 1 &&
      this.globalCompositeOperation === 'source-over' && /^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i.test(this.strokeStyle) &&
      this.path.length === 2 &&
      this.path[0].startsWith('M ') && /^[LQ] /.test(this.path[1]);
    if (!simpleRound) this.flushRoundCaps();
    this.elements.push('<path d="' + this.path.join(' ') + '" fill="none" stroke="' +
      escapeXml(this.strokeStyle) + '" stroke-width="' + number(this.lineWidth) +
      '" stroke-linecap="' + escapeXml(this.lineCap) + '" stroke-linejoin="' +
      escapeXml(this.lineJoin) + '"' + this.style() + '/>');
    if (simpleRound && this.lineWidth > 0) {
      const first = this.path[0].split(' ').slice(1).map(Number);
      const last = this.path[1].split(' ').slice(-2).map(Number);
      this.capColor = this.strokeStyle;
      for (const [x, y] of [first, last]) {
        const key = number(x) + ',' + number(y), radius = this.lineWidth / 2;
        const previous = this.roundCaps.get(key);
        if (!previous || previous.radius < radius) this.roundCaps.set(key, {x, y, radius});
      }
    }
  }
  fill() {
    this.flushRoundCaps();
    if (this.path.length) this.elements.push('<path d="' + this.path.join(' ') +
      '" fill="' + escapeXml(this.fillStyle) + '"' + this.style() + '/>');
  }
  fillRect(x, y, width, height) {
    this.flushRoundCaps();
    this.elements.push('<rect x="' + number(x) + '" y="' + number(y) + '" width="' +
      number(width) + '" height="' + number(height) + '" fill="' + escapeXml(this.fillStyle) +
      '"' + this.style() + '/>');
  }
  fillText(text, x, y) {
    this.flushRoundCaps();
    const match = this.font.match(/(\d+(?:\.\d+)?)px\s+(.+)/);
    this.elements.push('<text x="' + number(x) + '" y="' + number(y) + '" font-size="' +
      (match ? match[1] : '12') + '" font-family="' + escapeXml(match?.[2] || 'sans-serif') +
      '" fill="' + escapeXml(this.fillStyle) + '"' + this.style() + '>' + escapeXml(text) + '</text>');
  }
  flushRoundCaps() {
    if (!this.roundCaps.size) return;
    const disks = [];
    for (const {x, y, radius} of this.roundCaps.values()) {
      // Four cubic quarters avoid Chromium expanding SVG arc conics into
      // dozens of PDF curves per cap. Max radial error is <0.028% of radius.
      const k = radius * 0.5522847498307936;
      const c = values => ' C ' + values.map(number).join(' ');
      disks.push('M ' + number(x + radius) + ' ' + number(y) +
        c([x + radius, y + k, x + k, y + radius, x, y + radius]) +
        c([x - k, y + radius, x - radius, y + k, x - radius, y]) +
        c([x - radius, y - k, x - k, y - radius, x, y - radius]) +
        c([x + k, y - radius, x + radius, y - k, x + radius, y]) + ' Z');
    }
    this.elements.push('<path data-ink-caps="true" d="' + disks.join(' ') + '" fill="' + escapeXml(this.capColor) + '"/>');
    this.roundCaps.clear(); this.capColor = null;
  }
  toString() { this.flushRoundCaps(); return this.elements.join(''); }
}
for (const property of ['fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin',
  'globalAlpha', 'globalCompositeOperation', 'font']) {
  Object.defineProperty(SvgCanvas.prototype, property, {
    get() { return this.state[property]; },
    set(value) { this.state[property] = value; }
  });
}
