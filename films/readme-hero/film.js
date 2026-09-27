// README hero: a seamless 8 s loop. Everything is periodic in LOOP, so frame 200 == frame 0.
import { C, MONO, E, ease, clamp, text, width, film, drawBars } from '../../lib/stage.js';
import { studioLockup } from '../../lib/logo.js';

const W = 1280, H = 640, M = 80, LOOP = 8, FPS = 25;
const TAU = Math.PI * 2;

// procedural "score": periodic band energies, so the waveform loops with the picture
const wave = {
  band(t, i) {
    const u = ((t % LOOP) + LOOP) % LOOP;
    const hit = Math.exp(-(u % 0.5) * 7), bar = Math.exp(-(u % 2) * 1.6);
    const phrase = 0.6 + 0.4 * Math.sin(TAU * u / LOOP + i * 0.21);
    return clamp((0.28 + 0.5 * hit + 0.3 * bar * (i < 16 ? 1 : 0.5)) * phrase);
  },
};

function draw(ctx, t) {
  const u = t % LOOP;
  // numbers read the frame, not the blur sample: constant within one shutter, so no ghosting
  const uf = Math.floor(u * FPS) / FPS;
  // title block
  studioLockup(ctx, M, 172, 124);
  text(ctx, 'Motion-Design mit Claude Code.', M, 286, { size: 32, weight: 400, color: C.fg2 });
  text(ctx, 'Bild, Schrift und Ton – komplett aus Code.', M, 328, { size: 32, weight: 400, color: C.fg2 });

  // the render contract, live: the frame counter is the loop position
  const frame = String(Math.floor(u * FPS)).padStart(3, '0');
  const fs = 28;
  let x = M;
  x += text(ctx, 'window.seek(', x, 402, { family: MONO, size: fs, color: C.fg2 });
  // emphasis is inversion: Grass chip, Viola digits
  const vs = uf.toFixed(2), vw = width(ctx, vs, { family: MONO, size: fs, weight: 500 });
  ctx.fillStyle = C.signal; ctx.beginPath(); ctx.roundRect(x + 2, 402 - fs * 0.86, vw + 16, fs * 1.18, 6); ctx.fill();
  x += 10 + text(ctx, vs, x + 10, 402, { family: MONO, size: fs, weight: 500, color: C.signalInk }) + 10;
  x += text(ctx, ')  →  frame ', x, 402, { family: MONO, size: fs, color: C.fg3 });
  x += text(ctx, frame, x, 402, { family: MONO, size: fs, weight: 500, color: C.fg });
  if (Math.floor(u * 2) % 2 === 0) { ctx.fillStyle = C.fg; ctx.fillRect(x + 6, 402 - fs * 0.78, fs * 0.5, fs * 0.95); }

  // a motion curve: the dot's position is a pure function of t, ghosts at every beat show the samples
  const cx0 = 780, cx1 = 1200, cy0 = 150, cy1 = 400;
  const path = p => { const e = E.inOutCubic(p); return [cx0 + (cx1 - cx0) * p, cy1 - (cy1 - cy0) * e]; };
  ctx.strokeStyle = C.line2; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i <= 60; i++) { const [px, py] = path(i / 60); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.stroke();
  const pp = 0.5 - 0.5 * Math.cos(TAU * u / LOOP); // there and back: periodic
  for (let k = 0; k <= 8; k++) { const [gx, gy] = path(k / 8); ctx.fillStyle = C.line2; ctx.beginPath(); ctx.arc(gx, gy, 5, 0, TAU); ctx.fill(); }
  const [dx, dy] = path(pp);
  ctx.fillStyle = C.signal; ctx.beginPath(); ctx.arc(dx, dy, 13, 0, TAU); ctx.fill();
  text(ctx, 'x(t), y(t)', cx1, cy0 - 26, { family: MONO, size: 22, color: C.fg3, align: 'right' });

  // timeline: beat ticks, waveform, playhead
  const x0 = M, x1 = W - M, y = 500;
  ctx.fillStyle = C.line2;
  for (let b = 0; b <= LOOP * 2; b++) {
    const bx = x0 + (x1 - x0) * b / (LOOP * 2);
    ctx.fillRect(bx, y - 78, 2, b % 4 === 0 ? 14 : 7);
  }
  drawBars(ctx, wave, t, x0, y, x1 - x0, 96, { gap: 7, bar: 3, color: C.fg2, folds: 3, travel: 0.4 });
  const px = x0 + (x1 - x0) * (u / LOOP);
  ctx.fillStyle = C.signal; ctx.fillRect(px - 1.5, y - 70, 3, 128);
  ctx.beginPath(); ctx.arc(px, y - 70, 6, 0, TAU); ctx.fill();
  const spec = '60 fps · motion blur · -14 LUFS · 1080p · 16:9 + 9:16';
  text(ctx, spec, x1, 606, { family: MONO, size: 20, color: C.fg3, align: 'right' });
}

film({ width: W, height: H, fps: FPS, duration: LOOP, blur: 6, draw, palette: 'studio' });
