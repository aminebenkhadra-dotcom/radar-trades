// Reliability and time to target of the setups, from the reference runs of both years.
// Reliability: does "distance to stop / (distance to stop + distance to target)" predict how often TP comes first?
// Time: hours needed to reach TP1, against the TP distance measured in 1H ATR at entry.
// Version 41 study. Its two weak points are fixed in ttp42.js (used for version 42): the strict-0 and strict-2 runs overlap, so a
// setup could be counted twice here, and the ATR here is a plain 14-hour mean while the app uses Wilder's ATR.
const fs = require("fs"), L = require("./lib.js");
const [N, OLD] = process.argv.slice(2);
function load(dir, s) { let tr = []; for (let k = 0; k < 8; k++) { const f = dir + "/ref-" + s + "-" + k + ".json"; if (!fs.existsSync(f)) break; tr = tr.concat(JSON.parse(fs.readFileSync(f, "utf8")).trades); } return tr; }
function atr(k, n) { let s = 0; for (let i = k.length - n; i < k.length; i++) s += Math.max(k[i].h - k[i].l, Math.abs(k[i].h - k[i - 1].c), Math.abs(k[i].l - k[i - 1].c)); return s / n; }
const rows = [];
for (const [y, fl, data] of [["24", N + "/fl25", OLD + "/data25"], ["25", N + "/fl26", OLD + "/data"]]) {
  const tr = load(fl, 0).concat(load(fl, 2).map(t => Object.assign({ strict2: 1 }, t))), bySym = {};
  tr.forEach(t => (bySym[t.sym] = bySym[t.sym] || []).push(t));
  for (const sym of Object.keys(bySym)) {
    let D; try { D = L.loadSymbol(data, sym + "USDT"); } catch (e) { continue; }
    const h1 = L.aggregate(D.m15, 36e5), idx = new Map(); h1.forEach((k, i) => idx.set(k.t, i));
    for (const t of bySym[sym]) {
      const i = idx.get(Math.floor(t.t / 36e5) * 36e5); if (i === undefined || i < 20) continue;
      const a1 = atr(h1.slice(0, i), 14), R = Math.abs(t.entry - t.sl), dT = Math.abs(t.tp - t.entry);
      rows.push({ y, s2: !!t.strict2, p: R / (R + dT), win: t.how === "tp" ? 1 : 0, how: t.how, h: (t.x - t.t) / 36e5, k: dT / a1, ks: R / a1 });
    }
  }
}
console.log("trades", rows.length);
/* calibration */
const cb = [[0, .2], [.2, .26], [.26, .3], [.3, .34], [.34, .38], [.38, .45], [.45, 1]];
for (const y of ["24", "25"]) console.log("year 20" + y + ": " + cb.map(([a, b]) => { const r = rows.filter(x => x.y === y && x.p >= a && x.p < b); if (!r.length) return ""; return "pred " + (r.reduce((s, x) => s + x.p, 0) / r.length * 100).toFixed(0) + "% → réel " + (r.reduce((s, x) => s + x.win, 0) / r.length * 100).toFixed(0) + "% (" + r.length + ")"; }).filter(Boolean).join(" | "));
/* time to TP for winners, by TP distance in 1H ATR */
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * (a.length - 1)))];
const kb = [0, 2, 3, 4, 5, 6, 8, 10, 13, 17, 25, 1e9], table = [];
for (let j = 0; j < kb.length - 1; j++) {
  const w = rows.filter(x => x.how === "tp" && x.k >= kb[j] && x.k < kb[j + 1]).map(x => x.h).sort((a, b) => a - b);
  const l = rows.filter(x => x.how === "sl" && x.k >= kb[j] && x.k < kb[j + 1]).map(x => x.h).sort((a, b) => a - b);
  const all = rows.filter(x => x.k >= kb[j] && x.k < kb[j + 1]);
  if (w.length < 30) continue;
  const byY = ["24", "25"].map(y => { const z = rows.filter(x => x.y === y && x.how === "tp" && x.k >= kb[j] && x.k < kb[j + 1]).map(x => x.h).sort((a, b) => a - b); return z.length ? q(z, .5).toFixed(1) : "-"; });
  table.push([kb[j + 1] >= 1e9 ? 99 : kb[j + 1], +q(w, .5).toFixed(1), +q(w, .25).toFixed(1), +q(w, .75).toFixed(1), +q(w, .9).toFixed(1)]);
  console.log(("k " + kb[j] + "-" + kb[j + 1]).padEnd(12), "TP n", String(w.length).padStart(5), "med", q(w, .5).toFixed(1) + "h", "p25", q(w, .25).toFixed(1), "p75", q(w, .75).toFixed(1), "p90", q(w, .9).toFixed(1), "| by year med", byY.join(" / "), "| SL med", l.length ? q(l, .5).toFixed(1) : "-", "| win", (all.reduce((s, x) => s + x.win, 0) / all.length * 100).toFixed(0) + "%");
}
console.log("TABLE", JSON.stringify(table));
/* among trades still open after X hours, how often TP still comes */
for (const H of [6, 12, 24, 48, 96]) { const r = rows.filter(x => x.h > H); console.log("still open after " + H + "h: n " + r.length + ", TP " + (r.reduce((s, x) => s + x.win, 0) / r.length * 100).toFixed(0) + "%, time-out " + (r.filter(x => x.how === "time").length / r.length * 100).toFixed(0) + "%"); }
