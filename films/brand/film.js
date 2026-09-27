// motion-studio identity, rendered by the studio itself. One film, four variants set by
// <html data-variant="...">: mark (1024 square), lockup, lockup-light (inverted), social (GitHub preview).
// The mark draws itself in 1.6 s and then holds, so --gif gives the animated logo and --at 2.5 --png the still.
import { C, MONO, E, ease, text, film, drawBars, clamp } from '../../lib/stage.js';
import { studioMark, studioLockup } from '../../lib/logo.js';

const VAR = document.documentElement.dataset.variant ?? 'mark';
const SIZE = { mark: [1024, 1024], lockup: [1600, 480], 'lockup-light': [1600, 480], social: [1280, 640] }[VAR];
const [W, H] = SIZE;
const anim = t => ({
  draw: ease(t, 0.1, 1.0, E.inOutCubic),
  now: 0.5 * ease(t, 0.55, 1.35, E.outExpo),
  dot: ease(t, 0.55, 1.0, E.spring),
  tile: ease(t, 0, 0.35, E.outBack),
});
// a periodic stand-in for sound, so a still has a waveform
const PULSE = { band: (t, i) => clamp(0.3 + 0.5 * Math.exp(-((t + i * 0.013) % 0.5) * 6) * (0.6 + 0.4 * Math.sin(i * 0.45))) };

function draw(ctx, t) {
  const a = anim(t);
  if (VAR === 'mark') { studioMark(ctx, W / 2, H / 2, 820, a); return; }
  if (VAR === 'lockup' || VAR === 'lockup-light') {
    studioLockup(ctx, 150, H / 2, 260, { ...a, word: ease(t, 1.0, 1.6, E.outExpo) });
    return;
  }
  // social preview
  studioLockup(ctx, 110, 230, 150, { ...a, word: ease(t, 1.0, 1.6, E.outExpo) });
  const p = ease(t, 1.4, 1.9, E.outExpo);
  if (p > 0) {
    text(ctx, 'Motion-Design aus Code – gebaut von Claude Code.', 110, 400, { size: 38, weight: 400, tracking: -0.01, color: C.fg2 });
    text(ctx, 'Bild, Schrift und Ton als Funktion der Zeit.', 110, 452, { size: 38, weight: 400, tracking: -0.01, color: C.fg2 });
    text(ctx, 'github.com/BEKO2210/motion-studio', 110, 548, { family: MONO, size: 28, weight: 500, color: C.fg3 });
  }
  drawBars(ctx, PULSE, t, 760, 548, 410, 60, { gap: 8, bar: 3, color: C.line2, folds: 3, reveal: p });
}

film({ width: W, height: H, fps: 60, duration: 3, blur: 6, draw, combo: '191B15-D3F425', invert: VAR === 'lockup-light', style: 'tech' });
