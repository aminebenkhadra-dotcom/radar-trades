// Before / after: the acceptance cases of the version 42 review, run on the version 41 code and on the version 42 code.
// Usage: node tests/compare.js <version 41 index.html> [<version 42 index.html>]
// The version 41 page can be taken from the V41 APK (assets/index.html) or from git (tag v45). Its functions are read out of the
// page itself, so what runs is exactly the shipped code. The engine of version 41 is tools/backtest/engine_v41.js (same code).
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const P41 = fs.readFileSync(process.argv[2], "utf8"), P42 = fs.readFileSync(process.argv[3] || path.join(ROOT, "app/src/main/assets/index.html"), "utf8");

/* the text of one function of a page, braces matched outside strings */
function extract(src, name) {
  const i = src.indexOf("function " + name + "("); if (i < 0) throw new Error(name + " not found");
  let j = src.indexOf("{", i), depth = 0, q = null;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === "\\") { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === "{") depth++; else if (c === "}") { depth--; if (!depth) return src.slice(i, j + 1); }
  }
  throw new Error(name + " unbalanced");
}
const block = (src, a, b) => src.slice(src.indexOf(a) + a.length, src.indexOf(b));
const ENG41 = block(P41, "/*<ENGINE>*/", "/*</ENGINE>*/"), ENG42 = block(P42, "/*<ENGINE>*/", "/*</ENGINE>*/") + block(P42, "/*<CORE>*/", "/*</CORE>*/");
function v41(names, extra, S) {
  const src = ENG41 + "\n" + names.map(n => extract(P41, n)).join("\n") + "\n" + (extra || "");
  return new Function("S", "STABLE", src + ";return {" + names.concat(["judge", "snap"]).join(",") + "}")(S || {}, { USDT: 1, USDC: 1 });
}
const N = new Function(ENG42 + ";return {judge,roundPlan,sizePlan,stopCover,incomeNet,pagedRows,paperWalk,onGrid,isOnGrid}")();
const rows = [];
function row(c, before, after, okBefore, okAfter) { rows.push({ c, before, after, okBefore, okAfter }); }
const fx = v => String(+v.toFixed(4)).replace(".", ",");

/* 1. budget 20 USDT, entry 100, stop 98 */
{
  const A = v41(["sizing", "decOf"], "", { account: 1000, risk: 2, lev: 10, margin: 25, fee: 0.05 });
  const z = A.sizing({ plan: { entry: 100, sl: 98 }, step: 0.01 }), loss41 = z.qty * 2 + z.qty * 100 * 0.0012;
  const n = N.sizePlan({ entry: 100, sl: 98 }, 1, { capital: 1000, bmode: "usdt", budget: 20, lev: 10, mtype: "isolated", marginPct: 25, fee: 0.05, slip: 0.02, totPct: 0, dayPct: 0 }, { tick: 0.01, step: 0.01, minQ: 0.01, mstep: 0.01, mminQ: 0.01, minN: 5 }, true);
  row("Budget 20 USDT, entrée 100, stop 98, coût 0,12 %", "quantité " + fx(z.qty) + ", perte modélisée " + fx(loss41) + " $", "quantité " + fx(n.qty) + ", perte modélisée " + fx(n.loss) + " $", loss41 <= 20, n.loss <= 20);
}
/* 2. margin cap 25 % */
{
  const A = v41(["sizing", "decOf"], "", { account: 1000, risk: 2, lev: 10, margin: 25, fee: 0.05 });
  const z = A.sizing({ plan: { entry: 100, sl: 99.5 }, step: 0.01 });
  const n = N.sizePlan({ entry: 100, sl: 99.5 }, 1, { capital: 1000, bmode: "pct", risk: 2, lev: 10, mtype: "isolated", marginPct: 25, fee: 0.05, slip: 0.02, totPct: 0, dayPct: 0 }, { tick: 0.01, step: 0.01, minQ: 0.01, mstep: 0.01, mminQ: 0.01, minN: 5 }, true);
  row("Plafond de marge 25 % (stop à 0,5 %)", "marge " + fx(z.m) + " % : avertissement seul, quantité " + fx(z.qty), "marge " + fx(n.margin / 10) + " %, quantité réduite à " + fx(n.qty), z.m <= 25, n.margin <= 250 + 1e-9);
}
/* 3. tick 0.25, 0.05, 2.5 */
{
  const A = v41([], "");
  const cases = [[0.25, 100.25], [0.05, 100.05], [2.5, 102.5]];
  const b = cases.map(([t, v]) => { const r = { plan: { entry: v, sl: v - 10 * t, tp1: v + 20 * t, tp2: v + 40 * t } }; A.snap(r, t); return r.plan.entry; });
  const a = cases.map(([t, v]) => N.roundPlan({ entry: v, sl: v - 10 * t, tp1: v + 20 * t, tp2: v + 40 * t }, 1, { tick: t }).plan.entry);
  row("Niveaux 100,25 / 100,05 / 102,5 aux ticks 0,25 / 0,05 / 2,5", b.map(fx).join(" / "), a.map(fx).join(" / "), b.every((v, i) => N.isOnGrid(v, cases[i][0]) && v === cases[i][1]), a.every((v, i) => N.isOnGrid(v, cases[i][0]) && v === cases[i][1]));
}
/* 4. a stop covering 10 % of the position */
{
  const A = v41(["liveExits"], "");
  const p = { full: "SOLUSDT", dir: 1, ps: "BOTH", qty: 10, mark: 150, entry: 148 }, ord = [{ symbol: "SOLUSDT", side: "SELL", positionSide: "BOTH", type: "STOP_MARKET", stopPrice: "140", origQty: "1", reduceOnly: true }];
  const x = A.liveExits(p, ord), shown41 = (x.sl[0].px - p.entry) * p.qty, c = N.stopCover(p, ord);
  row("Stop sur 10 % d'une position de 10 SOL", "stop affiché à 140, « au stop " + fx(shown41) + " $ » sur toute la position, couverture non montrée", "couverture " + Math.round(c.cover * 100) + " %, 90 % sans stop signalés", false, Math.abs(c.cover - 0.1) < 1e-9);
}
/* 5. orders unreadable */
{
  const f41 = extract(P41, "liveFetch"), keeps = /if\(Array\.isArray\(r\[0\]\)&&Array\.isArray\(r\[1\]\)\)LV\.ord\[s\]=/.test(f41) && /p\.ordOk=!!o/.test(f41);
  const f42 = extract(P42, "liveFetch"), marks = /fail:Date\.now\(\)/.test(f42) && /p\.ordOk=ok/.test(f42);
  row("Lecture des ordres en échec", keeps ? "l'ancienne liste reste et la position paraît protégée" : "?", marks ? "« Protection inconnue », l'ancien stop n'est plus affiché" : "?", !keeps, marks);
}
/* 6. spread 1 % and a critical obstacle; 7. missing Bitcoin context */
function setup(o) {
  const r = { v: 3, sym: "TEST", price: 100, bd: 1, b4: 1, r1: 40, r4: 50, h4: [], dir: 1, score: 0, st: "wait", why: [], f: {}, a: 2, dist: 0, distPct: 0,
    z: { lo: 99, hi: 100.5, kind: "sr", n: 2, flip: false }, keys: ["moyenne 50 (4H)"], div: false, r15: 40, trig: { sweep: 1, bos: 1, candle: 0, rsiT: 0, delta: 0, climax: 0, r15: 40, ext: 30 },
    plan: { entry: 100, sl: 98, tp1: 104, tp2: 108, rr: 2, rr2: 4, zlo: 99, zhi: 100.5, res: true, block: false }, book: { bid: 60, range: 1, spread: 0.02, topBid: null, topAsk: null, block: null, guard: null }, sq: { up: 10, dn: 10, wu: [], wd: [], d: {} } };
  r.f = { bd: 1, adx: 30, struct: 2, broken: 0, lt: 1, retr: 0.4, pbVol: 0.7, kN: 1, zkind: 0, zn: 2, flip: 0, conf: 0, r1: 40, r4: 50, div: 0, dl4: 0.55, rng24: 1, relVol: 1, btc4: 1, btcSh: 0.5, sqA: 10, sqF: 10 };
  if (o) o(r); return r;
}
{
  const A = v41([], "");
  const a = A.judge(setup(r => { r.book.spread = 1; r.plan.block = true; })), b = N.judge(setup(r => { r.book.spread = 1; r.plan.block = true; }));
  row("Spread 1 % et obstacle avant 1R", "statut « " + a.st + " » (" + a.pct + " %), alerte possible", "statut « " + b.st + " », aucune alerte d'entrée", a.st !== "ready", b.st !== "ready");
  const c = A.judge(setup(r => { r.f.btc4 = null; r.f.btcSh = null; })), d = N.judge(setup(r => { r.f.btc4 = null; r.f.btcSh = null; }));
  const mk = g => g.gates.find(x => x.k === "mkt");
  row("Contexte Bitcoin non lu", "statut « " + c.st + " », Marché validé (" + (mk(c).ok ? "oui" : "non") + ")", "statut « " + d.st + " », Marché validé (" + (mk(d).ok ? "oui" : "non") + "), aucun point", c.st === "incomplete", d.st === "incomplete");
}
/* 8. PnL +1, fees −2 */
{
  const A = v41(["incomeStats", "resModel"], "");
  const pnl = [{ symbol: "SOLUSDT", income: "1", asset: "USDT", time: 2000, tradeId: "7" }], fee = [{ symbol: "SOLUSDT", income: "-1", asset: "USDT", time: 1000, tradeId: "6" }, { symbol: "SOLUSDT", income: "-1", asset: "USDT", time: 2000, tradeId: "7" }];
  const a = A.incomeStats(pnl, fee, []), b = N.incomeNet({ pnl, fee, fund: [] });
  row("Sortie brute +1, frais −2", a.wins + " gagnant sur " + a.n + ", net total " + fx(a.net), b.wins + " gagnant sur " + b.n + ", net " + fx(b.exits[0].net), a.wins === 0, b.wins === 0);
}
/* 9. fees paid in BNB */
{
  const A = v41(["incomeStats", "resModel"], "");
  const pnl = [{ symbol: "ETHUSDT", income: "5", asset: "USDT", time: 5000, tradeId: "9" }], fee = [{ symbol: "ETHUSDT", income: "-0.002", asset: "BNB", time: 5000, tradeId: "9" }];
  const a = A.incomeStats(pnl, fee, []), b = N.incomeNet({ pnl, fee, fund: [] }, x => x === "BNB" ? 600 : null);
  row("Frais de 0,002 BNB (600 $)", "frais comptés " + fx(a.parts.fees) + " $ (ignorés)", "frais comptés " + fx(b.fees) + " $", Math.abs(a.parts.fees + 1.2) < 1e-9, Math.abs(b.fees + 1.2) < 1e-9);
}
/* 10. paging */
(async () => {
  const all = []; for (let i = 0; i < 4321; i++) all.push({ tranId: i, time: 1e12 + i * 997 });
  const got = await N.pagedRows((a, b) => Promise.resolve(all.filter(x => x.time >= a && x.time <= b).slice(0, 1000)), 1e12, 1e12 + 4321 * 997, 0);
  row("Historique de 4 321 lignes (limite 1 000 par appel)", "1 000 lignes lues (un seul appel)", got.rows.length + " lignes lues", false, got.rows.length === 4321);
  /* 11. paper tracking: a gap through the stop, and a candle opened before the entry */
  const t0 = 600000 + 7 * 60000, k15 = [[600000, 100, 106, 97, 100, 0, 600000 + 899999], [1500000, 96.5, 97, 95, 96, 0, 2399999]];
  const A = v41(["paperResolve"], "");
  const pr = extract(P41, "paperResolve"), gapAtStop = /ex=t\.sl;why="stop"/.test(pr);
  const w = N.paperWalk({ e: 100, sl: 98, tp: 104, dir: 1, t0 }, k15.map(k => ({ ot: k[0], o: k[1], h: k[2], l: k[3], c: k[4], ct: k[6] })), 1e12, 0.0012, 432e6);
  row("Suivi sans argent : gap sous le stop, bougie commencée avant l'entrée", gapAtStop ? "sortie au stop 98 même quand le prix ouvre à 96,5 ; bougie de l'entrée lue en entier" : "?", "sortie à l'ouverture " + fx(w.px) + " (gap) ; prix d'avant l'entrée ignorés", !gapAtStop, w.why === "gap" && w.px === 96.5);
  console.log("| Cas | Version 41 | Version 42 | Conforme V41 | Conforme V42 |\n|---|---|---|---|---|");
  rows.forEach(r => console.log("| " + r.c + " | " + r.before + " | " + r.after + " | " + (r.okBefore ? "oui" : "non") + " | " + (r.okAfter ? "oui" : "non") + " |"));
  console.log("\n" + rows.filter(r => r.okAfter).length + "/" + rows.length + " conformes en version 42 · " + rows.filter(r => r.okBefore).length + "/" + rows.length + " en version 41");
  process.exit(rows.every(r => r.okAfter) ? 0 : 1);
})();
