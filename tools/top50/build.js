// Builds the Radar Top 50 page: top50/page.html + tools/engine.js + tools/btceth/configs.js + tools/top50/top.js + the replay records
// (tools/top50/results/replay-v1.json) -> top50/src/main/assets/index.html.
// node tools/top50/build.js [replay.json]   -> writes the page
// node tools/top50/build.js --check         -> writes nothing, exits with 1 when the bundled page is not exactly the build of these files
const fs = require("fs"), path = require("path"), root = path.join(__dirname, "..", "..");
const read = f => fs.readFileSync(path.isAbsolute(f) ? f : path.join(root, f), "utf8");
const arg = process.argv.slice(2).find(a => !a.startsWith("--"));
const hist = JSON.parse(read(arg || "tools/top50/results/replay-v1.json"));
const parts = [["/*<ENGINE>*/", "/*</ENGINE>*/", read("tools/engine.js").trim()], ["/*<CONFIGS>*/", "/*</CONFIGS>*/", read("tools/btceth/configs.js").trim()],
  ["/*<TOP>*/", "/*</TOP>*/", read("tools/top50/top.js").trim()], ["/*<HIST>*/", "/*</HIST>*/", "window.T5_HIST=" + JSON.stringify(hist) + ";"]];
let html = read("top50/page.html");
for (const [A, B, src] of parts) {
  const a = html.indexOf(A), b = html.indexOf(B);
  if (a < 0 || b < a) { console.error("markers " + A + " not found"); process.exit(1); }
  html = html.slice(0, a + A.length) + "\n" + src + "\n" + html.slice(b);
}
const out = path.join(root, "top50/src/main/assets/index.html");
if (process.argv.includes("--check")) {
  if (!fs.existsSync(out) || fs.readFileSync(out, "utf8") !== html) { console.error("top50 page out of date: run node tools/top50/build.js"); process.exit(1); }
  console.log("top50 page up to date");
} else { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html); console.log("written", out, html.length, "bytes"); }
