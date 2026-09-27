// The motion-studio mark: motion is a function of time. A tile, an easing curve between two hollow
// keyframes, and a filled "now" travelling on the curve. Colours come from the active palette:
// the tile is the signal colour, the drawing is signalInk (the inversion rule).
import { C, clamp, text, width, SANS } from './stage.js';

// curve in a 100-unit box: an ease-in-out, flat - steep - flat, from bottom left to top right
const P0 = [22, 71], P1 = [56, 71], P2 = [44, 29], P3 = [78, 29];
const bez = u => {
  const m = 1 - u;
  return [0, 1].map(k => m ** 3 * P0[k] + 3 * m * m * u * P1[k] + 3 * m * u * u * P2[k] + u ** 3 * P3[k]);
};

// draw: 0..1 how much of the curve is drawn; now: 0..1 where the dot sits on it (default 0.5)
export function studioMark(ctx, cx, cy, size, o = {}) {
  const draw = o.draw ?? 1, now = o.now ?? 0.5, tile = o.tile ?? 1, s = size / 100;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(s, s);
  if (tile > 0) {
    ctx.fillStyle = o.tileColor ?? C.signal;
    ctx.beginPath(); ctx.roundRect(50 - 50 * tile, 50 - 50 * tile, 100 * tile, 100 * tile, 22 * tile); ctx.fill();
  }
  const ink = o.ink ?? C.signalInk;
  ctx.strokeStyle = ink; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath();
  const N = 48;
  for (let i = 0; i <= N * clamp(draw); i++) { const [x, y] = bez(i / N); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  if (draw > 0) ctx.stroke();
  const key = ([x, y]) => {                         // keyframes: hollow rings
    ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(x, y, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = o.tileColor ?? C.signal; ctx.fill(); ctx.stroke();
  };
  if (draw > 0) key(P0);
  if (draw >= 1) key(P3);
  if (now > 0 && draw >= now) {                     // the frame being painted: filled
    const [x, y] = bez(now);
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x, y, 10.5 * (o.dot ?? 1), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// mark + wordmark on one baseline; h = tile height. Returns the total width.
export function studioLockup(ctx, x, cy, h, o = {}) {
  studioMark(ctx, x + h / 2, cy, h, o);
  const size = h * 0.56, f = { size, weight: 600, tracking: -0.04, family: o.family ?? SANS };
  const tx = x + h * 1.28;
  const w = width(ctx, 'motion-studio', f);
  if ((o.word ?? 1) > 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(tx - 4, cy - h, w * (o.word ?? 1) + 8, h * 2); ctx.clip();
    text(ctx, 'motion-studio', tx, cy + size * 0.36, { ...f, color: o.wordColor ?? C.fg });
    ctx.restore();
  }
  return tx + w - x;
}

