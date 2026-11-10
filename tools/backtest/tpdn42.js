// Lowering the target of a trade: on the version 42 replay, the trades where the "lower the target" signal appeared (tpDown in the
// engine, checked every hour), with what they did with their first target (base) and what the lowered target gave, stop unchanged.
// Split by kind of signal (lvl: a 4H level before the target; exh: trend turned or momentum fading, no level) and by whether the
// trade state already said to leave (out). Results in R, fees in. Usage: node tpdn42.js <dir with v42-*.json>
const fs = require("fs"), path = require("path"), dir = process.argv[2];
const tr = [];
fs.readdirSync(dir).filter(f => /^v42-\d+\.json$/.test(f)).forEach(f => tr.push(...JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).trades));
const st = L => { const n = L.length, av = f => n ? +(L.reduce((s, t) => s + f(t), 0) / n).toFixed(3) : 0, pc = f => n ? +(L.filter(f).length / n * 100).toFixed(1) : 0;
  return { n, base: av(t => t.r), baseTp: pc(t => t.how === "tp"), baseSl: pc(t => t.how === "sl"), alt: av(t => t.dn.a.r), altTp: pc(t => t.dn.a.how === "tp"), altSl: pc(t => t.dn.a.how === "sl"), better: pc(t => t.dn.a.r > t.r + 0.01), worse: pc(t => t.dn.a.r < t.r - 0.01), atR: av(t => t.dn.r), newRR: av(t => t.dn.rr) }; };
const dn = tr.filter(t => t.dn), out = { trades: tr.length, all: st(dn) };
["lvl", "exh"].forEach(k => { out[k] = st(dn.filter(t => t.dn.kind === k)); out[k + "_stay"] = st(dn.filter(t => t.dn.kind === k && !t.dn.out)); out[k + "_out"] = st(dn.filter(t => t.dn.kind === k && t.dn.out)); });
out.rev = st(dn.filter(t => t.dn.rev)); out.weak = st(dn.filter(t => t.dn.weak)); out.profit = st(dn.filter(t => t.dn.r >= 0.5 && !t.dn.out)); out.early = st(dn.filter(t => t.dn.r < 0.5 && !t.dn.out));
console.log(JSON.stringify(out));
