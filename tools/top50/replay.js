// Replays the Radar Top 50 configurations on the history of the branch top50-data and writes one record per zone contact.
// Usage: node tools/top50/replay.js <data dir> <out.json> [shard/of]     e.g. 2/5 = the second fifth of the coins
// Merge the shards with: node tools/top50/merge.js <dir with shard files> <out.json>
const fs = require("fs"), path = require("path");
const { loadSymbol } = require("../backtest/lib.js");
const E = require("./load.js")();
const [dir, out, shard] = process.argv.slice(2);
const idx = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
const coins = idx.universe.top;                      // ranked by volume in the RANK month
const [k, of] = (shard || "1/1").split("/").map(Number);
const btc = E.t5BtcDir(loadSymbol(dir, "BTCUSDT").m15);
const rec = [];
coins.forEach((s, ci) => {
  if (ci % of !== k - 1) return;
  const D = loadSymbol(dir, s), t0 = Date.now();
  const S = E.t5ReplayStart(ci, s.replace(/USDT$/, ""), D.m15, D.d1, s === "BTCUSDT" ? null : btc);
  while (!E.t5ReplayStep(S, 5000)) {}
  rec.push(...S.rec);
  console.log(s, D.m15.length, "candles", S.rec.length, "contacts", Math.round((Date.now() - t0) / 1000) + "s");
});
fs.writeFileSync(out, JSON.stringify({ coins: coins.map(s => s.replace(/USDT$/, "")), rec }));
