// Study of 23/11/2026: trend trades of version 42 against two additions, a reversal after an excess and a filter on trend trades taken
// too late. Summary per kind (trend / reversal) and side, and what the filter held back.
// Usage: node rev42.js <dir with v42-*.json>
const fs = require("fs"), path = require("path"), dir = process.argv[2];
let trades = [], late = [];
fs.readdirSync(dir).filter(f => /^v42-\d+\.json$/.test(f)).forEach(f => { const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); trades.push(...j.trades); late.push(...(j.late || [])); });
trades.sort((a, b) => a.t - b.t);
function st(tr) {
  const n = tr.length; let w = 0, sum = 0, gp = 0, gl = 0, run = 0, worst = 0, peak = 0, dd = 0, eq = 0;
  tr.forEach(t => { const x = t.r; if (x > 0) { w++; gp += x; run = 0 } else { gl -= x; run++; worst = Math.max(worst, run) } sum += x; eq += x; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); });
  const mean = n ? sum / n : 0, v = tr.reduce((a, t) => a + (t.r - mean) ** 2, 0);
  return { n, win: n ? +(w / n * 100).toFixed(1) : 0, avg: +mean.toFixed(3), se: n > 1 ? +Math.sqrt(v / (n - 1) / n).toFixed(3) : 0, tot: +sum.toFixed(1), pf: gl > 0 ? +(gp / gl).toFixed(2) : null, streak: worst, dd: +dd.toFixed(1) };
}
const K = t => (t.kind === "rev" ? "rev" : "trend") + (t.dir > 0 ? "L" : "S");
const by = {}; trades.forEach(t => (by[K(t)] = by[K(t)] || []).push(t));
const out = { all: st(trades), trend: st(trades.filter(t => t.kind !== "rev")), rev: st(trades.filter(t => t.kind === "rev")) };
Object.keys(by).sort().forEach(k => out[k] = st(by[k]));
/* what the late filter held back: kept once per symbol and day, as the replay would have taken only the first */
const seen = {}, lateOne = late.filter(t => { const k = t.sym + Math.floor(t.t / 864e5) + t.dir; if (seen[k]) return false; seen[k] = 1; return true; });
out.heldBack = { L: st(lateOne.filter(t => t.dir > 0)), S: st(lateOne.filter(t => t.dir < 0)) };
/* trend trades by configuration (side + zone kind: c order block and level, o order block, f flipped level, s level) */
const cf = {}, ck = t => (t.cf && typeof t.cf === "object" ? t.cf.key : String(t.cf));
trades.filter(t => t.kind !== "rev").forEach(t => (cf[ck(t)] = cf[ck(t)] || []).push(t));
out.byCf = Object.fromEntries(Object.keys(cf).sort().map(k => [k, st(cf[k])]));
/* month by month, all trades */
const mo = {}; trades.forEach(t => { const m = new Date(t.t).toISOString().slice(0, 7); (mo[m] = mo[m] || []).push(t); });
out.months = Object.fromEntries(Object.keys(mo).sort().map(m => [m, { n: mo[m].length, tot: +mo[m].reduce((a, t) => a + t.r, 0).toFixed(1) }]));
console.log(JSON.stringify(out, null, 1));
