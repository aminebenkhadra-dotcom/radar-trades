// Synthetic 15-minute candles for the tests: a price path through dated anchors (days before now, price), with a small deterministic
// jitter and, as on a real exchange, an open that is not exactly the previous close (the engine's 4H levels need that to see a swing).
const M15 = 9e5, D = 96, hash = (x, k) => ((Math.sin(x * k) * 43758.5453) % 1 + 1) % 1 - 0.5;
function path(pts, now, amp) {
  const n = 96 * 420, m = [], f = x => { const d = (x - n) / D; let v = pts[0][1];
    for (let i = 1; i < pts.length; i++) { if (d <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; v = a[1] + (b[1] - a[1]) * Math.max(0, (d - a[0]) / (b[0] - a[0])); break; } v = pts[i][1]; }
    return v * (1 + amp * hash(x, 12.9898)); };
  let t = Math.floor(now / M15) * M15 - (n - 1) * M15;
  for (let i = 0; i < n; i++) { const o = f(i), c = f(i + 1) * (1 + 0.0008 * hash(i, 78.233)); m.push({ t, o, h: Math.max(o, c) * 1.0006, l: Math.min(o, c) * 0.9994, c, q: 1e5, b: 5e4 }); t += M15; }
  return m; }
function agg(m, ms, lim) { const out = []; let cur = null;
  for (const c of m) { const k = Math.floor(c.t / ms) * ms; if (!cur || cur.t !== k) { cur = { t: k, o: c.o, h: c.h, l: c.l, c: c.c, q: c.q, b: c.b, v: 1 }; out.push(cur); } else { cur.h = Math.max(cur.h, c.h); cur.l = Math.min(cur.l, c.l); cur.c = c.c; cur.q += c.q; } }
  return out.slice(-lim); }
/* a rise, two double tops (110 then 106.5), a dip, and a recovery to 104: both trends up, two 4H levels between the price and 110 */
const LEVELS = [[-420, 40], [-34, 96], [-30, 110], [-28, 106], [-26, 110], [-23, 103], [-20, 106.5], [-18, 104], [-16, 106.5], [-13, 101], [-11, 103], [-9, 101], [-4, 103], [0, 104]];
module.exports = { path, agg, LEVELS };
