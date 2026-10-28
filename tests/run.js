// Acceptance tests of version 42, run before every build (a failure stops the build and nothing is published).
// Usage: node tests/run.js            -> tests tools/engine.js + tools/core.js
//        node tests/run.js --page     -> tests the copies inside app/src/main/assets/index.html instead
// No dependency: plain Node.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");

function load(fromPage) {
  let src;
  if (fromPage) {
    const html = fs.readFileSync(path.join(ROOT, "app/src/main/assets/index.html"), "utf8");
    const cut = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b); if (i < 0 || j < i) throw new Error("markers " + a + " missing"); return html.slice(i + a.length, j); };
    src = cut("/*<ENGINE>*/", "/*</ENGINE>*/") + "\n" + cut("/*<CORE>*/", "/*</CORE>*/");
  } else src = fs.readFileSync(path.join(ROOT, "tools/engine.js"), "utf8") + "\n" + fs.readFileSync(path.join(ROOT, "tools/core.js"), "utf8");
  const names = "analyze,enrich,judge,bookStats,btStart,btStep,btStats,btMarket,stepDec,onGrid,isOnGrid,contractOf,roundPlan,sizePlan,beWin,stopCover,openRiskOf,finalStatus,incomeNet,pagedRows,paperWalk,fillTrades,xlsxBytes,PREC,STATUS,CORE_VERSION";
  return new Function(src + ";return {" + names + "}")();
}

const E = load(process.argv.includes("--page"));
const tests = [];
let current = null;
/* tests run one after the other, async ones awaited, so every check lands in its own test */
function test(id, title, fn) { tests.push({ id, title, fn }); }
const atest = test;
function ok(cond, what) { current.checks.push((cond ? "ok   " : "FAIL ") + what); if (!cond) current.ok = false; }
const near = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-9);

/* a contract like most Binance perpetuals: step 0.01, minimum notional 5 USDT */
const X = (tick, step, extra) => Object.assign({ tick, minP: 0, maxP: 0, step: step || 0.01, minQ: step || 0.01, maxQ: 1e7, mstep: step || 0.01, mminQ: step || 0.01, mmaxQ: 1e6, minN: 5, pUp: 1.05, pDn: 0.95 }, extra || {});
const ACC = (o) => Object.assign({ capital: 1000, bmode: "pct", risk: 2, budget: 20, lev: 10, mtype: "isolated", marginPct: 25, fee: 0.05, slip: 0.02, mmr: 1, avail: null, usedMargin: 0, openRisk: 0, unbounded: [], unknown: [], totPct: 6, dayPnl: null, dayPct: 6 }, o || {});

/* ---------- 1. Sizing: the modelled loss never exceeds the budget ---------- */
test("T1", "Budget 20 USDT, entrée 100, stop 98, coût 0,12 %", () => {
  const z = E.sizePlan({ entry: 100, sl: 98 }, 1, ACC({ bmode: "usdt", budget: 20 }), X(0.01, 0.01), true);
  ok(z.ok, "taille calculée");
  ok(z.qty <= 20 / 2.12 + 1e-12, "quantité " + z.qty + " ≤ 20 / 2,12 = " + (20 / 2.12).toFixed(4));
  ok(near(z.qty, 9.43), "quantité arrondie au pas inférieur : 9,43");
  ok(z.loss <= 20 + 1e-9, "perte modélisée " + z.loss.toFixed(4) + " ≤ 20");
  ok(z.qty !== 10, "la quantité 10 (perte 21,20) a disparu");
  const s = E.sizePlan({ entry: 100, sl: 102 }, -1, ACC({ bmode: "usdt", budget: 20 }), X(0.01, 0.01), true);
  ok(s.loss <= 20 + 1e-9 && s.qty > 0, "short : perte modélisée " + s.loss.toFixed(4) + " ≤ 20, quantité " + s.qty);
});
test("T2", "Plafond de marge 25 % : la quantité est réduite", () => {
  const z = E.sizePlan({ entry: 100, sl: 99.5 }, 1, ACC({ lev: 10, marginPct: 25 }), X(0.01, 0.01), true);
  ok(z.by === "marge max", "taille limitée par la marge max (" + z.by + ")");
  ok(z.margin <= 250 + 1e-9, "marge " + z.margin.toFixed(2) + " ≤ 25 % de 1 000");
  ok(near(z.qty, 25), "quantité ramenée à 25 (au lieu de " + (20 / 0.62).toFixed(2) + ")");
  ok(z.ok, "le plan reste exploitable");
  const u = E.sizePlan({ entry: 100, sl: 99.5 }, 1, ACC({ lev: 10, marginPct: 25, usedMargin: 250 }), X(0.01, 0.01), true);
  ok(!u.ok && u.limit, "marge déjà toute engagée : entrée bloquée (" + u.why.join("; ") + ")");
});
test("T3", "Levier : la liquidation reste au-delà du stop", () => {
  const z = E.sizePlan({ entry: 100, sl: 92 }, 1, ACC({ lev: 10 }), X(0.01, 0.01), true);
  ok(z.levMax === 9 && z.lev === 9, "stop à 8 % : levier ramené de x10 à x" + z.lev);
  ok(z.warn.length === 1, "avertissement affiché");
  const c = E.sizePlan({ entry: 100, sl: 92 }, 1, ACC({ lev: 10, mtype: "cross" }), X(0.01, 0.01), true);
  ok(c.levMax === null && c.lev === 10, "marge croisée : levier inchangé, liquidation signalée comme dépendant du solde");
});
test("T4", "Plafonds du compte : risque total, perte du jour, position sans stop", () => {
  const a = E.sizePlan({ entry: 100, sl: 98 }, 1, ACC({ openRisk: 50 }), X(0.01, 0.01), true);
  ok(a.ok && near(a.budget, 10), "plafond 6 % = 60 $, 50 $ déjà engagés : budget ramené à 10 $ (" + a.budget + ")");
  const b = E.sizePlan({ entry: 100, sl: 98 }, 1, ACC({ dayPnl: -61 }), X(0.01, 0.01), true);
  ok(!b.ok && b.limit, "perte du jour de 61 $ pour une limite de 60 $ : entrée bloquée");
  const c = E.sizePlan({ entry: 100, sl: 98 }, 1, ACC({ unbounded: ["SOL long"] }), X(0.01, 0.01), true);
  ok(!c.ok && c.limit, "position sans stop ouverte : entrée bloquée");
  const d = E.sizePlan({ entry: 100, sl: 98 }, 1, ACC({ unknown: ["ETH long"] }), X(0.01, 0.01), true);
  ok(!d.ok && d.incomplete && !d.limit, "protection non lue : taille marquée incomplète");
  const e = E.sizePlan({ entry: 100, sl: 98 }, 1, ACC({ capital: 100, risk: 2 }), X(0.01, 1, { minQ: 1, mminQ: 1 }), true);
  ok(!e.ok && e.minSize, "budget 2 $ sur un contrat au pas de 1 : taille trop petite, plan refusé");
});

/* ---------- 2. Prices exactly on the contract grid ---------- */
test("T5", "Tick 0,25 · 0,05 · 2,5 en long et en short", () => {
  ok(E.onGrid(100.25, 0.25, "near") === 100.25, "100,25 reste 100,25 au tick 0,25");
  ok(E.onGrid(100.3, 0.25, "near") === 100.25, "100,30 devient 100,25");
  ok(E.stepDec(0.25) === 2 && E.stepDec(2.5) === 1 && E.stepDec(0.05) === 2 && E.stepDec(1e-7) === 7, "décimales lues sur le pas");
  for (const t of [0.25, 0.05, 2.5, 0.0001, 1e-7]) {
    for (const dir of [1, -1]) {
      const e = (t >= 1 ? 50000 : t < 0.001 ? 0.1 : 100) + 0.137 * t, R = 37.3 * t;
      const p = { entry: e, sl: e - dir * R, tp1: e + dir * 2.3 * R, tp2: e + dir * 4.1 * R };
      const rp = E.roundPlan(p, dir, X(t, 0.01));
      const q = rp.plan, on = ["entry", "sl", "tp1", "tp2"].every(k => E.isOnGrid(q[k], t));
      const ordered = dir > 0 ? q.sl < q.entry && q.entry < q.tp1 && q.tp1 <= q.tp2 : q.sl > q.entry && q.entry > q.tp1 && q.tp1 >= q.tp2;
      const away = (p.entry - p.sl) * dir <= (q.entry - q.sl) * dir + t / 2, toward = (q.tp1 - q.entry) * dir <= (p.tp1 - p.entry) * dir + t / 2;
      ok(rp.ok && on && ordered && away && toward, "tick " + t + " " + (dir > 0 ? "long " : "short") + " : " + ["entry", "sl", "tp1", "tp2"].map(k => q[k]).join(" / ") + " sur la grille, ordonnés");
    }
  }
  const bad = E.roundPlan({ entry: 100.4, sl: 100.1, tp1: 101.6, tp2: 102 }, 1, X(1, 0.01));
  ok(!bad.ok, "stop et entrée confondus après arrondi au tick 1 : plan invalide (" + bad.why.join("; ") + ")");
  const out = E.roundPlan({ entry: 100, sl: 95, tp1: 110, tp2: 120 }, 1, X(0.01, 0.01, { maxP: 105 }));
  ok(!out.ok, "objectif au-delà du prix maximum du contrat : plan invalide");
  const rr = E.roundPlan({ entry: 100.1, sl: 98.07, tp1: 104.96, tp2: 108 }, 1, X(0.25, 0.01));
  ok(near(rr.plan.rr, (rr.plan.tp1 - rr.plan.entry) / (rr.plan.entry - rr.plan.sl)), "ratio recalculé sur les niveaux arrondis");
});

/* ---------- 3. Protection of live positions ---------- */
test("T6", "Stop couvrant 10 % de la position", () => {
  const p = { full: "SOLUSDT", dir: 1, ps: "BOTH", qty: 10, mark: 150, entry: 148 };
  const c = E.stopCover(p, [{ symbol: "SOLUSDT", side: "SELL", positionSide: "BOTH", type: "STOP_MARKET", stopPrice: "140", origQty: "1", reduceOnly: true }]);
  ok(near(c.cover, 0.1), "couverture " + Math.round(c.cover * 100) + " %");
  ok(near(c.risk, -8), "perte au stop sur la partie couverte : " + c.risk);
  const f = E.stopCover(p, [{ symbol: "SOLUSDT", side: "SELL", positionSide: "BOTH", orderType: "STOP_MARKET", triggerPrice: "140", quantity: "0", closePosition: "true" }]);
  ok(near(f.cover, 1), "stop « fermer la position » : 100 %");
  const w = E.stopCover(p, [{ symbol: "SOLUSDT", side: "BUY", positionSide: "BOTH", type: "STOP_MARKET", stopPrice: "160", origQty: "10", reduceOnly: true }]);
  ok(w.cover === 0, "ordre dans le mauvais sens (achat sur un long) : ne protège pas");
  const h = E.stopCover({ full: "SOLUSDT", dir: 1, ps: "LONG", qty: 10, mark: 150, entry: 148 }, [{ symbol: "SOLUSDT", side: "SELL", positionSide: "SHORT", type: "STOP_MARKET", stopPrice: "140", origQty: "10" }]);
  ok(h.cover === 0, "mode couverture : un stop du côté SHORT ne protège pas le LONG");
  const n = E.stopCover(p, [{ symbol: "SOLUSDT", side: "SELL", positionSide: "BOTH", type: "STOP_MARKET", stopPrice: "140", origQty: "20", reduceOnly: false }]);
  ok(near(n.cover, 1) && n.nonRO, "stop non « reduce-only » plus gros que la position : couvre, mais signalé");
  const o = E.openRiskOf([{ name: "SOL long", cover: 0.1, risk: -8 }, { name: "ETH long", cover: null }, { name: "BTC long", cover: 1, risk: -12 }]);
  ok(o.unbounded.join() === "SOL long" && o.unknown.join() === "ETH long" && near(o.risk, 20), "risque ouvert : partiel = non borné, illisible = inconnu");
});

/* ---------- 4. Statuses ---------- */
function setup(o) {
  /* a long already in its zone, every required check passing, unless o says otherwise */
  const r = { v: 3, sym: "TEST", price: 100, bd: 1, b4: 1, r1: 40, r4: 50, h4: [], dir: 1, score: 0, st: "wait", why: [], f: {}, a: 2, dist: 0, distPct: 0,
    z: { lo: 99, hi: 100.5, kind: "sr", n: 2, flip: false }, keys: ["moyenne 50 (4H)"], div: false, r15: 40,
    trig: { sweep: 1, bos: 1, candle: 0, rsiT: 0, delta: 0, climax: 0, r15: 40, ext: 30 },
    plan: { entry: 100, sl: 98, tp1: 104, tp2: 108, rr: 2, rr2: 4, zlo: 99, zhi: 100.5, res: true, block: false },
    book: { bid: 60, range: 1, spread: 0.02, topBid: null, topAsk: null, block: null, guard: null },
    sq: { up: 10, dn: 10, wu: [], wd: [], d: {} } };
  r.f = { bd: 1, adx: 30, struct: 2, broken: 0, lt: 1, retr: 0.4, pbVol: 0.7, kN: 1, zkind: 0, zn: 2, flip: 0, conf: 0, r1: 40, r4: 50, div: 0, dl4: 0.55, rng24: 1, relVol: 1, btc4: 1, btcSh: 0.5, sqA: 10, sqF: 10 };
  return o ? o(r) || r : r;
}
test("T7", "Statuts de base", () => {
  ok(E.judge(setup()).st === "ready", "tous les contrôles passent : Prêt selon les règles");
  ok(E.judge(setup(r => { r.f.broken = 1; })).st === "refused", "tendance cassée : Refusé");
  ok(E.judge(setup(r => { r.dist = 1.2; r.distPct = 2; r.trig = null; })).st === "watch", "prix pas encore sur la zone : À surveiller");
  ok(E.STATUS.ready === "Prêt selon les règles" && E.STATUS.incomplete === "Données incomplètes", "libellés des quatre états");
  ok(E.judge(setup()).pct === undefined, "plus de pourcentage de préparation (95 %, 92 %…)");
});
test("T8", "Spread 1 % et obstacle critique avant TP", () => {
  const a = E.judge(setup(r => { r.book.spread = 1; r.plan.block = true; }));
  ok(a.st !== "ready" && a.st === "refused", "spread 1 % + obstacle : " + a.st + " (aucun Prêt)");
  const b = E.judge(setup(r => { r.book.spread = 0.3; }));
  ok(b.st === "watch", "spread 0,30 % : À surveiller (" + b.st + ")");
  const c = E.judge(setup(r => { r.plan.block = true; }));
  ok(c.st === "watch", "niveau 4H avant 1R : À surveiller (" + c.st + ")");
  const d = E.judge(setup(r => { r.book.block = { p: 101, n: 2e6 }; }));
  ok(d.st === "watch", "mur avant 1R : À surveiller (" + d.st + ")");
  const e = E.judge(setup(r => { r.book.block = { p: 103, n: 2e6 }; }));
  ok(e.st === "ready", "mur après 1R : affiché mais non bloquant (" + e.st + ")");
  const f = E.judge(setup(r => { r.book.spread = 0.12; }));
  ok(f.st === "ready", "spread 0,12 % sous le seuil de 0,15 % : pas de blocage arbitraire");
});
test("T9", "Données indispensables absentes", () => {
  const a = E.judge(setup(r => { r.f.btc4 = null; r.f.btcSh = null; }));
  ok(a.st === "incomplete", "contexte Bitcoin absent : Données incomplètes (" + a.st + ")");
  ok(a.gates.find(g => g.k === "mkt").ok === false, "contrôle Marché non validé par défaut");
  const pts = E.judge(setup(r => { r.f.btc4 = null; r.f.btcSh = null; })).score, ref = E.judge(setup()).score;
  ok(pts < ref, "aucun point accordé sans la donnée (score " + pts + " contre " + ref + ")");
  const b = E.judge(setup(r => { r.book = null; }));
  ok(b.st === "incomplete", "carnet non lu sur la zone : Données incomplètes (" + b.st + ")");
  const c = E.judge(setup(r => { r.trig = null; }));
  ok(c.st === "incomplete", "bougies 15 min non lues sur la zone : Données incomplètes (" + c.st + ")");
  const d = E.judge(setup(r => { r.sq = null; }));
  ok(d.st === "ready" && d.score < E.judge(setup()).score, "squeeze non mesuré : non bloquant, aucun point gratuit");
});
test("T10", "Statut final : plan arrondi, taille, contrat", () => {
  const r = E.judge(setup());
  ok(E.finalStatus(r, { ok: true, why: [] }, { ok: true, why: [] }, true).st === "ready", "tout est bon : Prêt");
  ok(E.finalStatus(r, { ok: false, why: ["stop confondu avec l'entrée"] }, null, true).st === "refused", "plan invalide après arrondi : Refusé");
  ok(E.finalStatus(r, { ok: true, why: [] }, null, false).st === "incomplete", "règles du contrat non lues : Données incomplètes");
  ok(E.finalStatus(r, { ok: true, why: [] }, { ok: false, limit: true, why: ["perte du jour atteinte"] }, true).st === "refused", "perte du jour atteinte : Refusé");
  ok(E.finalStatus(r, { ok: true, why: [] }, { ok: false, minSize: true, why: ["taille trop petite"] }, true).st === "refused", "taille sous le minimum du contrat : Refusé");
  ok(E.finalStatus(r, { ok: true, why: [] }, { ok: false, incomplete: true, why: ["protection non lue"] }, true).st === "incomplete", "protection d'une position non lue : Données incomplètes");
});

/* ---------- 5. Results ---------- */
test("T11", "PnL brut +1, frais −2 : net −1, pas un gagnant", () => {
  const m = E.incomeNet({ pnl: [{ symbol: "SOLUSDT", income: "1", asset: "USDT", time: 2000, tradeId: "7" }],
    fee: [{ symbol: "SOLUSDT", income: "-1", asset: "USDT", time: 1000, tradeId: "6" }, { symbol: "SOLUSDT", income: "-1", asset: "USDT", time: 2000, tradeId: "7" }], fund: [] });
  ok(m.n === 1 && near(m.exits[0].net, -1), "sortie nette −1 (" + m.exits[0].net + ")");
  ok(m.wins === 0, "aucun gagnant net compté");
  ok(near(m.net, -1) && near(m.gross, 1) && near(m.fees, -2), "totaux : brut +1, frais −2, net −1");
});
test("T12", "Frais en BNB convertis, conversion manquante signalée", () => {
  const rows = { pnl: [{ symbol: "ETHUSDT", income: "5", asset: "USDT", time: 5000, tradeId: "9" }], fee: [{ symbol: "ETHUSDT", income: "-0.002", asset: "BNB", time: 5000, tradeId: "9" }], fund: [] };
  const m = E.incomeNet(rows, (a) => a === "BNB" ? 600 : null);
  ok(near(m.exits[0].net, 3.8), "0,002 BNB à 600 $ = 1,20 $ de frais : net 3,80 (" + m.exits[0].net + ")");
  const n = E.incomeNet(rows, () => null);
  ok(n.missing.join() === "BNB" && /incomplet/.test(n.notes.join(" ")), "sans cours du BNB : résultat marqué incomplet");
  const o = E.incomeNet({ pnl: [{ symbol: "ETHUSDT", income: "5", asset: "USDT", time: 9e6, tradeId: "1" }, { symbol: "ETHUSDT", income: "3", asset: "USDT", time: 9e6 + 7e5, tradeId: "3" }],
    fee: [{ symbol: "ETHUSDT", income: "-1", asset: "USDT", time: 9e6 + 6e5, tradeId: "2" }], fund: [{ symbol: "ETHUSDT", income: "-0.5", asset: "USDT", time: 9e6 + 6.5e5 }] });
  ok(o.n === 2 && near(o.exits[1].net, 1.5), "frais d'ouverture et funding rattachés à la sortie suivante (" + o.exits.map(e => e.net).join(" / ") + ")");
});
atest("T13", "Historique paginé au-delà de 1 000 lignes", async () => {
  const all = []; for (let i = 0; i < 4321; i++) all.push({ tranId: i, time: 1e12 + i * 997 });
  let calls = 0;
  const get = (a, b) => { calls++; const r = all.filter(x => x.time >= a && x.time <= b).reverse(); return Promise.resolve(r.slice(0, 1000)); };
  const out = await E.pagedRows(get, 1e12, 1e12 + 4321 * 997, 0);
  const ids = new Set(out.rows.map(x => x.tranId));
  ok(ids.size === 4321 && !out.full, "4 321 lignes lues sur " + calls + " appels, sans doublon ni trou");
});
test("T14", "Suivi sans argent : milieu de bougie, gap, stop et TP dans la même bougie", () => {
  const t = { e: 100, sl: 98, tp: 104, dir: 1, t0: 600000 + 7 * 60000 };
  const before = [{ o: 100, h: 106, l: 97, c: 100, ot: 600000, ct: 600000 + 899999 }];
  ok(E.paperWalk(t, before, 1e12, 0.0012, 432e6) === null, "bougie ouverte avant l'entrée : ignorée (aucun prix antérieur)");
  const gap = [{ o: 100.5, h: 101, l: 100, c: 100.4, ot: 600000 + 8 * 60000, ct: 600000 + 9 * 60000 - 1 }, { o: 96.5, h: 97, l: 95, c: 96, ot: 1500000, ct: 2399999 }];
  const g = E.paperWalk(t, gap, 1e12, 0.0012, 432e6);
  ok(g && g.why === "gap" && g.px === 96.5, "gap sous le stop : sortie à l'ouverture 96,5 (" + (g && g.px) + ")");
  ok(g && near(g.r, (96.5 - 100) / 2 - 0.0012 * 100 / 2), "résultat " + (g && g.r.toFixed(3)) + " R, frais compris");
  const both = [{ o: 100, h: 104.5, l: 97.5, c: 101, ot: 1500000, ct: 2399999 }];
  const b = E.paperWalk(t, both, 1e12, 0.0012, 432e6);
  ok(b && b.why === "stop", "stop et TP dans la même bougie : le stop d'abord");
  const open = [{ o: 100, h: 103, l: 99, c: 101, ot: 1500000, ct: 2399999 }, { o: 101, h: 105, l: 100, c: 104, ot: 2400000, ct: 3299999 }];
  ok(E.paperWalk(t, open, 3000000, 0.0012, 432e6) === null, "bougie pas encore close : pas de sortie");
  ok(E.paperWalk(t, open, 4e6, 0.0012, 432e6).why === "tp1", "bougie close au-dessus du TP : sortie au TP");
});

/* ---------- 6. The engine still runs end to end on synthetic candles ---------- */
test("T15", "Moteur complet sur des bougies synthétiques", () => {
  let seed = 42; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const m = []; let p = 100, t = Date.UTC(2025, 0, 1);
  for (let i = 0; i < 96 * 60; i++) { const o = p; p = Math.max(1, p * (1 + (rnd() - 0.48) * 0.006)); const h = Math.max(o, p) * (1 + rnd() * 0.002), l = Math.min(o, p) * (1 - rnd() * 0.002), q = 1e5 * (1 + rnd()); m.push({ t, o, h, l, c: p, q, b: q * (0.4 + rnd() * 0.2) }); t += 9e5; }
  const S = E.btStart("TEST", m, [], { strict: 0 });
  let guard = 0; while (!E.btStep(S, 2000) && guard++ < 100) { }
  ok(S.done && S.evals > 0, "rejeu terminé : " + S.evals + " évaluations, " + S.trades.length + " trades");
  ok(S.trades.every(x => isFinite(x.r)), "résultats numériques");
});

/* ---------- 7. Excel export of the trade history ---------- */
const FL = (id, t, side, qty, price, rp, fee, extra) => Object.assign({ symbol: "SOLUSDT", id, orderId: id, time: t, side, qty: String(qty), price: String(price), quoteQty: String(qty * price), realizedPnl: String(rp), commission: String(fee), commissionAsset: "USDT", positionSide: "BOTH", maker: false }, extra || {});
test("T16", "Export : trades reconstruits à partir des exécutions", () => {
  const H = 36e5, t = Date.UTC(2026, 9, 5, 8);
  const fills = [
    FL(1, t, "BUY", 2, 100, 0, 0.1), FL(2, t + H, "BUY", 2, 104, 0, 0.1),           // long 4 @ 102 (renfort)
    FL(3, t + 2 * H, "SELL", 1, 110, 8, 0.05), FL(4, t + 3 * H, "SELL", 3, 106, 12, 0.15), // sortie partielle puis totale
    FL(5, t + 4 * H, "SELL", 1, 100, 0, 0.05), FL(6, t + 5 * H, "BUY", 3, 98, 2, 0.15), // short 1, puis achat de 3 : clôture et long 2
    FL(7, t - 9 * H, "SELL", 5, 50, -3, 0.2, { symbol: "ADAUSDT" }),                     // ADA : position ouverte avant la période lue
    FL(1, t, "BUY", 2, 100, 0, 0.1)];                                                    // doublon ignoré
  const fund = [{ symbol: "SOLUSDT", time: t + 1.5 * H, income: "-0.4", asset: "USDT" }];
  const R = E.fillTrades(fills, fund, null), T = R.trades;
  ok(T.length === 4, "4 trades (" + T.length + ")");
  const a = T.find(x => x.sym === "SOLUSDT" && x.dir > 0 && x.t1 === t + 3 * H);
  ok(a && near(a.qty, 4) && near(a.entry, 102) && near(a.exit, 107), "long : 4 à 102 en moyenne, sortie moyenne 107");
  ok(a && near(a.pnl, 20) && near(a.fee, -0.4) && near(a.fund, -0.4) && near(a.net, 19.2), "net = 20 − 0,40 frais − 0,40 funding = 19,20");
  ok(a && a.n === 4 && near(a.h, 3), "4 exécutions, 3 heures");
  const s = T.find(x => x.dir < 0 && x.sym === "SOLUSDT");
  ok(s && near(s.pnl, 2) && near(s.fee, -0.1) && s.t1 === t + 5 * H, "short clôturé par l'achat, frais au prorata (0,05 + 1/3 de 0,15)");
  const r = T.find(x => x.open);
  ok(r && r.dir > 0 && near(r.qty, 2) && near(r.entry, 98) && r.t1 === null && near(r.fee, -0.1), "reste de l'achat : long 2 en cours");
  const p = T.find(x => x.sym === "ADAUSDT");
  ok(p && p.partial && p.entry === null && p.dir > 0 && near(p.exit, 50) && near(p.net, -3.2), "ADA : entrée avant la période, sortie gardée");
  ok(T[T.length - 1].open, "positions en cours à la fin");
});
test("T17", "Export : fichier Excel valide (zip, CRC, onglets)", () => {
  const u = E.xlsxBytes([{ name: "Résumé", cols: [{ w: 20 }, { w: 10 }], rows: [[{ v: "Titre", s: "title" }], ["Net", { f: "SUM(Trades!B2:B3)", v: 3, s: "pnl" }]] },
    { name: "Trades", table: true, cols: [{ h: "Date", f: "date" }, { h: "Net", f: "pnl" }], rows: [[Date.UTC(2026, 0, 1), 1], [Date.UTC(2026, 0, 2), 2]] }]);
  const dv = new DataView(u.buffer), eo = u.length - 22;
  ok(dv.getUint32(0, true) === 0x04034b50 && dv.getUint32(eo, true) === 0x06054b50, "signatures zip");
  const n = dv.getUint16(eo + 10, true); ok(n === 7, "7 fichiers dans le zip (" + n + ")");
  let o = dv.getUint32(eo + 16, true), names = [], crcOk = true;
  for (let i = 0; i < n; i++) {
    const len = dv.getUint16(o + 28, true), at = dv.getUint32(o + 42, true), size = dv.getUint32(o + 20, true), crc = dv.getUint32(o + 16, true);
    names.push(Buffer.from(u.subarray(o + 46, o + 46 + len)).toString()); const nl = dv.getUint16(at + 26, true);
    const data = u.subarray(at + 30 + nl, at + 30 + nl + size); if (require("zlib").crc32 ? require("zlib").crc32(data) !== crc : false) crcOk = false; o += 46 + len;
  }
  ok(names.includes("xl/workbook.xml") && names.includes("xl/worksheets/sheet2.xml"), "classeur et onglets présents");
  ok(crcOk, "CRC des fichiers");
  const wb = Buffer.from(u).toString("latin1");
  ok(wb.includes("<f>SUM(Trades!B2:B3)</f><v>3</v>") && wb.includes('<autoFilter ref="A1:B3"/>'), "formule avec valeur, filtre sur le tableau");
});

/* ---------- report ---------- */
(async () => {
  let fail = 0;
  for (const t of tests) {
    current = { id: t.id, title: t.title, checks: [], ok: true };
    try { await t.fn(); } catch (e) { current.ok = false; current.checks.push("exception: " + (e && e.stack || e)); }
    console.log((current.ok ? "PASS " : "FAIL ") + current.id + " · " + current.title);
    for (const c of current.checks) console.log("     " + c);
    if (!current.ok) fail++;
  }
  console.log("\n" + (tests.length - fail) + "/" + tests.length + " tests réussis · " + (process.argv.includes("--page") ? "code de la page" : "tools/engine.js + tools/core.js") + " · version " + E.CORE_VERSION);
  process.exit(fail ? 1 : 0);
})();
