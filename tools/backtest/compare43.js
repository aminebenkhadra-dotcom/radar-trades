// Version 42 against version 43 on the same data: result of the ready setups, and of the setups each new blocker held back.
// Usage: node compare43.js <folder of ref.js outputs>; files are named <engine>s<strict>-<part>.json
const fs = require("fs"), path = require("path"), D = process.argv[2], g = {};
for (const f of fs.readdirSync(D)) { const m = f.match(/^(v4[23])s(\d)-\d+\.json$/); if (!m) continue;
  const k = m[1] + "s" + m[2], j = JSON.parse(fs.readFileSync(path.join(D, f))); g[k] = g[k] || { t: [], s: [] }; g[k].t.push(...j.trades); g[k].s.push(...(j.shadow || [])); }
const st = a => ({ n: a.length, win: a.length ? +(100 * a.filter(x => x.how === "tp").length / a.length).toFixed(1) : null, r: a.length ? +(a.reduce((s, x) => s + x.r, 0) / a.length).toFixed(3) : null });
const out = {};
for (const k of Object.keys(g).sort()) { out[k] = { ready: st(g[k].t), held: {} };
  for (const key of ["top", "btc", "obst"]) out[k].held[key] = st(g[k].s.filter(x => (x.blk || []).includes(key))); }
console.log(JSON.stringify(out, null, 1));
