// Second study, independent of the setup engine: do positioning and flow data say anything about the next 24 hours?
// Hourly grid, every symbol. Effects must hold in each of four time blocks, not just on average.
const fs = require("fs"), L = require("./lib.js"), DIR = process.argv[2];
const { syms } = L.listSymbols(DIR), SKIP = { PAXGUSDT: 1 };
const rows = [];
const btc = L.loadSymbol(DIR, "BTCUSDT"), bh = L.aggregate(btc.m15, 3600000), bmap = new Map(); bh.forEach((k, i) => bmap.set(k.t, i));
for (const sym of syms) {
  if (SKIP[sym]) continue;
  const D = L.loadSymbol(DIR, sym), h = L.aggregate(D.m15, 3600000), n = h.length, met = new Map(); D.met.forEach(x => met.set(x.t, x));
  /* hourly ATR-like scale: mean absolute 24h move over the last 14 days */
  let fi = 0;
  for (let i = 24 * 35; i < n - 25; i++) {
    const k = h[i], T = k.t + 3600000, c = k.c;                    // decision at the close of hour i
    const LAG = 3600000, m0 = met.get(T - LAG), m24 = met.get(T - LAG - 86400000), m4 = met.get(T - LAG - 4 * 3600000);   /* rows stamped T describe the minutes after T: use the previous hour */ if (!m0 || !m24 || !(m0.ls > 0) || !(m24.ls > 0)) continue;
    let adr = 0; for (let d = 1; d <= 14; d++) { let hi = -Infinity, lo = Infinity; for (let x = i - d * 24 + 1; x <= i - (d - 1) * 24; x++) { if (h[x].h > hi) hi = h[x].h; if (h[x].l < lo) lo = h[x].l; } adr += hi - lo; } adr /= 14;
    if (!(adr > 0)) continue;
    let hi = -Infinity, lo = Infinity, q24 = 0, b24 = 0; for (let x = i - 23; x <= i; x++) { if (h[x].h > hi) hi = h[x].h; if (h[x].l < lo) lo = h[x].l; q24 += h[x].q; b24 += h[x].b; }
    let q30 = 0; for (let x = i - 24 * 30 + 1; x <= i; x++) q30 += h[x].q;
    while (fi + 1 < D.fund.length && D.fund[fi + 1][0] <= T) fi++;
    const fund = D.fund.length && D.fund[fi][0] <= T ? D.fund[fi][1] * 100 : NaN;
    const bi = bmap.get(k.t), bret = bi !== undefined && bi >= 24 && bi + 24 < bh.length ? { p: bh[bi].c / bh[bi - 24].c - 1, f: bh[bi + 24].c / bh[bi].c - 1 } : null; if (!bret) continue;
    const oi0 = m0.oi / h[i - 1].c, oi24 = m24.oi / h[i - 25].c, oi4 = m4 && m4.oi > 0 ? m4.oi / h[i - 5].c : NaN;
    /* forward: 24h return in units of the usual daily range; long-side barrier at ±0.5 daily range within 48h */
    const f24 = (h[i + 24].c - c) / adr, f8 = (h[i + 8].c - c) / adr; let yb = 0; const up = c + 0.5 * adr, dn = c - 0.5 * adr;
    for (let x = i + 1; x < Math.min(n, i + 49); x++) { if (h[x].l <= dn) { yb = -1; break; } if (h[x].h >= up) { yb = 1; break; } }
    rows.push({ t: T, s: sym, f24, f8, yb, rel24: (h[i + 24].c / c - 1) - bret.f,
      ret1: (c - h[i - 1].c) / adr, ret4: (c - h[i - 4].c) / adr, ret24: (c - h[i - 24].c) / adr, ret7d: (c - h[i - 168].c) / adr, relbtc: (c / h[i - 24].c - 1) - bret.p,
      rng24: (hi - lo) / adr, relVol: q24 / (q30 / 30), buy24: q24 > 0 ? b24 / q24 : NaN, pos24: hi > lo ? (c - lo) / (hi - lo) : 0.5,
      fund, ls: Math.log(m0.ls), dls: Math.log(m0.ls / m24.ls), top: m0.top > 0 ? Math.log(m0.top) : NaN, dtop: m0.top > 0 && m24.top > 0 ? Math.log(m0.top / m24.top) : NaN,
      lstop: m0.top > 0 ? Math.log(m0.ls / m0.top) : NaN, taker: m0.taker > 0 ? Math.log(m0.taker) : NaN, oi24: (oi0 / oi24 - 1) * 100, oi4: isNaN(oi4) ? NaN : (oi0 / oi4 - 1) * 100,
      btc24: bret.p * 100 });
  }
}
console.log("rows", rows.length, "symbols", new Set(rows.map(r => r.s)).size, new Date(rows.reduce((a, r) => Math.min(a, r.t), Infinity)).toISOString().slice(0, 10), "→", new Date(rows.reduce((a, r) => Math.max(a, r.t), 0)).toISOString().slice(0, 10));
/* thin to one row every 4 hours to limit overlap */
const R = rows.filter(r => (r.t / 3600000) % 4 === 0), tmin = R.reduce((a, r) => Math.min(a, r.t), Infinity), tmax = R.reduce((a, r) => Math.max(a, r.t), 0);
const WEEK = 7 * 864e5, blockOf = r => Math.min(3, Math.floor((r.t - tmin) / ((tmax - tmin + 1) / 4)));
const feats = ["ret1", "ret4", "ret24", "ret7d", "relbtc", "rng24", "relVol", "buy24", "pos24", "fund", "ls", "dls", "top", "dtop", "lstop", "taker", "oi24", "oi4", "btc24"];
function study(y, label, demean) {
  console.log("\n" + label + (demean ? " (relative to the other coins at the same hour)" : "") + "\nfeature     spread      t   weeks+   block spreads (4 quarters)");
  const byT = new Map(); if (demean) { for (const r of R) { const g = byT.get(r.t) || { s: 0, n: 0 }; g.s += r[y]; g.n++; byT.set(r.t, g); } }
  const val = r => demean ? r[y] - byT.get(r.t).s / byT.get(r.t).n : r[y];
  const out = [];
  for (const f of feats) {
    /* tercile cut-offs across coins at each hour when demeaned, global otherwise */
    const v = R.map(r => r[f]).filter(x => !isNaN(x)).sort((a, b) => a - b), lo = v[Math.floor(v.length / 3)], hi = v[Math.floor(v.length * 2 / 3)];
    const wk = new Map(), bl = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    for (const r of R) { const x = r[f]; if (isNaN(x)) continue; const w = Math.floor(r.t / WEEK), g = wk.get(w) || [0, 0, 0, 0], b = bl[blockOf(r)], yy = val(r); if (x < lo) { g[0] += yy; g[1]++; b[0] += yy; b[1]++; } else if (x > hi) { g[2] += yy; g[3]++; b[2] += yy; b[3]++; } wk.set(w, g); }
    const sp = [...wk.values()].filter(g => g[1] >= 50 && g[3] >= 50).map(g => g[2] / g[3] - g[0] / g[1]);
    const m = sp.reduce((a, b) => a + b, 0) / sp.length, sd = Math.sqrt(sp.reduce((a, b) => a + (b - m) * (b - m), 0) / (sp.length - 1));
    out.push({ f, m, t: m / (sd / Math.sqrt(sp.length)), pos: sp.filter(z => z > 0).length, k: sp.length, bs: bl.map(b => b[2] / b[3] - b[0] / b[1]) });
  }
  out.sort((a, b) => Math.abs(b.t) - Math.abs(a.t));
  out.forEach(o => console.log(o.f.padEnd(9), ((o.m >= 0 ? "+" : "") + o.m.toFixed(4)).padStart(9), o.t.toFixed(1).padStart(6), (o.pos + "/" + o.k).padStart(7), "  ", o.bs.map(z => ((z >= 0 ? "+" : "") + z.toFixed(3)).padStart(7)).join(" "), o.bs.every(z => z > 0) || o.bs.every(z => z < 0) ? "  ← same sign in all 4" : ""));
}
study("f24", "next 24h move, in usual daily ranges");
study("yb", "long-side barrier ±0.5 daily range");
study("rel24", "next 24h return minus Bitcoin's", true);
