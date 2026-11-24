// Study of the memo of 24/11/2026: what each point of the memo would have changed, on the replays of memo.yml (feat42.js rows).
// For every condition: trades and mean R when it holds and when it does not, longs and shorts apart, per period, on the app's trades
// (prof) and on the trades the app leaves orange (base trades that do not match a winning profile). Plus the trend-inversion exits
// (point 1) against the plain stop and target, and the economic announcements (point 7) and the coins' supply (point 8).
// Usage: node memo42.js <dir with A/ B/ C/ D/ each holding base-trades.json and prof-trades.json> [supply.json]
const fs = require("fs"), path = require("path"), dir = process.argv[2];
const supply = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], "utf8")) : {};
const P = ["A", "B", "C", "D"].filter(p => fs.existsSync(path.join(dir, p, "prof-trades.json")));
const load = (p, v) => JSON.parse(fs.readFileSync(path.join(dir, p, v + "-trades.json"), "utf8")).map(x => ({ sym: x[0], t: x[1], x: x[2], d: x[3], how: x[4], r: x[5], cf: x[6], f: x[7] || {}, ix: x[8], kind: x[9] || "" }));
/* major US announcements (UTC): FOMC decisions (second day, 18:00 or 19:00), CPI releases (12:30 or 13:30) */
const FOMC = ["2024-09-18", "2024-11-07", "2024-12-18", "2025-01-29", "2025-03-19", "2025-05-07", "2025-06-18", "2025-07-30", "2025-09-17", "2025-10-29", "2025-12-10",
  "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17", "2026-07-29", "2026-09-16", "2026-10-28"];
const CPI = ["2024-09-11", "2024-10-10", "2024-11-13", "2024-12-11", "2025-01-15", "2025-02-12", "2025-03-12", "2025-04-10", "2025-05-13", "2025-06-11", "2025-07-15",
  "2025-08-12", "2025-09-11", "2025-10-24", "2025-12-18", "2026-01-13", "2026-02-13", "2026-03-11", "2026-04-10", "2026-05-12", "2026-06-10", "2026-07-14", "2026-08-12",
  "2026-09-11", "2026-10-14", "2026-11-10"];
const EV = [...FOMC.map(d => Date.parse(d + "T18:30:00Z")), ...CPI.map(d => Date.parse(d + "T13:00:00Z"))].sort((a, b) => a - b);
const before24 = t => EV.some(e => e > t && e - t <= 864e5), across = (t, x) => EV.some(e => e > t && e < x);
const win = (f, d) => d > 0 ? f.rg !== null && f.rg > 1.3 : f.bsh !== null && f.bsh >= 0 && f.bsh < 1;
const C = {
  "1 · pivot à moins de 0,25 ATR de l'entrée": o => o.f.pvE != null ? o.f.pvE < 0.25 : null,
  "2 · pivot à moins de 0,25 ATR du TP": o => o.f.pvT != null ? o.f.pvT < 0.25 : null,
  "2 · pivot entre l'entrée et le TP": o => o.f.pvW != null ? o.f.pvW > 0 : null,
  "3 · gros niveau à moins de 3 % sur le chemin": o => o.f.bigP != null ? o.f.bigP < 3 : null,
  "3 · gros niveau avant 1 R": o => o.f.bigR != null ? o.f.bigR < 1 : null,
  "4 · zone morte 15 min / 1H": o => o.f.dz1 != null ? o.f.dz1 === 1 : null,
  "4 · zone morte 1H / 4H": o => o.f.dz4 != null ? o.f.dz4 === 1 : null,
  "5 · plus forte que BTC sur 24 h (sens du trade)": o => o.f.rs24 != null ? o.f.rs24 > 0 : null,
  "5 · plus forte que BTC sur 7 j (sens du trade)": o => o.f.rs7 != null ? o.f.rs7 > 0 : null,
  "5 · nettement (> 5 %) sur 7 j (sens du trade)": o => o.f.rs7 != null ? o.f.rs7 > 5 : null,
  "7 · annonce (FOMC, CPI) dans les 24 h": o => before24(o.t),
  "7 · annonce pendant le trade": o => across(o.t, o.x),
  "8 · moins de 60 % de l'offre en circulation": o => { const s = supply[o.sym + "USDT"] || supply["1000" + o.sym + "USDT"] || supply[o.sym]; return s && s.ct != null ? s.ct < 60 : null; },
};
const st = a => { const n = a.length; if (!n) return null; const s = a.reduce((x, y) => x + y, 0); return { n, avg: s / n, tot: s, win: a.filter(x => x > 0).length / n }; };
const fmt = s => s ? (s.n + " " + (s.avg >= 0 ? "+" : "") + s.avg.toFixed(2)).padEnd(11) : "—".padEnd(11);
const data = {}; P.forEach(p => { data[p] = { base: load(p, "base").filter(o => !o.kind), prof: load(p, "prof").filter(o => !o.kind) }; });
const out = {};
for (const side of [1, -1]) {
  console.log("\n=== " + (side > 0 ? "LONGS" : "SHORTS") + " · chaque case : trades et R moyen, si la condition est vraie | si elle est fausse");
  console.log("".padEnd(48) + P.map(p => (p + " appli (vrai | faux)").padEnd(26)).join("") + "  orange de l'appli, si vrai");
  for (const k in C) {
    let line = k.padEnd(48);
    P.forEach(p => { const a = data[p].prof.filter(o => o.d === side), yes = a.filter(o => C[k](o) === true), no = a.filter(o => C[k](o) === false);
      line += (fmt(st(yes.map(o => o.r))) + "| " + fmt(st(no.map(o => o.r)))).padEnd(26);
      (out[k] = out[k] || {})[p + side] = { yes: st(yes.map(o => o.r)), no: st(no.map(o => o.r)) }; });
    line += "  " + P.map(p => { const a = data[p].base.filter(o => o.d === side && !win(o.f, o.d) && C[k](o) === true); return p + " " + fmt(st(a.map(o => o.r))); }).join("");
    console.log(line);
  }
}
/* point 1: trend-inversion exits, on the app's trades (prof) */
console.log("\n=== point 1 · sortie à la clôture au-delà du dernier sommet / creux contre le trade (trades de l'appli)");
P.forEach(p => { const a = data[p].prof.filter(o => o.ix);
  const row = (lab, f) => { const s = st(a.map(f)); return lab + " " + s.n + " tr " + (s.avg >= 0 ? "+" : "") + s.avg.toFixed(3) + " R tot " + s.tot.toFixed(1) + " gagnants " + (s.win * 100).toFixed(0) + " %"; };
  console.log(p + " · " + [row("stop et TP", o => o.r), row("x1 (1H)", o => o.ix.x1 ? o.ix.x1[0] : o.r), row("x4 (4H)", o => o.ix.x4 ? o.ix.x4[0] : o.r)].join(" | "));
  const cut = a.filter(o => o.ix.x1 && o.ix.x1[1] === "inv"); console.log("    x1 : " + cut.length + " trades coupés ; ils finissaient " + fmt(st(cut.map(o => o.r))) + " et sortent à " + fmt(st(cut.map(o => o.ix.x1[0]))) + " ; dont gagnants coupés " + cut.filter(o => o.r > 0).length);
  const cut4 = a.filter(o => o.ix.x4 && o.ix.x4[1] === "inv"); console.log("    x4 : " + cut4.length + " trades coupés ; ils finissaient " + fmt(st(cut4.map(o => o.r))) + " et sortent à " + fmt(st(cut4.map(o => o.ix.x4[0]))) + " ; dont gagnants coupés " + cut4.filter(o => o.r > 0).length); });
if (process.argv[4]) fs.writeFileSync(process.argv[4], JSON.stringify(out));
