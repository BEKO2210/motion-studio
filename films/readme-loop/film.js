// README diagram: the studio loop as a 12 s cycle. A token runs the pipeline, fails the review twice,
// passes the third time and renders. Lines are routed around every label.
import { C, MONO, E, ease, lerp, clamp, text, width, film } from '../../lib/stage.js';

const W = 1280, H = 720, LOOP = 12, FPS = 25, TAU = Math.PI * 2;
const R1 = 210, R2 = 470, XS = [180, 620, 1060];
const N = [
  { x: XS[0], y: R1, name: '01 score.py', out: 'audio.wav' },
  { x: XS[1], y: R1, name: '02 beats.py', out: 'beats.json' },
  { x: XS[2], y: R1, name: '03 analyze.py', out: 'wave.json' },
  { x: XS[0], y: R2, name: '04 render --sheet', out: 'contact sheet' },
  { x: XS[1], y: R2, name: '05 review', out: '' },
  { x: XS[2], y: R2, name: '06 render', out: 'out.mp4' },
];
// edges as polylines, clear of all labels
const EDGE = {
  e12: [[XS[0] + 26, R1], [XS[1] - 26, R1]],
  e23: [[XS[1] + 26, R1], [XS[2] - 26, R1]],
  e34: [[XS[2] + 26, R1], [1190, R1], [1190, 340], [90, 340], [90, R2], [XS[0] - 26, R2]],
  e45: [[XS[0] + 26, R2], [XS[1] - 26, R2]],
  e56: [[XS[1] + 26, R2], [XS[2] - 26, R2]],
};
const back = u => { // loop back 5 -> 4: quadratic arc above row 2
  const a = [XS[1] - 18, R2 - 18], c = [400, 360], b = [XS[0] + 18, R2 - 18], m = 1 - u;
  return [m * m * a[0] + 2 * m * u * c[0] + u * u * b[0], m * m * a[1] + 2 * m * u * c[1] + u * u * b[1]];
};
// timeline: [t0, t1, kind, ref]; kind 'at' = dwell on node ref, 'edge' = travel along EDGE[ref], 'back' = loop back
const PLAN = [
  [0, 0.8, 'at', 0], [0.8, 1.2, 'edge', 'e12'], [1.2, 2.0, 'at', 1], [2.0, 2.4, 'edge', 'e23'], [2.4, 3.2, 'at', 2],
  [3.2, 4.0, 'edge', 'e34'], [4.0, 4.8, 'at', 3], [4.8, 5.1, 'edge', 'e45'], [5.1, 5.8, 'at', 4],
  [5.8, 6.4, 'back'], [6.4, 6.9, 'at', 3], [6.9, 7.2, 'edge', 'e45'], [7.2, 7.8, 'at', 4],
  [7.8, 8.4, 'back'], [8.4, 8.9, 'at', 3], [8.9, 9.2, 'edge', 'e45'], [9.2, 9.9, 'at', 4],
  [9.9, 10.2, 'edge', 'e56'], [10.2, 12, 'at', 5],
];
function along(pts, f) {
  const L = []; let tot = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(l); tot += l; }
  let d = f * tot;
  for (let i = 0; i < L.length; i++) { if (d <= L[i]) { const u = d / L[i]; return [lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)]; } d -= L[i]; }
  return pts[pts.length - 1];
}
function tokenAt(u) {
  for (const [a, b, kind, ref] of PLAN) {
    if (u < a || u >= b) continue;
    const f = E.inOutCubic((u - a) / (b - a));
    if (kind === 'at') return { p: [N[ref].x, N[ref].y], node: ref };
    if (kind === 'edge') return { p: along(EDGE[ref], f) };
    return { p: back(f) };
  }
  return { p: [N[5].x, N[5].y], node: 5 };
}
const visited = (u, i) => PLAN.some(([a, , kind, ref]) => kind === 'at' && ref === i && u >= a);

function stroke(pts, col, w = 2) {
  const ctx = stroke.ctx;
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round';
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
}

function draw(ctx, t) {
  stroke.ctx = ctx;
  const u = t % LOOP, uf = Math.floor(u * FPS) / FPS;
  text(ctx, 'The studio loop', 90, 110, { size: 44, weight: 600, tracking: -0.03 });
  text(ctx, 'nothing is rendered in full before every score is 8 or better', 90, 150, { family: MONO, size: 22, color: C.fg3 });

  Object.values(EDGE).forEach(p => stroke(p, C.line2));
  const arc = Array.from({ length: 31 }, (_, i) => back(i / 30));
  ctx.setLineDash([8, 8]); stroke(arc, C.line2); ctx.setLineDash([]);
  text(ctx, 'fix the 3 worst', 400, 446, { family: MONO, size: 20, color: C.fg3, align: 'center', halo: 10 });

  const tok = tokenAt(u);
  N.forEach((n, i) => {
    const on = tok.node === i, seen = visited(u, i);
    ctx.fillStyle = on ? C.signal : seen ? C.fg : C.line2;
    ctx.beginPath(); ctx.arc(n.x, n.y, on ? 14 : 11, 0, TAU); ctx.fill();
    text(ctx, n.name, n.x, n.y + 56, { family: MONO, size: 26, weight: 500, color: seen ? C.fg : C.fg3, align: 'center' });
    if (n.out && seen) text(ctx, '→ ' + n.out, n.x, n.y + 88, { family: MONO, size: 22, color: C.fg3, align: 'center' });
  });

  // 04: the contact sheet fills tile by tile on every visit
  const lastSheet = [...PLAN].reverse().find(([a, , k, r]) => k === 'at' && r === 3 && u >= a);
  if (lastSheet) {
    const f = clamp((u - lastSheet[0]) / (lastSheet[1] - lastSheet[0]));
    for (let k = 0; k < 6; k++) {
      const x = 120 + (k % 3) * 42, y = R2 + 108 + Math.floor(k / 3) * 28;
      ctx.fillStyle = f * 6 > k ? C.fg3 : C.ink2; ctx.fillRect(x, y, 36, 22);
    }
  }
  // 05: review result of the latest pass
  const passes = PLAN.filter(([a, , k, r]) => k === 'at' && r === 4 && u >= a).length;
  if (passes) {
    const s = [6, 7, 8][passes - 1], ok = s >= 8;
    const label = ok ? `min score ${s}  ✓` : `min score ${s}  ✗`;
    if (ok) {
      const lw = width(ctx, label, { family: MONO, size: 22, weight: 500 });
      ctx.fillStyle = C.signal; ctx.beginPath(); ctx.roundRect(XS[1] - lw / 2 - 12, R2 + 88 - 20, lw + 24, 30, 6); ctx.fill();
    }
    text(ctx, label, XS[1], R2 + 88, { family: MONO, size: 22, weight: 500, color: ok ? C.signalInk : C.fg3, align: 'center' });
  }
  // 06: render progress, then the file
  if (u >= 10.2) {
    const f = clamp((uf - 10.2) / 1.1);
    ctx.fillStyle = C.ink2; ctx.fillRect(XS[2] - 110, R2 + 108, 220, 8);
    ctx.fillStyle = f >= 1 ? C.signal : C.fg; ctx.fillRect(XS[2] - 110, R2 + 108, 220 * f, 8);
    text(ctx, `${String(Math.round(f * 600)).padStart(3, '0')} / 600 frames`, XS[2], R2 + 146, { family: MONO, size: 20, color: f >= 1 ? C.signal : C.fg3, align: 'center' });
  }
  ctx.fillStyle = C.signal; ctx.beginPath(); ctx.arc(tok.p[0], tok.p[1], 8, 0, TAU); ctx.fill();
}

film({ width: W, height: H, fps: FPS, duration: LOOP, blur: 6, draw, palette: 'studio' });
