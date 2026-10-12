// Print the engine's verdict (with texts) for a few symbols at a given bar, to proof-read the wording.
const fs = require("fs"), path = require("path"), L = require("./lib.js");
const E = new Function(fs.readFileSync(path.join(__dirname, "..", "engine.js"), "utf8") + ";return {analyze,enrich,judge,market,btFrames,snap,px}")();
const DIR = process.argv[2], back = +(process.argv[3] || 1), want = process.argv.slice(4);
const B = L.loadSymbol(DIR, "BTCUSDT");
function at(D, back) { const F = E.btFrames(D.m15, D.d1), n = D.m15.length - back; for (let i = 0; i < n; i++) F.step(i); return F; }
const FB = at(B, back), btc = E.market(FB.get("d1", 90), FB.get("h4", 200), FB.get("h1", 200));
for (const sym of want) {
  const D = L.loadSymbol(DIR, sym + "USDT"), F = at(D, back);
  const r = E.analyze(sym, F.get("d1", 400), F.get("h4", 200), F.get("h1", 200), { btc });
  if (r.plan) { E.enrich(r, F.m15(500), null, null, {}); }
  E.judge(r, { strict: 2 }); E.snap(r, 0.01);
  console.log("\n" + sym, "| dir", r.dir, "| st", r.st, "| score", r.score, "| pct", r.pct, r.plan ? "| entry " + r.plan.entry + " sl " + r.plan.sl + " tp1 " + r.plan.tp1 + " tp2 " + r.plan.tp2 + " rr " + r.plan.rr.toFixed(2) + " rrNet " + r.rrNet.toFixed(2) + " cost% " + r.costPct.toFixed(1) : "| " + r.why.map(w => w.t).join(" / "));
  (r.gates || []).forEach(g => { console.log("  [" + (g.st === "ok" ? "✓" : g.st === "mid" ? "~" : "✕") + "] " + g.label.padEnd(12) + g.head); g.items.forEach(i => console.log("        " + (i.k === "ok" ? "✓" : i.k === "mid" ? "~" : "✕") + " " + i.t)); });
}
