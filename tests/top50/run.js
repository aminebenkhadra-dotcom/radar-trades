// Page tests of Radar Top 50: the bundled page in Chromium, Binance answered by a simulated market of 55 contracts (no network, no phone).
// With a data dir (branch top50-data), the coins of that dir use their real history, cut at --at when given.
// Usage: NODE_PATH=<folder holding playwright> node tests/top50/run.js [data dir] [--at <ISO date>] [--shots <dir>]
"use strict";
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const args = process.argv.slice(2), opt = n => args.includes(n) ? args[args.indexOf(n) + 1] : null;
const DATA = args[0] && !args[0].startsWith("--") ? args[0] : null, SHOTS = opt("--shots"), AT = opt("--at");
const HTML = fs.readFileSync(path.join(__dirname, "../../top50/src/main/assets/index.html"), "utf8");
const EXE = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const M15 = 9e5;

/* market: real history for the coins of the data dir, a random walk for the others; plus a stablecoin and a stock that must be left out */
const MK = {};
let real = [];
if (DATA) { real = JSON.parse(fs.readFileSync(path.join(DATA, "index.json"), "utf8")).universe.top;
  for (const s of real) { let m = zlib.gunzipSync(fs.readFileSync(path.join(DATA, s + ".m15.csv.gz"))).toString().split("\n").filter(Boolean)
      .map(l => l.split(",")).map(r => ({ t: +r[0] * M15, o: +r[1], h: +r[2], l: +r[3], c: +r[4], q: +r[5], b: +r[6] }));
    if (AT) m = m.filter(k => k.t <= Date.parse(AT)); if (m.length > 96 * 420) m = m.slice(-96 * 420); MK[s.replace(/USDT$/, "")] = m; } }
let seed = 5; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const END = DATA && AT ? Date.parse(AT) : Date.now();
for (let i = 0; Object.keys(MK).length < 55; i++) {
  const sym = ["BTC", "ETH", "SOL"][i] || "C" + String.fromCharCode(65 + (i % 26)) + String.fromCharCode(65 + Math.floor(i / 26));
  if (MK[sym]) continue;
  let p = 10 + rnd() * 100, t = Math.floor(END / M15) * M15 - 96 * 420 * M15; const m = [], dr = (rnd() - 0.5) * 1e-4;
  for (let j = 0; j < 96 * 420; j++) { const o = p; p *= Math.exp((rnd() - 0.5) * 0.007 + (Math.floor(j / 1200) % 2 ? dr : -dr * 0.8)); m.push({ t, o, h: Math.max(o, p) * (1 + rnd() * 0.002), l: Math.min(o, p) * (1 - rnd() * 0.002), c: p, q: 1e5, b: 5e4 }); t += M15; }
  MK[sym] = m;
}
const syms = Object.keys(MK);
const VOL = Object.fromEntries(syms.map((s, i) => [s, real.includes(s + "USDT") ? 1e12 - real.indexOf(s + "USDT") : 1e9 - i]));
const IV = { "15m": M15, "1h": 36e5, "4h": 144e5, "1d": 864e5 }, cache = {};
function klines(sym, iv, limit) {
  const key = sym + iv; if (!cache[key]) { const ms = IV[iv], g = new Map();
    for (const k of MK[sym]) { const kk = Math.floor(k.t / ms) * ms; let c = g.get(kk);
      if (!c) g.set(kk, { t: kk, o: k.o, h: k.h, l: k.l, c: k.c, q: k.q, b: k.b }); else { c.h = Math.max(c.h, k.h); c.l = Math.min(c.l, k.l); c.c = k.c; c.q += k.q; c.b += k.b; } }
    cache[key] = [...g.values()]; }
  return cache[key].slice(-limit).map(c => [c.t, String(c.o), String(c.h), String(c.l), String(c.c), "0", c.t + IV[iv] - 1, String(c.q), 0, "0", String(c.b), "0"]);
}
const tick = s => { const p = MK[s][MK[s].length - 1].c, d = Math.max(0, Math.min(7, 4 - Math.floor(Math.log10(p)))); return (1 / 10 ** d).toFixed(d); };
const INFO = { symbols: syms.map(s => ({ symbol: s + "USDT", baseAsset: s, quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING", underlyingType: "COIN",
  filters: [{ filterType: "PRICE_FILTER", tickSize: tick(s) }, { filterType: "LOT_SIZE", stepSize: "0.001", minQty: "0.001" }, { filterType: "MIN_NOTIONAL", notional: "5" }] }))
  .concat([{ symbol: "USDCUSDT", baseAsset: "USDC", quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING", underlyingType: "COIN", filters: [] },
    { symbol: "TSLAUSDT", baseAsset: "TSLA", quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING", underlyingType: "EQUITY", filters: [] }]) };
const TICKER = syms.map(s => ({ symbol: s + "USDT", quoteVolume: String(VOL[s]), priceChangePercent: "1.5" }))
  .concat([{ symbol: "USDCUSDT", quoteVolume: "9e15", priceChangePercent: "0" }, { symbol: "TSLAUSDT", quoteVolume: "8e15", priceChangePercent: "0" }]);

let fails = 0;
const check = (ok, what) => { console.log((ok ? "PASS " : "FAIL ") + what); if (!ok) fails++; };

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  async function open(query, fail) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage(), errors = [], calls = { notify: [], start: 0, done: [], kl: 0 };
    page.on("pageerror", e => errors.push(e.message));
    await page.exposeFunction("__bridge", (k, a) => { if (k === "notify") calls.notify.push(a); else if (k === "done") calls.done.push(a); else calls[k]++; });
    await page.addInitScript(() => { let on = false;
      window.Android = { notify: (t, x, g) => window.__bridge("notify", [t, x, g]), done: s => window.__bridge("done", s), startWatch: () => { on = true; window.__bridge("start") },
        stopWatch: () => { on = false }, watching: () => on, lastCheck: () => "", test: () => {} }; });
    await page.route("https://radar.local/**", async route => {
      const u = new URL(route.request().url()), q = u.searchParams, sym = (q.get("symbol") || "").replace(/USDT$/, "");
      if (u.pathname.startsWith("/fapi/") && fail) return route.fulfill({ status: 503, body: "{}" });
      if (u.pathname === "/fapi/v1/klines") { calls.kl++; return route.fulfill({ contentType: "application/json", body: JSON.stringify(klines(sym, q.get("interval"), +q.get("limit"))) }); }
      if (u.pathname === "/fapi/v1/ticker/24hr") return route.fulfill({ contentType: "application/json", body: JSON.stringify(TICKER) });
      if (u.pathname === "/fapi/v1/exchangeInfo") return route.fulfill({ contentType: "application/json", body: JSON.stringify(INFO) });
      return route.fulfill({ contentType: "text/html", body: HTML });
    });
    await page.goto("https://radar.local/" + (query || ""));
    return { page, errors, calls, ctx };
  }

  /* 1. home: the rate of the active setting, a full scan of 50 coins, ready and near setups */
  let { page, errors, calls, ctx } = await open();
  await page.waitForSelector(".rate .pct");
  if (SHOTS) { await page.waitForTimeout(800); await page.screenshot({ path: path.join(SHOTS, "scanning.png") }); }
  await page.waitForFunction(() => window.SCAN && SCAN.at > 0 && !SCAN.busy, null, { timeout: 120000 });
  const home = await page.evaluate(() => ({ n: SCAN.list.length, list: SCAN.list.map(c => c.sym), ok: Object.values(SCAN.res).filter(r => !r.err).length,
    pct: document.querySelector("#homeRate .pct").textContent, ready: document.querySelectorAll(".setup").length, near: document.querySelectorAll(".near").length, chip: document.getElementById("activeChip").textContent }));
  check(home.n === 50 && home.ok === 50, "Top 50 : 50 cryptos analysées");
  check(!home.list.includes("USDC") && !home.list.includes("TSLA"), "stablecoin et action tokenisée écartées du Top 50");
  check(calls.kl === 200, "4 séries de bougies par crypto (" + calls.kl + " requêtes)");
  check(/\d/.test(home.pct) && home.chip === "Tendance", "taux de la configuration active affiché (" + home.pct + " %, « " + home.chip + " »)");
  check(true, home.ready + " configuration(s) prête(s), " + home.near + " à l'approche");
  /* every ready card fits the active setting: in the trend, at the zone, gain/risk >= 1.5, no obstacle */
  const fit = await page.evaluate(() => { const P = cur(), bad = [];
    Object.values(SCAN.res).forEach(R => { if (R.err) return; liveOf(R, P).forEach(c => { if (c.st5 !== "ready") return;
      if (!(c.at && c.trend === "with" && c.plan.rrNet >= 1.5 && !c.plan.block)) bad.push(R.sym + c.key);
      const p = grid(c.plan5, c.dir, R.X), s = beSize(p, c.dir, prof, R.X);
      if (!((p.entry - p.sl) * c.dir > 0 && (p.tp1 - p.entry) * c.dir > 0)) bad.push("plan " + R.sym);
      if (s && s.loss > 20.0001) bad.push("taille " + R.sym); }); }); return bad; });
  check(fit.length === 0, "chaque setup prêt respecte les réglages, plan cohérent, perte au stop ≤ 2 % de 1 000" + (fit.length ? " : " + fit.join(", ") : ""));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "home.png"), fullPage: true });

  /* 2. a coin: chart and its configurations through the setting */
  const first = await page.locator("[data-coin]").first();
  if (await first.count()) { await first.click(); await page.waitForSelector("#s-coin .chart svg");
    const coin = await page.evaluate(() => ({ cfg: document.querySelectorAll("#s-coin .cfg").length, tf: document.querySelectorAll("#s-coin .tf div").length }));
    check(coin.cfg > 0 && coin.tf === 5, "fiche d'une crypto : graphique, 5 unités de temps, " + coin.cfg + " configurations");
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "coin.png"), fullPage: true });
    check(await page.evaluate(() => window.goBack()) && await page.locator("#s-home.on").count() === 1, "retour arrière vers les setups"); }

  /* 3. setting: the rate changes with the parameters; a new configuration is saved and used */
  await page.click('nav button[data-s="set"]');
  const r0 = await page.locator("#setRate .side b").textContent(), n0 = await page.evaluate(() => t5Rate(H, edit).all.n);
  await page.click('.seg[data-f="trend"] button[data-v="all"]');
  const n1 = await page.evaluate(() => t5Rate(H, edit).all.n), shown1 = await page.locator("#setRate .side").textContent();
  check(n1 > n0 && shown1.includes(String(n1).replace(/\B(?=(\d{3})+(?!\d))/g, " ")) || shown1.replace(/\s/g, "").includes(String(n1)), "tendance « Toutes » : plus de trades (" + n0 + " → " + n1 + "), taux recalculé à l'écran");
  await page.click('.type[data-k="Ls"]');
  const n2 = await page.evaluate(() => t5Rate(H, edit).all.n);
  check(n2 < n1, "décocher « Long support 4H » retire ses trades (" + n1 + " → " + n2 + ")");
  await page.click('.seg[data-f="target"] button[data-v="1"]');
  const r1 = await page.evaluate(() => t5Rate(H, edit).all.win), be = await page.locator("#setRate .legend").textContent();
  check(r1 > 0 && /50 %/.test(be), "objectif 1R : seuil de rentabilité 50 % affiché, taux " + Math.round(r1) + " %");
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "set.png"), fullPage: true });
  await page.click('#presets button[data-id="+"]');
  await page.fill("#pName", "Mon test");
  await page.click("#useP");
  const saved = await page.evaluate(() => ({ p: JSON.parse(localStorage.getItem("presets")), a: JSON.parse(localStorage.getItem("active")), chip: document.getElementById("activeChip").textContent }));
  const mine = saved.p.find(p => p.name === "Mon test");
  check(mine && saved.a === mine.id && saved.chip === "Mon test" && mine.target === 1 && mine.kinds.Ls === false, "nouvelle configuration enregistrée et active");

  /* 4. profile and alerts */
  await page.click('nav button[data-s="prof"]');
  await page.fill("#fCap", "3000"); await page.click("#fWatch"); await page.click("#saveProf");
  check(calls.start === 1 && (await page.evaluate(() => prof.capital)) === 3000, "profil enregistré, alertes lancées sur le téléphone");
  check(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.join(" | ") : ""));
  await ctx.close();

  /* 5. background: alerts for ready setups of the active setting, never twice */
  ({ page, errors, calls, ctx } = await open("?bg=1"));
  await page.waitForFunction(() => typeof window.bgScan === "function");
  await page.evaluate(() => window.bgScan());
  await page.waitForFunction(() => window.SCAN.at > 0 && !SCAN.busy, null, { timeout: 120000 }); await page.waitForTimeout(300);
  const expect = await page.evaluate(() => Object.values(SCAN.res).reduce((n, R) => n + (R.err ? 0 : liveOf(R, cur()).filter(c => c.st5 === "ready").length), 0));
  const firstN = calls.notify.length;
  await page.evaluate(() => { SCAN.at = 0; window.bgScan(); });
  await page.waitForFunction(() => window.SCAN.at > 0 && !SCAN.busy, null, { timeout: 120000 }); await page.waitForTimeout(300);
  check(firstN === expect && calls.notify.length === firstN && calls.done.length === 2, "arrière-plan : " + firstN + " alerte(s) pour " + expect + " prête(s), rien en double");
  await ctx.close();

  /* 6. Binance unreachable */
  ({ page, errors, calls, ctx } = await open("", true));
  await page.waitForFunction(() => window.SCAN && SCAN.err, null, { timeout: 30000 });
  check(/impossible/.test(await page.locator("#scan").textContent()), "Binance injoignable : message clair");
  await ctx.close(); await browser.close();
  console.log(fails ? fails + " échec(s)" : "tous les tests passent"); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
