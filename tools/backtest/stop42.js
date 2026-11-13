// Stop placement: one replay of version 42 per variant (base, stop moved beyond the last 1H swing of 12 / 24 / 48 hours, or the
// setup held back when the stop is exposed). Out: trades, per day, % TP1, average R (fees in), stops hit within 8 hours, and on
// the trades whose stop was exposed (sx): their count and results. Usage: node stop42.js <dir with v42-*.json> <days>
const fs = require("fs"), path = require("path"), dir = process.argv[2];
const tr = [];
fs.readdirSync(dir).filter(f => /^v42-\d+\.json$/.test(f)).forEach(f => tr.push(...JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).trades));
const days = tr.length ? (Math.max(...tr.map(t => t.t)) - Math.min(...tr.map(t => t.t))) / 864e5 : 1;
const st = L => { const n = L.length, av = f => n ? +(L.reduce((s, t) => s + f(t), 0) / n).toFixed(3) : 0, pc = f => n ? +(L.filter(f).length / n * 100).toFixed(1) : 0;
  return { n, tp: pc(t => t.how === "tp"), sl: pc(t => t.how === "sl"), fast: pc(t => t.how === "sl" && t.x - t.t <= 8 * 36e5), avg: av(t => t.r), stopPct: av(t => t.rp || 0), sum: +L.reduce((s, t) => s + t.r, 0).toFixed(1) }; };
console.log(JSON.stringify({ days: Math.round(days), all: Object.assign(st(tr), { perDay: +(tr.length / days).toFixed(2) }), exposed: st(tr.filter(t => t.sx)), clean: st(tr.filter(t => !t.sx)) }));
