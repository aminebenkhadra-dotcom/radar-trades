// Cost arithmetic: how much of each trade's risk goes to fees, and what a minimum stop distance changes (both periods).
const S = require("./study.js"), dir = process.argv[2];
const T = S.load(dir + "/out", dir + "/data"), C = T.C;
const stopPct = a => { const p = S.planLevels(T, a), e = T.price[a]; return Math.abs(e - p.sl) / e * 100; };
const v2 = (a, C) => C.s2[a] + 5 + 5 * (C.tRsi[a] || 0) >= 70 && C.rr[a] >= 1.5;
const f = s => String(s.n).padStart(5) + " win " + s.win.toFixed(1) + " % avg " + (s.avg >= 0 ? "+" : "") + s.avg.toFixed(3) + "R ±" + s.se.toFixed(3);
const g = (label, gate, extra) => { const a = S.L.stats(S.run(T, Object.assign({ gate, set: "train" }, extra || {}))), b = S.L.stats(S.run(T, Object.assign({ gate, set: "test" }, extra || {}))), c = S.L.stats(S.run(T, Object.assign({ gate, set: "all" }, extra || {}))); console.log(label.padEnd(40) + " TRAIN " + f(a) + "  TEST " + f(b) + "  ALL " + f(c)); };
g("v2 ready", v2);
for (const [lo, hi] of [[0, 1], [1, 1.5], [1.5, 2], [2, 3], [3, 5], [5, 99]]) g("  v2 ready, stop " + lo + "–" + hi + " %", a => v2(a, C) && stopPct(a) >= lo && stopPct(a) < hi);
g("v2 ready, stop ≥ 1.5 %", a => v2(a, C) && stopPct(a) >= 1.5);
g("v2 ready, stop ≥ 2 %", a => v2(a, C) && stopPct(a) >= 2);
g("v2 ready, stop ≥ 2.5 %", a => v2(a, C) && stopPct(a) >= 2.5);
console.log("-- same, before costs");
g("v2 ready (gross)", v2, { cost: 0 });
for (const [lo, hi] of [[0, 1.5], [1.5, 2.5], [2.5, 4], [4, 99]]) g("  gross, stop " + lo + "–" + hi + " %", a => v2(a, C) && stopPct(a) >= lo && stopPct(a) < hi, { cost: 0 });
console.log("-- maker entry (limit order: 0.02 % instead of 0.05 %, no entry slippage): cost 0.08 % round trip");
g("v2 ready, cost 0.08 %", v2, { cost: 0.0008 });
g("v2 ready, stop ≥ 2 %, cost 0.08 %", a => v2(a, C) && stopPct(a) >= 2, { cost: 0.0008 });
