// Closer first target: more winning trades, but does the average change? Usage: node study3.js <datadir> <outdir> [label]
const fs = require("fs"), path = require("path"), L = require("./lib.js");
const DIR = process.argv[2], OUT = process.argv[3], LABEL = process.argv[4] || "";
let cols, rows = [], syms;
for (let k = 0; k < 4; k++) { const f = path.join(OUT, "c2-" + k + ".json"); if (!fs.existsSync(f)) break; const j = JSON.parse(fs.readFileSync(f, "utf8")); cols = j.cols; syms = j.syms; rows = rows.concat(j.rows); }
const C = {}; cols.forEach((c, i) => C[c] = i); rows.sort((a, b) => a[C.t] - b[C.t] || a[C.s] - b[C.s]);
const PX = {};
for (const s of new Set(rows.map(r => r[0]))) { const m = L.loadSymbol(DIR, syms[s]).m15; PX[s] = { h: Float64Array.from(m, k => k.h), l: Float64Array.from(m, k => k.l), o: Float64Array.from(m, k => k.o), c: Float64Array.from(m, k => k.c), n: m.length }; }
function resolve(p, i, dir, e, sl, tp) { const R = Math.abs(e - sl), end = Math.min(p.n - 1, i + 960); let j;
  for (j = i + 1; j <= end; j++) { const lo = p.l[j], hi = p.h[j]; if (dir > 0 ? lo <= sl : hi >= sl) { const fill = dir > 0 ? Math.min(p.o[j], sl) : Math.max(p.o[j], sl); return { r: dir * (fill - e) / R, j }; } if (dir > 0 ? hi >= tp : lo <= tp) return { r: Math.abs(tp - e) / R, j }; }
  j = Math.min(j, p.n - 1); return { r: dir * (p.c[j] - e) / R, j }; }
function run(gate, k) { const out = [], free = {};
  for (const x of rows) { const s = x[C.s], i = x[C.i]; if ((free[s] || 0) > i || !gate(x)) continue; const p = PX[s], dir = x[C.dir], e = x[C.entry], sl = x[C.sl], R = Math.abs(e - sl);
    const res = resolve(p, i, dir, e, sl, k ? e + dir * k * R : x[C.tp1]); out.push({ r: res.r - 0.0012 * e / R, bars: res.j - i }); free[s] = res.j + 17; }
  return out; }
const ok = (x, ks) => ks.every(k => x[C["ok_" + k]] === 1), S0 = x => ok(x, ["trend", "zone", "risk"]), S2 = x => ok(x, ["trend", "zone", "risk", "trig", "mkt", "mom"]);
console.log("=== " + LABEL);
for (const [name, G] of [["3 checks", S0], ["6 checks", S2]]) for (const [lab, k] of [["TP1 on the level (now)", 0], ["TP1 at 1R", 1], ["TP1 at 1.5R", 1.5]]) console.log(L.line((name + ", " + lab).slice(0, 26), L.stats(run(G, k))));
