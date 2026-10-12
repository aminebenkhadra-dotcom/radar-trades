const fs = require("fs"), path = require("path"), L = require("./lib.js");
const E = new Function(fs.readFileSync(path.join(__dirname, "..", "engine.js"), "utf8") + ";return {analyze,enrich,judge,market,btFrames,snap,px}")();
const DIR = process.argv[2], OUT = process.argv[3], tag = process.argv[4], picks = process.argv.slice(5).map(Number);
let tr = []; for (let k = 0; k < 4; k++) { const f = OUT + "/" + tag + "-" + k + ".json"; if (fs.existsSync(f)) tr = tr.concat(JSON.parse(fs.readFileSync(f, "utf8")).trades); }
const B = L.loadSymbol(DIR, "BTCUSDT");
for (const k of picks) {
  const t = tr[k], D = L.loadSymbol(DIR, t.sym + "USDT"), i = D.m15.findIndex(x => x.t === t.t), F = E.btFrames(D.m15, D.d1), FB = E.btFrames(B.m15, B.d1), ib = B.m15.findIndex(x => x.t === t.t);
  for (let x = 0; x <= i; x++) F.step(x); for (let x = 0; x <= ib; x++) FB.step(x);
  const btc = E.market(FB.get("d1", 90), FB.get("h4", 200), FB.get("h1", 200));
  const r = E.analyze(t.sym, F.get("d1", 400), F.get("h4", 200), F.get("h1", 200), { btc });
  E.enrich(r, F.m15(500), null, null, {}); E.judge(r, { strict: 2 });
  console.log("\n" + t.sym, new Date(t.t).toISOString().slice(0, 16), "| dir", r.dir, "| st", r.st, "| score", r.score, "| pct", r.pct, "| entry " + E.px(r.plan.entry) + " sl " + E.px(r.plan.sl) + " tp1 " + E.px(r.plan.tp1) + " | result " + t.how + " " + t.r.toFixed(2) + "R");
  r.gates.forEach(g => { console.log("  [" + (g.st === "ok" ? "✓" : g.st === "mid" ? "~" : "✕") + "] " + g.label.padEnd(12) + g.head); g.items.forEach(i => console.log("        " + (i.k === "ok" ? "✓" : i.k === "mid" ? "~" : "✕") + " " + i.t)); });
}
