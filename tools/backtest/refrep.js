// node refrep.js <outdir> <tag> [tag...]   — summary of reference runs of the shipped engine
const fs = require("fs"), L = require("./lib.js"), OUT = process.argv[2], SPLIT = Date.UTC(2026, 5, 1);
function load(tag) { let tr = []; for (let k = 0; k < 8; k++) { const f = OUT + "/" + tag + "-" + k + ".json"; if (!fs.existsSync(f)) break; tr = tr.concat(JSON.parse(fs.readFileSync(f, "utf8")).trades); } tr.forEach(t => { t.bars = (t.x - t.t) / 9e5; t.stop = Math.abs(t.entry - t.sl) / t.entry * 100; t.rr = Math.abs(t.tp - t.entry) / Math.abs(t.entry - t.sl); }); return tr.sort((a, b) => a.t - b.t); }
for (const tag of process.argv.slice(3)) {
  const tr = load(tag), g = (label, fn) => console.log(L.line(label, L.stats(tr.filter(fn))));
  console.log("=== " + tag + "  (" + (tr.length ? new Date(tr[0].t).toISOString().slice(0, 10) + " → " + new Date(tr[tr.length - 1].t).toISOString().slice(0, 10) : "no trades") + ", " + new Set(tr.map(t => t.sym)).size + " symbols)");
  g("ALL", () => true); g("  Nov–May", t => t.t < SPLIT); g("  Jun–Oct", t => t.t >= SPLIT); g("  long", t => t.dir > 0); g("  short", t => t.dir < 0);
  for (const [a, b] of [[0, 55], [55, 65], [65, 75], [75, 101]]) g("  score " + a + "–" + (b - 1), t => t.score >= a && t.score < b);
  const mo = {}; tr.forEach(t => { const k = new Date(t.t).toISOString().slice(2, 7); (mo[k] = mo[k] || []).push(t); });
  console.log("  by month: " + Object.keys(mo).sort().map(k => k + " " + (L.stats(mo[k]).avg >= 0 ? "+" : "") + L.stats(mo[k]).avg.toFixed(2) + "(" + mo[k].length + ")").join("  "));
  const pos = Object.keys(mo).filter(k => L.stats(mo[k]).avg > 0).length; console.log("  months in profit: " + pos + "/" + Object.keys(mo).length + " | median stop " + tr.map(t => t.stop).sort((a, b) => a - b)[Math.floor(tr.length / 2)].toFixed(2) + " % | median R:R " + tr.map(t => t.rr).sort((a, b) => a - b)[Math.floor(tr.length / 2)].toFixed(2));
  const bySym = {}; tr.forEach(t => (bySym[t.sym] = bySym[t.sym] || []).push(t)); const ss = Object.keys(bySym).map(k => L.stats(bySym[k]).avg);
  console.log("  symbols with a positive average: " + ss.filter(v => v > 0).length + "/" + ss.length);
}
