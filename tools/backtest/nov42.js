// The trades version 42 would have proposed since a given day (app options), one line each, and their result per day and side.
// Usage: node nov42.js <dir with v42-*.json> <first day YYYY-MM-DD>
const fs = require("fs"), path = require("path"), dir = process.argv[2], FROM = Date.parse(process.argv[3] + "T00:00:00Z");
let tr = [];
fs.readdirSync(dir).filter(f => /^v42-\d+\.json$/.test(f)).forEach(f => tr.push(...JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).trades));
tr = tr.filter(t => t.t >= FROM).sort((a, b) => a.t - b.t);
const day = {}, f = t => new Date(t).toISOString().slice(5, 16).replace("T", " ");
tr.forEach(t => { const d = new Date(t.t).toISOString().slice(0, 10), k = t.dir > 0 ? "L" : "S"; const x = day[d] = day[d] || { L: { n: 0, w: 0, r: 0 }, S: { n: 0, w: 0, r: 0 } };
  x[k].n++; if (t.r > 0) x[k].w++; x[k].r = +(x[k].r + t.r).toFixed(2); });
console.log(JSON.stringify({ n: tr.length, days: day, list: tr.map(t => [t.sym, f(t.t), f(t.x), t.dir > 0 ? "L" : "S", t.how, +t.r.toFixed(2), +t.entry.toPrecision(6), +t.sl.toPrecision(6), +t.tp.toPrecision(6)]) }, null, 0));
