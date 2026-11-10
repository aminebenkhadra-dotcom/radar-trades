// Raising the target of a trade: on the version 42 replay, the trades where the "raise the target" signal appeared (tpUp in the
// engine, checked every hour), with what they did with their first target (base) and what the raised target gave with the stop
// left where it was (a), moved to the entry (b), or moved just under the first target once it is passed (c). Results in R, fees in.
// Usage: node tpup42.js <dir with v42-*.json>
const fs = require("fs"), path = require("path"), dir = process.argv[2];
const tr = [];
fs.readdirSync(dir).filter(f => /^v42-\d+\.json$/.test(f)).forEach(f => tr.push(...JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).trades));
const up = tr.filter(t => t.up), avg = f => up.length ? +(up.reduce((s, t) => s + f(t), 0) / up.length).toFixed(3) : 0, pc = f => up.length ? +(up.filter(f).length / up.length * 100).toFixed(1) : 0;
const v = k => ({ avg: avg(t => t.up[k].r), tp: pc(t => t.up[k].how === "tp"), sl: pc(t => t.up[k].how === "sl"), lock: pc(t => t.up[k].how === "lock"), better: pc(t => t.up[k].r > t.r + 0.01), worse: pc(t => t.up[k].r < t.r - 0.01) });
console.log(JSON.stringify({ trades: tr.length, signals: up.length, share: tr.length ? +(up.length / tr.length * 100).toFixed(1) : 0,
  base: { avg: avg(t => t.r), tp: pc(t => t.how === "tp"), sl: pc(t => t.how === "sl") }, a: v("a"), b: v("b"), c: v("c"),
  newRR: avg(t => t.up.rr), oldRR: avg(t => Math.abs(t.tp - t.entry) / Math.abs(t.entry - t.sl)), atR: avg(t => t.up.r), hours: avg(t => t.up.k / 4) }));
