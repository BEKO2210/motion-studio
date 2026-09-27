// npm run build -- <name> [render flags]   e.g.  npm run build -- intro --sheet
// Runs the whole chain for films/<name>: score.py -> analyze.py -> beats.py -> render.mjs.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const [name, ...flags] = process.argv.slice(2);
if (!name) { console.error('usage: npm run build -- <name> [--sheet | --at 1,2 | --gif 960 | --lufs -18]'); process.exit(1); }
const film = join('films', name);
if (!existsSync(join(root, film, 'index.html'))) { console.error(`${film}/index.html not found`); process.exit(1); }
const py = existsSync(join(root, '.venv/bin/python')) ? join(root, '.venv/bin/python') : 'python3';
const run = (cmd, args) => {
  console.log(`\n> ${[cmd.replace(root + '/', ''), ...args].join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });
  if (r.status) process.exit(r.status);
};
if (existsSync(join(root, film, 'score.py'))) {
  run(py, [join(film, 'score.py')]);
  run(py, ['lib/analyze.py', film]);
  run(py, ['beats.py', film]);
}
run('node', ['render.mjs', film, ...flags]);
