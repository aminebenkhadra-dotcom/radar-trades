// Which features discriminate good from bad entries week after week? (training period only)
// For each feature: top-third minus bottom-third average outcome inside each week, then mean and t-stat across weeks.
const fs = require("fs"), S = require("./study.js"), dir = process.argv[2], WHICH = process.argv[3] || "yb";
const T = S.load(dir + "/out", dir + "/data"), C = T.C, n = T.n;
const b = fs.readFileSync(dir + "/out/outcome.bin"), arr = new Float32Array(b.buffer, b.byteOffset, n * 2), y = WHICH === "r0" ? arr.subarray(n) : arr.subarray(0, n);
/* derived, direction-aware positioning features */
const add = (name, fn) => { const a = new Float32Array(n); for (let x = 0; x < n; x++) a[x] = fn(x); C[name] = a; T.cols.push(name); };
add("lsd", x => Math.log(C.ls[x]) * C.dir[x]); add("topd", x => Math.log(C.top[x]) * C.dir[x]); add("takerd", x => Math.log(C.taker[x]) * C.dir[x]);
add("oid", x => C.oi[x]); add("long", x => C.dir[x] > 0 ? 1 : 0);
const WEEK = 7 * 864e5, rows = [];
for (let x = 0; x < n; x++) if (T.train[x] && C.i[x] % 8 === 0) rows.push(x);
const wk = x => Math.floor(T.t[x] / WEEK);
const weeks = [...new Set(rows.map(wk))].sort();
const skip = new Set(["s", "i", "price", "zlo", "zhi", "a4", "a1", "x60", "ext15", "ah0", "ah1", "ah2", "ah3", "ah4", "ah5", "plsl", "pltp", "dir"]);
const res = [];
for (const name of T.cols) {
  if (skip.has(name)) continue;
  const col = C[name], vals = rows.map(x => col[x]).filter(v => !isNaN(v)).sort((a, b) => a - b); if (vals.length < 1000) continue;
  let lo = vals[Math.floor(vals.length / 3)], hi = vals[Math.floor(vals.length * 2 / 3)];
  const uniq = new Set(vals); if (uniq.size <= 3) { const u = [...uniq].sort((a, b) => a - b); lo = u[0] + 1e-9; hi = u[u.length - 1] - 1e-9; }
  const sp = [];
  for (const w of weeks) {
    let s0 = 0, n0 = 0, s1 = 0, n1 = 0;
    for (const x of rows) { if (wk(x) !== w) continue; const v = col[x]; if (isNaN(v)) continue; if (v < lo) { s0 += y[x]; n0++; } else if (v > hi || (v >= hi && uniq.size <= 3)) { s1 += y[x]; n1++; } }
    if (n0 >= 30 && n1 >= 30) sp.push(s1 / n1 - s0 / n0);
  }
  if (sp.length < 10) continue;
  const m = sp.reduce((a, b) => a + b, 0) / sp.length, sd = Math.sqrt(sp.reduce((a, b) => a + (b - m) * (b - m), 0) / (sp.length - 1));
  res.push({ name, m, t: m / (sd / Math.sqrt(sp.length)), pos: sp.filter(v => v > 0).length, k: sp.length, lo, hi });
}
res.sort((a, b) => Math.abs(b.t) - Math.abs(a.t));
console.log("outcome:", WHICH, "| weeks:", weeks.length, "| rows:", rows.length);
console.log("feature     low<       high>      spread   t     weeks+");
res.forEach(r => console.log(r.name.padEnd(10), String(+r.lo.toPrecision(3)).padStart(9), String(+r.hi.toPrecision(3)).padStart(9), ((r.m >= 0 ? "+" : "") + r.m.toFixed(3)).padStart(9), r.t.toFixed(1).padStart(6), (r.pos + "/" + r.k).padStart(7)));
