// Sensitivity of the calm gate (training period), real trade simulation.
const S = require("./study.js"), dir = process.argv[2];
const T = S.load(dir + "/out", dir + "/data"), C = T.C, st = S.L.stats;
const cell = g => { const s = st(S.run(T, { gate: g })); return (String(s.n).padStart(5) + " " + (s.avg >= 0 ? "+" : "") + s.avg.toFixed(3) + " " + (s.tot >= 0 ? "+" : "") + s.tot.toFixed(0).padStart(4) + "R").padEnd(22); };
console.log("rows: relVol <, cols: rng24 <   (trades, avg R, total R)");
const RV = [0.6, 0.7, 0.85, 1.0, 1.3, 99], RG = [0.6, 0.75, 0.9, 1.1, 1.4, 99];
console.log("        " + RG.map(g => ("rng24<" + g).padEnd(22)).join(""));
for (const rv of RV) console.log(("rv<" + rv).padEnd(8) + RG.map(rg => cell((a, C) => C.relVol[a] < rv && C.rng24[a] < rg)).join(""));
console.log("\nwith Bitcoin volume below its average (bVol<1):");
for (const rv of [0.7, 0.85, 1.0, 99]) console.log(("rv<" + rv).padEnd(8) + RG.map(rg => cell((a, C) => C.relVol[a] < rv && C.rng24[a] < rg && C.bVol[a] < 1)).join(""));
console.log("\nBitcoin volume alone: " + [0.7, 0.85, 1, 1.2, 99].map(b => "bVol<" + b + ": " + cell((a, C) => C.bVol[a] < b)).join(" | "));
console.log("1H vs 4H vol alone:   " + [0.42, 0.45, 0.48, 0.52].map(b => "vr<" + b + ": " + cell((a, C) => C.a1p[a] / C.atrp[a] < b)).join(" | "));
