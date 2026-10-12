// Copies tools/engine.js into the app page, between the ENGINE markers. The page stays a single file.
const fs = require("fs"), path = require("path");
const page = path.join(__dirname, "..", "app", "src", "main", "assets", "index.html"), A = "/*<ENGINE>*/", B = "/*</ENGINE>*/";
let html = fs.readFileSync(page, "utf8"); const a = html.indexOf(A), b = html.indexOf(B);
if (a < 0 || b < a) { console.error("ENGINE markers not found"); process.exit(1); }
const eng = fs.readFileSync(path.join(__dirname, "engine.js"), "utf8").trim();
const next = html.slice(0, a + A.length) + "\n" + eng + "\n" + html.slice(b);
if (next !== html) fs.writeFileSync(page, next);
console.log(next !== html ? "engine injected" : "engine already up to date", "(" + eng.split("\n").length + " lines)");
