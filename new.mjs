// npm run new -- <name> [--9x16 | --both] [--seconds 10] [--bpm 120] [--combo 191B15-D3F425] [--invert] [--style tech|grotesk|editorial|terminal]
// Creates films/<name>/ with a runnable film.js, score.py and index.html.
import { existsSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const valued = new Set(['--seconds', '--bpm', '--combo', '--style']);
const name = args.find((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]));
if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
  console.error('usage: npm run new -- <name> [--9x16] [--seconds 10] [--bpm 120]   (name: a-z, 0-9, -)');
  process.exit(1);
}
const dir = join(root, 'films', name);
if (existsSync(dir)) { console.error(`films/${name} already exists`); process.exit(1); }
const vertical = args.includes('--9x16'), both = args.includes('--both');
const [w, h] = vertical ? [1080, 1920] : [1920, 1080];
const seconds = +opt('--seconds', 10), bpm = +opt('--bpm', 120);
const combo = opt('--combo', '191B15-D3F425').replace(/^.*#/, ''), style = opt('--style', 'tech'), invert = args.includes('--invert');

mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'index.html'), `<!doctype html>
<meta charset="utf-8">
<title>${name}</title>
<link rel="stylesheet" href="../../lib/fonts.css">
<script type="module" src="film.js"></script>
`);
writeFileSync(join(dir, 'film.js'), `// ${name}: ${w}x${h}, ${seconds} s, ${bpm} bpm. draw(ctx, t) must be a pure function of t.
import { C, MONO, E, ease, text, film, drawBars, DISPLAY } from '../../lib/stage.js';

${both ? `// one film, two formats: films/${name}-9x16 sets <html data-format="9x16">; branch on V for layout only
const V = document.documentElement.dataset.format === '9x16';
const W = V ? 1080 : 1920, H = V ? 1920 : 1080, M = V ? 90 : 120, B = 60 / ${bpm}, bt = n => n * B;` : `const W = ${w}, H = ${h}, M = ${vertical ? 90 : 120}, B = 60 / ${bpm}, bt = n => n * B;`}

function draw(ctx, t, d) {
  // the score drives the waveform
  drawBars(ctx, d.wave, t, M, H * 0.66, W - 2 * M, ${both ? 'V ? 200 : 140' : vertical ? 200 : 140}, { reveal: ease(t, 0, 0.5) });
  // one read, landing on beat 1 and held (reading time: >= 1.2 s)
  const p = ease(t, bt(1), bt(1) + 0.35, E.outExpo);
  ctx.save(); ctx.beginPath(); ctx.rect(0, H * 0.4 - 140, W, 180); ctx.clip();
  text(ctx, '${name}', M, H * 0.4 + (1 - p) * 160, { size: ${both ? 'V ? 110 : 140' : vertical ? 110 : 140}, ...DISPLAY() });
  ctx.restore();
  // numbers read the frame, not the blur sample, so they never ghost
  text(ctx, \`t = \${(Math.floor(t * 60 + 1e-6) / 60).toFixed(2)} s\`, M, H * 0.4 + 70, { family: MONO, size: 36, color: C.fg3 });
}

film({ width: W, height: H, fps: 60, duration: ${seconds}, blur: 6, draw, combo: '${combo}', style: '${style}'${invert ? ', invert: true' : ''} });
`);
writeFileSync(join(dir, 'score.py'), `"""${name}: sound for a ${seconds} s film at ${bpm} bpm."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))
from audio import *  # noqa: E402,F403

BPM = ${bpm}
B = 60 / BPM
here = Path(__file__).parent
mx = Mix(${seconds}.0)
b = lambda n: n * B  # noqa: E731

beats = int(${seconds} / B)
for n in range(beats):
    mx.add("fx", b(n), tick(n), 0.35)       # a clock, so beats.py finds the grid
mx.add("dry", b(1), impact(1), 0.9)         # the title lands on beat 1
mx.note(b(1), 62, 0.6, 3.0, pedal=True)

print("LUFS", round(mx.render(here / "audio.wav"), 2))
`);
if (both) {
  const v = join(root, 'films', `${name}-9x16`);
  mkdirSync(v, { recursive: true });
  writeFileSync(join(v, 'index.html'), `<!doctype html>
<html data-format="9x16">
<meta charset="utf-8">
<title>${name} 9:16</title>
<link rel="stylesheet" href="../../lib/fonts.css">
<script type="module" src="../${name}/film.js"></script>
</html>
`);
  for (const f of ['audio.wav', 'wave.json', 'beats.json', 'cues.json']) symlinkSync(`../${name}/${f}`, join(v, f));
}
console.log(`films/${name}${both ? ` + films/${name}-9x16` : ''} created (${w}x${h}, ${seconds} s, ${bpm} bpm, combo ${combo}${invert ? ' inverted' : ''}, style ${style})

next:
  .venv/bin/python films/${name}/score.py
  .venv/bin/python lib/analyze.py films/${name}
  .venv/bin/python beats.py films/${name}
  node render.mjs films/${name} --sheet
  node render.mjs films/${name}`);
