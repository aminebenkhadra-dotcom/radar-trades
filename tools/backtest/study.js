// Research helpers over the candidate table: apply a gate and a plan with one trade at a time per symbol, then measure.
const fs = require("fs"), path = require("path"), L = require("./lib.js");
const SPLIT = Date.UTC(2026, 5, 1);          // train: before June 2026, test: after
function load(outDir, dataDir) {
  const parts = [];
  for (let k = 0; k < 8; k++) { const f = path.join(outDir, "cand-" + k + ".json"); if (!fs.existsSync(f)) break; const meta = JSON.parse(fs.readFileSync(f, "utf8")); const b = fs.readFileSync(path.join(outDir, "cand-" + k + ".bin")); parts.push({ meta, a: new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4) }); }
  const cols = parts[0].meta.cols, nc = cols.length, n = parts.reduce((s, p) => s + p.meta.n, 0), C = {};
  cols.forEach(c => C[c] = new Float32Array(n));
  let off = 0;
  for (const p of parts) { for (let a = 0; a < p.meta.n; a++) for (let c = 0; c < nc; c++) C[cols[c]][off + a] = p.a[a * nc + c]; off += p.meta.n; }
  const syms = parts[0].meta.syms, PX = {}, t = new Float64Array(n), train = new Uint8Array(n);
  const used = new Set(); for (let a = 0; a < n; a++) used.add(C.s[a]);
  for (const s of used) { const m = L.loadSymbol(dataDir, syms[s]).m15, N = m.length, o = { t: new Float64Array(N), o: new Float64Array(N), h: new Float64Array(N), l: new Float64Array(N), c: new Float64Array(N), n: N };
    for (let i = 0; i < N; i++) { o.t[i] = m[i].t; o.o[i] = m[i].o; o.h[i] = m[i].h; o.l[i] = m[i].l; o.c[i] = m[i].c; } PX[s] = o; }
  /* exact entry prices from the candles (the table stores 32-bit floats) */
  const price = new Float64Array(n);
  for (let a = 0; a < n; a++) { const p = PX[C.s[a]]; t[a] = p.t[C.i[a]]; price[a] = p.c[C.i[a]]; train[a] = t[a] < SPLIT ? 1 : 0; }
  /* row ranges per symbol (rows are grouped by symbol, in time order) */
  const ranges = []; let a0 = 0;
  for (let a = 1; a <= n; a++) if (a === n || C.s[a] !== C.s[a0]) { ranges.push([a0, a]); a0 = a; }
  return { n, cols, C, syms, PX, t, price, train, ranges };
}
function resolve(p, i, dir, entry, sl, tp, max) {
  const R = Math.abs(entry - sl), end = Math.min(p.n - 1, i + (max || 960)); let j, mfe = 0, mae = 0;
  for (j = i + 1; j <= end; j++) {
    const lo = p.l[j], hi = p.h[j];
    if (dir > 0 ? lo <= sl : hi >= sl) { const fill = dir > 0 ? Math.min(p.o[j], sl) : Math.max(p.o[j], sl); return { how: 0, j, r: dir * (fill - entry) / R, mfe, mae: 1 }; }
    if (dir > 0 ? hi >= tp : lo <= tp) return { how: 1, j, r: Math.abs(tp - entry) / R, mfe: Math.abs(tp - entry) / R, mae };
    const fav = dir > 0 ? (hi - entry) / R : (entry - lo) / R, adv = dir > 0 ? (entry - lo) / R : (hi - entry) / R;
    if (fav > mfe) mfe = fav; if (adv > mae) mae = adv;
  }
  j = Math.min(j, p.n - 1);
  return { how: 2, j, r: dir * (p.c[j] - entry) / R, mfe, mae };
}
/* default plan: market entry, stop behind the zone, first 4H body level between 1R and 3R as target, else 2R */
function planLevels(T, a, k) {
  const C = T.C, dir = C.dir[a], e = T.price[a], sl = dir > 0 ? C.zlo[a] - (k === undefined ? 0.5 : k) * C.a4[a] : C.zhi[a] + (k === undefined ? 0.5 : k) * C.a4[a], R = Math.abs(e - sl);
  let t1 = 2 * R;
  for (const q of ["ah0", "ah1", "ah2", "ah3", "ah4", "ah5"]) { const d = (C[q][a] - e) * dir; if (d >= R && d <= 3 * R) { t1 = d; break; } }
  return { sl, tp: e + dir * t1 };
}
function run(T, o) {
  const C = T.C, gate = o.gate, plan = o.plan || planLevels, cool = o.cool === undefined ? 16 : o.cool, cost = o.cost === undefined ? 0.0012 : o.cost, out = [];
  const want = o.set === "test" ? 0 : o.set === "all" ? -1 : 1;
  for (const [a0, a1] of T.ranges) {
    const p = T.PX[C.s[a0]]; let free = 0;
    for (let a = a0; a < a1; a++) {
      const i = C.i[a]; if (i < free) continue;
      if (want >= 0 && T.train[a] !== want) continue;
      if (gate && !gate(a, C, T)) continue;
      const pl = plan(T, a); if (!pl) continue;
      const dir = C.dir[a], e = T.price[a], R = Math.abs(e - pl.sl); if (!(R > 0)) continue;
      if (dir > 0 ? !(pl.sl < e && pl.tp > e) : !(pl.sl > e && pl.tp < e)) continue;
      const res = resolve(p, i, dir, e, pl.sl, pl.tp, o.max);
      out.push({ a, s: C.s[a], t: T.t[a], dir, r: res.r - cost * e / R, raw: res.r, how: res.how, bars: res.j - i, mfe: res.mfe, mae: res.mae, rr: Math.abs(pl.tp - e) / R, stop: R / e * 100 });
      free = res.j + 1 + cool;
    }
  }
  out.sort((x, y) => x.t - y.t);
  return out;
}
function show(label, tr) { console.log(L.line(label, L.stats(tr))); }
/* average result by bucket of a feature (edges: ascending cut points) */
function buckets(T, tr, name, edges, opt) {
  const col = T.C[name], rows = [], lab = [];
  for (let b = 0; b <= edges.length; b++) { rows.push([]); lab.push(b === 0 ? "< " + edges[0] : b === edges.length ? "≥ " + edges[b - 1] : edges[b - 1] + " – " + edges[b]); }
  const nan = [];
  for (const t of tr) { const v = col[t.a]; if (isNaN(v)) { nan.push(t); continue; } let b = 0; while (b < edges.length && v >= edges[b]) b++; rows[b].push(t); }
  console.log("— " + name + (opt && opt.note ? "  (" + opt.note + ")" : ""));
  rows.forEach((r, b) => { if (r.length) show("   " + lab[b], r); });
  if (nan.length) show("   n/a", nan);
}
function quantiles(T, tr, name, q) {
  const v = tr.map(t => T.C[name][t.a]).filter(x => !isNaN(x)).sort((a, b) => a - b); if (!v.length) return [];
  const e = []; for (let k = 1; k < q; k++) { const x = v[Math.floor(v.length * k / q)]; if (!e.length || x > e[e.length - 1]) e.push(+x.toPrecision(3)); } return [...new Set(e)];
}
module.exports = { load, run, resolve, planLevels, show, buckets, quantiles, SPLIT, L };
