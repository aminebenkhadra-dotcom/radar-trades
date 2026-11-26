// Réglages of 26/11/2026: one replay (ref.js output) summed up as the app would play it. Nico: exit at the 1H trend inversion (engine
// option inv, x1) and half size before a strong announcement (FOMC, CPI within 24 hours) or outside the top 20 by capitalisation
// (ranks.json from caps.js); the other réglages as they are. Stats per side, month by month, and the week from 2026-11-17.
// Usage: node presets42.js <dir with v42-*.json> <radar|avant|nico|sr> [ranks.json]
const fs = require("fs"), path = require("path"), [dir, kind, rk] = process.argv.slice(2);
const ranks = rk && fs.existsSync(rk) ? JSON.parse(fs.readFileSync(rk, "utf8")) : {};
let tr = [];
fs.readdirSync(dir).filter(f => /^v42-\d+\.json$/.test(f)).forEach(f => tr.push(...JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).trades));
tr.sort((a, b) => a.t - b.t);
const FOMC = ["2024-09-18", "2024-11-07", "2024-12-18", "2025-01-29", "2025-03-19", "2025-05-07", "2025-06-18", "2025-07-30", "2025-09-17", "2025-10-29", "2025-12-10",
  "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17", "2026-07-29", "2026-09-16", "2026-10-28"];
const CPI = ["2024-09-11", "2024-10-10", "2024-11-13", "2024-12-11", "2025-01-15", "2025-02-12", "2025-03-12", "2025-04-10", "2025-05-13", "2025-06-11", "2025-07-15",
  "2025-08-12", "2025-09-11", "2025-10-24", "2025-12-18", "2026-01-13", "2026-02-13", "2026-03-11", "2026-04-10", "2026-05-12", "2026-06-10", "2026-07-14", "2026-08-12",
  "2026-09-11", "2026-10-14", "2026-11-10"];
const EV = [...FOMC.map(d => Date.parse(d + "T18:30:00Z")), ...CPI.map(d => Date.parse(d + "T13:00:00Z"))];
const soon = t => EV.some(e => e > t && e - t <= 864e5);
const rankOf = s => ranks[s + "USDT"] || ranks["1000" + s + "USDT"] || ranks["1000000" + s + "USDT"] || null;
if (kind === "nico") tr.forEach(t => { t.r0 = t.r; const inv = t.ix && t.ix.x1 ? t.ix.x1[0] : t.r, rk = rankOf(t.sym), half = soon(t.t) || (rk !== null && rk > 20);
  t.inv = inv; t.half = half ? 1 : 0; t.r = +(inv * (half ? 0.5 : 1)).toFixed(3); });
function st(a) { const n = a.length; let w = 0, s = 0, run = 0, worst = 0, eq = 0, pk = 0, dd = 0;
  a.forEach(t => { if (t.r > 0) { w++; run = 0 } else { run++; worst = Math.max(worst, run) } s += t.r; eq += t.r; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq) });
  return { n, win: n ? +(w / n * 100).toFixed(1) : 0, avg: n ? +(s / n).toFixed(3) : 0, tot: +s.toFixed(1), streak: worst, dd: +dd.toFixed(1) }; }
const out = { all: st(tr), L: st(tr.filter(t => t.dir > 0)), S: st(tr.filter(t => t.dir < 0)) };
out.kinds = {}; [...new Set(tr.map(t => t.kind || "trend"))].forEach(k => out.kinds[k] = st(tr.filter(t => (t.kind || "trend") === k)));
if (kind === "nico") { const sum = f => +tr.reduce((a, t) => a + f(t), 0).toFixed(1);
  out.nico = { raw: sum(t => t.r0), invOnly: sum(t => t.inv), halfOnly: sum(t => t.r0 * (t.half ? 0.5 : 1)), halved: tr.filter(t => t.half).length }; }
const mo = {}; tr.forEach(t => { const m = new Date(t.t).toISOString().slice(0, 7); (mo[m] = mo[m] || []).push(t); });
out.months = Object.fromEntries(Object.keys(mo).sort().map(m => [m, st(mo[m]).tot]));
const wk = tr.filter(t => t.t >= Date.parse("2026-11-17T00:00:00Z")); if (wk.length) out.week = st(wk);
console.log(JSON.stringify(out));
