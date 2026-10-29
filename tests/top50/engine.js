// Engine checks of Radar Top 50 on a simulated market (no network): replay records, rates of a setting, live statuses.
// Usage: node tests/top50/engine.js
const E = require("../../tools/top50/load.js")();
let fails = 0;
const check = (ok, what) => { console.log((ok ? "PASS " : "FAIL ") + what); if (!ok) fails++; };
let seed = 42; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
function walk(p, n) { const m = []; let t = Date.UTC(2024, 9, 1); for (let i = 0; i < n; i++) { const o = p; p *= Math.exp((rnd() - 0.5) * 0.006 + (Math.floor(i / 1500) % 2 ? -5e-5 : 6e-5));
  m.push({ t, o, h: Math.max(o, p) * (1 + rnd() * 0.002), l: Math.min(o, p) * (1 - rnd() * 0.002), c: p, q: 1e6, b: 5e5 }); t += 9e5; } return m; }
const btc = walk(60000, 96 * 160), alt = walk(3, 96 * 160), bdir = E.t5BtcDir(btc);
const rec = [];
[[0, "BTC", btc, null], [1, "ALT", alt, bdir]].forEach(([ci, s, m, b]) => { const S = E.t5ReplayStart(ci, s, m, [], b); while (!E.t5ReplayStep(S, 4000)) {} rec.push(...S.rec); });
check(rec.length >= 10, rec.length + " contacts rejoués");
check(rec.every(r => r.length === 14 && (r[2] === 1 || r[2] === -1) && r[3] >= 0 && r[3] < 4 && r[4] >= 0 && r[4] < 3 && r[8] >= -1 && r[8] <= 1), "chaque contact a ses 14 champs valides");
check(rec.every(r => [0, 1, 2, 3].every(g => (r[9] >> g & 1) ? r[10 + g] > 0 : true)), "un objectif atteint donne toujours un résultat positif");
const H = { coins: ["BTC", "ALT"], rank: [1, 2], years: { A: ["2024-10-01", "2025-01-15"], B: ["2025-01-15", "2025-06-01"] }, rec };
const all = E.t5Rate(H, { trend: "all", minRR: 0 }), trend = E.t5Rate(H, { trend: "with", minRR: 0 });
check(all.all.n === rec.length - rec.filter(r => r[1] * 36e5 >= Date.parse("2025-06-01")).length, "réglage le plus large : tous les contacts des deux périodes comptés (" + all.all.n + ")");
check(trend.all.n < all.all.n && trend.all.n === rec.filter(r => r[4] === 0 && r[1] * 36e5 < Date.parse("2025-06-01")).length, "« dans la tendance » garde exactement les contacts dans la tendance");
const k = E.t5Rate(H, { trend: "all", minRR: 0, kinds: { Ls: false } }), ls = rec.filter(r => r[2] === 1 && r[3] === 3 && r[1] * 36e5 < Date.parse("2025-06-01")).length;
check(k.all.n === all.all.n - ls, "décocher un type retire ses contacts");
const g10 = E.t5Rate(H, { trend: "all", minRR: 0, group: 1 });
check(g10.all.n === rec.filter(r => r[0] === 0 && r[1] * 36e5 < Date.parse("2025-06-01")).length, "le groupe de cryptos filtre par rang");
const r1 = E.t5Rate(H, { trend: "all", minRR: 0, target: 1 });
check(r1.all.win > all.all.win, "objectif 1R : plus de trades gagnants qu'au niveau 4H (" + Math.round(r1.all.win) + " % contre " + Math.round(all.all.win) + " %)");
const F = E.btFrames(alt, []); for (let i = 0; i < alt.length; i++) F.step(i);
const R = E.beConfigs("ALT", { d1: F.get("d1", 400), h4: F.get("h4", 200), h1: F.get("h1", 200), m15: F.m15(300) }, { minRR: 0.01 });
const live = E.t5Live(R, { trend: "with", minRR: 1.5, noBlock: true, target: 2 }, 1);
check(live.every(c => ["ready", "near", "sig", "off"].includes(c.st5) && (c.st5 === "off") === !!c.no), "chaque configuration en direct a un statut, et une raison quand elle sort des réglages");
check(live.every(c => Math.abs(Math.abs(c.plan5.tp1 - c.plan5.entry) / Math.abs(c.plan5.entry - c.plan5.sl) - 1.5) < 1e-9), "objectif 1,5R : le plan vise 1,5 fois le risque");
console.log(fails ? fails + " échec(s)" : "tous les tests passent"); process.exit(fails ? 1 : 0);
