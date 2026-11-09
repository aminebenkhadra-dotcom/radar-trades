// What the state of an open trade said about its end, in the version 42 replay: every 4 hours of each replayed trade the engine's
// tradeState was recorded (score, hard flag, progress in R). Per cell (stateKey): how many, % that ended at TP1, the average final
// result, and the average gain of holding over closing right then (final R minus the R of an exit at that moment, fees alike).
// Usage: node state42.js <dir with v42-*.json>
const fs = require("fs"), path = require("path"), dir = process.argv[2];
const tr = [];
fs.readdirSync(dir).filter(f => /^v42-\d+\.json$/.test(f)).forEach(f => tr.push(...JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).trades));
const cell = {}, band = {}, add = (o, k, t, s) => { const c = o[k] || (o[k] = [0, 0, 0, 0]); c[0]++; if (t.how === "tp") c[1]++; c[2] += t.r; c[3] += t.r - (s[2] - t.cr); };
let samples = 0;
tr.forEach(t => (t.hs || []).forEach(s => { samples++; add(cell, s[3], t, s); add(band, s[3][0], t, s); add(band, "r" + s[3][1], t, s); add(band, "all", t, s); }));
const fin = o => { const out = {}; Object.keys(o).sort().forEach(k => { const c = o[k]; out[k] = [c[0], +(c[1] / c[0] * 100).toFixed(1), +(c[2] / c[0]).toFixed(3), +(c[3] / c[0]).toFixed(3)]; }); return out; };
console.log(JSON.stringify({ trades: tr.length, samples, band: fin(band), cell: fin(cell) }));
