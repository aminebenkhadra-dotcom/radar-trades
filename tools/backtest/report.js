// node report.js <file prefix> (reads <prefix>-0.json, <prefix>-1.json ...)
const fs = require("fs"), L = require("./lib.js");
const pre = process.argv[2]; let tr = [], evals = 0;
for (let k = 0; k < 8; k++) { const f = pre + "-" + k + ".json"; if (!fs.existsSync(f)) break; const j = JSON.parse(fs.readFileSync(f, "utf8")); tr = tr.concat(j.trades); evals += j.evals; }
tr.sort((a, b) => a.t - b.t);
const MAJ = { BTC: 1, ETH: 1, SOL: 1, BNB: 1, XRP: 1, DOGE: 1, ADA: 1, LINK: 1, AVAX: 1, LTC: 1, TRX: 1, BCH: 1, DOT: 1, SUI: 1 };
const g = (label, fn) => console.log(L.line(label, L.stats(tr.filter(fn))));
console.log("trades", tr.length, "evaluations", evals, "from", new Date(tr[0].t).toISOString().slice(0, 10), "to", new Date(tr[tr.length - 1].t).toISOString().slice(0, 10));
g("ALL", () => true);
g("  long", t => t.dir > 0); g("  short", t => t.dir < 0);
g("  market entry", t => !t.lim); g("  limit entry", t => t.lim);
g("  majors", t => MAJ[t.sym]); g("  others", t => !MAJ[t.sym]);
g("  BTC+ETH", t => t.sym === "BTC" || t.sym === "ETH");
for (const [a, b] of [[70, 74], [75, 79], [80, 84], [85, 100]]) g("  score " + a + "-" + b, t => t.score >= a && t.score <= b);
for (const [a, b] of [[0, 1.5], [1.5, 2], [2, 2.5], [2.5, 3.01]]) g("  rr " + a + "-" + b, t => t.rr >= a && t.rr < b);
for (const [a, b] of [[0, 1], [1, 2], [2, 4], [4, 8], [8, 100]]) g("  stop% " + a + "-" + b, t => t.stop >= a && t.stop < b);
const how = {}; tr.forEach(t => how[t.how] = (how[t.how] || 0) + 1); console.log("exits", JSON.stringify(how));
const months = [...new Set(tr.map(t => new Date(t.t).toISOString().slice(0, 7)))];
months.forEach(mo => g("  " + mo, t => new Date(t.t).toISOString().slice(0, 7) === mo));
const split = Date.UTC(2026, 5, 1);
g("TRAIN (to 2026-05)", t => t.t < split); g("TEST (from 2026-06)", t => t.t >= split);
