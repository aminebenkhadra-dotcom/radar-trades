// Page tests of version 42: the real page in Chromium, phone bridge and Binance answers simulated (no network, no phone).
// Usage: NODE_PATH=<folder holding playwright> node tests/page/run.js [path/to/index.html] [--shots <dir>]
// Each case prints PASS or FAIL with what it checked; the exit code is 1 when one fails.
"use strict";
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const args = process.argv.slice(2), SHOTS = args.includes("--shots") ? args[args.indexOf("--shots") + 1] : null;
const PAGE = args[0] && !args[0].startsWith("--") ? args[0] : path.join(__dirname, "../../app/src/main/assets/index.html");
const HTML = fs.readFileSync(PAGE, "utf8");
const EXE = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

/* ---------- a simulated market: 15-minute candles of a dozen contracts, trends and pullbacks ---------- */
const NOW = Math.floor(Date.now() / 6e4) * 6e4, M15 = 9e5;
let seed = 2026; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const SYMS = [["BTC", 67000, 0.1, 0.0003], ["ETH", 3400, 0.01, 0.0004], ["SOL", 160, 0.01, 0.0005], ["XRP", 0.6, 0.0001, -0.0004], ["DOGE", 0.15, 0.00001, 0.0005],
  ["LINK", 15, 0.001, -0.0005], ["AVAX", 30, 0.001, 0.0004], ["SUI", 1.8, 0.0001, 0.0006], ["ADA", 0.45, 0.0001, -0.0003], ["NEAR", 5, 0.001, 0.0005],
  ["APT", 9, 0.001, -0.0006], ["ARB", 0.9, 0.0001, 0.0004]];
const MARKET = {};
for (const [base, p0, tick, drift] of SYMS) {
  const n = 96 * 420, m = []; let p = p0 * Math.exp(-drift * n * 0.6), t = Math.floor(NOW / M15) * M15 - (n - 1) * M15, phase = 0;
  for (let i = 0; i < n; i++) {
    if (i % 300 === 0) phase = rnd() < 0.35 ? -1 : 1;           // pullback legs against the drift
    const mu = drift * (phase > 0 ? 1.6 : -1.4), o = p;
    p = Math.max(tick * 10, p * Math.exp(mu + (rnd() - 0.5) * 0.006));
    const h = Math.max(o, p) * (1 + rnd() * 0.0025), l = Math.min(o, p) * (1 - rnd() * 0.0025), q = p0 * 2e3 * (1 + rnd() * 2);
    m.push({ t, o, h, l, c: p, q, b: q * (0.42 + rnd() * 0.16) }); t += M15;
  }
  MARKET[base + "USDT"] = { base, tick, m };
}
const IV = { "1m": 6e4, "15m": M15, "1h": 36e5, "4h": 144e5, "1d": 864e5 };
function klines(sym, iv, limit, start, end) {
  const S = MARKET[sym]; if (!S) return null; const ms = IV[iv], out = [];
  if (iv === "1m") { const lo = start || NOW - limit * 6e4; for (let t = Math.ceil(lo / 6e4) * 6e4; t <= Math.min(end || NOW, NOW) && out.length < limit; t += 6e4) { const c = S.m[S.m.length - 1].c; out.push([t, c, c * 1.0005, c * 0.9995, c, 1, t + 6e4 - 1, c * 100, 1, 0.5, c * 50, 0]); } return out; }
  const groups = new Map();
  for (const k of S.m) { if (k.t > NOW) break; const key = Math.floor(k.t / ms) * ms; let g = groups.get(key);
    if (!g) groups.set(key, g = { t: key, o: k.o, h: k.h, l: k.l, c: k.c, q: k.q, b: k.b }); else { g.h = Math.max(g.h, k.h); g.l = Math.min(g.l, k.l); g.c = k.c; g.q += k.q; g.b += k.b; } }
  let arr = [...groups.values()];
  if (start) arr = arr.filter(g => g.t >= start); if (end) arr = arr.filter(g => g.t <= end);
  arr = start ? arr.slice(0, limit) : arr.slice(-limit);
  return arr.map(g => [g.t, g.o, g.h, g.l, g.c, g.q / g.c, g.t + ms - 1, g.q, 100, g.b / g.c, g.b, 0]);
}
function last(sym) { const m = MARKET[sym].m; return m[m.length - 1].c; }
function book(sym, spreadPct) {
  const p = last(sym), tick = MARKET[sym].tick, half = Math.max(tick, p * spreadPct / 200), bids = [], asks = [];
  for (let i = 0; i < 200; i++) { bids.push([String(p - half - i * p * 0.0002), String(5e3 / p * (1 + rnd()))]); asks.push([String(p + half + i * p * 0.0002), String(5e3 / p * (1 + rnd()))]); }
  return { bids, asks };
}
const dec = x => { const s = String(x); return s.includes(".") ? s.length - s.indexOf(".") - 1 : 0; };
const EXINFO = { symbols: Object.entries(MARKET).map(([s, v]) => ({ symbol: s, baseAsset: v.base, quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING", underlyingType: "COIN",
  filters: [{ filterType: "PRICE_FILTER", tickSize: String(v.tick), minPrice: String(v.tick), maxPrice: "10000000" }, { filterType: "LOT_SIZE", stepSize: v.base === "BTC" ? "0.001" : "0.1", minQty: v.base === "BTC" ? "0.001" : "0.1", maxQty: "1000000" },
    { filterType: "MARKET_LOT_SIZE", stepSize: v.base === "BTC" ? "0.001" : "0.1", minQty: v.base === "BTC" ? "0.001" : "0.1", maxQty: "100000" }, { filterType: "MIN_NOTIONAL", notional: "5" },
    { filterType: "PERCENT_PRICE", multiplierUp: "1.0500", multiplierDown: "0.9500", multiplierDecimal: "4" }] })) };

/* ---------- the phone bridge, as the app's Java side would answer ---------- */
const BRIDGE = `(() => {
  const M = window.__M = window.__M || { keys: {}, notes: [], saved: null, restore: null, pos: [], ord: {}, ordFail: {}, inc: {}, perm: null, fut: { totalWalletBalance: "1000", availableBalance: "800", totalMarginBalance: "1000" } };
  try { const s = sessionStorage.getItem("__M"); if (s) Object.assign(M, JSON.parse(s)); } catch (e) {}
  const reply = (id, st, body) => setTimeout(() => window.onApi && window.onApi(id, st, JSON.stringify(body)), 5);
  window.Android = {
    api(id, ex, name) {
      if (!M.keys[ex]) return reply(id, 401, { msg: "Aucune clé" });
      if (ex === "binance") {
        if (name === "pos") return reply(id, 200, M.pos);
        if (name.startsWith("ord:")) { const s = name.slice(4); return M.ordFail[s] ? reply(id, 0, { msg: "délai dépassé" }) : reply(id, 200, M.ord[s] || []); }
        if (name.startsWith("algo:")) { const s = name.slice(5); return M.ordFail[s] ? reply(id, 0, { msg: "délai dépassé" }) : reply(id, 200, []); }
        if (name === "fut") return reply(id, 200, M.fut);
        if (name === "perm") return reply(id, 200, M.perm || { enableReading: true, ipRestrict: false });
        if (name.startsWith("inc:")) { const p = name.split(":"), a = +p[2], b = +p[3]; return reply(id, 200, (M.inc[p[1]] || []).filter(r => r.time >= a && r.time <= b).slice(0, 1000)); }
        if (name.startsWith("utr:")) { const p = name.split(":"), a = +p[2], b = +p[3]; if (b - a >= 7 * 864e5) return reply(id, 400, { msg: "fenêtre" }); M.utrCalls = (M.utrCalls || 0) + 1; return reply(id, 200, (M.fills || []).filter(f => f.symbol === p[1] && f.time >= a && f.time <= b).slice(0, 1000)); }
        if (name === "spot") return reply(id, 200, { balances: [] });
        return reply(id, 200, []);
      }
      return reply(id, 200, { code: "0", data: [] });
    },
    hasKeys(ex) { return !!M.keys[ex]; }, saveKeys() { return true; }, clearKeys() {},
    notify(title, text, tag, tab) { M.notes.push({ ch: "setups", title, text, tag, tab }); },
    protect(title, text, tag, tab) { M.notes.push({ ch: "protect", title, text, tag, tab }); },
    startWatch() {}, stopWatch() {}, canNotify() { return true; }, batteryFree() { return true; }, askBattery() {}, test() {}, lastCheck() { return ""; },
    done(msg) { M.done = msg; },
    saveBytes(name, b64) { M.xlsx = { name, b64 }; setTimeout(() => window.onExport && window.onExport(true, name), 5); },
    saveFile(name, data) { M.saved = data; setTimeout(() => window.onBackup && window.onBackup(true, ""), 5); },
    openFile() { setTimeout(() => window.onRestore && window.onRestore(true, M.restore || ""), 5); }
  };
})();`;

/* ---------- the page and its network ---------- */
async function open(browser, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, colorScheme: "dark", timezoneId: "Africa/Casablanca" });
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", e => errors.push(String(e && e.stack || e)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR|fonts\.g/.test(m.text())) errors.push("console: " + m.text()); });
  if (o.session) await page.addInitScript(`if(!sessionStorage.getItem("__M"))sessionStorage.setItem("__M",${JSON.stringify(JSON.stringify(o.session))})`);
  await page.addInitScript(BRIDGE);
  if (o.init) await page.addInitScript(o.init);
  await page.route("**/*", async route => {
    const u = new URL(route.request().url());
    if (u.hostname !== "radar.local") return route.fulfill({ status: 404, body: "" });
    const q = u.searchParams, sym = q.get("symbol"), p = u.pathname, json = (b, st) => route.fulfill({ status: st || 200, contentType: "application/json", body: JSON.stringify(b) });
    if (p === "/" || p === "/index.html") return route.fulfill({ status: 200, contentType: "text/html", body: HTML });
    if (p === "/fapi/v1/exchangeInfo") return json(EXINFO);
    if (p === "/fapi/v1/ticker/24hr") return json(sym ? { symbol: sym, quoteVolume: "5e8" } : Object.keys(MARKET).map((s, i) => ({ symbol: s, quoteVolume: String(1e9 / (i + 1)) })));
    if (p === "/fapi/v1/premiumIndex") return json(sym ? { symbol: sym, lastFundingRate: "0.0001", markPrice: String(last(sym)) } : Object.keys(MARKET).map(s => ({ symbol: s, lastFundingRate: "0.0001" })));
    if (p === "/fapi/v1/klines") { const k = klines(sym, q.get("interval"), +q.get("limit") || 500, +q.get("startTime") || 0, +q.get("endTime") || 0); return k ? json(k) : json({ code: -1121 }, 400); }
    if (p === "/fapi/v1/depth") return json(book(sym, (o.spread && o.spread[sym]) || 0.02));
    if (p === "/fapi/v1/ticker/price") return json({ symbol: sym, price: String(last(sym)) });
    if (p.startsWith("/futures/data/")) return json([]);
    if (p.startsWith("/bspot/") || p.startsWith("/mexc/")) return json([]);
    return route.fulfill({ status: 503, body: "" });
  });
  await page.goto("https://radar.local/" + (o.suffix || ""));
  return { ctx, page, errors };
}
const results = [];
async function test(id, title, fn) {
  const rec = { id, title, checks: [], ok: true }, ok = (c, w) => { rec.checks.push((c ? "ok   " : "FAIL ") + w); if (!c) rec.ok = false; };
  try { await fn(ok); } catch (e) { rec.ok = false; rec.checks.push("exception: " + (e && e.stack || e)); }
  results.push(rec);
  console.log((rec.ok ? "PASS " : "FAIL ") + id + " · " + title); rec.checks.forEach(c => console.log("     " + c));
}
async function waitScan(page) { await page.waitForFunction(() => !document.getElementById("app").classList.contains("scanning") && /scan/.test(document.getElementById("status").textContent), null, { timeout: 120000 }); }

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

  await test("P1", "Scan complet : quatre statuts, aucun pourcentage de préparation, aucune erreur", async ok => {
    const { ctx, page, errors } = await open(browser);
    await waitScan(page);
    const st = await page.$$eval("#view-scan .st", a => a.map(x => x.className.replace("st ", "") + ":" + x.textContent));
    ok(st.length > 0, st.length + " cartes : " + [...new Set(st)].slice(0, 6).join(" | "));
    ok(st.every(x => /^(ready|watch|refused|incomplete|none):/.test(x) || /Pas de trade/.test(x)), "chaque carte a l'un des quatre statuts");
    const txt = await page.textContent("#view-scan");
    ok(!/\b9[0-9] %|presque prêt|fiabilité/i.test(txt), "aucun « 95 % », « presque prêt » ni « fiabilité » sur les cartes");
    ok(await page.isVisible("#prof-line .prof-alert, .prof-alert"), "bandeau « Profil de risque à confirmer »");
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" / ") : ""));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "p1-scan.png"), fullPage: false });
    await ctx.close();
  });

  await test("P2", "Détail d'un setup : statut expliqué, prix sur le pas du contrat, taille nette de frais", async ok => {
    const { ctx, page, errors } = await open(browser);
    await waitScan(page);
    const btn = await page.$("#view-scan button.row[data-s]");
    ok(!!btn, "un setup à ouvrir");
    if (btn) {
      const openBtn = await page.$('#view-scan button.row[aria-expanded="true"]'), use = openBtn || btn, sym = await use.getAttribute("data-s");
      if (!openBtn) await btn.click();
      await page.waitForSelector(".stbox");
      const d = await page.evaluate(() => { const g = s => (document.querySelector(s) || {}).textContent || ""; return { box: g(".stbox"), plan: [...document.querySelectorAll(".detail .plan dd")].map(x => x.textContent), size: g(".detail") }; });
      ok(/Prêt selon les règles|À surveiller|Refusé|Données incomplètes/.test(d.box), "statut affiché : " + d.box.slice(0, 70));
      const tick = MARKET[sym + "USDT"].tick, onGrid = d.plan.every(v => { const x = +v.replace(/\s| | /g, "").replace(",", "."); return Math.abs(x / tick - Math.round(x / tick)) < 1e-6; });
      ok(onGrid, "entrée, stop, TP1, TP2 sur le pas " + tick + " : " + d.plan.join(" / "));
      ok(/Perte max au stop/.test(d.size) && /frais et glissement/.test(d.size), "perte max au stop détaillée (prix + frais et glissement)");
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "p2-detail.png"), fullPage: false });
    }
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors[0] : ""));
    await ctx.close();
  });

  await test("P3", "Profil : rien n'est changé en silence, la confirmation est explicite", async ok => {
    const { ctx, page, errors } = await open(browser, { init: `if(!localStorage.getItem("radar-settings"))localStorage.setItem("radar-settings",JSON.stringify({risk:2,lev:7,margin:20,account:1500,acsync:false}))` });
    const v = await page.evaluate(() => ({ lev: document.getElementById("f-lev").value, risk: document.getElementById("f-risk").value, margin: document.getElementById("f-margin").value, open: document.getElementById("prof").open, sim: document.getElementById("prof-sim").textContent }));
    ok(v.lev === "7" && v.risk === "2" && v.margin === "20", "réglages existants conservés (levier x7, 2 %, marge 20 %)");
    ok(v.open && /à confirmer/.test(await page.textContent("#prof-badge")), "profil ouvert et marqué « à confirmer »");
    ok(/−30 %/.test(v.sim) && /−46 %/.test(v.sim), "recul simulé affiché (2 % : −30 %, 1 fois sur 10 : −46 %)");
    await page.click("#prof-ok");
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem("radar-settings")));
    ok(s.profOk === true && s.lev === 7, "confirmé par l'utilisateur, valeurs inchangées");
    if (SHOTS) { await page.evaluate(() => document.getElementById("prof").scrollIntoView()); await page.screenshot({ path: path.join(SHOTS, "p3-profil.png") }); }
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors[0] : ""));
    await ctx.close();
  });

  const POS = [{ symbol: "SOLUSDT", positionAmt: "10", entryPrice: "150", markPrice: String(last("SOLUSDT")), unRealizedProfit: "1", liquidationPrice: "120", leverage: "10", marginType: "isolated", isolatedWallet: "150", notional: "1500", positionSide: "BOTH", breakEvenPrice: "150.2" }];
  await test("P4", "Position avec un stop qui ne couvre que 10 %", async ok => {
    const { ctx, page, errors } = await open(browser, { session: { keys: { binance: true }, pos: POS, ord: { SOLUSDT: [{ symbol: "SOLUSDT", side: "SELL", positionSide: "BOTH", type: "STOP_MARKET", stopPrice: "140", origQty: "1", reduceOnly: true }] } }, suffix: "#trades" });
    await page.waitForSelector("#live article.lv", { timeout: 20000 });
    const t = await page.textContent("#live");
    ok(/Stop partiel : 10 % de la position couverts/.test(t), "« Stop partiel : 10 % de la position couverts »");
    ok(/90 % de la position/.test(t) && !/Trade sécurisé/.test(t), "90 % non protégés, aucune mention de protection complète");
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "p4-stop-partiel.png") });
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors[0] : ""));
    await ctx.close();
  });

  await test("P5", "Ordres illisibles : protection inconnue, l'ancien stop n'est pas présenté comme actuel", async ok => {
    const { ctx, page, errors } = await open(browser, { session: { keys: { binance: true }, pos: POS, ord: { SOLUSDT: [{ symbol: "SOLUSDT", side: "SELL", positionSide: "BOTH", type: "STOP_MARKET", stopPrice: "140", origQty: "0", closePosition: "true" }] } }, suffix: "#trades" });
    await page.waitForSelector("#live article.lv", { timeout: 20000 });
    const before = await page.textContent("#live");
    ok(/Au stop/.test(before) && !/Protection inconnue/.test(before), "première lecture réussie : stop à 100 %");
    await page.evaluate(() => { window.__M.ordFail.SOLUSDT = true; });
    await page.waitForFunction(() => /Protection inconnue/.test(document.getElementById("live").textContent), null, { timeout: 30000 });
    const after = await page.textContent("#live");
    ok(/Protection inconnue/.test(after), "lecture en échec : « Protection inconnue »");
    ok(!/Stop 140/.test(after), "l'ancien stop (140) n'est plus affiché comme actuel");
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "p5-protection-inconnue.png") });
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors[0] : ""));
    await ctx.close();
  });

  await test("P6", "Résultats Binance : brut +1, frais −2, historique paginé au-delà de 1 000 lignes", async ok => {
    const T0 = NOW - 3 * 864e5, inc = { REALIZED_PNL: [{ symbol: "SOLUSDT", incomeType: "REALIZED_PNL", income: "1", asset: "USDT", time: T0 + 36e5, tradeId: "2", tranId: 1 }],
      COMMISSION: [{ symbol: "SOLUSDT", incomeType: "COMMISSION", income: "-1", asset: "USDT", time: T0, tradeId: "1", tranId: 2 }, { symbol: "SOLUSDT", incomeType: "COMMISSION", income: "-1", asset: "USDT", time: T0 + 36e5, tradeId: "2", tranId: 3 }],
      FUNDING_FEE: [] };
    for (let i = 0; i < 2600; i++) inc.FUNDING_FEE.push({ symbol: "ETHUSDT", incomeType: "FUNDING_FEE", income: "-0.001", asset: "USDT", time: T0 - 5 * 864e5 + i * 1e5, tranId: 100 + i });
    const { ctx, page, errors } = await open(browser, { session: { keys: { binance: true }, inc }, suffix: "#res" });
    await page.waitForFunction(() => /Résultat net sur/.test(document.getElementById("view-res").textContent), null, { timeout: 30000 });
    const t = await page.textContent("#view-res");
    ok(/0 %\s*sorties gagnantes nettes \(0\/1\)/.test(t.replace(/ | /g, " ")), "aucune sortie gagnante nette (0/1)");
    ok(/funding\s*−2,60/.test(t.replace(/\u202f|\u00a0/g, " ")) && !/trop fourni/.test(t), "2 600 lignes de funding lues en entier (funding −2,60 $)");
    ok(/Résultat net sur 30 jours/.test(t) && !/partiel/.test(t), "résultat complet sur 30 jours");
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors[0] : ""));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "p6-resultats.png") });
    await ctx.close();
  });

  await test("P7", "Alertes en arrière-plan : protection d'abord, entrée seulement sur « Prêt selon les règles »", async ok => {
    const { ctx, page, errors } = await open(browser, { session: { keys: { binance: true }, pos: POS, ord: { SOLUSDT: [] } }, suffix: "?bg=1",
      init: `localStorage.setItem("radar-settings",JSON.stringify({atr:true,a50:true,profOk:true,account:1000}))` });
    await page.evaluate(() => window.bgScan(false, true));
    await page.waitForFunction(() => window.__M.done, null, { timeout: 150000 });
    const M = await page.evaluate(() => window.__M);
    const prot = M.notes.filter(n => n.ch === "protect"), set = M.notes.filter(n => n.ch === "setups");
    ok(prot.some(n => /aucun stop-loss/.test(n.title)), "position sans stop : alerte de protection (canal séparé)");
    ok(M.notes.length === 0 || M.notes[0].ch === "protect", "la protection passe avant les setups");
    ok(set.every(n => /prêt selon les règles/.test(n.title) && !/%/.test(n.title)), "alertes d'entrée : uniquement « prêt selon les règles », sans pourcentage (" + set.length + ")");
    ok(/contrôle de 1 position Binance/.test(M.done), "résumé du contrôle : " + M.done);
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors[0] : ""));
    await ctx.close();
  });

  await test("P8", "Sauvegarde : export puis import, sans clé API", async ok => {
    const { ctx, page, errors } = await open(browser, { init: `if(!sessionStorage.getItem("seeded")){sessionStorage.setItem("seeded","1");localStorage.setItem("radar-trades",JSON.stringify([{id:"a1",sym:"SOL",full:"SOLUSDT",dir:1,entry:150,qty:1,sl:140,tp:170,t:1}]))}` });
    await page.evaluate(() => document.querySelector("#bk-out").click());
    await page.waitForFunction(() => window.__M.saved, null, { timeout: 5000 });
    const saved = await page.evaluate(() => window.__M.saved), o = JSON.parse(saved);
    ok(o.app === "radar-trades" && o.data["radar-trades"] && !/apiKey|secret/i.test(saved), "fichier exporté : journal présent, aucune clé API");
    await page.evaluate(s => { localStorage.removeItem("radar-trades"); window.__M.restore = s; sessionStorage.setItem("__M", JSON.stringify({ restore: s })); }, saved);
    await page.evaluate(() => { const b = document.querySelector("#bk-in"); b.click(); b.click(); });
    await page.waitForTimeout(1500);
    const back = await page.evaluate(() => JSON.parse(localStorage.getItem("radar-trades") || "[]"));
    ok(back.length === 1 && back[0].sym === "SOL", "journal restauré après import");
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors[0] : ""));
    await ctx.close();
  });

  await test("P9", "Clé capable de trader : signalée dans le portefeuille", async ok => {
    const { ctx, page, errors } = await open(browser, { session: { keys: { binance: true }, perm: { enableReading: true, enableFutures: true, enableWithdrawals: false, ipRestrict: false } }, suffix: "#pf" });
    await page.waitForFunction(() => /Cette clé peut/.test(document.getElementById("view-pf").textContent), null, { timeout: 20000 });
    ok(/Cette clé peut trader les futures/.test(await page.textContent("#view-pf")), "« Cette clé peut trader les futures » affiché");
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors[0] : ""));
    await ctx.close();
  });

  await test("P10", "Tous les onglets s'ouvrent sans erreur", async ok => {
    const { ctx, page, errors } = await open(browser, { session: { keys: { binance: true }, pos: POS, ord: { SOLUSDT: [] } } });
    await waitScan(page);
    const tabs = await page.$$eval(".tabs button", a => a.map(b => b.dataset.v));
    for (const v of tabs) { await page.click('.tabs button[data-v="' + v + '"]'); await page.waitForTimeout(700); }
    await page.click('.tabs button[data-v="one"]'); await page.fill("#one-sym", "SOL"); await page.click("#one-form button");
    await page.waitForFunction(() => /Setup|Pas de trade/.test(document.getElementById("one-out").textContent), null, { timeout: 30000 });
    const v = await page.textContent("#one-out .verdict");
    ok(/prêt selon les règles|à surveiller|refusé|données incomplètes|Pas de trade/i.test(v), "Analyser SOL : « " + v.trim() + " »");
    ok(tabs.length === 17, tabs.length + " onglets parcourus, plus l'analyse d'une crypto");
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" / ") : ""));
    await ctx.close();
  });

  await test("P11", "Export Excel de l'historique Binance Futures", async ok => {
    /* 24 trades on 3 contracts over 30 days, one with a second entry, the last one still open; income rows built from the same fills */
    const now = Date.now(), fills = [], inc = { REALIZED_PNL: [], COMMISSION: [], FUNDING_FEE: [] }, syms = ["SOLUSDT", "ETHUSDT", "BTCUSDT"], base = { SOLUSDT: 150, ETHUSDT: 3000, BTCUSDT: 60000 };
    let id = 1, want = 0, nWant = 0;
    const fill = (sym, t, side, qty, price, rp) => { const fee = qty * price * 0.0005, f = { symbol: sym, id: id++, orderId: id * 7, time: t, side, qty: String(qty), price: String(price), quoteQty: String(qty * price), realizedPnl: String(rp), commission: String(fee), commissionAsset: "USDT", positionSide: "BOTH", maker: false };
      fills.push(f); inc.COMMISSION.push({ symbol: sym, time: t, income: String(-fee), asset: "USDT", tradeId: String(f.id) }); if (rp) inc.REALIZED_PNL.push({ symbol: sym, time: t, income: String(rp), asset: "USDT", tradeId: String(f.id) }); return -fee; };
    for (let i = 0; i < 24; i++) {
      const sym = syms[i % 3], dir = i % 2 ? -1 : 1, t0 = now - (29 - i) * 29 * 36e5, e = base[sym] * (1 + i / 100), q = +(200 / e).toFixed(4), x = e * (1 + dir * (i % 4 === 0 ? -0.01 : 0.02));
      let net = fill(sym, t0, dir > 0 ? "BUY" : "SELL", q, e, 0);
      if (i === 5) net += fill(sym, t0 + 36e5, dir > 0 ? "BUY" : "SELL", q, e, 0);
      const qq = i === 5 ? 2 * q : q;
      if (i === 23) continue;
      const rp = (x - e) * dir * qq; net += fill(sym, t0 + 5 * 36e5, dir > 0 ? "SELL" : "BUY", qq, x, rp) + rp;
      inc.FUNDING_FEE.push({ symbol: sym, time: t0 + 2 * 36e5, income: "-0.05", asset: "USDT" }); net -= 0.05; if (t0 + 5 * 36e5 >= now - 30 * 864e5 + 6e4) { want += net; nWant++; }
    }
    const { ctx, page, errors } = await open(browser, { session: { keys: { binance: true }, fills, inc }, suffix: "#res" });
    await page.click('.tabs button[data-v="res"]').catch(() => {});
    await page.waitForSelector('[data-xp="30"]', { timeout: 20000 });
    ok(true, "bouton « Exporter en Excel · 30 jours » dans Résultats");
    await page.click('[data-xp="30"]');
    await page.waitForFunction(() => window.__M.xlsx, null, { timeout: 30000 }).catch(async e => { throw new Error("statut : " + await page.evaluate(() => (document.querySelector(".xp-st") || {}).textContent + " / utr " + window.__M.utrCalls + " / " + typeof Android.saveBytes) + " / " + errors.slice(0, 2).join(" | ")); });
    await page.waitForFunction(() => /Fichier/.test(document.querySelector(".xp-st").textContent), null, { timeout: 5000 }).catch(() => {});
    const x = await page.evaluate(() => ({ f: window.__M.xlsx, st: document.querySelector(".xp-st").textContent, calls: window.__M.utrCalls }));
    const buf = Buffer.from(x.f.b64, "base64");
    ok(/^radar-trades-historique-futures-\d{4}-\d\d-\d\d-30j\.xlsx$/.test(x.f.name), "fichier " + x.f.name + " (" + (buf.length / 1024).toFixed(1) + " Ko)");
    ok(buf.readUInt32LE(0) === 0x04034b50, "fichier zip / xlsx");
    ok(/Fichier enregistré/.test(x.st), "message : " + x.st);
    ok(x.calls > 0 && x.calls <= 15, x.calls + " lectures d'exécutions (fenêtres de 7 jours utiles seulement)");
    const xml = buf.toString("utf8");
    ok(/Entrée avant|Clôturé/.test(xml) && /En cours/.test(xml), "statuts Clôturé et En cours présents");
    const net = +((xml.match(/Résultat net \(USDT\)<\/t><\/is><\/c><c r="B9" s="4"><f>[^<]*<\/f><v>([^<]+)</) || [])[1]);
    const cnt = +((xml.match(/<c r="B6" s="6"><f>[^<]*<\/f><v>([^<]+)</) || [])[1]);
    ok(cnt === nWant && Math.abs(net - want) < 0.01, cnt + " trades clôturés, net " + net.toFixed(2) + " (attendu " + nWant + " et " + want.toFixed(2) + ")");
    if (process.env.XLSX_OUT) { fs.writeFileSync(process.env.XLSX_OUT, buf); fs.writeFileSync(process.env.XLSX_OUT + ".want", String(want)); }
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "p11-export.png"), fullPage: false });
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" / ") : ""));
    await ctx.close();
  });

  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log("\n" + (results.length - fail) + "/" + results.length + " tests de page réussis");
  process.exit(fail ? 1 : 0);
})();
