// Success rate of each setup configuration (direction x kind of zone, then x number of price marks on the zone), from the
// version 42 replay: setups "Prêt" taken by the history test, TP1 before the stop. Usage: node config42.js <dir with v42-*.json>
const fs = require("fs"), path = require("path"), dir = process.argv[2];
const tr = [];
fs.readdirSync(dir).filter(f => /^v42-\d+\.json$/.test(f)).forEach(f => tr.push(...JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).trades));
const st = L => { const n = L.length; let w = 0, s = 0; L.forEach(t => { s += t.r; if (t.how === "tp") w++; }); return [n, n ? +(w / n * 100).toFixed(1) : 0, n ? +(s / n).toFixed(3) : 0]; };
const by = {}, byK = {};
tr.forEach(t => { if (!t.cf) return; const k = t.cf.key, b = t.cf.k >= 2 ? 2 : t.cf.k; (by[k] = by[k] || []).push(t); (byK[k + b] = byK[k + b] || []).push(t); });
const out = { all: st(tr), how: [...new Set(tr.map(t => t.how))], cfg: {}, marks: {} };
Object.keys(by).sort().forEach(k => out.cfg[k] = st(by[k]));
Object.keys(byK).sort().forEach(k => out.marks[k] = st(byK[k]));
console.log(JSON.stringify(out));
