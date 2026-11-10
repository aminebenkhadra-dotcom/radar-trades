// Moving the stop after break-even: on the version 42 replay, every trade run with each trailing rule of the engine (trailStop):
// average result in R (fees in) against the plain plan (original stop, first target), share of trades ending above 2.5 R, and the
// same on the trades that reached +1 R (the only ones a rule changes). Usage: node trail42.js <dir with v42-*.json>
const fs = require("fs"), path = require("path"), dir = process.argv[2];
const tr = [];
fs.readdirSync(dir).filter(f => /^v42-\d+\.json$/.test(f)).forEach(f => tr.push(...JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).trades));
const T = tr.filter(t => t.tr), W = T.filter(t => t.far >= 1), rules = ["be", "step", "r1", "a1", "a2", "sw"];
const av = (L, f) => L.length ? +(L.reduce((s, t) => s + f(t), 0) / L.length).toFixed(3) : 0, pc = (L, f) => L.length ? +(L.filter(f).length / L.length * 100).toFixed(1) : 0;
const out = { trades: tr.length, run: T.length, reached1R: W.length, base: { all: av(T, t => t.r), on1R: av(W, t => t.r), tp: pc(T, t => t.how === "tp") } };
rules.forEach(r => out[r] = { all: av(T, t => t.tr[r][0]), on1R: av(W, t => t.tr[r][0]), big: pc(W, t => t.tr[r][0] > 2.5), zero: pc(W, t => Math.abs(t.tr[r][0]) < 0.25), best: +Math.max(...W.map(t => t.tr[r][0]), 0).toFixed(1), better: pc(W, t => t.tr[r][0] > t.r + 0.01), worse: pc(W, t => t.tr[r][0] < t.r - 0.01) });
console.log(JSON.stringify(out));
