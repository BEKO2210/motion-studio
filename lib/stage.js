// Shared film runtime. A film is draw(ctx, t): pure, no state between frames.
export const C = {
  ink0: '#0d1014', ink1: '#12171d', ink2: '#1a2129', tile: '#161b22',
  line: '#232b34', line2: '#313c48', fg: '#e7eaef', fg2: '#a7b0bb', fg3: '#8a95a1', ref: '#6f7a87',
  signal: '#34d399', signalInk: '#04261a',
};
export const SANS = 'Sora', MONO = 'IBM Plex Mono';

// ---------------------------------------------------------------- math
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const mix = (a, b, p) => a.map((v, i) => lerp(v, b[i], p));
export const E = {
  lin: p => p,
  inQuad: p => p * p,
  outQuad: p => 1 - (1 - p) * (1 - p),
  outCubic: p => 1 - (1 - p) ** 3,
  inCubic: p => p ** 3,
  inOutCubic: p => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2),
  outQuart: p => 1 - (1 - p) ** 4,
  inQuart: p => p ** 4,
  inOutQuart: p => (p < 0.5 ? 8 * p ** 4 : 1 - (-2 * p + 2) ** 4 / 2),
  outExpo: p => (p >= 1 ? 1 : 1 - 2 ** (-10 * p)),
  inExpo: p => (p <= 0 ? 0 : 2 ** (10 * p - 10)),
  inOutExpo: p => (p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? 2 ** (20 * p - 10) / 2 : (2 - 2 ** (-20 * p + 10)) / 2),
  outBack: p => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2,
  // critically-damped-ish spring settle, overshoots once
  spring: p => (p >= 1 ? 1 : 1 - Math.exp(-7 * p) * Math.cos(9 * p)),
};
export const ease = (t, a, b, f = E.outExpo) => f(seg(t, a, b));

export const mulberry32 = a => () => {
  a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
// stateless hash noise: same (i, seed) -> same value in [0,1)
export const hash = (i, seed = 0) => mulberry32((i * 374761393 + seed * 668265263) | 0)();
export const rand = seed => { const r = mulberry32(seed); return (a = 0, b = 1) => a + (b - a) * r(); };

// ---------------------------------------------------------------- type
export function font(ctx, size, { family = SANS, weight = 600, tracking = 0 } = {}) {
  ctx.font = `${weight} ${size}px "${family}"`;
  ctx.letterSpacing = `${tracking * size}px`;
}
export function text(ctx, s, x, y, o = {}) {
  font(ctx, o.size ?? 32, o);
  ctx.fillStyle = o.color ?? C.fg;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'alphabetic';
  if (o.halo) {
    // knock lines out around the glyphs so connectors visibly stop before the text
    ctx.save(); ctx.strokeStyle = o.haloColor ?? C.ink0; ctx.lineWidth = o.halo; ctx.lineJoin = 'round';
    ctx.strokeText(s, x, y); ctx.restore();
  }
  ctx.fillText(s, x, y);
  return ctx.measureText(s).width;
}
export function width(ctx, s, o = {}) { font(ctx, o.size ?? 32, o); return ctx.measureText(s).width; }

const GLYPHS = '01{}[]:,"<>/=+-*#_.;abcdefxyz';
// Resolve text left to right; unresolved characters flicker through a seeded glyph set.
export function scramble(s, p, t, seed = 0, fps = 30) {
  const n = s.length, k = Math.floor(p * n * 1.0001);
  const f = Math.floor(t * fps);
  let out = '';
  for (let i = 0; i < n; i++) {
    if (i < k || s[i] === ' ') out += s[i];
    else if (i < k + 6) out += GLYPHS[Math.floor(hash(i * 131 + f, seed) * GLYPHS.length)];
  }
  return out;
}

// Monospace code line with token colors. tokens: [[text, color], ...]. Returns width.
export function code(ctx, tokens, x, y, size, o = {}) {
  font(ctx, size, { family: MONO, weight: o.weight ?? 400 });
  ctx.textBaseline = o.baseline ?? 'alphabetic';
  ctx.textAlign = 'left';
  let cx = x;
  for (const [s, c] of tokens) { ctx.fillStyle = c; ctx.fillText(s, cx, y); cx += ctx.measureText(s).width; }
  return cx - x;
}
// Simple C++ / JSON tokenizer for coloring: keywords fg, strings fg2, numbers signal-free fg, punctuation fg3.
const KW = /^(auto|const|constexpr|struct|return|if|else|for|namespace|using|template|typename|std|statim|float|int|bool|void|noexcept|co_await|static|inline)$/;
export function tokens(line, hot = null) {
  const out = [];
  const re = /("(?:[^"\\]|\\.)*"|\/\/.*$|[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|\s+|.)/g;
  let m;
  while ((m = re.exec(line))) {
    const s = m[0];
    let c = C.fg3;
    if (s.startsWith('//')) c = C.ref;
    else if (s[0] === '"') c = C.fg2;
    else if (/^\d/.test(s)) c = C.fg;
    else if (KW.test(s)) c = C.fg;
    else if (/^[A-Za-z_]/.test(s)) c = C.fg2;
    if (hot && s.replace(/"/g, '') === hot) c = C.signal;
    out.push([s, c]);
  }
  return out;
}

// ---------------------------------------------------------------- brand
// Mark geometry in its 64x64 viewBox: input line, three options, the middle one decided.
export function mark(ctx, cx, cy, size, o = {}) {
  const s = size / 64;
  const line = o.line ?? 1, opts = o.opts ?? 1, pick = o.pick ?? 1, tile = o.tile ?? 0;
  ctx.save();
  ctx.translate(cx - 32 * s, cy - 32 * s);
  ctx.scale(s, s);
  if (tile > 0) {
    ctx.globalAlpha = tile;
    ctx.fillStyle = C.tile;
    ctx.beginPath(); ctx.roundRect(0, 0, 64, 64, 15); ctx.fill();
    ctx.strokeStyle = C.line2; ctx.lineWidth = 1 / s * 1.2; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (line > 0) {
    ctx.strokeStyle = o.lineColor ?? C.fg; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(14, 32); ctx.lineTo(14 + 17 * line, 32); ctx.stroke();
  }
  ctx.strokeStyle = C.fg3; ctx.lineWidth = 2;
  for (const y of [17.5, 46.5]) {
    if (opts <= 0) continue;
    ctx.beginPath(); ctx.arc(43, y, 3.6 * opts, 0, Math.PI * 2); ctx.stroke();
  }
  if (pick > 0) {
    ctx.fillStyle = C.signal;
    ctx.beginPath(); ctx.arc(43, 32, 7.5 * pick, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// Wordmark strokes from assets/brand/logo-dark.svg (inner group, before its 0.86 scale).
export const WORD = [
  'M27 25C24 21 19 20 15.5 20C9 20 5 23 5 28C5 33 10 35 16 37C22 39 28 41 28 47C28 53 23 56 16 56C11 56 7 54 5 51',
  'M44 8V48C44 54 47 56 51 56C53 56 55 55.5 56 55M38 20H51',
  'M98 38A18 18 0 1 1 62 38A18 18 0 1 1 98 38M98 20V56',
  'M115 8V48C115 54 118 56 122 56C124 56 126 55.5 127 55M109 20H122',
  'M141 20V56',
  'M158 20V56M158 30C158 24 162 20 168 20C174 20 178 24 178 30V56M178 30C178 24 182 20 188 20C194 20 198 24 198 30V56',
];
export const WORD_BOX = { x: 5, y: 0.5, w: 193, h: 55.5 }; // dot top (0.5) to baseline stroke (56)
const lengths = WORD.map(d => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); return p; });
let LEN = null;
function pathLengths() {
  if (LEN) return LEN;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'absolute'; svg.style.visibility = 'hidden';
  lengths.forEach(p => svg.append(p));
  document.body.append(svg);
  LEN = lengths.map(p => p.getTotalLength());
  svg.remove();
  return LEN;
}
const P2D = WORD.map(d => new Path2D(d));
// Draw the wordmark with its left edge at x, baseline at y, height h (x-height of the s-to-m strokes).
// draw: 0..1 per stroke write-on (array or number), dot: 0..1 scale of the i-dot.
export function wordmark(ctx, x, y, h, o = {}) {
  const s = h / 36; // strokes span y 20..56 for the x-height
  const len = pathLengths();
  const draw = o.draw ?? 1;
  ctx.save();
  ctx.translate(x - 5 * s, y - 56 * s);
  ctx.scale(s, s);
  ctx.strokeStyle = o.color ?? C.fg; ctx.lineWidth = o.weight ?? 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  P2D.forEach((p, i) => {
    const d = Array.isArray(draw) ? draw[i] : draw;
    if (d <= 0) return;
    if (d < 1) { ctx.setLineDash([len[i] * d, len[i] * 2]); } else ctx.setLineDash([]);
    ctx.stroke(p);
  });
  ctx.setLineDash([]);
  const dot = o.dot ?? 1;
  if (dot > 0) { ctx.fillStyle = C.signal; ctx.beginPath(); ctx.arc(141, 6 + (o.dotY ?? 0) / s, 5.5 * dot, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  return 193 * s; // drawn width
}

// ---------------------------------------------------------------- audio-driven waveform
export class Wave {
  constructor(w) {
    const bin = atob(w.data);
    this.fps = w.fps; this.n = w.frames; this.b = w.bands + 1;
    this.v = Uint8Array.from(bin, c => c.charCodeAt(0));
  }
  band(t, i) {
    const f = clamp(t * this.fps, 0, this.n - 1.001), f0 = Math.floor(f), p = f - f0;
    return lerp(this.v[f0 * this.b + i], this.v[(f0 + 1) * this.b + i], p) / 255;
  }
  peak(t) { return this.band(t, this.b - 1); }
  // smoothed energy of band range [a, b)
  energy(t, a = 0, b = 48) { let s = 0; for (let i = a; i < b; i++) s += this.band(t, i); return s / (b - a); }
}

// Thin mirrored bars across [x, x+w], centered on y. Each bar reads a band (wrapping, mirrored in the
// middle) plus a slight delay across x, so the shape travels. p: 0..1 reveal from the left.
export function drawBars(ctx, wave, t, x, y, w, h, o = {}) {
  const gap = o.gap ?? 6, bw = o.bar ?? 2, n = Math.floor(w / gap);
  const reveal = o.reveal ?? 1, floor = o.floor ?? 0.04;
  ctx.fillStyle = o.color ?? C.fg3;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    if (u > reveal) break;
    const bi = Math.floor(Math.abs(Math.sin(u * Math.PI * (o.folds ?? 3))) * 44) + 2;
    const lag = (o.travel ?? 0.25) * u;
    let a = wave.band(t - lag, bi) ** 1.6;
    a = floor + a * (1 - floor);
    const hh = Math.max(bw, a * h);
    if (o.hot && Math.abs(u - o.hot) < 0.02) ctx.fillStyle = C.signal; else ctx.fillStyle = o.color ?? C.fg3;
    ctx.fillRect(x + i * gap, y - hh / 2, bw, hh);
  }
}
// Oscilloscope line: a band-synthesized trace, deterministic in t.
export function drawTrace(ctx, wave, t, x, y, w, h, o = {}) {
  const n = Math.floor(w / 3);
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    let v = 0;
    for (let k = 0; k < 6; k++) {
      const e = wave.band(t - u * 0.12, 4 + k * 7);
      v += e ** 2 * Math.sin(u * (6 + k * 11) * Math.PI + t * (3 + k * 2) + k);
    }
    const env = Math.sin(Math.PI * u) ** 0.5;
    const yy = y + v * h * 0.35 * env * (o.gain ?? 1);
    i ? ctx.lineTo(x + u * w, yy) : ctx.moveTo(x + u * w, yy);
  }
  ctx.strokeStyle = o.color ?? C.fg; ctx.lineWidth = o.lw ?? 2; ctx.stroke();
}

// ---------------------------------------------------------------- runtime
export async function film(o) {
  const { width, height, fps = 60, duration, blur = 4, shutter = 0.5, draw } = o;
  const dir = location.pathname.replace(/[^/]*$/, '');
  const faces = [`600 64px "${SANS}"`, `500 64px "${SANS}"`, `400 64px "${SANS}"`, `400 64px "${MONO}"`, `500 64px "${MONO}"`];
  const got = await Promise.all(faces.map(f => document.fonts.load(f)));
  if (got.some(g => g.length === 0)) throw new Error('brand fonts missing: ' + faces.filter((f, i) => !got[i].length).join(', '));
  const get = async f => { const r = await fetch(dir + f); return r.ok ? r.json() : null; };
  const [beats, cues, wave] = await Promise.all([get('beats.json'), get('cues.json'), get('wave.json')]);
  const data = { beats: beats?.beats ?? [], cues, wave: wave ? new Wave(wave) : null };

  const cv = document.createElement('canvas');
  cv.width = width; cv.height = height;
  document.body.style.cssText = `margin:0;background:${C.ink0};overflow:hidden`;
  document.body.append(cv);
  const ctx = cv.getContext('2d');
  const sub = document.createElement('canvas'); sub.width = width; sub.height = height;
  const sctx = sub.getContext('2d');
  const render = location.search.includes('render');
  const paint = (c, t) => { c.save(); c.fillStyle = C.ink0; c.fillRect(0, 0, width, height); draw(c, t, data); c.restore(); };

  window.seek = t => {
    if (!render) { paint(ctx, t); return; }
    // motion blur: average `blur` samples across the open shutter [t, t + shutter/fps)
    const n = typeof blur === 'function' ? blur(t) : blur;
    if (n <= 1) { paint(ctx, t); return; }
    for (let k = 0; k < n; k++) {
      paint(sctx, t + (k / n) * (shutter / fps));
      ctx.globalAlpha = 1 / (k + 1);
      ctx.drawImage(sub, 0, 0);
    }
    ctx.globalAlpha = 1;
  };
  window.FILM = { width, height, fps, duration };
  if (!render) {
    // preview: ?t=3.2 shows one frame, otherwise plays in real time
    const q = new URLSearchParams(location.search);
    if (q.has('t')) window.seek(+q.get('t'));
    else { const t0 = performance.now(); const loop = () => { window.seek(((performance.now() - t0) / 1000) % duration); requestAnimationFrame(loop); }; loop(); }
  }
  return data;
}
