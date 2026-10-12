// Exit management experiments inside calm conditions (training period).
const S = require("./study.js"), dir = process.argv[2], SET = process.argv[3] || "train";
const T = S.load(dir + "/out", dir + "/data"), C = T.C, st = S.L.stats;
const calm = (a, C) => C.relVol[a] < 0.7 && C.rng24[a] < 0.75;
/* generic manager: optional break-even move after `be` R, optional partial at tp1, final target tp2, time stop */
function manage(o) {
  return function (T, a) { return S.planLevels(T, a, o.k); };
}
function runM(o) {
  const out = [], cost = 0.0012;
  for (const [a0, a1] of T.ranges) {
    const p = T.PX[C.s[a0]]; let free = 0;
    for (let a = a0; a < a1; a++) {
      const i = C.i[a]; if (i < free) continue; if (SET !== "all" && T.train[a] !== (SET === "train" ? 1 : 0)) continue; if (!o.gate(a, C)) continue;
      const d = C.dir[a], e = T.price[a], pl = S.planLevels(T, a, o.k), R = Math.abs(e - pl.sl);
      const t1 = o.t1 ? o.t1 * R : Math.abs(pl.tp - e), t2 = (o.t2 || 0) * R, bePx = e * (1 + d * 0.0012);
      let sl = pl.sl, part = 0, r = 0, j, done = false, moved = false; const end = Math.min(p.n - 1, i + 960);
      for (j = i + 1; j <= end; j++) {
        const lo = p.l[j], hi = p.h[j];
        if (d > 0 ? lo <= sl : hi >= sl) { r += (1 - part) * d * (sl - e) / R; done = true; break; }
        if (o.part && !part && (d > 0 ? hi >= e + t1 : lo <= e - t1)) { part = o.part; r += part * t1 / R; if (o.beAt1) { sl = bePx; moved = true; } }
        const tgt = o.part ? t2 : t1;
        if (d > 0 ? hi >= e + tgt : lo <= e - tgt) { r += (1 - part) * tgt / R; done = true; break; }
        if (o.be && !moved && (d > 0 ? hi >= e + o.be * R : lo <= e - o.be * R)) { sl = bePx; moved = true; }
      }
      if (!done) { j = Math.min(j, p.n - 1); r += (1 - part) * d * (p.c[j] - e) / R; }
      out.push({ a, t: T.t[a], r: r - cost * e / R, bars: j - i }); free = j + 1 + 16;
    }
  }
  return out;
}
const row = (label, o) => S.show(label, runM(Object.assign({ gate: calm }, o)));
console.log("set:", SET);
row("TP1 at level (1R–3R)", {});
row("TP 1.5R", { t1: 1.5 }); row("TP 2R", { t1: 2 }); row("TP 3R", { t1: 3 });
row("level TP, BE after 1R", { be: 1 });
row("TP 2R, BE after 1R", { t1: 2, be: 1 }); row("TP 3R, BE after 1R", { t1: 3, be: 1 }); row("TP 3R, BE after 1.5R", { t1: 3, be: 1.5 });
row("half at level, BE, rest 3R", { part: 0.5, t2: 3, beAt1: true });
row("half at level, BE, rest 4R", { part: 0.5, t2: 4, beAt1: true });
row("half at 1.5R, BE, rest 3R", { part: 0.5, t1: 1.5, t2: 3, beAt1: true });
row("half at 1.5R, rest 3R no BE", { part: 0.5, t1: 1.5, t2: 3 });
row("half at 2R, BE, rest 4R", { part: 0.5, t1: 2, t2: 4, beAt1: true });
