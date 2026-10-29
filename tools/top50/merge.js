// Merges the replay shards into tools/top50/results/replay-v1.json: coins in Top 50 order, their rank, two separate years, records.
const fs = require("fs"), path = require("path");
const [dir, out] = process.argv.slice(2);
let coins = null; const rec = [];
for (const f of fs.readdirSync(dir).filter(f => /^shard-\d+\.json$/.test(f))) {
  const x = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); coins = coins || x.coins; rec.push(...x.rec);
}
rec.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
const res = { made: new Date().toISOString(), version: 1, years: { A: ["2024-10-01", "2025-10-01"], B: ["2025-10-01", "2026-10-28"] },
  coins, rank: coins.map((c, i) => i + 1),
  fields: "coin, hour, dir, kind (c o f s), trend (with mixed against), rrNet x100, obstacle, 15m signal, Bitcoin x dir, wins bitmask (TP1 1R 1.5R 2R), r x100 per target",
  rec };
fs.writeFileSync(out, JSON.stringify(res));
console.log(coins.length, "coins", rec.length, "records", fs.statSync(out).size, "bytes");
