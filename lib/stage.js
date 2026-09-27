// Shared film runtime. A film is draw(ctx, t): pure, no state between frames.
// Default palette: Twilight Zone x Stadium Grass (combo.it-handwerk-stuttgart.de/#191B15-D3F425).
// A two-color system: the ground is Twilight Zone, type and lines are Stadium Grass and its OKLCH
// shades (same hue), dividers and tracks are tints of Twilight Zone. Emphasis is inversion:
// a Grass fill with Twilight type. C is mutable so a film can bring its own palette.
export const C = {
  ink0: '#191b15', ink1: '#1f221a', ink2: '#282a22', tile: '#23251e',
  line: '#31342c', line2: '#464941', fg: '#d3f425', fg2: '#a0b742', fg3: '#7a8843', ref: '#636e3f',
  signal: '#d3f425', signalInk: '#191b15',
};
export const PALETTES = { studio: { ...C } };

// ---------------------------------------------------------------- colour: any two-colour combo -> a full palette
// hex <-> OKLCH (Björn Ottosson's OKLab), so shades keep their hue instead of drifting to mud
const toLin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGam = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
export function hexToOklch(hex) {
  const n = parseInt(hex.replace('#', ''), 16), [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(v => toLin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const q = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * q;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * q;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * q;
  return [L, Math.hypot(A, B), (Math.atan2(B, A) * 180 / Math.PI + 360) % 360];
}
export function oklchToHex(L, Cc, h) {
  const a = Cc * Math.cos(h * Math.PI / 180), b = Cc * Math.sin(h * Math.PI / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, q = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * q, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * q, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * q];
  return '#' + rgb.map(v => Math.round(clamp(toGam(clamp(v))) * 255).toString(16).padStart(2, '0')).join('');
}
// comboPalette('191B15-D3F425') or a combo.it-handwerk-stuttgart.de link. The darker colour becomes the
// ground (invert: true swaps that), the other one type and lines. Ground tints and ink shades are
// derived in OKLCH; emphasis is inversion (signal fill with signalInk type).
export function comboPalette(combo, { invert = false } = {}) {
  const hexes = String(combo).match(/[0-9a-f]{6}/gi);
  if (!hexes || hexes.length < 2) throw new Error(`combo needs two hex colours, got "${combo}"`);
  let [g, k] = hexes.slice(-2).map(hexToOklch);
  if ((g[0] > k[0]) !== invert) [g, k] = [k, g];
  const dir = g[0] < k[0] ? 1 : -1;                      // tints move away from the ground, towards the ink
  const tint = d => oklchToHex(g[0] + dir * d, Math.max(g[1] * 1.15, 0.01), g[2]);
  const shade = f => oklchToHex(k[0] + (g[0] - k[0]) * f, k[1] * (1 - f) ** 1.3, k[2]);
  return {
    ink0: oklchToHex(...g), ink1: tint(0.027), tile: tint(0.042), ink2: tint(0.062), line: tint(0.102), line2: tint(0.182),
    fg: oklchToHex(...k), fg2: shade(0.25), fg3: shade(0.45), ref: shade(0.57),
    signal: oklchToHex(...k), signalInk: oklchToHex(...g),
  };
}

// ---------------------------------------------------------------- style: type pairing and motion character
// SANS and MONO are live bindings: film({ style }) switches them before the first frame.
export const STYLES = {
  tech:      { display: 'Sora', ui: 'IBM Plex Mono', weight: 600, tracking: -0.035, radius: 10, ease: 'outExpo' },
  grotesk:   { display: 'Space Grotesk', ui: 'JetBrains Mono', weight: 700, tracking: -0.05, radius: 0, ease: 'outQuart' },
  editorial: { display: 'Instrument Serif', ui: 'IBM Plex Mono', weight: 400, tracking: -0.01, italic: true, radius: 2, ease: 'inOutCubic' },
  terminal:  { display: 'JetBrains Mono', ui: 'JetBrains Mono', weight: 800, tracking: -0.03, radius: 0, ease: 'outCubic' },
};
export let STYLE = STYLES.tech;
export let SANS = STYLE.display, MONO = STYLE.ui;
// the display settings of the active style, for text(..., { size, ...DISPLAY() })
export const DISPLAY = () => ({ family: SANS, weight: STYLE.weight, tracking: STYLE.tracking, italic: STYLE.italic });
export function useStyle(name) {
  STYLE = typeof name === 'string' ? STYLES[name] : { ...STYLES.tech, ...name };
  if (!STYLE) throw new Error(`unknown style "${name}" (${Object.keys(STYLES).join(', ')})`);
  SANS = STYLE.display; MONO = STYLE.ui;
}

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
export function font(ctx, size, { family = SANS, weight = 600, tracking = 0, italic } = {}) {
  const it = italic ?? (family === SANS && STYLE.italic);
  ctx.font = `${it ? 'italic ' : ''}${weight} ${size}px "${family}"`;
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
const KW = /^(auto|const|constexpr|struct|class|return|if|else|for|while|namespace|using|template|typename|std|float|int|bool|void|noexcept|co_await|static|inline|import|export|from|function|let|var|new)$/;
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
  const { width, height, fps = 60, duration, blur = 4, shutter = 0.5, draw, palette, combo, invert, style } = o;
  if (palette) Object.assign(C, typeof palette === 'string' ? PALETTES[palette] : palette);
  if (combo) Object.assign(C, comboPalette(combo, { invert }));
  if (style) useStyle(style);
  const dir = location.pathname.replace(/[^/]*$/, '');
  const faces = [`${STYLE.italic ? 'italic ' : ''}${STYLE.weight} 64px "${SANS}"`, `400 64px "${SANS}"`, `400 64px "${MONO}"`, `500 64px "${MONO}"`];
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
