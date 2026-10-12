const S = require("./study.js"), dir = process.argv[2];
const T = S.load(dir + "/out", dir + "/data");
console.log("rows", T.n, "cols", T.cols.length, "train rows", T.train.reduce((a, b) => a + b, 0));
const v2 = (a, C) => C.s2[a] + 5 + 5 * (C.tRsi[a] || 0) >= 70 && C.rr[a] >= 1.5;
for (const set of ["train", "test"]) {
  console.log("== " + set);
  S.show("v2 'Prêt' (market entry)", S.run(T, { gate: v2, set }));
  S.show("every zone touch", S.run(T, { set }));
  S.show("  long", S.run(T, { set, gate: (a, C) => C.dir[a] > 0 }));
  S.show("  short", S.run(T, { set, gate: (a, C) => C.dir[a] < 0 }));
}
