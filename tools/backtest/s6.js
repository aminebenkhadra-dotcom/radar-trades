// Weekly-clustered spreads for derived features (training period).
const fs = require("fs"), S = require("./study.js"), dir = process.argv[2];
const T = S.load(dir + "/out", dir + "/data"), C = T.C, n = T.n;
const b = fs.readFileSync(dir + "/out/outcome.bin"), arr = new Float32Array(b.buffer, b.byteOffset, n * 2), Y = { yb: arr.subarray(0, n), r0: arr.subarray(n) };
const WEEK = 7 * 864e5, rows = [];
for (let x = 0; x < n; x++) if (T.train[x] && C.i[x] % 8 === 0) rows.push(x);
const wk = x => Math.floor(T.t[x] / WEEK), weeks = [...new Set(rows.map(wk))].sort();
function spread(name, fn, y) {
  const v = new Float32Array(n); for (const x of rows) v[x] = fn(x);
  const vals = rows.map(x => v[x]).filter(z => !isNaN(z)).sort((a, b) => a - b), lo = vals[Math.floor(vals.length / 3)], hi = vals[Math.floor(vals.length * 2 / 3)], sp = [];
  for (const w of weeks) { let s0 = 0, n0 = 0, s1 = 0, n1 = 0; for (const x of rows) { if (wk(x) !== w) continue; const z = v[x]; if (isNaN(z)) continue; if (z < lo) { s0 += y[x]; n0++; } else if (z > hi) { s1 += y[x]; n1++; } } if (n0 >= 30 && n1 >= 30) sp.push(s1 / n1 - s0 / n0); }
  const m = sp.reduce((a, b) => a + b, 0) / sp.length, sd = Math.sqrt(sp.reduce((a, b) => a + (b - m) * (b - m), 0) / (sp.length - 1));
  return name.padEnd(26) + String(+lo.toPrecision(3)).padStart(8) + String(+hi.toPrecision(3)).padStart(8) + ((m >= 0 ? "+" : "") + m.toFixed(3)).padStart(9) + (m / (sd / Math.sqrt(sp.length))).toFixed(1).padStart(6) + (sp.filter(z => z > 0).length + "/" + sp.length).padStart(7);
}
const defs = {
  "a15p/atrp (15m vs 4H vol)": x => C.a15p[x] / C.atrp[x],
  "a1p/atrp (1H vs 4H vol)": x => C.a1p[x] / C.atrp[x],
  "a15p/a1p": x => C.a15p[x] / C.a1p[x],
  "relVol": x => C.relVol[x], "rng24": x => C.rng24[x], "rng8": x => C.rng8[x], "dayR": x => C.dayR[x], "volReg": x => C.volReg[x],
  "bVol (BTC volume)": x => C.bVol[x], "bRng (BTC range)": x => C.bRng[x],
  "relVol/bVol (coin vs BTC)": x => C.relVol[x] / C.bVol[x],
  "max(relVol,bVol)": x => Math.max(C.relVol[x], C.bVol[x]),
  "relVol*rng24": x => C.relVol[x] * C.rng24[x],
  "relVol+rng24": x => C.relVol[x] + C.rng24[x],
  "ret24 (chase)": x => C.ret24[x], "|ret24|": x => Math.abs(C.ret24[x]),
  "btc24": x => C.btc24[x], "|btc24|": x => Math.abs(C.btc24[x]), "btcR4": x => C.btcR4[x],
  "r4 (coin RSI 4H)": x => C.r4[x], "ext (vs EMA20 4H)": x => C.ext[x],
};
for (const yn of ["yb", "r0"]) { console.log("outcome " + yn + "                  low<    high>   spread     t  weeks+"); for (const k in defs) console.log(spread(k, defs[k], Y[yn])); }
