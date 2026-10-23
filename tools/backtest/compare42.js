// Version 41 against version 42 on the same history: setups "Prêt", winners, result per trade, and the setups that the new
// blockers (obstacle before 1R) and the missing-data rule hold back. Usage: node compare42.js <dir with v41-*.json and v42-*.json>
const fs = require("fs"), path = require("path"), dir = process.argv[2];
function load(tag) {
  const out = { trades: [], shadow: [], evals: 0 };
  fs.readdirSync(dir).filter(f => f.startsWith(tag + "-") && f.endsWith(".json")).forEach(f => {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    out.trades.push(...d.trades); out.shadow.push(...(d.shadow || [])); out.evals += d.evals || 0;
  });
  return out;
}
function stats(tr) {
  const n = tr.length; let w = 0, s = 0; tr.forEach(t => { s += t.r; if (t.r > 0) w++; });
  const m = n ? s / n : 0; let v = 0; tr.forEach(t => { v += (t.r - m) * (t.r - m); });
  return { n, win: n ? +(w / n * 100).toFixed(1) : 0, avg: +m.toFixed(3), se: n > 1 ? +Math.sqrt(v / (n - 1) / n).toFixed(3) : 0, tot: +s.toFixed(1) };
}
const a = load("v41"), b = load("v42");
const by = {};
b.shadow.forEach(t => { const k = (t.blk.length ? t.blk.join("+") : "") + (t.miss.length ? (t.blk.length ? "+" : "") + "manque:" + t.miss.join("+") : ""); (by[k] = by[k] || []).push(t); });
const rep = { v41: stats(a.trades), v42: stats(b.trades), evals: { v41: a.evals, v42: b.evals }, heldBack: stats(b.shadow), byReason: {} };
Object.keys(by).forEach(k => { rep.byReason[k] = stats(by[k]); });
console.log(JSON.stringify(rep, null, 1));
