// node render.mjs films/<name>                 full render -> out.mp4 (add --lufs -18 for a quieter sound bed)
// node render.mjs films/<name> --sheet         one frame per beat -> sheet-NN.png
// node render.mjs films/<name> --at 1.5,3:4:0.25   frames at given times (a:b:step ranges) -> strip-NN.png
// node render.mjs films/<name> --gif 960      also write out.gif (looping, for READMEs)
// node render.mjs films/<name> --at 2,5 --png  full-size stills frame-<t>.png (thumbnails, covers)
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync, unlinkSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join, relative, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dir = resolve(process.argv[2] ?? '');
const flag = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1] ?? ''; };
const sheet = process.argv.includes('--sheet');
const at = flag('--at');
const stills = sheet || at !== null;
const target = flag('--lufs') !== null ? +flag('--lufs') : -14; // integrated loudness of the delivered sound
if (!existsSync(join(dir, 'index.html'))) throw new Error(`no index.html in ${dir}`);

// Static server over the studio root: ES modules, fetch and fonts need http, not file://.
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.wav': 'audio/wav' };
const server = createServer((req, res) => {
  const p = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }).end(readFileSync(p));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

// Render mode: kill CSS motion, count every contract violation.
const guard = () => {
  window.__violations = [];
  const flag = (name, fn) => function (...a) { window.__violations.push(name); return fn.apply(this, a); };
  Math.random = flag('Math.random', Math.random);
  window.requestAnimationFrame = flag('requestAnimationFrame', window.requestAnimationFrame);
  window.setTimeout = flag('setTimeout', window.setTimeout);
  document.addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style');
    s.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
    document.head.append(s);
  });
};

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => { console.error('page error:', e.message); process.exit(1); });
await page.addInitScript(guard);
await page.goto(base + relative(root, join(dir, 'index.html')) + '?render=1');
await page.waitForFunction(() => window.FILM && typeof window.seek === 'function', null, { timeout: 60000 });
const film = await page.evaluate(() => window.FILM);
await page.setViewportSize({ width: film.width, height: film.height });

const range = s => s.split(',').flatMap(p => {
  const [a, b, step] = p.split(':').map(Number);
  if (b === undefined) return [a];
  const n = Math.floor((b - a) / step + 1e-9);
  return Array.from({ length: n + 1 }, (_, i) => +(a + i * step).toFixed(4));
});
// one frame per measured beat; without beats.json (no music yet) fall back to a half-second grid
const beatTimes = () => existsSync(join(dir, 'beats.json'))
  ? JSON.parse(readFileSync(join(dir, 'beats.json'), 'utf8')).beats
  : Array.from({ length: Math.floor(film.duration * 2) }, (_, i) => i / 2 + 0.1);
const times = sheet
  ? beatTimes()
  : at !== null ? range(at)
  : Array.from({ length: Math.round(film.duration * film.fps) }, (_, i) => i / film.fps);

const t0 = Date.now();
const violations = () => page.evaluate(() => window.__violations);
const fail = v => {
  const counts = Object.entries(v.reduce((a, x) => ((a[x] = (a[x] ?? 0) + 1), a), {}));
  console.error('Render contract broken:', counts.map(([k, n]) => `${k} x${n}`).join(', '));
  process.exit(1);
};

if (stills) {
  // Contact sheet: thumbnails at phone width (412 px) with the time under each, pages of 24 (16:9) or 8 (9:16).
  const shots = [];
  for (const t of times) {
    await page.evaluate(t => window.seek(t), t);
    shots.push({ t, png: (await page.screenshot({ type: 'png' })).toString('base64') });
  }
  const v = await violations();
  if (v.length) fail(v);
  if (process.argv.includes('--png')) {
    // single full-size stills instead of a sheet: frame-<seconds>.png
    for (const s of shots) writeFileSync(join(dir, `frame-${s.t.toFixed(2)}.png`), Buffer.from(s.png, 'base64'));
    await browser.close(); server.close();
    console.log(`${shots.length} still(s) -> ${dir}/frame-*.png`);
    process.exit(0);
  }
  // --sheet writes sheet-NN.png, --at writes strip-NN.png, so a strip never deletes the beat sheet
  const prefix = sheet ? 'sheet' : 'strip';
  for (const f of readdirSync(dir)) if (new RegExp(`^${prefix}-\\d+\\.png$`).test(f)) unlinkSync(join(dir, f));
  const portrait = film.height > film.width;
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor); // sheets wear the film's ground
  const per = portrait ? 8 : 24;
  const sp = await browser.newPage({ viewport: { width: 4 * 412 + 5 * 12, height: 400 } });
  for (let p = 0; p * per < shots.length; p++) {
    const cells = shots.slice(p * per, p * per + per).map(s =>
      `<figure><img src="data:image/png;base64,${s.png}"><figcaption>${s.t.toFixed(2)}s</figcaption></figure>`).join('');
    await sp.setContent(`<style>body{margin:0;background:${bg};display:grid;grid-template-columns:repeat(4,412px);gap:12px;padding:12px}
      figure{margin:0}img{width:412px;display:block;outline:1px solid rgba(255,255,255,.14)}figcaption{font:13px monospace;color:rgba(255,255,255,.55);padding:4px 0 0}</style>${cells}`);
    await sp.waitForFunction(() => [...document.images].every(i => i.complete));
    await sp.screenshot({ path: join(dir, `${prefix}-${String(p + 1).padStart(2, '0')}.png`), fullPage: true });
  }
  await browser.close();
  server.close();
  console.log(`${shots.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${prefix}-01..${String(Math.ceil(shots.length / per)).padStart(2, '0')}.png`);
  process.exit(0);
}

const audio = join(dir, 'audio.wav');
const hasAudio = existsSync(audio);
const ebur = f => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr.toString();
  return { I: +r.match(/I:\s+(-?[\d.]+) LUFS/g).pop().match(/-?[\d.]+/)[0], TP: +r.match(/Peak:\s+(-?[\d.]+) dBFS/g).pop().match(/-?[\d.]+/)[0] };
};
let af = [];
if (hasAudio) {
  // The score is already normalized and true-peak limited; only a small linear trim is allowed here.
  const m = ebur(audio), gain = target - m.I;
  if (m.TP + gain > -1.2) { console.error(`audio would peak at ${(m.TP + gain).toFixed(1)} dBTP after trim; fix the limiter in the score`); process.exit(1); }
  af = ['-af', `volume=${gain.toFixed(2)}dB`, '-c:a', 'aac', '-b:a', '256k', '-ar', '48000'];
}
if (process.argv.includes('--remux')) {
  // keep the rendered picture, replace only the sound
  const out = join(dir, 'out.mp4'), tmp = join(dir, 'remux.mp4');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', out, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', ...af, '-movflags', '+faststart', '-shortest', tmp]);
  if (r.status) { console.error(r.stderr.toString()); process.exit(1); }
  spawnSync('mv', [tmp, out]);
  const e = ebur(out);
  console.log(`remuxed ${out} | Loudness: ${e.I} LUFS | true peak: ${e.TP} dBFS`);
  await browser.close(); server.close(); process.exit(0);
}

const out = join(dir, 'out.mp4');
const args = ['-f', 'image2pipe', '-framerate', String(film.fps), '-i', '-', ...(hasAudio ? ['-i', audio, ...af] : []),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'slow', '-r', String(film.fps),
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', '-shortest', out];
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((ok, no) => ff.on('close', c => (c ? no(new Error(`ffmpeg exit ${c}`)) : ok())));
for (const [i, t] of times.entries()) {
  await page.evaluate(t => window.seek(t), t);
  const png = await page.screenshot({ type: 'png' });
  if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 60 === 0) process.stdout.write(`\r${i + 1}/${times.length} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
await done;
const v = await violations();
await browser.close();
server.close();
console.log(`\r${times.length}/${times.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${out}`);
if (v.length) fail(v);
if (hasAudio) { const e = ebur(out); console.log(`Loudness: ${e.I} LUFS | true peak: ${e.TP} dBFS`); }
if (flag('--gif') !== null) {
  // README-ready loop: two-pass palette, width from the flag (default: film width), every frame kept
  const gw = +flag('--gif') || film.width, gif = join(dir, 'out.gif');
  const vf = `scale=${gw}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a`;
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', out, '-vf', vf, '-loop', '0', gif]);
  if (r.status) { console.error(r.stderr.toString()); process.exit(1); }
  console.log(`${gif}: ${(statSync(gif).size / 1e6).toFixed(2)} MB`);
}
