// Page tests of Radar BTC·ETH: the bundled page in Chromium, Binance answered from real history (no network, no phone).
// Usage: NODE_PATH=<folder holding playwright> node tests/btceth/run.js <data dir from the btceth-data branch> [--shots <dir>] [--at <ISO date>]
// Without a data dir, a simulated market is used. Prints PASS/FAIL per case; exit code 1 when one fails.
"use strict";
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const args = process.argv.slice(2), opt = n => args.includes(n) ? args[args.indexOf(n) + 1] : null;
const DATA = args[0] && !args[0].startsWith("--") ? args[0] : null, SHOTS = opt("--shots"), AT = opt("--at");
const HTML = fs.readFileSync(path.join(__dirname, "../../btceth/src/main/assets/index.html"), "utf8");
const EXE = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const M15 = 9e5;

function market() {
  const out = {};
  for (const s of ["BTC", "ETH"]) {
    let m;
    if (DATA) {
      m = zlib.gunzipSync(fs.readFileSync(path.join(DATA, s + "USDT.m15.csv.gz"))).toString().split("\n").filter(Boolean)
        .map(l => l.split(",")).map(r => ({ t: +r[0] * M15, o: +r[1], h: +r[2], l: +r[3], c: +r[4], q: +r[5], b: +r[6] }));
      if (AT) m = m.filter(k => k.t <= Date.parse(AT));
    } else {
      let seed = s === "BTC" ? 7 : 11, p = s === "BTC" ? 80000 : 2400; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
      m = []; let t = Math.floor(Date.now() / M15) * M15 - 96 * 420 * M15;
      for (let i = 0; i < 96 * 420; i++) { const o = p; p *= Math.exp((rnd() - 0.5) * 0.006 + (i % 2000 < 1000 ? 4e-5 : -4e-5)); m.push({ t, o, h: Math.max(o, p) * 1.001, l: Math.min(o, p) * 0.999, c: p, q: 1e6, b: 5e5 }); t += M15; }
    }
    out[s] = m;
  }
  return out;
}
const MK = market(), IV = { "15m": M15, "1h": 36e5, "4h": 144e5, "1d": 864e5 };
function klines(sym, iv, limit) {
  const ms = IV[iv], g = new Map();
  for (const k of MK[sym]) { const key = Math.floor(k.t / ms) * ms; let c = g.get(key);
    if (!c) g.set(key, { t: key, o: k.o, h: k.h, l: k.l, c: k.c, q: k.q, b: k.b }); else { c.h = Math.max(c.h, k.h); c.l = Math.min(c.l, k.l); c.c = k.c; c.q += k.q; c.b += k.b; } }
  return [...g.values()].slice(-limit).map(c => [c.t, String(c.o), String(c.h), String(c.l), String(c.c), "0", c.t + ms - 1, String(c.q), 0, "0", String(c.b), "0"]);
}
const RULES = { symbols: [
  { symbol: "BTCUSDT", filters: [{ filterType: "PRICE_FILTER", tickSize: "0.10" }, { filterType: "LOT_SIZE", stepSize: "0.001", minQty: "0.001" }, { filterType: "MIN_NOTIONAL", notional: "100" }] },
  { symbol: "ETHUSDT", filters: [{ filterType: "PRICE_FILTER", tickSize: "0.01" }, { filterType: "LOT_SIZE", stepSize: "0.001", minQty: "0.001" }, { filterType: "MIN_NOTIONAL", notional: "20" }] }] };

let fails = 0;
const check = (ok, what) => { console.log((ok ? "PASS " : "FAIL ") + what); if (!ok) fails++; };

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  async function open(query, fail) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage(), errors = [], calls = { notify: [], start: 0, stop: 0, done: [] };
    page.on("pageerror", e => errors.push(e.message));
    await page.exposeFunction("__bridge", (k, a) => { if (k === "notify") calls.notify.push(a); else if (k === "done") calls.done.push(a); else calls[k]++; });
    await page.addInitScript(() => {
      let on = false;
      window.Android = { notify: (t, x, g) => window.__bridge("notify", [t, x, g]), done: s => window.__bridge("done", s), startWatch: () => { on = true; window.__bridge("start") },
        stopWatch: () => { on = false; window.__bridge("stop") }, watching: () => on, lastCheck: () => "", test: () => {}, canNotify: () => true };
    });
    await page.route("https://radar.local/**", async route => {
      const u = new URL(route.request().url()), q = u.searchParams, sym = (q.get("symbol") || "").replace("USDT", "");
      if (fail && u.pathname.startsWith("/fapi/")) return route.fulfill({ status: 503, body: "{}" });
      if (u.pathname === "/fapi/v1/klines") return route.fulfill({ contentType: "application/json", body: JSON.stringify(klines(sym, q.get("interval"), +q.get("limit"))) });
      if (u.pathname === "/fapi/v1/ticker/24hr") { const m = MK[sym], c = m[m.length - 1].c, o = m[m.length - 97].c; return route.fulfill({ contentType: "application/json", body: JSON.stringify({ priceChangePercent: String((c / o - 1) * 100) }) }); }
      if (u.pathname === "/fapi/v1/exchangeInfo") return route.fulfill({ contentType: "application/json", body: JSON.stringify(RULES) });
      return route.fulfill({ contentType: "text/html", body: HTML });
    });
    await page.goto("https://radar.local/" + (query || ""));
    return { page, errors, calls, ctx };
  }

  /* 1. BTC screen: price, five time units, chart, configuration cards with plan, size and history */
  let { page, errors, calls, ctx } = await open();
  await page.waitForSelector(".hero .price", { timeout: 20000 });
  const btc = await page.evaluate(() => ({ price: document.querySelector(".hero .price").textContent, tf: document.querySelectorAll(".tf > div").length,
    chart: !!document.querySelector(".chart svg rect"), off: document.querySelectorAll(".off").length, cards: [...document.querySelectorAll(".cfg")].map(c => ({ st: c.querySelector(".pill").textContent, dir: c.querySelector(".dir").textContent,
      nums: [...c.querySelectorAll(".nums b")].map(b => b.textContent), size: !!c.querySelector(".size"), hist: c.querySelectorAll(".hb").length })), list: DATA && window.DATA, raw: null }));
  check(/\d/.test(btc.price) && btc.tf === 5 && btc.chart, "BTC : prix, 5 unités de temps et graphique 4H affichés (" + btc.price + ")");
  check(btc.cards.length + btc.off > 0 && btc.cards.every(c => c.nums.length === 4 && c.nums.every(n => /\d/.test(n)) && c.hist === 2), btc.cards.length + " configurations BTC jouables (+ " + btc.off + " écartées), chacune avec entrée, stop, TP1, gain/risque et 2 années d'historique");
  check(btc.cards.every(c => c.size), "taille de position calculée sur chaque carte");
  /* plan sanity on every configuration: stop beyond the entry, TP1 on the right side, prices on the 0.10 grid, loss at the stop within 2 % of 1 000 */
  const plans = await page.evaluate(() => { const R = DATA.BTC; return R.list.map(c => { const p = gridPlan(c.plan, c.dir, R.X), s = beSize(p, c.dir, prof, R.X);
    return { dir: c.dir, e: p.entry, sl: p.sl, tp: p.tp1, loss: s && s.loss, grid: [p.entry, p.sl, p.tp1].every(v => Math.abs(v * 10 - Math.round(v * 10)) < 1e-6) }; }); });
  check(plans.every(p => (p.e - p.sl) * p.dir > 0 && (p.tp - p.e) * p.dir > 0), "stop et TP1 du bon côté de l'entrée sur toutes les cartes");
  check(plans.every(p => p.grid), "prix arrondis au pas de cotation BTC (0,1)");
  check(plans.every(p => p.loss > 0 && p.loss <= 20.0001), "perte au stop, frais compris, jamais au-dessus de 2 % de 1 000 USDT");
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "btc.png"), fullPage: true });
  await page.locator(".cfg .hd").first().click();
  check(await page.locator(".cfg.open .more").isVisible(), "une carte s'ouvre sur son détail");
  if (SHOTS) await page.locator(".cfg").first().screenshot({ path: path.join(SHOTS, "card-open.png") });

  /* 2. ETH */
  await page.locator('.coins button[data-c="ETH"]').click();
  await page.waitForFunction(() => document.body.classList.contains("eth") && /\d/.test((document.querySelector(".hero .price") || {}).textContent || "") && window.DATA.ETH && !window.DATA.ETH.err, null, { timeout: 20000 });
  const eth = await page.evaluate(() => ({ price: DATA.ETH.price, shown: document.querySelector(".hero .price").textContent, n: document.querySelectorAll(".cfg").length }));
  check(eth.n >= 0 && /\d/.test(eth.shown), "ETH : écran affiché (" + eth.shown + ", " + eth.n + " configurations)");
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "eth.png"), fullPage: true });

  /* 3. settings: profile saved, sizes follow, alerts switched on through the phone */
  await page.click("#gear");
  await page.fill("#fCap", "5000"); await page.fill("#fRisk", "1");
  await page.click("#fWatch");
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "settings.png") });
  await page.click("#save");
  const after = await page.evaluate(() => ({ prof: JSON.parse(localStorage.getItem("profile")), loss: DATA.ETH.list.map(c => beSize(gridPlan(c.plan, c.dir, DATA.ETH.X), c.dir, prof, DATA.ETH.X).loss) }));
  check(after.prof.capital === 5000 && after.prof.risk === 1 && after.loss.every(l => l <= 50.0001), "profil enregistré, perte au stop limitée à 1 % de 5 000");
  check(calls.start === 1, "alertes activées : surveillance lancée sur le téléphone");
  check(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.join(" | ") : ""));
  await ctx.close();

  /* 4. background check: alerts only for "Prêt", never twice for the same zone */
  ({ page, errors, calls, ctx } = await open("?bg=1"));
  await page.waitForFunction(() => typeof window.bgScan === "function");
  const expect = await page.evaluate(() => Promise.all(["BTC", "ETH"].map(fetchCoin)).then(a => a.reduce((n, R) => n + R.list.filter(c => c.st === "ready").length, 0)));
  await page.evaluate(() => window.bgScan()); await page.waitForTimeout(1500);
  const first = calls.notify.length;
  await page.evaluate(() => window.bgScan()); await page.waitForTimeout(1500);
  check(first === expect && calls.notify.length === first && calls.done.length === 2, "arrière-plan : " + first + " alerte(s) pour " + expect + " configuration(s) prête(s), rien en double, contrôle signalé");
  await ctx.close();

  /* 5. Binance unreachable: a clear message and a retry button */
  ({ page, errors, calls, ctx } = await open("", true));
  await page.waitForSelector(".err", { timeout: 20000 });
  check(await page.locator("#retry").isVisible(), "Binance injoignable : message et bouton Réessayer");
  await ctx.close();
  await browser.close();
  console.log(fails ? fails + " échec(s)" : "tous les tests passent");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
