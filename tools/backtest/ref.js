// Reference run of the shipped engine: the same history test the app runs, on every symbol of the data set.
// Usage: node ref.js <datadir> <outdir> <strict 0|1|2> [part k/n] [extra JSON options]
const fs = require("fs"), path = require("path"), L = require("./lib.js");
const SRC = fs.readFileSync(path.join(__dirname, "..", "engine.js"), "utf8");
const E = new Function(SRC + ";return {btStart,btStep,btStats,btMarket,analyze,enrich,judge}")();
const DIR = process.argv[2], OUT = process.argv[3], STRICT = +(process.argv[4] || 1), PART = (process.argv[5] || "0/1").split("/").map(Number), EXTRA = process.argv[6] ? JSON.parse(process.argv[6]) : {};
const SKIP = { PAXGUSDT: 1 }, { syms } = L.listSymbols(DIR), t0 = Date.now();
const B = L.loadSymbol(DIR, "BTCUSDT"), btc = E.btMarket(B.m15, B.d1);
let trades = [], evals = 0;
syms.filter(s => !SKIP[s]).forEach((sym, idx) => {
  if (idx % PART[1] !== PART[0]) return;
  const D = L.loadSymbol(DIR, sym), S = E.btStart(sym.replace(/USDT$/, ""), D.m15, D.d1, Object.assign({ strict: STRICT, btc }, EXTRA));
  while (!E.btStep(S, 5000)) { }
  evals += S.evals; S.trades.forEach(t => trades.push(Object.assign({ sym: S.sym }, t)));
});
const tag = "ref-" + STRICT + (process.argv[6] ? "x" : "");
fs.writeFileSync(path.join(OUT, tag + "-" + PART[0] + ".json"), JSON.stringify({ trades, evals }));
console.log(tag, "part", PART.join("/"), "evals", evals, "trades", trades.length, Math.round((Date.now() - t0) / 1000) + "s");
