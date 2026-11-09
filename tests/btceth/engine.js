// Engine checks of Radar BTC·ETH on a simulated market (no network): every configuration has a coherent plan and status,
// sizes never risk more than the budget, and the replay runs. Usage: node tests/btceth/engine.js
const E = require("../../tools/btceth/load.js")();
let fails = 0, n = 0;
const check = (ok, what) => { console.log((ok ? "PASS " : "FAIL ") + what); if (!ok) fails++; };
let seed = 42; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const M15 = 9e5, m = []; let p = 60000, t = Date.UTC(2025, 0, 1);
for (let i = 0; i < 96 * 120; i++) { const o = p; p *= Math.exp((rnd() - 0.5) * 0.006 + (Math.floor(i / 1500) % 2 ? -5e-5 : 6e-5));
  const q = 1e6 * (1 + rnd()); m.push({ t, o, h: Math.max(o, p) * (1 + rnd() * 0.002), l: Math.min(o, p) * (1 - rnd() * 0.002), c: p, q, b: q * (0.4 + rnd() * 0.2) }); t += M15; }
const F = E.btFrames(m, []), A = { capital: 1000, risk: 2, lev: 10 }, X = { tick: 0.1, step: 0.001, minQty: 0.001, minNotional: 100 };
let bad = [], over = 0, statuses = {};
for (let i = 0; i < m.length; i++) { F.step(i); if (i < 96 * 60 || i % 16) continue;
  const R = E.beConfigs("BTC", { d1: F.get("d1", 400), h4: F.get("h4", 200), h1: F.get("h1", 200), m15: F.m15(300) });
  R.list.forEach(c => { n++; const q = c.plan; statuses[c.st] = (statuses[c.st] || 0) + 1;
    if (!((q.entry - q.sl) * c.dir > 0 && (q.tp1 - q.entry) * c.dir > 0 && q.tp2 * c.dir >= q.tp1 * c.dir && E.BE_NAMES[c.key])) bad.push(c.key);
    if (c.dir > 0 ? c.zone.lo > R.price : c.zone.hi < R.price) bad.push("side " + c.key);
    if (c.st === "ready" && !(c.at && c.trend === "with" && q.rrNet >= 1.5 && !q.block)) bad.push("ready " + c.key);
    const s = E.beSize(q, c.dir, A, X); if (s && s.loss > 20.0001) over++; }); }
check(n > 100, n + " configurations produites");
check(bad.length === 0, "plans cohérents, zones du bon côté, « Prêt » seulement dans les règles" + (bad.length ? " : " + bad.slice(0, 5).join(", ") : ""));
check(over === 0, "perte au stop jamais au-dessus de 2 % du capital");
check(Object.keys(statuses).length >= 3, "statuts rencontrés : " + JSON.stringify(statuses));
// the trader's plan (page options): wider stop, TP2 at 3R at least, no "Prêt" right after a big move; exits split 40/30/30
let planBad = [], splitBad = [], moveOk = true, nPlan = 0; const F2 = E.btFrames(m, []);
for (let i = 0; i < m.length; i++) { F2.step(i); if (i < 96 * 60 || i % 64) continue; const F = F2;
  const c = { d1: F.get("d1", 400), h4: F.get("h4", 200), h1: F.get("h1", 200), m15: F.m15(300) };
  const base = E.beConfigs("BTC", c), R = E.beConfigs("BTC", c, E.BE_PLAN), a15 = E.atr(c.m15), price = R.price;
  R.list.forEach(x => { nPlan++; const z = x.zone, pad = x.dir > 0 ? z.lo - x.plan.sl : x.plan.sl - z.hi;
    if (pad < 0.004 * price - 1e-6 || pad < a15 - 1e-6 || pad < 0.5 * R.a - 1e-6) planBad.push("stop " + x.key);
    if (x.st !== "refused" && x.plan.rr2 < 3) planBad.push("rr2 " + x.key);
    if (x.st === "ready" && E.beMove30(c.m15) > 3) moveOk = false;
    const s = E.beSize(x.plan, x.dir, { capital: 760, risk: 5, lev: 10 }, X), sp = E.beSplit(x.plan, s, X);
    if (s && sp && (Math.abs(sp.q1 + sp.q2 + sp.q3 - s.qty) > 1e-9 || sp.q1 > 0.4 * s.qty + 1e-9 || sp.q3 < 0)) splitBad.push(x.key); });
  base.list.forEach(x => { const z = x.zone, pad = x.dir > 0 ? z.lo - x.plan.sl : x.plan.sl - z.hi; if (Math.abs(pad - 0.5 * base.a) > 1e-6) planBad.push("défaut " + x.key); }); }
check(nPlan > 50 && planBad.length === 0, nPlan + " configurations du plan : stop au-delà de la zone d'au moins 0,4 %, 1 ATR 15 min et 0,5 ATR 4H ; TP2 ≥ 3R ; moteur par défaut inchangé" + (planBad.length ? " : " + planBad.slice(0, 5).join(", ") : ""));
check(splitBad.length === 0, "sorties 40 % / 30 % / runner : quantités au pas, somme égale à la taille");
const spike = m.slice(-300).map(k => ({ ...k })); const last = spike[spike.length - 1]; last.h = last.c * 1.05;
check(E.beMove30(spike) > 3 && moveOk, "pas de « Prêt » après un mouvement de plus de 3 % en 30 min");
const S = E.beReplayStart("BTC", m, [], {}); while (!E.beReplayStep(S, 4000)) {}
check(S.trades.length > 0 && S.trades.every(x => x.how === "tp" || x.how === "sl" || x.how === "time"), "rejeu : " + S.trades.length + " trades suivis jusqu'au TP1, au stop ou à 10 jours");
console.log(fails ? fails + " échec(s)" : "tous les tests passent"); process.exit(fails ? 1 : 0);
