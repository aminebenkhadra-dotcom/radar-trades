// Time to TP1 for version 42: hours the winning setups took, by TP distance in 1H ATR at entry, measured like the app measures it
// (Wilder's ATR over the 200 hours before the entry, tools/engine.js atr). One row per distinct trade (symbol, entry time, side).
// Usage: node ttp42.js rows <trades dir> <data dir> <out.json>   -> rows of one period
//        node ttp42.js table <rows.json> [<rows.json> ...]          -> the table copied into tools/engine.js (TTP)
const fs = require("fs"), path = require("path"), L = require("./lib.js");
const E = new Function(fs.readFileSync(path.join(__dirname, "..", "engine.js"), "utf8") + ";return {atr}")();
const [mode, ...a] = process.argv.slice(2);
if (mode === "rows") {
  const [dir, data, out] = a, seen = new Set(), bySym = {};
  fs.readdirSync(dir).filter(f => /^v42-\d+\.json$/.test(f)).forEach(f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).trades.forEach(t => {
    const k = t.sym + "|" + t.t + "|" + t.dir; if (seen.has(k)) return; seen.add(k); (bySym[t.sym] = bySym[t.sym] || []).push(t); }));
  const rows = [];
  for (const sym of Object.keys(bySym)) {
    const D = L.loadSymbol(data, sym + "USDT"); if (!D.m15.length) continue;
    const h1 = L.aggregate(D.m15, 36e5), idx = new Map(); h1.forEach((k, i) => idx.set(k.t, i));
    for (const t of bySym[sym]) {
      const i = idx.get(Math.floor(t.t / 36e5) * 36e5); if (i === undefined || i < 40) continue;
      const a1 = E.atr(h1.slice(Math.max(0, i - 200), i)), dT = Math.abs(t.tp - t.entry);
      if (a1 > 0) rows.push({ k: +(dT / a1).toFixed(3), h: +((t.x - t.t) / 36e5).toFixed(2), how: t.how });
    }
  }
  fs.writeFileSync(out, JSON.stringify(rows)); console.log("rows", rows.length);
} else if (mode === "table") {
  let rows = []; a.forEach(f => { rows = rows.concat(JSON.parse(fs.readFileSync(f, "utf8"))); });
  const q = (v, p) => v[Math.min(v.length - 1, Math.floor(p * (v.length - 1)))], kb = [0, 2, 3, 4, 5, 6, 8, 10], table = [];
  for (let j = 0; j < kb.length - 1; j++) {
    const w = rows.filter(x => x.how === "tp" && x.k >= kb[j] && x.k < kb[j + 1]).map(x => x.h).sort((x, y) => x - y);
    console.log(("k " + kb[j] + "-" + kb[j + 1]).padEnd(8), "TP n", String(w.length).padStart(5), w.length ? "med " + q(w, .5).toFixed(1) + "h p25 " + q(w, .25).toFixed(1) + " p75 " + q(w, .75).toFixed(1) : "");
    if (w.length >= 30) table.push([kb[j + 1], +q(w, .5).toFixed(1), +q(w, .25).toFixed(1), +q(w, .75).toFixed(1)]);
  }
  console.log("rows", rows.length, "TABLE", JSON.stringify(table));
}
