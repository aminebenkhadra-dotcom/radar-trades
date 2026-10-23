// Copies tools/engine.js and tools/core.js into the app page, between the ENGINE and CORE markers. The page stays a single file.
// node tools/inject.js          -> writes the page when it differs
// node tools/inject.js --check  -> writes nothing, exits with 1 when the page does not hold exactly these two files (used before every build)
const fs = require("fs"), path = require("path");
const page = path.join(__dirname, "..", "app", "src", "main", "assets", "index.html");
const parts = [["/*<ENGINE>*/", "/*</ENGINE>*/", "engine.js"], ["/*<CORE>*/", "/*</CORE>*/", "core.js"]];
const check = process.argv.includes("--check");
let html = fs.readFileSync(page, "utf8"), next = html, bad = [];
for (const [A, B, file] of parts) {
  const a = next.indexOf(A), b = next.indexOf(B);
  if (a < 0 || b < a || next.indexOf(A, a + 1) >= 0) { console.error(file + ": markers " + A + " " + B + " not found exactly once"); process.exit(1); }
  const src = fs.readFileSync(path.join(__dirname, file), "utf8").trim();
  if (next.slice(a + A.length, b).trim() !== src) bad.push(file);
  next = next.slice(0, a + A.length) + "\n" + src + "\n" + next.slice(b);
}
if (check) {
  if (bad.length) { console.error("Page out of sync with tools/" + bad.join(", tools/") + ": run node tools/inject.js"); process.exit(1); }
  console.log("page in sync with tools/engine.js and tools/core.js");
} else {
  if (next !== html) fs.writeFileSync(page, next);
  console.log(next !== html ? "injected: " + (bad.join(", ") || "layout") : "page already up to date");
}
