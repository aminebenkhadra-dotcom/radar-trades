// Study of 25/11/2026: the app's trend trades against breakout trades (engine option brk). Stats per kind (trend / brk) and side,
// the whole replay, month by month, and the last week (from 2026-11-17) when the period reaches it.
// Usage: node brk42.js <dir with v42-*.json>
const fs = require("fs"), path = require("path"), dir = process.argv[2];
let tr = [];
fs.readdirSync(dir).filter(f => /^v42-\d+\.json$/.test(f)).forEach(f => tr.push(...JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).trades));
tr.sort((a, b) => a.t - b.t);
function st(a) { const n = a.length; let w = 0, s = 0, run = 0, worst = 0, eq = 0, pk = 0, dd = 0;
  a.forEach(t => { if (t.r > 0) { w++; run = 0 } else { run++; worst = Math.max(worst, run) } s += t.r; eq += t.r; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq) });
  return { n, win: n ? +(w / n * 100).toFixed(1) : 0, avg: n ? +(s / n).toFixed(3) : 0, tot: +s.toFixed(1), streak: worst, dd: +dd.toFixed(1) }; }
const K = t => (t.kind === "brk" ? "brk" : "trend") + (t.dir > 0 ? "L" : "S");
const out = { all: st(tr) }; ["trendL", "trendS", "brkL", "brkS"].forEach(k => out[k] = st(tr.filter(t => K(t) === k)));
const mo = {}; tr.forEach(t => { const m = new Date(t.t).toISOString().slice(0, 7); (mo[m] = mo[m] || []).push(t); });
out.months = Object.fromEntries(Object.keys(mo).sort().map(m => [m, { all: st(mo[m]).tot, brk: st(mo[m].filter(t => t.kind === "brk")).tot, nb: mo[m].filter(t => t.kind === "brk").length }]));
const wk = tr.filter(t => t.t >= Date.parse("2026-11-17T00:00:00Z"));
if (wk.length) { out.week = { all: st(wk) }; ["trendL", "trendS", "brkL", "brkS"].forEach(k => out.week[k] = st(wk.filter(t => K(t) === k))); }
console.log(JSON.stringify(out));
