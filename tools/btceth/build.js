// Builds the Radar BTC·ETH page: btceth/page.html + tools/engine.js + tools/btceth/configs.js + the replay summary
// (tools/btceth/results/replay-v1.json, without the trade list) -> btceth/src/main/assets/index.html.
// node tools/btceth/build.js          -> writes the page
// node tools/btceth/build.js --check  -> writes nothing, exits with 1 when the bundled page is not exactly the build of these files
const fs = require("fs"), path = require("path"), root = path.join(__dirname, "..", "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const hist = JSON.parse(read("tools/btceth/results/replay-v1.json")); delete hist.trades;
const parts = [["/*<ENGINE>*/", "/*</ENGINE>*/", read("tools/engine.js").trim()], ["/*<CONFIGS>*/", "/*</CONFIGS>*/", read("tools/btceth/configs.js").trim()],
  ["/*<HIST>*/", "/*</HIST>*/", "window.BE_HIST=" + JSON.stringify(hist) + ";"]];
let html = read("btceth/page.html");
for (const [A, B, src] of parts) {
  const a = html.indexOf(A), b = html.indexOf(B);
  if (a < 0 || b < a) { console.error("markers " + A + " not found"); process.exit(1); }
  html = html.slice(0, a + A.length) + "\n" + src + "\n" + html.slice(b);
}
const out = path.join(root, "btceth/src/main/assets/index.html");
if (process.argv.includes("--check")) {
  if (!fs.existsSync(out) || fs.readFileSync(out, "utf8") !== html) { console.error("btceth page out of date: run node tools/btceth/build.js"); process.exit(1); }
  console.log("btceth page up to date");
} else { fs.writeFileSync(out, html); console.log("written", out, html.length, "bytes"); }
