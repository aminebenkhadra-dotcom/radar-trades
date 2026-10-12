// Export thinned rows (one every 2 hours per symbol) with outcomes for an outside statistical check.
const fs = require("fs"), S = require("./study.js"), dir = process.argv[2];
const T = S.load(dir + "/out", dir + "/data"), C = T.C, n = T.n;
const b = fs.readFileSync(dir + "/out/outcome.bin"), arr = new Float32Array(b.buffer, b.byteOffset, n * 2), yb = arr.subarray(0, n), r0 = arr.subarray(n);
const skip = new Set(["s", "i", "price", "zlo", "zhi", "a4", "a1", "x60", "ext15", "ah0", "ah1", "ah2", "ah3", "ah4", "ah5", "plsl", "pltp"]);
const cols = T.cols.filter(c => !skip.has(c)), out = [["t", "sym", "train", "yb", "r0"].concat(cols).join(",")];
for (let x = 0; x < n; x++) { if (C.i[x] % 8) continue; out.push([T.t[x], C.s[x], T.train[x], yb[x].toFixed(4), r0[x].toFixed(4)].concat(cols.map(c => isNaN(C[c][x]) ? "" : +C[c][x].toPrecision(6))).join(",")); }
fs.writeFileSync(dir + "/out/thin.csv", out.join("\n"));
console.log("rows", out.length - 1, "features", cols.length);
