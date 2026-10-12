// Walk-forward test of the engine shipped in Version 19 ("v2"): take every setup the app would have called "Prêt".
// Usage: node baseline.js <datadir> [book bonus 0|5|10] [part k/n]
const fs = require("fs"), path = require("path"), L = require("./lib.js");
const E = new Function(fs.readFileSync(path.join(__dirname, "engine_v2.js"), "utf8") + ";return {analyze,settle,rsiSeries}")();
const DIR = process.argv[2], BONUS = +(process.argv[3] || 0), PART = (process.argv[4] || "0/1").split("/").map(Number);
const SKIP = { PAXGUSDT: 1 }, COST = 0.0012, COOL = 16, START = 96 * 34;
const { syms } = L.listSymbols(DIR);
const trades = [];
let evals = 0, ready = 0, t0 = Date.now();
syms.filter(s => !SKIP[s]).forEach((sym, idx) => {
  if (idx % PART[1] !== PART[0]) return;
  const D = L.loadSymbol(DIR, sym), m = D.m15, F = new L.Frames(m, D.d1), base = sym.replace(/USDT$/, "");
  let free = START, pend = null;
  for (let i = 0; i < m.length - 1; i++) {
    F.step(i);
    if (pend) {                                   // limit order from the previous bar's "Prêt"
      const k = m[i], p = pend; pend = null;
      if (p.dir > 0 ? k.l <= p.entry : k.h >= p.entry) {
        let res;
        if (p.dir > 0 ? k.l <= p.sl : k.h >= p.sl) res = { how: "sl", jin: i, j: i, r: -1, bars: 0 };
        else res = L.resolve(m, i, { dir: p.dir, entry: p.entry, sl: p.sl, tp: p.tp1 });
        const R = Math.abs(p.entry - p.sl);
        trades.push({ sym: base, t: m[i].t, dir: p.dir, score: p.score, rr: p.rr, how: res.how, raw: res.r, r: res.r - COST * p.entry / R, bars: res.bars, stop: R / p.entry * 100, lim: 1 });
        free = res.j + 1 + COOL; continue;
      }
    }
    if (i < free) continue;
    const d1 = F.get("d1", 90); if (d1.length < 55) continue;
    const h4 = F.get("h4", 200), h1 = F.get("h1", 200);
    evals++;
    const r = E.analyze(base, d1, h4, h1);
    if (!r.plan) continue;
    let sc = r.base + BONUS;
    const rs = E.rsiSeries(F.m(500).map(x => x.c)), n = rs.length;
    if (n > 30) { const now = rs[n - 1], prev = rs[n - 2], win = rs.slice(-8), ext = r.dir > 0 ? Math.min.apply(null, win) : Math.max.apply(null, win);
      if (r.dir > 0 ? (ext <= 35 && now > prev && now > ext + 3) : (ext >= 65 && now < prev && now < ext - 3)) sc += 5; }
    E.settle(r, sc);
    if (r.st !== "ready") continue;
    ready++;
    const p = r.plan, price = r.price;
    if (r.dir > 0 ? price <= p.entry * (1 + 1e-9) : price >= p.entry * (1 - 1e-9)) {
      const res = L.resolve(m, i, { dir: r.dir, entry: price, sl: p.sl, tp: p.tp1 }), R = Math.abs(price - p.sl);
      trades.push({ sym: base, t: m[i].t, dir: r.dir, score: r.score, rr: p.rr, how: res.how, raw: res.r, r: res.r - COST * price / R, bars: res.bars, stop: R / price * 100, lim: 0 });
      free = res.j + 1 + COOL;
    } else pend = { dir: r.dir, entry: p.entry, sl: p.sl, tp1: p.tp1, score: r.score, rr: p.rr };
  }
});
fs.writeFileSync(path.join(process.argv[5] || ".", "v2-" + BONUS + "-" + PART[0] + ".json"), JSON.stringify({ trades, evals, ready, secs: (Date.now() - t0) / 1000 }));
console.log("part", PART.join("/"), "evals", evals, "ready bars", ready, "trades", trades.length, Math.round((Date.now() - t0) / 1000) + "s");
