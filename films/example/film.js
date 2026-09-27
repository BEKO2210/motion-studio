// Minimal film: 4 seconds, a waveform driven by the score and one read that lands on the beat.
import { C, MONO, E, ease, text, film, drawBars } from '../../lib/stage.js';

const W = 1920, H = 1080, B = 0.5, bt = n => n * B;

function draw(ctx, t, d) {
  drawBars(ctx, d.wave, t, 120, 700, W - 240, 160, { reveal: ease(t, 0, 0.4) });
  const p = ease(t, bt(1), bt(1) + 0.35, E.outExpo);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 300, W, 200); ctx.clip();
  text(ctx, 'window.seek(t)', 120, 460 + (1 - p) * 160, { family: MONO, size: 120, weight: 500 });
  ctx.restore();
  const q = ease(t, bt(3), bt(3) + 0.35, E.outExpo);
  if (q > 0) text(ctx, 'every frame is a function of time', 120, 560, { size: 48, weight: 400, color: q > 0.5 ? C.signal : C.fg3 });
}

film({ width: W, height: H, fps: 60, duration: 4, blur: 6, draw });
