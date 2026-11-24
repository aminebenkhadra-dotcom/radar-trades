// Study of 23/11/2026: every trend trade of a replay with its profile (engine option feat), one compact row each, for the analysis of
// which longs and which shorts won. Row: [symbol, entry time, exit time, side 1/-1, how, R, configuration, profile, inversion exits
// (option inv: {x1: [R, how], x4: [R, how]}), kind ("rev", "rng" or empty for a trend trade)].
// Usage: node feat42.js <dir with v42-*.json>
const fs = require("fs"), path = require("path"), dir = process.argv[2];
let rows = [];
fs.readdirSync(dir).filter(f => /^v42-\d+\.json$/.test(f)).forEach(f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).trades
  .forEach(t => rows.push([t.sym, t.t, t.x, t.dir, t.how, +t.r.toFixed(3), t.cf && typeof t.cf === "object" ? t.cf.key : t.cf, t.fx || null, t.ix || null, t.kind || ""])));
rows.sort((a, b) => a[1] - b[1]);
process.stdout.write(JSON.stringify(rows));
