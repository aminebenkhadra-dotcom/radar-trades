// Pre-specified configurations, run once on the held-out period (June–October 2026) and on the training period for reference.
const S = require("./study.js"), dir = process.argv[2];
const T = S.load(dir + "/out", dir + "/data"), C = T.C;
const months = tr => { const m = {}; tr.forEach(t => { const k = new Date(t.t).toISOString().slice(2, 7); (m[k] = m[k] || []).push(t); }); return Object.keys(m).sort().map(k => k + ":" + (S.L.stats(m[k]).avg >= 0 ? "+" : "") + S.L.stats(m[k]).avg.toFixed(2) + "(" + m[k].length + ")").join(" "); };
const calm = (a, C) => C.relVol[a] < 0.7 && C.rng24[a] < 0.75, strict = (a, C) => C.relVol[a] < 0.6 && C.rng24[a] < 0.6;
const v2 = (a, C) => C.s2[a] + 5 + 5 * (C.tRsi[a] || 0) >= 70 && C.rr[a] >= 1.5;
const fixed = rr => (T, a) => { const p = S.planLevels(T, a), e = T.price[a], d = C.dir[a]; return { sl: p.sl, tp: e + d * rr * Math.abs(e - p.sl) }; };
const cfg = [
  ["T0 all zone touches", null, {}], ["T1 v2 'Prêt'", v2, {}],
  ["T2 calm", calm, {}], ["T3 calm strict", strict, {}],
  ["T4 calm + 15m break", (a, C) => calm(a, C) && C.tBos[a] === 1, {}],
  ["T5 calm + BTC not extended", (a, C) => calm(a, C) && C.btcR4[a] < 59, {}],
  ["T6 calm, target 3R", calm, { plan: fixed(3) }],
  ["T8 calm, stop +1 ATR4", calm, { plan: (T, a) => S.planLevels(T, a, 1) }],
  ["T9 NOT calm", (a, C) => C.relVol[a] > 1 && C.rng24[a] > 1.1, {}],
];
for (const set of ["train", "test"]) {
  console.log("=== " + set);
  for (const [label, gate, extra] of cfg) { const tr = S.run(T, Object.assign({ gate, set }, extra)); S.show(label, tr); console.log("      " + months(tr)); }
}
