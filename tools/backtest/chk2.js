// Is the taker ratio stamped T made of trades before T (usable) or after T (look-ahead)?
const L = require("./lib.js"), DIR = process.argv[2];
function corr(a, b) { const n = a.length; let sa = 0, sb = 0; for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; } sa /= n; sb /= n; let va = 0, vb = 0, cv = 0; for (let i = 0; i < n; i++) { va += (a[i] - sa) ** 2; vb += (b[i] - sb) ** 2; cv += (a[i] - sa) * (b[i] - sb); } return cv / Math.sqrt(va * vb); }
for (const sym of ["BTCUSDT", "SOLUSDT", "1000PEPEUSDT", "ASTERUSDT"]) {
  const D = L.loadSymbol(DIR, sym), idx = new Map(); D.m15.forEach((k, i) => idx.set(k.t, i));
  const x = [], pm2 = [], pm1 = [], p0 = [], p1 = [], r0 = [], rm1 = [];
  for (const m of D.met) { const i = idx.get(m.t); if (i === undefined || i < 3 || i + 2 >= D.m15.length || !(m.taker > 0)) continue; const s = k => k.q > 0 ? k.b / k.q : 0.5;
    x.push(Math.log(m.taker)); pm2.push(s(D.m15[i - 2])); pm1.push(s(D.m15[i - 1])); p0.push(s(D.m15[i])); p1.push(s(D.m15[i + 1]));
    rm1.push(D.m15[i - 1].c / D.m15[i - 1].o - 1); r0.push(D.m15[i].c / D.m15[i].o - 1); }
  console.log(sym.padEnd(13), "n", x.length, "| corr with buy share of candle [T-30,T-15)", corr(x, pm2).toFixed(3), " [T-15,T)", corr(x, pm1).toFixed(3), " [T,T+15)", corr(x, p0).toFixed(3), " [T+15,T+30)", corr(x, p1).toFixed(3),
    "| corr with return [T-15,T)", corr(x, rm1).toFixed(3), " [T,T+15)", corr(x, r0).toFixed(3));
}
