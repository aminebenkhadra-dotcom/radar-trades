// Memo 3 of 26/11/2026: the app's trades in the middle of a 1H range (engine flag mid) against the others, longs and shorts.
// Usage: node mid42.js <dir with v42-*.json>
const fs = require("fs"), path = require("path"), dir = process.argv[2];
let tr = []; fs.readdirSync(dir).filter(f => /^v42-\d+\.json$/.test(f)).forEach(f => tr.push(...JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).trades));
tr = tr.filter(t => !t.kind);
const st = a => { const n = a.length, s = a.reduce((x, t) => x + t.r, 0); return { n, win: n ? +(a.filter(t => t.r > 0).length / n * 100).toFixed(1) : 0, avg: n ? +(s / n).toFixed(3) : 0, tot: +s.toFixed(1) }; };
const out = {}; for (const [k, f] of [["all", () => true], ["L", t => t.dir > 0], ["S", t => t.dir < 0]]) { const a = tr.filter(f); out[k] = { mid: st(a.filter(t => t.mid)), rest: st(a.filter(t => !t.mid)) }; }
console.log(JSON.stringify(out));
