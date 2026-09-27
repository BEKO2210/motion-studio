// Workflow reel: 60 s, 9:16, for Instagram. Explains the studio in five steps and points to the repo.
// Timeline and typing come from cues.json, the same file the sound design reads.
// Instagram covers the top 250 px, the bottom 420 px and the right 160 px with its own UI,
// so every read sits inside x 90..920, y 250..1500.
import { C, SANS, MONO, E, ease, lerp, clamp, text, width, film, drawBars } from '../../lib/stage.js';

const W = 1080, H = 1920, FPS = 60;
const X0 = 90, X1 = 920, CW = X1 - X0;
const cue = await (await fetch('cues.json')).json();
const B = 60 / cue.bpm, bt = n => n * B, S = cue.scenes, EV = cue.events;
const CMD = Object.fromEntries(cue.typing.map(c => [c.id, c]));
const sheet = await new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = 'assets/sheet.png'; });
const clip = (ctx, x, y, w, h) => { ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); };
const DISPLAY = { weight: 600, tracking: -0.035 };
const fit = (ctx, s, want, maxW = CW, o = DISPLAY) => Math.min(want, want * maxW / width(ctx, s, { size: want, ...o }));

// a line that rises in through a mask and leaves upward
function rise(ctx, s, x, y, size, a0, a1, o = {}) {
  const t = rise.t;
  const a = ease(t, bt(a0), bt(a0) + 0.35, E.outExpo), z = a1 == null ? 0 : ease(t, bt(a1) - 0.22, bt(a1), E.inExpo);
  if (a <= 0 || z >= 1) return 0;
  ctx.save(); clip(ctx, 0, y - size * 1.05, W, size * 1.4);
  const w = text(ctx, s, x, y + (1 - a) * size * 1.2 - z * size * 1.2, { size, ...DISPLAY, ...o });
  ctx.restore();
  return w;
}
// inverted emphasis: Grass fill, Twilight type
function chip(ctx, s, x, y, size, o = {}) {
  const f = { family: o.family ?? MONO, size, weight: o.weight ?? 500 };
  const w = width(ctx, s, f), px = o.pad ?? size * 0.45;
  ctx.fillStyle = C.signal; ctx.beginPath(); ctx.roundRect(x, y - size * 0.95, w + px * 2, size * 1.35, o.r ?? 8); ctx.fill();
  text(ctx, s, x + px, y, { ...f, color: C.signalInk });
  return w + px * 2;
}

// ---------------------------------------------------------------- terminal typing from cues.json
function typed(id, t) {
  const c = CMD[id], chars = c.text.replace(/\n/g, '');
  const t0 = bt(c.at), n = clamp(Math.floor((t - t0) * c.cps), 0, chars.length);
  const end = t0 + chars.length / c.cps;
  return { c, n, started: t >= t0, done: t >= end + 0.15, doneAt: end + 0.15 };
}
// draws a command, soft-wrapped at '\n' (continuations indented), returns the next free y
function term(ctx, id, x, y, size, t, o = {}) {
  const st = typed(id, t);
  const lh = size * 1.55;
  if (!st.started && !o.ghost) return y;
  const parts = st.c.text.split('\n');
  let off = 0, cy = y, cursorDone = false;
  parts.forEach((p, i) => {
    const vis = p.slice(0, clamp(st.n - off, 0, p.length));
    const lx = x + (i ? width(ctx, '  ', { family: MONO, size }) : 0);
    let cx = lx;
    if (i === 0 && /^[$>] /.test(p)) {
      cx += text(ctx, vis.slice(0, 2), cx, cy, { family: MONO, size, color: C.fg3 });
      cx += text(ctx, vis.slice(2), cx, cy, { family: MONO, size, weight: o.weight ?? 400, color: o.color ?? C.fg });
    } else cx += text(ctx, vis, cx, cy, { family: o.family ?? MONO, size, weight: o.weight ?? 400, color: o.color ?? C.fg });
    // the cursor sits on the line that is being typed
    const here = st.n >= off && (st.n < off + p.length || i === parts.length - 1);
    if (st.started && !st.done && here && !cursorDone) {
      ctx.fillStyle = C.signal; ctx.fillRect(cx + 4, cy - size * 0.78, size * 0.52, size * 0.98);
      cursorDone = true;
    }
    if (i === parts.length - 1 && t >= st.doneAt + 0.1 && o.check !== false) text(ctx, '  ✓', cx, cy, { family: MONO, size, color: C.fg3 });
    off += p.length;
    cy += lh;
  });
  return cy;
}

// a periodic stand-in where the sound design is quiet, so the waveform never looks dead
const PULSE = { band(t, i) { const u = t % 2, hit = Math.exp(-(u % 0.5) * 6); return clamp((0.25 + 0.55 * hit) * (0.6 + 0.4 * Math.sin(t * 2.1 + i * 0.3))); } };

// ---------------------------------------------------------------- recurring: the waveform of this very soundtrack
function band(ctx, t, d, y, h, col = C.line2, src = d.wave) {
  drawBars(ctx, src, t, X0, y, CW, h, { gap: 9, bar: 3, color: col, folds: 3, travel: 0.3 });
}

// step title: inverted number chip + title
function title(ctx, t, num, s, a0, a1) {
  const a = ease(t, bt(a0), bt(a0) + 0.3, E.outBack), z = ease(t, bt(a1) - 0.22, bt(a1), E.inExpo);
  if (a <= 0 || z >= 1) return;
  ctx.save(); ctx.translate(X0, 420); ctx.scale(clamp(a, 0, 1.2), clamp(a, 0, 1.2)); ctx.translate(-X0, -420);
  const cw = chip(ctx, num, X0, 420 - z * 200, 52, { pad: 18, r: 10 });
  ctx.restore();
  const size = fit(ctx, s, 88, CW - 140);
  rise.t = t; rise(ctx, s, X0 + 150, 424, size, a0 + 0.2, a1);
  void cw;
}

// ================================================================ hook: DIESES / VIDEO / IST / CODE.
function hook(ctx, t, d) {
  const words = ['DIESES', 'VIDEO', 'IST'];
  const cy = 900;
  if (t < bt(EV.hookCode)) {
    const i = clamp(Math.floor(t / B), 0, 2);
    const w = words[i];
    const size = fit(ctx, w, 330);
    const p = ease(t, bt(EV.hookWords[i]), bt(EV.hookWords[i]) + 0.16, E.outExpo);
    const s = lerp(1.35, 1, p);
    ctx.save(); ctx.translate(W / 2 - 80, cy); ctx.scale(s, s); ctx.translate(-(W / 2 - 80), -cy);
    text(ctx, w, X0 + CW / 2, cy + size * 0.36, { size, ...DISPLAY, align: 'center' });
    ctx.restore();
    return;
  }
  if (t < bt(EV.hookRead)) {
    // CODE. lands as the inverted block
    const p = ease(t, bt(EV.hookCode), bt(EV.hookCode) + 0.14, E.outExpo);
    const h = 420 * p;
    ctx.fillStyle = C.signal; ctx.fillRect(X0, cy - h / 2, CW, h);
    ctx.save(); clip(ctx, X0, cy - h / 2, CW, h);
    const size = fit(ctx, 'CODE.', 300, CW - 80);
    text(ctx, 'CODE.', X0 + CW / 2, cy + size * 0.36, { size, ...DISPLAY, align: 'center', color: C.signalInk });
    ctx.restore();
    return;
  }
  // the read: this video is code, with its own frame counter
  rise.t = t;
  rise(ctx, 'Dieses Video', X0, 600, fit(ctx, 'Dieses Video', 130), EV.hookRead, S.claim);
  const ws = fit(ctx, 'ist Code.', 130);
  const a = ease(t, bt(EV.hookRead + 0.25), bt(EV.hookRead + 0.25) + 0.3, E.outExpo);
  const z = ease(t, bt(S.claim) - 0.22, bt(S.claim), E.inExpo);
  if (a > 0 && z < 1) {
    ctx.save(); clip(ctx, 0, 740 - ws * 1.05, W, ws * 1.4);
    const y = 740 + (1 - a) * ws * 1.2 - z * ws * 1.2;
    const w1 = text(ctx, 'ist ', X0, y, { size: ws, ...DISPLAY });
    const w2 = width(ctx, 'Code.', { size: ws, ...DISPLAY });
    ctx.fillStyle = C.signal; ctx.fillRect(X0 + w1 - 8, y - ws * 0.8, w2 + 24, ws * 1.0);
    text(ctx, 'Code.', X0 + w1 + 4, y, { size: ws, ...DISPLAY, color: C.signalInk });
    ctx.restore();
  }
  const f = Math.floor(t * FPS + 1e-6);
  const c = ease(t, bt(EV.hookRead + 0.75), bt(EV.hookRead + 0.75) + 0.3, E.outExpo);
  if (c > 0 && z < 1) {
    let x = X0;
    x += text(ctx, 'window.seek(', x, 900, { family: MONO, size: 40, color: C.fg2 });
    x += chip(ctx, (f / FPS).toFixed(2), x + 4, 900, 40) + 8;
    text(ctx, ')', x, 900, { family: MONO, size: 40, color: C.fg2 });
    text(ctx, `frame ${String(f).padStart(4, '0')} / 3600`, X0, 980, { family: MONO, size: 40, color: C.fg });
  }
  band(ctx, t, d, 1230, 240, C.fg3);
}

// ================================================================ claim
function claim(ctx, t, d) {
  rise.t = t;
  rise(ctx, 'Kein After Effects.', X0, 780, fit(ctx, 'Kein After Effects.', 110), EV.claim[0], S.s1);
  const s = 'Nur Claude Code.', size = fit(ctx, s, 110, CW - 40);
  const a = ease(t, bt(EV.claim[1]), bt(EV.claim[1]) + 0.3, E.outExpo), z = ease(t, bt(S.s1) - 0.22, bt(S.s1), E.inExpo);
  if (a > 0 && z < 1) {
    const w = width(ctx, s, { size, ...DISPLAY });
    ctx.fillStyle = C.signal; ctx.fillRect(X0, 820 + 40 * z, (w + 40) * a, size * 1.2);
    ctx.save(); clip(ctx, X0, 820, (w + 40) * a, size * 1.2);
    text(ctx, s, X0 + 20, 820 + size * 0.93, { size, ...DISPLAY, color: C.signalInk });
    ctx.restore();
  }
  band(ctx, t, d, 1230, 160, C.line2);
}

// ================================================================ 01 tools
function s1(ctx, t, d) {
  title(ctx, t, '01', 'Werkzeuge', S.s1, S.s2);
  const lab = (s, y, at) => { if (t >= bt(at) - 0.15) text(ctx, s, X0, y, { family: MONO, size: 26, color: C.fg3 }); };
  lab('macOS', 620, CMD.brew.at); term(ctx, 'brew', X0, 680, 32, t);
  lab('Linux', 800, CMD.apt.at); term(ctx, 'apt', X0, 860, 32, t);
  let x = X0;
  ['Node 22+', 'ffmpeg', 'Python 3'].forEach((s, i) => {
    const p = ease(t, bt(EV.chips[i]), bt(EV.chips[i]) + 0.3, E.outBack);
    const f = { family: MONO, size: 34, weight: 500 }, w = width(ctx, s, f) + 44;
    if (p > 0) {
      ctx.save(); ctx.translate(x + w / 2, 1120); ctx.scale(p, p); ctx.translate(-(x + w / 2), -1120);
      ctx.strokeStyle = C.signal; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x, 1120 - 34, w, 58, 29); ctx.stroke();
      text(ctx, s, x + 22, 1120 + 6, { ...f, color: C.fg });
      ctx.restore();
    }
    x += w + 20;
  });
  band(ctx, t, d, 1440, 70);
}

// ================================================================ 02 clone
function s2(ctx, t, d) {
  title(ctx, t, '02', 'Repo klonen', S.s2, S.s3);
  let y = 640;
  for (const id of ['clone', 'cd', 'npm', 'pw', 'venv', 'pip']) y = term(ctx, id, X0, y, 32, t, { ghost: false }) + (typed(id, t).started ? 14 : 0);
  band(ctx, t, d, 1440, 70);
}

// ================================================================ 03 start
const EFFORT = ['low', 'medium', 'high', 'xhigh', 'max'];
function s3(ctx, t, d) {
  title(ctx, t, '03', 'Claude Code starten', S.s3, S.s4);
  term(ctx, 'claude', X0, 640, 32, t);
  term(ctx, 'model', X0, 735, 32, t, { check: false });
  const open = ease(t, bt(51.6), bt(51.6) + 0.25, E.outExpo);
  if (open > 0) {
    const sel = t >= bt(EV.select[2]) ? 3 : t >= bt(EV.select[1]) ? 2 : t >= bt(EV.select[0]) ? 1 : 0;
    const done = t >= bt(EV.confirm);
    text(ctx, 'effort', X0, 830, { family: MONO, size: 26, color: C.fg3 });
    EFFORT.forEach((e, i) => {
      const y = 895 + i * 66;
      if (i / EFFORT.length > open) return;
      if (i === sel) {
        ctx.fillStyle = done ? C.signal : C.line;
        ctx.beginPath(); ctx.roundRect(X0 - 6, y - 40, 420, 56, 8); ctx.fill();
      }
      text(ctx, (i === sel ? (done ? '✓ ' : '› ') : '  ') + e, X0 + 10, y, { family: MONO, size: 34, weight: i === sel ? 500 : 400, color: i === sel && done ? C.signalInk : i === sel ? C.fg : C.fg3 });
    });
    rise.t = t;
    rise(ctx, 'xhigh für einzelne Filme,', X0, 1290, 44, EV.confirm + 0.5, S.s4, { weight: 400, tracking: -0.01, color: C.fg2 });
    rise(ctx, 'max für große.', X0, 1352, 44, EV.confirm + 0.75, S.s4, { weight: 400, tracking: -0.01, color: C.fg2 });
  }
  band(ctx, t, d, 1440, 70);
}

// ================================================================ 04 brief
const RULES = ['Jedes Bild = Funktion der Zeit', 'Ton im Code, auf dem Takt', 'Lesezeit & Sicherheitsrand', 'Erst prüfen, dann rendern'];
function s4(ctx, t, d) {
  title(ctx, t, '04', 'Briefing geben', S.s4, S.s5);
  const box = ease(t, bt(S.s4 + 0.4), bt(S.s4 + 0.4) + 0.3, E.outExpo);
  if (box > 0) {
    ctx.strokeStyle = C.line2; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(X0, 560, CW * box, 290, 16); ctx.stroke();
    if (box > 0.9) text(ctx, '›', X0 + 26, 636, { size: 44, weight: 600, color: C.signal });
    term(ctx, 'brief', X0 + 70, 636, 36, t, { family: SANS, check: false });
  }
  const r = ease(t, bt(EV.reads), bt(EV.reads) + 0.3, E.outExpo);
  if (r > 0) text(ctx, 'Claude liest CLAUDE.md', X0, 950, { family: MONO, size: 30, color: C.fg3 });
  RULES.forEach((s, i) => {
    const p = ease(t, bt(EV.rules[i]), bt(EV.rules[i]) + 0.3, E.outExpo);
    if (p <= 0) return;
    const y = 1050 + i * 96;
    ctx.fillStyle = C.signal; ctx.fillRect(X0, y - 26, 18 * p, 18);
    ctx.save(); clip(ctx, X0 + 40, y - 50, CW, 70);
    text(ctx, s, X0 + 44, y + (1 - p) * 60, { size: fit(ctx, s, 46, CW - 50, { weight: 400 }), weight: 400, tracking: -0.01 });
    ctx.restore();
  });
  band(ctx, t, d, 1440, 70);
}

// ================================================================ 05 review, then render
function s5(ctx, t, d) {
  title(ctx, t, '05', 'Prüfen, dann rendern', S.s5, S.result);
  term(ctx, 'sheet', X0, 600, 32, t);
  // the contact sheet of this reel, pinned like a proof
  const p = ease(t, bt(EV.sheetIn), bt(EV.sheetIn) + 0.3, E.outBack);
  if (p > 0) {
    const w = CW, h = sheet ? w * sheet.height / sheet.width : 380, y = 740;
    ctx.save(); ctx.translate(X0 + w / 2, y + h / 2); ctx.scale(p, p); ctx.translate(-(X0 + w / 2), -(y + h / 2));
    if (sheet) ctx.drawImage(sheet, X0, y, w, h);
    else { ctx.fillStyle = C.ink2; for (let k = 0; k < 4; k++) ctx.fillRect(X0 + k * (w / 4) + 6, y, w / 4 - 12, h); }
    ctx.restore();
  }
  let x = X0;
  ['Hook 8', 'Lesbarkeit 8', 'Sync 8'].forEach((s, i) => {
    if (t >= bt(EV.scores[i])) x += chip(ctx, s, x, 1180, 30) + 16;
  });
  term(ctx, 'render', X0, 1270, 32, t);
  const [p0, p1] = EV.progress.map(bt);
  if (t >= p0) {
    const f = clamp((Math.floor(t * FPS + 1e-6) / FPS - p0) / (p1 - p0));
    ctx.fillStyle = C.ink2; ctx.fillRect(X0, 1316, CW, 14);
    ctx.fillStyle = C.signal; ctx.fillRect(X0, 1316, CW * f, 14);
    if (t < bt(EV.done)) text(ctx, `frame ${String(Math.round(3600 * f)).padStart(4, '0')} / 3600`, X0, 1392, { family: MONO, size: 30, color: C.fg3 });
    else chip(ctx, '✓ out.mp4 · 1080×1920 · 60 fps', X0, 1400, 30);
  }
}

// ================================================================ result: a live miniature of what you get
function result(ctx, t, d) {
  rise.t = t;
  rise(ctx, 'Fertig.', X0, 660, 200, EV.result, S.cta);
  rise(ctx, '1080p · 60 fps · Motion Blur', X0, 750, fit(ctx, '1080p · 60 fps · Motion Blur', 44, CW, { weight: 400 }), EV.result + 0.5, S.cta, { weight: 400, tracking: 0, color: C.fg2 });
  const a = ease(t, bt(EV.result + 1), bt(EV.result + 1) + 0.35, E.outExpo), z = ease(t, bt(S.cta) - 0.22, bt(S.cta), E.inExpo);
  if (a <= 0 || z >= 1) return;
  const y0 = 840, h = 560 * a * (1 - z);
  ctx.strokeStyle = C.line2; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(X0, y0, CW, h, 20); ctx.stroke();
  ctx.save(); clip(ctx, X0, y0, CW, h);
  text(ctx, 'dein-film', X0 + 50, y0 + 130, { size: 84, ...DISPLAY });
  const u = (t - bt(EV.result)) / 6;
  const px = X0 + 50 + (CW - 100) * (0.5 - 0.5 * Math.cos(Math.PI * 2 * u));
  drawBars(ctx, PULSE, t, X0 + 50, y0 + 330, CW - 100, 170, { gap: 8, bar: 3, color: C.fg2, folds: 3, travel: 0.4 });
  ctx.fillStyle = C.signal; ctx.fillRect(px - 2, y0 + 230, 4, 200);
  text(ctx, `t = ${(Math.floor(t * FPS + 1e-6) / FPS).toFixed(2)} s`, X0 + 50, y0 + 500, { family: MONO, size: 30, color: C.fg3 });
  ctx.restore();
}

// ================================================================ call to action
function cta(ctx, t, d) {
  rise.t = t;
  rise(ctx, 'Alles kostenlos', X0, 680, fit(ctx, 'Alles kostenlos', 116), S.cta);
  rise(ctx, 'auf GitHub.', X0, 810, fit(ctx, 'Alles kostenlos', 116), S.cta + 0.3);
  const done = t >= bt(EV.ctaUrlDone);
  const f = { family: MONO, size: 40, weight: 500 };
  if (done) {
    const w = width(ctx, CMD.url.text, f) + 36;
    ctx.fillStyle = C.signal; ctx.beginPath(); ctx.roundRect(X0 - 4, 970 - 48, w, 66, 10); ctx.fill();
    text(ctx, CMD.url.text, X0 + 14, 970, { ...f, color: C.signalInk });
  } else term(ctx, 'url', X0 + 14, 970, 40, t, { check: false, weight: 500 });
  rise(ctx, 'MIT-Lizenz · Node · Python · Claude Code', X0, 1080, fit(ctx, 'MIT-Lizenz · Node · Python · Claude Code', 32, CW, { family: MONO, weight: 400 }), EV.ctaUrlDone, null, { family: MONO, weight: 400, tracking: 0, color: C.fg3 });
  band(ctx, t, d, 1300, 200, C.fg3, t > bt(EV.ctaUrlDone) ? PULSE : d.wave);
}

// ================================================================ timeline
const SCENES = [[S.hook, hook], [S.claim, claim], [S.s1, s1], [S.s2, s2], [S.s3, s3], [S.s4, s4], [S.s5, s5], [S.result, result], [S.cta, cta]];
const HITS = [...EV.hookWords, EV.hookCode, ...EV.titles, EV.result, EV.cta];
function draw(ctx, t, d) {
  let i = SCENES.length - 1;
  while (i > 0 && t < bt(SCENES[i][0])) i--;
  let pz = 0;
  for (const h of HITS) { const dt = t - bt(h); if (dt >= 0) pz = 0.012 * Math.exp(-dt * 12); }
  ctx.translate(W / 2, H / 2); ctx.scale(1 + pz, 1 + pz); ctx.translate(-W / 2, -H / 2);
  SCENES[i][1](ctx, t, d);
}

film({ width: W, height: H, fps: FPS, duration: 60, blur: 6, draw, palette: 'studio' });
