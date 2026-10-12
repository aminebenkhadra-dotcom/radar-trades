// Candidate table built with the SHIPPED engine (tools/engine.js): every 15m bar where a setup sits on its zone,
// with the six checks, a few context flags and the plan, so that extra filters can be tried offline.
// Also writes, for every symbol and hour, the daily trend of the coin (for market breadth).
// Usage: node gen2.js <datadir> <outdir> [part k/n]
const fs = require("fs"), path = require("path"), L = require("./lib.js");
const E = new Function(fs.readFileSync(path.join(__dirname, "..", "engine.js"), "utf8") + ";return {analyze,enrich,judge,market,btFrames,btMarket,BT_WARM}")();
const DIR = process.argv[2], OUT = process.argv[3], PART = (process.argv[4] || "0/1").split("/").map(Number);
const SKIP = { PAXGUSDT: 1 }, { syms } = L.listSymbols(DIR), t0 = Date.now();
const NONCRYPTO = /^(USDC|BTCDOM|XAU|XAG|XPT|XPD|PAXG|XAUT|TSLA|NVDA|AAPL|MSTR|COIN|HOOD|AMZN|GOOGL|META|MSFT)/;
const B = L.loadSymbol(DIR, "BTCUSDT"), btc = E.btMarket(B.m15, B.d1);
const G = ["trend", "mkt", "zone", "trig", "mom", "risk"], rows = [], trend = {};
const list = syms.filter(s => !SKIP[s] && !NONCRYPTO.test(s));
list.forEach((sym, idx) => {
  if (idx % PART[1] !== PART[0]) return;
  const D = L.loadSymbol(DIR, sym), m = D.m15, F = E.btFrames(m, D.d1), base = sym.replace(/USDT$/, ""), tr = trend[sym] = [];
  for (let i = 0; i < m.length - 1; i++) {
    F.step(i);
    if (i < E.BT_WARM) continue;
    const d1 = F.get("d1", 400); if (d1.length < 55) continue;
    const ctx = btc[m[i].t] || null;
    const r = E.analyze(base, d1, F.get("h4", 200), F.get("h1", 200), { btc: ctx }, {});
    if (i % 4 === 3) tr.push([m[i].t, r.bd, r.b4]);
    if (!r.plan || r.dist > 0.5) continue;
    E.enrich(r, F.m15(500), null, null, { noHeat: true });
    E.judge(r, { strict: 2 });
    const ok = {}; r.gates.forEach(g => ok[g.k] = g.ok ? 1 : 0);
    const f = r.f, p = r.plan;
    rows.push([idx, i, m[i].t, r.dir, p.entry, p.sl, p.tp1, p.tp2, r.score].concat(G.map(k => ok[k]),
      [f.bd, Math.round(f.adx), f.struct, f.broken, f.lt, f.btc4 === null ? 9 : f.btc4, ctx ? ctx.bd * r.dir : 9, r.trig ? r.trig.bos : 0, r.trig ? r.trig.sweep : 0, f.kN, +f.retr.toFixed(3), +(f.rng24 || 0).toFixed(3), +(f.relVol || 0).toFixed(3), +r.rrNet.toFixed(3), +r.costPct.toFixed(2)]));
  }
  console.log(sym.padEnd(14), "rows so far", rows.length, Math.round((Date.now() - t0) / 1000) + "s");
});
const cols = ["s", "i", "t", "dir", "entry", "sl", "tp1", "tp2", "score"].concat(G.map(k => "ok_" + k), ["bd", "adx", "struct", "broken", "lt", "btc4", "btcd", "bos", "sweep", "kN", "retr", "rng24", "relVol", "rrNet", "costPct"]);
fs.writeFileSync(path.join(OUT, "c2-" + PART[0] + ".json"), JSON.stringify({ cols, rows, syms: list, trend }));
console.log("part", PART.join("/"), "rows", rows.length, Math.round((Date.now() - t0) / 1000) + "s");
