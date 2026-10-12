// Research table: every 15m bar where the engine has a plan and price is at the entry zone, with all its features.
// Usage: node gen.js <datadir> <outdir> [part k/n] [symbol filter]
const fs = require("fs"), path = require("path"), L = require("./lib.js");
const SRC = fs.readFileSync(path.join(__dirname, "engine_research.js"), "utf8");
const E = new Function(SRC + ";return {analyze,enrich,market,targets,atr}")();
const DIR = process.argv[2], OUT = process.argv[3], PART = (process.argv[4] || "0/1").split("/").map(Number), ONLY = process.argv[5];
const SKIP = { PAXGUSDT: 1 }, START = 96 * 34, NEAR = 0.5;
const { syms } = L.listSymbols(DIR);
const t0 = Date.now();
/* Bitcoin context at every bar */
const BTC = new Map();
{ const D = L.loadSymbol(DIR, "BTCUSDT"), F = new L.Frames(D.m15, D.d1);
  for (let i = 0; i < D.m15.length; i++) { F.step(i); if (i < START) continue; BTC.set(D.m15[i].t, E.market(F.get("d1", 90), F.get("h4", 200), F.get("h1", 200))); } }
console.log("btc context", BTC.size, Math.round((Date.now() - t0) / 1000) + "s");
const META = ["s", "i", "dir", "price", "zlo", "zhi", "a4", "a1", "x60", "ext15", "ah0", "ah1", "ah2", "ah3", "ah4", "ah5", "plsl", "pltp"];
let KEYS = null, rows = [], evals = 0, plans = 0;
const list = syms.filter(s => !SKIP[s]);
list.forEach((sym, idx) => {
  if (idx % PART[1] !== PART[0] || (ONLY && sym !== ONLY)) return;
  const D = L.loadSymbol(DIR, sym), m = D.m15, F = new L.Frames(m, D.d1), base = sym.replace(/USDT$/, "");
  /* hourly positioning metrics → lookup by hour */
  const met = new Map(); D.met.forEach(x => met.set(x.t, x));
  let fi = 0; const ts = Date.now(); let cnt = 0;
  for (let i = 0; i < m.length - 1; i++) {
    F.step(i);
    if (i < START) continue;
    const d1 = F.get("d1", 400); if (d1.length < 55) continue;
    const h4 = F.get("h4", 200), h1 = F.get("h1", 200), T = m[i].t + L.M15;
    evals++;
    const r = E.analyze(base, d1, h4, h1, { btc: BTC.get(m[i].t) || null });
    if (!r.plan) continue;
    plans++;
    if (r.f.dist > NEAR) continue;
    while (fi + 1 < D.fund.length && D.fund[fi + 1][0] <= T) fi++;
    const fund = D.fund.length && D.fund[fi][0] <= T ? D.fund[fi][1] : null;
    const hr = Math.floor((T - 300000) / 3600000) * 3600000, mt = met.get(hr), mp = met.get(hr - 86400000);   /* a row stamped H describes H → H+5 min: only usable once those minutes are over */
    let oi = null, ls = null;
    if (mt) { ls = mt.ls > 0 ? mt.ls : null; if (mp && mp.oi > 0 && mt.oi > 0) { const pNow = h1[h1.length - 1].c, pPrev = h1.length > 25 ? h1[h1.length - 25].c : pNow; oi = ((mt.oi / pNow) / (mp.oi / pPrev) - 1) * 100; } }
    const k = m[i], m15 = F.m(500); m15.push({ t: T, o: k.c, h: k.c, l: k.c, c: k.c, q: 0, b: 0 });
    E.enrich(r, m15, null, { fund, ls, oi }, { noHeat: true });
    if (mt) { r.f.top = mt.top > 0 ? mt.top : null; r.f.taker = mt.taker > 0 ? mt.taker : null; } else { r.f.top = null; r.f.taker = null; }
    if (!KEYS) KEYS = Object.keys(r.f);
    const price = r.price, tg = E.targets(r.lv, r.dir, price, 1e-12, r.h4);   // levels ahead, measured from the market price
    const x60 = r.dir > 0 ? Math.max.apply(null, r.h4.map(x => x.h)) : Math.min.apply(null, r.h4.map(x => x.l));
    const row = [idx, i, r.dir, price, r.z.lo, r.z.hi, r.a, r.a1, x60, r.trig ? r.trig.ext15 : NaN];
    for (let q = 0; q < 6; q++) row.push(q < tg.ahead.length ? price + r.dir * tg.ahead[q] : NaN);
    row.push(r.plan.sl, r.plan.tp1);
    for (const key of KEYS) { const v = r.f[key]; row.push(v === null || v === undefined ? NaN : +v); }
    rows.push(row); cnt++;
  }
  console.log(sym.padEnd(14), "rows", String(cnt).padStart(6), Math.round((Date.now() - ts) / 1000) + "s");
});
const cols = META.concat(KEYS || []), buf = new Float32Array(rows.length * cols.length);
rows.forEach((r, a) => buf.set(r, a * cols.length));
const tag = PART[0] + (ONLY ? "-" + ONLY : "");
fs.writeFileSync(path.join(OUT, "cand-" + tag + ".bin"), Buffer.from(buf.buffer));
fs.writeFileSync(path.join(OUT, "cand-" + tag + ".json"), JSON.stringify({ cols, n: rows.length, syms: list, evals, plans, start: START }));
console.log("part", PART.join("/"), "evals", evals, "plans", plans, "rows", rows.length, "cols", cols.length, Math.round((Date.now() - t0) / 1000) + "s");
