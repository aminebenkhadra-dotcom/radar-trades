// Per-row outcomes (cached) and a univariate scan of every feature on the training period.
const fs = require("fs"), S = require("./study.js"), dir = process.argv[2];
const T = S.load(dir + "/out", dir + "/data"), C = T.C, n = T.n;
const cache = dir + "/out/outcome.bin";
let yb, r0;
if (fs.existsSync(cache) && fs.statSync(cache).size === n * 8) { const b = fs.readFileSync(cache), a = new Float32Array(b.buffer, b.byteOffset, n * 2); yb = a.subarray(0, n); r0 = a.subarray(n); }
else {
  const a = new Float32Array(n * 2); yb = a.subarray(0, n); r0 = a.subarray(n);
  for (let x = 0; x < n; x++) {
    const p = T.PX[C.s[x]], i = C.i[x], d = C.dir[x], e = T.price[x], a4 = C.a4[x];
    const sym = S.resolve(p, i, d, e, e - d * a4, e + d * a4, 480);            // symmetric barrier, one 4H ATR each side, 5 days
    yb[x] = sym.how === 2 ? Math.max(-1, Math.min(1, sym.r)) : sym.r;
    const pl = S.planLevels(T, x), R = Math.abs(e - pl.sl), res = S.resolve(p, i, d, e, pl.sl, pl.tp);
    r0[x] = res.r - 0.0012 * e / R;
  }
  fs.writeFileSync(cache, Buffer.from(a.buffer));
}
/* thin the rows: one every 2 hours per symbol, training period, split in two halves to check that an effect repeats */
const HALF = Date.UTC(2026, 1, 15), rowsA = [], rowsB = [], rowsT = [];
for (let x = 0; x < n; x++) { if (C.i[x] % 8) continue; if (!T.train[x]) rowsT.push(x); else (T.t[x] < HALF ? rowsA : rowsB).push(x); }
const mean = (rows, y) => { let s = 0; for (const x of rows) s += y[x]; return rows.length ? s / rows.length : NaN; };
console.log("thinned rows: train A", rowsA.length, "train B", rowsB.length, "(test " + rowsT.length + ", not shown)");
console.log("base: sym barrier A", mean(rowsA, yb).toFixed(3), "B", mean(rowsB, yb).toFixed(3), "| plan R A", mean(rowsA, r0).toFixed(3), "B", mean(rowsB, r0).toFixed(3));
const skip = new Set(["s", "i", "price", "zlo", "zhi", "a4", "a1", "x60", "ext15", "ah0", "ah1", "ah2", "ah3", "ah4", "ah5", "plsl", "pltp"]);
const f = v => (isNaN(v) ? "   – " : (v >= 0 ? "+" : "") + v.toFixed(2));
const out = [];
for (const name of T.cols) {
  if (skip.has(name)) continue;
  const col = C[name], all = rowsA.concat(rowsB), vals = all.map(x => col[x]).filter(v => !isNaN(v)).sort((a, b) => a - b);
  if (!vals.length) continue;
  const uniq = [...new Set(vals)]; let edges;
  if (uniq.length <= 6) edges = uniq.slice(1).map(v => v - 1e-9);
  else { edges = []; for (let k = 1; k < 5; k++) { const v = vals[Math.floor(vals.length * k / 5)]; if (!edges.length || v > edges[edges.length - 1]) edges.push(v); } }
  const bk = rows => { const g = []; for (let b = 0; b <= edges.length; b++) g.push([]); for (const x of rows) { const v = col[x]; if (isNaN(v)) continue; let b = 0; while (b < edges.length && v >= edges[b]) b++; g[b].push(x); } return g; };
  const gA = bk(rowsA), gB = bk(rowsB);
  const line = (g, y) => g.map(r => f(mean(r, y))).join(" ");
  /* spread between top and bottom bucket, both halves */
  const sA = mean(gA[gA.length - 1], yb) - mean(gA[0], yb), sB = mean(gB[gB.length - 1], yb) - mean(gB[0], yb);
  out.push({ name, txt: name.padEnd(9) + " edges " + edges.map(e => (+e.toPrecision(3))).join(",").padEnd(30) + " n " + gA.map((r, b) => r.length + gB[b].length).join("/").padEnd(32) +
    "\n          barrier A " + line(gA, yb) + "   B " + line(gB, yb) + "\n          planR   A " + line(gA, r0) + "   B " + line(gB, r0), sA, sB });
}
out.sort((a, b) => Math.min(Math.abs(b.sA), Math.abs(b.sB)) * (Math.sign(b.sA) === Math.sign(b.sB) ? 1 : 0) - Math.min(Math.abs(a.sA), Math.abs(a.sB)) * (Math.sign(a.sA) === Math.sign(a.sB) ? 1 : 0));
out.forEach(o => console.log(o.txt + "\n          spread A " + f(o.sA) + " B " + f(o.sB)));
