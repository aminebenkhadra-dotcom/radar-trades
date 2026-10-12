// Does trading only in the direction of the overall market help? Shipped engine + market-trend filters, from the gen2 table.
// Usage: node study2.js <datadir> <outdir> [label]
const fs = require("fs"), path = require("path"), L = require("./lib.js");
const DIR = process.argv[2], OUT = process.argv[3], LABEL = process.argv[4] || "";
let cols, rows = [], syms, trend = {};
for (let k = 0; k < 4; k++) { const f = path.join(OUT, "c2-" + k + ".json"); if (!fs.existsSync(f)) break; const j = JSON.parse(fs.readFileSync(f, "utf8")); cols = j.cols; syms = j.syms; rows = rows.concat(j.rows); Object.assign(trend, j.trend); }
const C = {}; cols.forEach((c, i) => C[c] = i);
rows.sort((a, b) => a[C.t] - b[C.t] || a[C.s] - b[C.s]);
const PX = {};
for (const s of new Set(rows.map(r => r[0]))) { const m = L.loadSymbol(DIR, syms[s]).m15; PX[s] = { h: Float64Array.from(m, k => k.h), l: Float64Array.from(m, k => k.l), o: Float64Array.from(m, k => k.o), c: Float64Array.from(m, k => k.c), t: Float64Array.from(m, k => k.t), n: m.length }; }
/* hourly market picture: breadth (average daily trend of all coins), Bitcoin and Ether daily trend */
const hb = new Map(), hour = t => Math.floor(t / 36e5);
for (const s in trend) for (const [t, bd] of trend[s]) { const h = hour(t); const g = hb.get(h) || [0, 0]; g[0] += bd; g[1]++; hb.set(h, g); }
function series(sym) { const m = new Map(); (trend[sym] || []).forEach(([t, bd]) => m.set(hour(t), bd)); return m; }
const btcD = series("BTCUSDT"), ethD = series("ETHUSDT");
function at(map, t) { for (let h = hour(t), k = 0; k < 8; k++, h--) if (map.has(h)) return map.get(h); return 0; }
const breadth = t => { for (let h = hour(t), k = 0; k < 8; k++, h--) { const g = hb.get(h); if (g && g[1] >= 10) return g[0] / g[1]; } return 0; };
/* Bitcoin's long trend: previous daily close against the 21-week EMA of weekly closes */
const B = L.loadSymbol(DIR, "BTCUSDT"), days = L.aggregate(B.d1.filter(k => k.t + 864e5 <= B.m15[0].t).concat(L.aggregate(B.m15, 864e5)), 864e5);
const btcW = new Map(); { let wk = [], cur = null, e = null; const k = 2 / 22;
  for (const d of days) { const w = Math.floor((d.t + 3 * 864e5) / 6048e5); if (cur !== null && w !== cur) { const c = wk[wk.length - 1]; e = e === null ? c : c * k + e * (1 - k); } if (w !== cur) { cur = w; } wk.push(d.c); btcW.set(Math.floor(d.t / 864e5) + 1, e === null ? 0 : (d.c > e ? 1 : -1)); } }
const weekly = t => btcW.get(Math.floor(t / 864e5)) || 0;
/* global score, -100..+100: Bitcoin daily 30, Bitcoin weekly 25, Ether daily 15, breadth 30 */
const glob = t => 30 * at(btcD, t) + 25 * weekly(t) + 15 * at(ethD, t) + 30 * breadth(t);
const COST = 0.0012;
function resolve(p, i, dir, e, sl, tp) {
  const R = Math.abs(e - sl), end = Math.min(p.n - 1, i + 960); let j;
  for (j = i + 1; j <= end; j++) { const lo = p.l[j], hi = p.h[j];
    if (dir > 0 ? lo <= sl : hi >= sl) { const fill = dir > 0 ? Math.min(p.o[j], sl) : Math.max(p.o[j], sl); return { r: dir * (fill - e) / R, j }; }
    if (dir > 0 ? hi >= tp : lo <= tp) return { r: Math.abs(tp - e) / R, j }; }
  j = Math.min(j, p.n - 1); return { r: dir * (p.c[j] - e) / R, j };
}
function run(gate) {
  const out = [], free = {};
  for (const x of rows) { const s = x[C.s], i = x[C.i]; if ((free[s] || 0) > i || !gate(x)) continue;
    const p = PX[s], dir = x[C.dir], e = x[C.entry], sl = x[C.sl], res = resolve(p, i, dir, e, sl, x[C.tp1]);
    out.push({ s, t: x[C.t], dir, r: res.r - COST * e / Math.abs(e - sl), bars: res.j - i, g: glob(x[C.t]) * dir }); free[s] = res.j + 17; }
  return out;
}
const ok = (x, ks) => ks.every(k => x[C["ok_" + k]] === 1);
const S0 = x => ok(x, ["trend", "zone", "risk"]), S1 = x => S0(x) && x[C.ok_trig] === 1, S2 = x => S1(x) && x[C.ok_mkt] === 1 && x[C.ok_mom] === 1;
const t0 = rows[0][C.t], t1 = rows[rows.length - 1][C.t], q = (t1 - t0) / 4;
function show(label, tr) {
  const s = L.stats(tr), parts = [0, 1, 2, 3].map(k => L.stats(tr.filter(t => t.t >= t0 + k * q && t.t < t0 + (k + 1) * q + 1))), f = v => (v >= 0 ? "+" : "") + v.toFixed(3);
  console.log(label.padEnd(46) + String(s.n).padStart(6) + "  win " + (s.n ? s.win.toFixed(1) : "–").padStart(4) + " %  avg " + (s.n ? f(s.avg) : "  –  ") + " ±" + (s.n ? s.se.toFixed(3) : "–") + "  | quarters " + parts.map(p => p.n ? f(p.avg) + "(" + p.n + ")" : "–").join(" "));
}
console.log("=== " + LABEL + "  " + new Date(t0).toISOString().slice(0, 10) + " → " + new Date(t1).toISOString().slice(0, 10) + " | symbols " + Object.keys(PX).length);
const share = []; for (let t = t0; t < t1; t += 864e5) share.push(glob(t)); console.log("global score: share of days > +15: " + (share.filter(v => v > 15).length / share.length * 100).toFixed(0) + " %, < -15: " + (share.filter(v => v < -15).length / share.length * 100).toFixed(0) + " %");
for (const [name, G] of [["3 checks", S0], ["4 checks", S1], ["6 checks (default)", S2]]) {
  const all = run(G); console.log("— " + name);
  show("  all setups", all);
  show("  longs", all.filter(t => t.dir > 0)); show("  shorts", all.filter(t => t.dir < 0));
  show("  with the market (global score × side > 0)", all.filter(t => t.g > 0));
  show("  against the market (global score × side < 0)", all.filter(t => t.g < 0));
  show("  with a clear market trend (score × side ≥ 40)", all.filter(t => t.g >= 40));
  show("  only if Bitcoin daily trend agrees", run(x => G(x) && (x[C.btcd] === 1 || x[C.btcd] === 9)));
  show("  only if breadth agrees", run(x => G(x) && breadth(x[C.t]) * x[C.dir] > 0));
  show("  only if Bitcoin weekly trend agrees", run(x => G(x) && weekly(x[C.t]) * x[C.dir] > 0));
  show("  only if the global score agrees (filter)", run(x => G(x) && glob(x[C.t]) * x[C.dir] > 0));
}
