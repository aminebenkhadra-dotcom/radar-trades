// Replays the Radar BTC·ETH configurations on Binance history and prints the success rate of each situation, by coin and year.
// Usage: node tools/btceth/replay.js <data dir from the btceth-data branch> [out.json]
const path = require("path"), fs = require("fs");
const { loadSymbol } = require("../backtest/lib.js");
const E = require("./load.js")();
const dir = process.argv[2], out = process.argv[3];
const YEARS = { A: ["2024-10-01", "2025-10-01"], B: ["2025-10-01", "2026-10-28"] };
const st = L => { const n = L.length; let w = 0, s = 0; L.forEach(t => { s += t.r; if (t.how === "tp") w++; }); return [n, n ? +(w / n * 100).toFixed(1) : 0, n ? +(s / n).toFixed(3) : 0]; };
const ALL = [];
const res = { made: new Date().toISOString(), version: E.BE_VERSION, years: YEARS, coins: {} };
for (const sym of ["BTCUSDT", "ETHUSDT"]) {
  const D = loadSymbol(dir, sym), t0 = Date.now();
  const S = E.beReplayStart(sym.replace("USDT", ""), D.m15, D.d1, {});
  while (!E.beReplayStep(S, 5000)) {}
  ALL.push(...S.trades.map(t => Object.assign({ coin: sym.replace("USDT", "") }, t)));
  const C = res.coins[sym.replace("USDT", "")] = group(S.trades);
  for (const y in C) console.log(" ", y, JSON.stringify(C[y].all), "with:", JSON.stringify(C[y]["tr|with"]), "with+signal:", JSON.stringify(C[y]["with|1"]), "against:", JSON.stringify(C[y]["tr|against"]));
  console.log(sym, S.trades.length, "trades", Math.round((Date.now() - t0) / 1000) + "s");
}
res.coins.BOTH = group(ALL);
res.trades = ALL;
if (out) fs.writeFileSync(out, JSON.stringify(res));
function group(trades) {
  const C = {};
  for (const y in YEARS) {
    const a = Date.parse(YEARS[y][0]), b = Date.parse(YEARS[y][1]), T = trades.filter(t => t.t >= a && t.t < b), g = {};
    const put = (k, t) => (g[k] = g[k] || []).push(t);
    T.forEach(t => {
      put("all", t); put(t.key, t);                           // the configuration, whatever the trend
      put(t.key + "|" + t.tr, t);                             // with the trend class (with / mixed / against)
      if (t.tr === "with") put(t.key + "|with|" + t.sig, t);  // in the trend, with or without a 15m signal
      put("tr|" + t.tr, t); if (t.tr === "with") put("with|" + t.sig, t);
    });
    C[y] = Object.fromEntries(Object.keys(g).sort().map(k => [k, st(g[k])]));
  }
  return C;
}
