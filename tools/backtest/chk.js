// Sanity checks of the test bench itself.
const S = require("./study.js"), dir = process.argv[2];
const T = S.load(dir + "/out", dir + "/data"), C = T.C;
const fut = h => (a, C) => { const p = T.PX[C.s[a]], i = C.i[a]; return i + h < p.n && (p.c[i + h] - p.c[i]) * C.dir[a] > 0; };
S.show("no gate, zero cost", S.run(T, { set: "all", cost: 0 }));
S.show("no gate, 0.12 % cost", S.run(T, { set: "all" }));
S.show("CHEAT: knows +24h direction", S.run(T, { set: "all", gate: fut(96) }));
S.show("CHEAT: knows +1h direction", S.run(T, { set: "all", gate: fut(4) }));
S.show("ANTI-CHEAT: wrong +24h", S.run(T, { set: "all", gate: (a, C) => !fut(96)(a, C) }));
/* random direction check: flip the direction of every setup (stop and target mirrored) */
const flip = (T, a) => { const p = S.planLevels(T, a), e = T.price[a]; return null; };
let tr = [], cost = 0.0012;
for (const [a0, a1] of T.ranges) { const p = T.PX[C.s[a0]]; let free = 0;
  for (let a = a0; a < a1; a++) { const i = C.i[a]; if (i < free) continue; const pl = S.planLevels(T, a), e = T.price[a], d = -C.dir[a], R = Math.abs(e - pl.sl), sl = e - d * R, tp = e + d * Math.abs(pl.tp - e);
    const res = S.resolve(p, i, d, e, sl, tp); tr.push({ t: T.t[a], r: res.r - cost * e / R, bars: res.j - i }); free = res.j + 17; } }
S.show("same setups, opposite side", tr);
/* spot check one row against raw candles */
const a = T.ranges[0][0] + 5000, p = T.PX[C.s[a]], i = C.i[a];
console.log("row", a, T.syms[C.s[a]], new Date(T.t[a]).toISOString(), "dir", C.dir[a], "price", T.price[a], "zone", C.zlo[a].toFixed(2), C.zhi[a].toFixed(2), "ATR4", C.a4[a].toFixed(2), "ATR4%", C.atrp[a].toFixed(2), "levels ahead", [C.ah0[a], C.ah1[a], C.ah2[a]].map(v => v.toFixed(1)).join(" "));
const pl = S.planLevels(T, a), res = S.resolve(p, i, C.dir[a], T.price[a], pl.sl, pl.tp);
console.log("plan sl", pl.sl.toFixed(2), "tp", pl.tp.toFixed(2), "→", ["stop", "target", "timeout"][res.how], "after", res.j - i, "bars; exit bar low/high", p.l[res.j], p.h[res.j]);
