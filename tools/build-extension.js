// Builds the Chrome extension from the app page: the inline script becomes app.js (extensions forbid inline scripts), shim.js
// stands in for the Android side. Usage: node tools/build-extension.js <out dir>
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), OUT = process.argv[2] || path.join(ROOT, "extension-build");
let html = fs.readFileSync(path.join(ROOT, "app/src/main/assets/index.html"), "utf8");
const a = html.indexOf("<script>"), b = html.indexOf("</script>", a);
if (a < 0 || html.indexOf("<script>", a + 1) >= 0) throw new Error("expected exactly one inline script");
let js = html.slice(a + 8, b);
html = html.slice(0, a) + '<script src="shim.js"></script><script src="app.js"></script>' + html.slice(b + 9);
html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, "");
/* phone-only controls: battery exemption, Binance positions, balance sync */
html = swap(html, "</style>", "#a-bat,label:has(#a-tr),label:has(#f-acsync){display:none!important}\n</style>");
function swap(s, x, y) { if (s.indexOf(x) < 0) throw new Error("text not found: " + x.slice(0, 60)); return s.split(x).join(y); }
js = swap(js, "Cette fonction demande la dernière version de l\\'application : réinstalle l\\'APK.", "Portefeuille et positions Binance : dans l\\'appli Android seulement, où les clés API restent chiffrées dans le coffre du téléphone.");
js = swap(js, "Coche une liste pour lancer la surveillance. Android affichera une notification permanente tant qu'elle tourne.", "Coche une liste pour lancer la surveillance. Sur ordinateur, elle tourne tant que cet onglet reste ouvert : épingle-le.");
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(path.join(OUT, "icons"), { recursive: true });
fs.writeFileSync(path.join(OUT, "app.html"), html); fs.writeFileSync(path.join(OUT, "app.js"), js);
for (const f of ["manifest.json", "background.js", "shim.js"]) fs.copyFileSync(path.join(ROOT, "extension", f), path.join(OUT, f));
for (const f of fs.readdirSync(path.join(ROOT, "extension/icons"))) fs.copyFileSync(path.join(ROOT, "extension/icons", f), path.join(OUT, "icons", f));
console.log("extension built in", OUT);
