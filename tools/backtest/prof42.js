// Study of 23/11/2026: which profiles of trend trades won, longs and shorts apart, on several replay periods (feat42.js output).
// For each side, every feature cut into a few coarse bins: trades and mean R per period. Then the single conditions and the pairs of
// conditions that stayed positive on both full years, and a cross-check: conditions picked on one year, measured on the other.
// Usage: node prof42.js A=<trades.json> B=<trades.json> [C=<trades.json>] [D=<trades.json>] [--min 40] [--json out.json]
const fs = require("fs");
const args = process.argv.slice(2), P = {}, opt = { min: 40, json: null };
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--min") opt.min = +args[++i]; else if (args[i] === "--json") opt.json = args[++i];
  else { const [k, f] = args[i].split("="); P[k] = JSON.parse(fs.readFileSync(f, "utf8")); }
}
const per = Object.keys(P);
/* coarse bins, fixed before looking at the results */
const cut = (x, edges, names) => { if (x === null || x === undefined || !isFinite(x)) return null; for (let i = 0; i < edges.length; i++) if (x < edges[i]) return names[i]; return names[edges.length]; };
const FEATS = {
  "tendance 1J alignée": f => f.bd ? "oui" : "non",
  "ADX 4H": f => cut(f.adx, [18, 25, 35], ["<18", "18-25", "25-35", "≥35"]),
  "moyenne 200 j": f => f.lt === null ? null : f.lt > 0 ? "dans le sens" : f.lt < 0 ? "contre" : "inconnue",
  "structure 4H": f => f.st === null ? null : ["inverse", "mixte", "nette"][f.st] || null,
  "Bitcoin 4H": f => f.b4 === null ? null : f.b4 > 0 ? "même sens" : f.b4 < 0 ? "contre" : "neutre",
  "Bitcoin 4 h (%)": f => cut(f.bsh, [-1, 0, 1], ["≤-1 contre", "-1-0", "0-1", "≥1 avec"]),
  "Bitcoin contre depuis 72 h (%)": f => cut(f.reb, [2, 4, 7], ["<2", "2-4", "4-7", "≥7"]),
  "Bitcoin 1J": f => f.bbd === null ? null : f.bbd > 0 ? "même sens" : f.bbd < 0 ? "contre" : "neutre",
  "RSI 4H (sens du trade)": f => cut(f.r4, [35, 45, 55, 65], ["<35", "35-45", "45-55", "55-65", "≥65"]),
  "RSI 1H (sens du trade)": f => cut(f.r1, [35, 45, 55, 65], ["<35", "35-45", "45-55", "55-65", "≥65"]),
  "repli de l'impulsion": f => cut(f.rt, [0.25, 0.5, 0.7], ["<25 %", "25-50 %", "50-70 %", "≥70 %"]),
  "amplitude 24 h": f => cut(f.rg, [0.75, 1.3], ["calme", "normale", "agitée"]),
  "volume relatif": f => cut(f.rv, [0.8, 1.5], ["faible", "normal", "fort"]),
  "repères sur la zone": f => f.kN === null ? null : f.kN >= 3 ? "3+" : String(f.kN),
  "zone": f => f.cc ? "order block + niveau" : f.zk ? "order block" : f.fl ? "niveau retourné" : "niveau",
  "contacts du niveau": f => f.zn === null ? null : f.zn >= 3 ? "3+" : String(f.zn),
  "divergence RSI": f => f.dv ? "oui" : "non",
  "flux 4H (sens du trade)": f => cut(f.d4, [0.45, 0.55], ["contre", "neutre", "avec"]),
  "volume du repli": f => cut(f.pv, [0.8, 1.2], ["faible", "normal", "fort"]),
  "déclencheur cassure": f => f.tg & 1 ? "oui" : "non",
  "déclencheur balayage": f => f.tg & 2 ? "oui" : "non",
  "déclencheur bougie": f => f.tg & 4 ? "oui" : "non",
  "déclencheur RSI": f => f.tg & 8 ? "oui" : "non",
  "déclencheur flux": f => f.tg & 16 ? "oui" : "non",
  "déclencheur volume": f => f.tg & 32 ? "oui" : "non",
  "score": f => cut(f.sc, [60, 70, 80], ["<60", "60-70", "70-80", "≥80"]),
  "TP1 en R": f => cut(f.rr, [1.8, 2.2, 3], ["<1,8", "1,8-2,2", "2,2-3", "≥3"]),
  "stop (% du prix)": f => cut(f.rp, [1, 2, 3.5], ["<1", "1-2", "2-3,5", "≥3,5"]),
  "heure UTC": (f, t) => { const h = new Date(t).getUTCHours(); return h < 6 ? "0-6" : h < 12 ? "6-12" : h < 18 ? "12-18" : "18-24"; },
  "jour": (f, t) => ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"][new Date(t).getUTCDay()],
};
const stat = a => { const n = a.length; if (!n) return { n: 0, avg: null, win: null, tot: 0 }; const s = a.reduce((x, y) => x + y, 0);
  return { n, avg: +(s / n).toFixed(3), win: +(a.filter(x => x > 0).length / n * 100).toFixed(0), tot: +s.toFixed(1) }; };
/* rows: [sym, t, x, dir, how, r, cf, fx] */
const conds = [], keyOf = (f, b) => f + " = " + b;
const data = {};
per.forEach(p => { data[p] = P[p].filter(x => x[7]).map(x => { const fx = x[7], o = { side: x[3] > 0 ? "L" : "S", r: x[5], c: {} };
  for (const f in FEATS) { const b = FEATS[f](fx, x[1]); if (b !== null && b !== undefined) o.c[f] = b; } return o; }); });
const out = { periods: {}, sides: {} };
per.forEach(p => out.periods[p] = { L: stat(data[p].filter(o => o.side === "L").map(o => o.r)), S: stat(data[p].filter(o => o.side === "S").map(o => o.r)) });
for (const side of ["L", "S"]) {
  const tab = {};
  for (const f in FEATS) {
    const bins = new Set(); per.forEach(p => data[p].forEach(o => { if (o.side === side && o.c[f] !== undefined) bins.add(o.c[f]); }));
    for (const b of bins) { tab[keyOf(f, b)] = {}; per.forEach(p => { tab[keyOf(f, b)][p] = stat(data[p].filter(o => o.side === side && o.c[f] === b).map(o => o.r)); }); }
  }
  /* single conditions positive on both years */
  const ok = k => tab[k].A && tab[k].B && tab[k].A.n >= opt.min && tab[k].B.n >= opt.min && tab[k].A.avg > 0 && tab[k].B.avg > 0;
  const singles = Object.keys(tab).filter(ok).sort((a, b) => Math.min(tab[b].A.avg, tab[b].B.avg) - Math.min(tab[a].A.avg, tab[a].B.avg));
  /* pairs of conditions (two different features) positive on both years */
  const keys = Object.keys(tab).filter(k => tab[k].A && tab[k].B && tab[k].A.n >= opt.min && tab[k].B.n >= opt.min);
  const pairs = [];
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const [f1, b1] = keys[i].split(" = "), [f2, b2] = keys[j].split(" = "); if (f1 === f2) continue;
    const s = {}; per.forEach(p => s[p] = stat(data[p].filter(o => o.side === side && o.c[f1] === b1 && o.c[f2] === b2).map(o => o.r)));
    if (s.A.n >= opt.min && s.B.n >= opt.min && s.A.avg > 0 && s.B.avg > 0) pairs.push({ k: keys[i] + " ET " + keys[j], s });
  }
  pairs.sort((a, b) => Math.min(b.s.A.avg, b.s.B.avg) - Math.min(a.s.A.avg, a.s.B.avg));
  /* cross-check: the 5 best single conditions of one year (n >= min), measured on the other year */
  const best = (p) => Object.keys(tab).filter(k => tab[k][p] && tab[k][p].n >= opt.min).sort((a, b) => tab[b][p].avg - tab[a][p].avg).slice(0, 5);
  const cross = {};
  for (const [p, q] of [["A", "B"], ["B", "A"]]) if (data[p] && data[q]) {
    const ks = best(p), pick = data[q].filter(o => o.side === side && ks.some(k => { const [f, b] = k.split(" = "); return o.c[f] === b; }));
    cross[p + "→" + q] = { conditions: ks.map(k => k + " (" + tab[k][p].avg + " R)"), there: stat(pick.map(o => o.r)), all: out.periods[q][side] };
  }
  out.sides[side] = { table: tab, singles: singles.map(k => ({ k, s: tab[k] })), pairs: pairs.slice(0, 40), nPairs: pairs.length, cross };
}
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(out));
const fmt = s => s && s.n ? s.n + " · " + (s.avg > 0 ? "+" : "") + s.avg.toFixed(2) : "—";
for (const side of ["L", "S"]) {
  const o = out.sides[side];
  console.log("\n=== " + (side === "L" ? "LONGS" : "SHORTS") + " · " + per.map(p => p + " " + fmt(out.periods[p][side])).join(" | "));
  console.log("conditions seules positives les deux années (n ≥ " + opt.min + ") :", o.singles.length);
  o.singles.slice(0, 25).forEach(x => console.log("  " + x.k.padEnd(48) + per.map(p => p + " " + fmt(x.s[p])).join(" | ")));
  console.log("paires positives les deux années :", o.nPairs);
  o.pairs.slice(0, 20).forEach(x => console.log("  " + x.k.padEnd(90) + per.map(p => p + " " + fmt(x.s[p])).join(" | ")));
  for (const c in o.cross) console.log("contrôle " + c + " : les 5 meilleures conditions de " + c[0] + " donnent " + fmt(o.cross[c].there) + " sur " + c.slice(-1) + " (tous : " + fmt(o.cross[c].all) + ")");
}
