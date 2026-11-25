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
/* the suite runs at a fixed instant, Thursday 19/11/2026 16:50 UTC (17:50 in Casablanca): the simulated market and every page share it, so the states of
   the setups no longer depend on the hour of the run (21/11/2026: at 08:40 the simulated market had no ready setup and P19 failed).
   Each page's clock starts there and runs normally. TEST_NOW=<ms> picks another instant */
const T0 = Date.now(), NOW = Math.floor((+process.env.TEST_NOW || Date.UTC(2026, 10, 19, 16, 50)) / 6e4) * 6e4, M15 = 9e5;
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
/* one more contract, outside the scanned market: a steady rise with regular pullbacks (both trends up, momentum neither fading nor
   stretched), the case where the target of a long near its objective can be raised */
const EXTRA = {};
{ const n = 96 * 420, m = [], f = x => 100 * Math.exp(0.00003 * (x - n)) * (1 + 0.008 * Math.sin(2 * Math.PI * x / 90) + 0.0048 * Math.sin(2 * Math.PI * x / 657)); let t = Math.floor(NOW / M15) * M15 - (n - 1) * M15;
  for (let i = 0; i < n; i++) { const o = f(i), c = f(i + 1); m.push({ t, o, h: Math.max(o, c) * 1.0008, l: Math.min(o, c) * 0.9992, c, q: 1e5, b: 5e4 }); t += M15; }
  EXTRA.ZIGUSDT = { base: "ZIG", tick: 0.001, m }; }
/* and one with two 4H levels between the price and a far target: the case where the target of a long should be lowered */
EXTRA.LVLUSDT = { base: "LVL", tick: 0.001, m: require("../synth.js").path(require("../synth.js").LEVELS, NOW, 0.003) };
const MK = sym => MARKET[sym] || EXTRA[sym];
const CAPS = (() => { const L = [], order = ["BTC", "ETH", "USDT", "XRP", "SOL", "DOGE", "USDC", "ADA", "LINK", "AVAX", "SUI", "NEAR"]; order.forEach((s, i) => L.push({ symbol: s.toLowerCase(), name: s, market_cap_rank: i + 1 }));
  L.push({ symbol: "apt", name: "Aptos", market_cap_rank: 45 }, { symbol: "arb", name: "Arbitrum", market_cap_rank: 52 }); for (let r = 53; r <= 250; r++) L.push({ symbol: "zz" + r, name: "Other " + r, market_cap_rank: r }); return L; })();
const IV = { "1w": 7 * 864e5, "1m": 6e4, "15m": M15, "1h": 36e5, "4h": 144e5, "1d": 864e5 };
/* Bitcoin falling for the last four days (−21 %): the « Marché » check then fails every long (P20) */
const BTCDOWN = (() => { const m = MARKET.BTCUSDT.m, n = m.length; return { base: "BTC", tick: MARKET.BTCUSDT.tick, m: m.map((k, i) => { const f = Math.exp(-0.0006 * Math.max(0, i - (n - 400))); return { t: k.t, o: k.o * f, h: k.h * f, l: k.l * f, c: k.c * f, q: k.q, b: k.b }; }) }; })();
/* Bitcoin rebounding 15 % over its last day (P20: shorts held back while Bitcoin stands 7 % above its 72-hour low) */
const BTCREB = (() => { const m = MARKET.BTCUSDT.m, n = m.length; return { base: "BTC", tick: MARKET.BTCUSDT.tick, m: m.map((k, i) => { const f = Math.exp(0.0015 * Math.max(0, i - (n - 96))); return { t: k.t, o: k.o * f, h: k.h * f, l: k.l * f, c: k.c * f, q: k.q, b: k.b }; }) }; })();
/* Bitcoin +4,2 % in the last closed 15-minute candle, on 28 times its volume (P22) */
const BTCJUMP = (() => { const m = MARKET.BTCUSDT.m.map(k => Object.assign({}, k)), n = m.length, x = m[n - 2], o = m[n - 3].c;
  Object.assign(x, { o, c: o * 1.042, h: o * 1.043, l: o * 0.999, q: x.q * 28, b: x.q * 20 });
  const f = x.c / m[n - 1].o; Object.assign(m[n - 1], { o: m[n - 1].o * f, h: m[n - 1].h * f, l: m[n - 1].l * f, c: m[n - 1].c * f });
  return { base: "BTC", tick: MARKET.BTCUSDT.tick, m }; })();
function klines(sym, iv, limit, start, end, S0) {
  const S = S0 || MK(sym); if (!S) return null; const ms = IV[iv], out = [];
  if (iv === "1m") { const lo = start || NOW - limit * 6e4; for (let t = Math.ceil(lo / 6e4) * 6e4; t <= Math.min(end || NOW, NOW) && out.length < limit; t += 6e4) { const c = S.m[S.m.length - 1].c; out.push([t, c, c * 1.0005, c * 0.9995, c, 1, t + 6e4 - 1, c * 100, 1, 0.5, c * 50, 0]); } return out; }
  const groups = new Map();
  for (const k of S.m) { if (k.t > NOW) break; const key = Math.floor(k.t / ms) * ms; let g = groups.get(key);
    if (!g) groups.set(key, g = { t: key, o: k.o, h: k.h, l: k.l, c: k.c, q: k.q, b: k.b }); else { g.h = Math.max(g.h, k.h); g.l = Math.min(g.l, k.l); g.c = k.c; g.q += k.q; g.b += k.b; } }
  let arr = [...groups.values()];
  if (start) arr = arr.filter(g => g.t >= start); if (end) arr = arr.filter(g => g.t <= end);
  arr = start ? arr.slice(0, limit) : arr.slice(-limit);
  return arr.map(g => [g.t, g.o, g.h, g.l, g.c, g.q / g.c, g.t + ms - 1, g.q, 100, g.b / g.c, g.b, 0]);
}
function last(sym) { const m = MK(sym).m; return m[m.length - 1].c; }
function book(sym, spreadPct) {
  const p = last(sym), tick = MK(sym).tick, half = Math.max(tick, p * spreadPct / 200), bids = [], asks = [];
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
    startWatch(a, b, m) { M.watch = { on: b, min: m }; }, stopWatch() { M.watch = null; }, canNotify() { return true; }, batteryFree() { return true; }, askBattery() {}, test() {}, lastCheck() { return ""; },
    nextCheck() { return M.next || 0; }, exactOk() { return M.exact !== false; }, askExact() { M.askedExact = 1; },
    done(msg) { M.done = msg; },
    saveBytes(name, b64) { M.xlsx = { name, b64 }; setTimeout(() => window.onExport && window.onExport(true, name), 5); },
    saveFile(name, data) { M.saved = data; setTimeout(() => window.onBackup && window.onBackup(true, ""), 5); },
    openFile() { setTimeout(() => window.onRestore && window.onRestore(true, M.restore || ""), 5); }
  };
})();`;

/* ---------- the page and its network ---------- */
/* a private GitHub repository holding one file, as the contents API serves it: sha checked on writes, ETag on reads, CORS */
function github(route, u, G) {
  const rq = route.request(), m = rq.method(), cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,PUT,OPTIONS", "access-control-expose-headers": "ETag" };
  const send = (st, b, h) => route.fulfill({ status: st, headers: Object.assign({ "content-type": "application/json" }, cors, h || {}), body: b === undefined ? "" : JSON.stringify(b) });
  if (m === "OPTIONS") return send(204);
  if ((rq.headers().authorization || "") !== "Bearer " + G.token) return send(401, { message: "Bad credentials" });
  if (u.pathname === "/repos/" + G.repo) return send(200, { private: true });
  if (u.pathname !== "/repos/" + G.repo + "/contents/radar-trades.json") return send(404, { message: "Not Found" });
  G.calls = (G.calls || 0) + 1;
  if (m === "GET") {
    if (!G.sha) return send(404, { message: "Not Found" });
    if (rq.headers()["if-none-match"] === '"' + G.sha + '"') return send(304, undefined, { etag: '"' + G.sha + '"' });
    return send(200, { sha: G.sha, content: G.content, encoding: "base64" }, { etag: '"' + G.sha + '"' });
  }
  if (m === "PUT") {
    const b = JSON.parse(rq.postData() || "{}");
    if ((G.sha || b.sha) && b.sha !== G.sha) return send(409, { message: "sha mismatch" });
    G.content = b.content; G.sha = "s" + (G.n = (G.n || 0) + 1); G.puts = (G.puts || 0) + 1; G.text = Buffer.from(b.content, "base64").toString("utf8");
    return send(200, { content: { sha: G.sha } });
  }
  return send(405, {});
}
/* goes to a page the way a user does: back to the home page, then its tile */
async function nav(page, v) {
  if (!(await page.isVisible("#view-home"))) { await page.click("#back"); await page.waitForSelector("#view-home:not([hidden])", { timeout: 10000 }); }
  await page.click('#view-home [data-go="' + v + '"]');
}
async function open(browser, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, colorScheme: "dark", timezoneId: "Africa/Casablanca" });
  await ctx.clock.setSystemTime(NOW + (Date.now() - T0));
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", e => errors.push(String(e && e.stack || e)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR|fonts\.g/.test(m.text())) errors.push("console: " + m.text()); });
  if (o.session) await page.addInitScript(`if(!sessionStorage.getItem("__M"))sessionStorage.setItem("__M",${JSON.stringify(JSON.stringify(o.session))})`);
  await page.addInitScript(BRIDGE);
  if (o.web) await page.addInitScript("try{delete window.Android}catch(e){}window.Android=undefined;");
  if (o.init) await page.addInitScript(o.init);
  await page.route("**/*", async route => {
    const u = new URL(route.request().url());
    if (u.hostname === "api.github.com" && o.gh) return github(route, u, o.gh);
    if (u.hostname !== "radar.local") return route.fulfill({ status: 404, body: "" });
    const q = u.searchParams, sym = q.get("symbol"), p = u.pathname, json = (b, st) => route.fulfill({ status: st || 200, contentType: "application/json", body: JSON.stringify(b) });
    if (p === "/" || p === "/index.html") return route.fulfill({ status: 200, contentType: "text/html", body: HTML });
    if (p === "/fapi/v1/exchangeInfo") return json(EXINFO);
    if (p === "/fapi/v1/ticker/24hr") return json(sym ? { symbol: sym, quoteVolume: "5e8" } : Object.keys(MARKET).map((s, i) => ({ symbol: s, quoteVolume: String(1e9 / (i + 1)) })));
    if (p === "/fapi/v1/premiumIndex") return json(sym ? { symbol: sym, lastFundingRate: "0.0001", markPrice: String(last(sym)) } : Object.keys(MARKET).map(s => ({ symbol: s, lastFundingRate: "0.0001" })));
    if (p === "/fapi/v1/klines") { const k = klines(sym, q.get("interval"), +q.get("limit") || 500, +q.get("startTime") || 0, +q.get("endTime") || 0, o.btcDown && sym === "BTCUSDT" ? BTCDOWN : o.btcJump && sym === "BTCUSDT" ? BTCJUMP : o.btcReb && sym === "BTCUSDT" ? BTCREB : null); return k ? json(k) : json({ code: -1121 }, 400); }
    if (p === "/fapi/v1/depth") return json(book(sym, (o.spread && o.spread[sym]) || 0.02));
    if (p === "/fapi/v1/ticker/price") return json({ symbol: sym, price: String(last(sym)) });
    if (p.startsWith("/futures/data/")) return json([]);
    /* market capitalisation ranks: the first ten coins and two stablecoins in level 1, APT and ARB in level 2 */
    if (p === "/cg/coins/markets") { if (o.noCap) return route.fulfill({ status: 503, body: "" }); const pg = +q.get("page") || 1; return json(pg > 1 ? [] : CAPS); }
    if (p.startsWith("/bspot/") || p.startsWith("/mexc/")) return json([]);
    return route.fulfill({ status: 503, body: "" });
  });
  if (!o.simple) await page.addInitScript(`try{localStorage.setItem("radar-vue","detail")}catch(e){}`);
  await page.goto("https://radar.local/" + (o.suffix || "") + (o.suffix || o.home ? "" : "#" + (o.at || "l1")));
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
    const fd = await page.evaluate(() => { const e = document.getElementById("fdet"); e.open = true; return { hidden: e.hidden, rows: [...e.querySelectorAll(".fdr")].map(r => r.textContent.replace(/\s+/g, " ")), txt: e.textContent }; });
    const num = k => { const r = fd.rows.find(x => x.includes(k)); return r ? parseInt(r.replace(/\s/g, ""), 10) : NaN; };
    ok(!fd.hidden && num("cryptos du Level 1") >= num("cotées sur Binance Futures") && num("cotées sur Binance Futures") >= num("en tendance sur 1 jour") && num("en tendance sur 1 jour") >= num("avec une zone d'entrée") && num("avec une zone d'entrée") >= num("près de leur zone"), "détail du scan : " + fd.rows.slice(0, 7).map(x => x.slice(0, 34)).join(" → "));
    ok(num("avec une zone d'entrée") === await page.$$eval("#view-scan button.row[data-s]", a => a.length) && (num("prêt") === 0 ? /Pourquoi les \d+ autres ne sont pas prêts/.test(fd.txt) : true), "le détail compte les mêmes setups que la liste, et dit pourquoi les autres ne sont pas prêts");
    if (SHOTS) { await page.$eval("#fdet", e => e.scrollIntoView()); await page.screenshot({ path: path.join(SHOTS, "p2-detail-scan.png") }); await page.evaluate(() => { document.getElementById("fdet").open = false; scrollTo(0, 0); }); }
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
    /* « Vérifier » on the banner of the level leads to the risk profile, now on the settings page */
    await page.waitForSelector("#prof-go", { timeout: 20000 }); await page.click("#prof-go"); await page.waitForSelector("#view-set:not([hidden])", { timeout: 10000 });
    ok(await page.isVisible("#prof-ok"), "« Vérifier » ouvre la page Réglages sur le profil de risque");
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

  await test("P7", "Alertes en arrière-plan : trades, seulement « sortir » ou liquidation proche ; entrée seulement sur « Prêt »", async ok => {
    const { ctx, page, errors } = await open(browser, { session: { keys: { binance: true }, pos: POS, ord: { SOLUSDT: [] } }, suffix: "?bg=1",
      init: `localStorage.setItem("radar-settings",JSON.stringify({atr:true,alv:"12",nt43:1,nt44:1,nt45:1,profOk:true,account:1000}));localStorage.setItem("radar-trades",${JSON.stringify(JSON.stringify([{ id: "x1", sym: "ETH", full: "ETHUSDT", dir: -1, entry: last("ETHUSDT") * 0.99, qty: 1, sl: last("ETHUSDT") * 1.03, tp: last("ETHUSDT") * 0.9, t: NOW - 5 * 36e5 }, { id: "x2", sym: "ETH", full: "ETHUSDT", dir: 1, entry: last("ETHUSDT") * 0.9, qty: 0.1, sl: last("ETHUSDT") * 0.88, tp: last("ETHUSDT") * 1.2, t: NOW - 5 * 36e5 }, { id: "x3", sym: "ZIG", full: "ZIGUSDT", dir: 1, entry: last("ZIGUSDT") * 0.9, qty: 1, sl: last("ZIGUSDT") * 0.88, tp: last("ZIGUSDT") * 1.01, t: NOW - 5 * 36e5 }, { id: "x4", sym: "LVL", full: "LVLUSDT", dir: 1, entry: last("LVLUSDT") * 0.997, qty: 1, sl: last("LVLUSDT") * 0.975, tp: last("LVLUSDT") * 1.07, t: NOW - 5 * 36e5 }, { id: "x5", sym: "ZIG", full: "ZIGUSDT", dir: 1, entry: last("ZIGUSDT") * 0.9, qty: 1, sl: last("ZIGUSDT") * 0.902, r0: last("ZIGUSDT") * 0.02, tp: last("ZIGUSDT") * 1.3, t: NOW - 5 * 36e5 }]))})` });
    await page.evaluate(() => window.bgScan(false, true));
    await page.waitForFunction(() => window.__M.done, null, { timeout: 150000 });
    const M = await page.evaluate(() => window.__M);
    const prot = M.notes.filter(n => n.ch === "protect"), set = M.notes.filter(n => n.ch === "setups");
    ok(prot.every(n => /sortir du trade|liquidation proche|feu vert break-even|potentiel au-delà de ton TP|TP à réduire|stop à remonter/.test(n.title)) && !M.notes.some(n => /stop-loss|fermé|objectif|protection/.test(n.title)), "trades : aucune notification hors « sortir », « break-even », « potentiel au-delà du TP » et « liquidation proche » (" + prot.length + " envoyée" + (prot.length > 1 ? "s" : "") + ", position sans stop comprise)");
    const ex = prot.filter(n => /ETH · short : sortir du trade/.test(n.title))[0];
    ok(ex && /^Fiabilité \d+ % · /.test(ex.text), "short contre les deux tendances : « " + (ex ? ex.title + " » · " + ex.text.slice(0, 60) : "aucune alerte »"));
    ok(!prot.some(n => /feu vert/.test(n.title) && prot.some(m => /sortir/.test(m.title) && m.tag.slice(1) === n.tag.slice(2))), "jamais « break-even » et « sortir » pour le même trade");
    const be = prot.filter(n => /ETH · long · feu vert break-even/.test(n.title))[0];
    ok(be && /break-even net de frais/.test(be.text), "long à plus de +1 R : « " + (be ? be.title : "aucune alerte") + " »");
    const tu = prot.filter(n => /ZIG · long · potentiel au-delà de ton TP/.test(n.title));
    ok(tu.length === 1 && tu[0].tag === "tpx3" && /Tu peux viser .* au lieu de/.test(tu[0].text), "long à 9 % de son objectif, tendances intactes : une alerte « potentiel au-delà de ton TP » (" + tu.length + ")");
    const td = prot.filter(n => /LVL · long · TP à réduire/.test(n.title));
    ok(td.length === 1 && /Mieux vaut viser .* au lieu de/.test(td[0].text), "long avec deux niveaux 4H avant son objectif : une alerte « TP à réduire » (" + td.length + ")");
    const sl = prot.filter(n => /ZIG · long · stop à remonter/.test(n.title));
    ok(sl.length === 1 && sl[0].tag === "slx5" && /pour verrouiller \+\d/.test(sl[0].text), "long sécurisé au break-even et monté de 5 R : une alerte « stop à remonter » (" + (sl[0] ? sl[0].text : "aucune") + ")");
    ok(M.notes.length === 0 || M.notes[0].ch === "protect", "la protection passe avant les setups");
    ok(set.every(n => /prêt à saisir · Level [12]$/.test(n.title) && !/%/.test(n.title) && /^Level [12], n°\d+ par capitalisation · \d\/6 contrôles · /.test(n.text) && /Entrée .* Stop .* TP1 /.test(n.text)), "alertes d'entrée : uniquement « prêt à saisir », avec entrée, stop et TP1 (" + set.length + (set[0] ? " · " + set[0].text.slice(0, 70) : "") + ")");
    ok(/contrôle de 1 position Binance et 5 trades suivis/.test(M.done), "résumé du contrôle : " + M.done);
    await page.reload(); await page.waitForFunction(() => document.getElementById("a-log") && !document.getElementById("a-log").hidden, null, { timeout: 15000 }).catch(() => {});
    const lg = await page.evaluate(() => ({ L: JSON.parse(localStorage.getItem("radar-bglog") || "[]"), shown: document.getElementById("a-log").hidden ? "" : document.getElementById("a-log").textContent }));
    ok(lg.L.length === 1 && lg.L[0].m === M.done && /^Levels 1 et 2 : \d+ avec une zone, \d+ à la zone/.test(lg.L[0].x) && /Derniers contrôles en arrière-plan \(1\)/.test(lg.shown) && lg.shown.includes(lg.L[0].x), "journal des contrôles, visible dans les réglages : « " + lg.L[0].x.slice(0, 110) + " »");
    const o2 = await open(browser, { init: `if(!sessionStorage.getItem("s2")){sessionStorage.setItem("s2","1");localStorage.setItem("radar-settings",JSON.stringify({atr:true,a10:false,a50:true,nt43:1,nt44:1,profOk:true,account:1000}))}` });
    const s2 = await o2.page.evaluate(() => JSON.parse(localStorage.getItem("radar-settings")));
    const lvb = await o2.page.evaluate(() => [...document.querySelectorAll("[data-alv]")].map(b => b.checked));
    ok(s2.alv === "12" && s2.a50 === false && s2.atr === true && s2.nt45 === 1 && lvb.join() === "true,true,false,false,false", "mise à jour : l'alerte du Top 50 devient Levels 1 et 2, cases cochées, les autres réglages gardés");
    const o3 = await open(browser, { init: `if(!sessionStorage.getItem("s3")){sessionStorage.setItem("s3","1");localStorage.setItem("radar-settings",JSON.stringify({atr:true,alv:"",nt43:1,nt44:1,nt45:1,profOk:true,account:1000}))}` });
    ok((await o3.page.evaluate(() => JSON.parse(localStorage.getItem("radar-settings")))).alv === "", "une fois faite, la mise à jour ne recoche plus les Levels si tu les décoches");
    await o3.ctx.close();
    await o2.ctx.close();
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
    await page.click("#back"); await page.waitForSelector("#view-home:not([hidden])");
    const tabs = await page.$$eval("#view-home .hm-l, #view-home .hm-t", a => a.map(b => b.dataset.go));
    for (const v of tabs) { await nav(page, v); await page.waitForTimeout(700); }
    await nav(page, "one"); await page.fill("#one-sym", "SOL"); await page.click("#one-form button");
    await page.waitForFunction(() => /Setup|Pas de trade/.test(document.getElementById("one-out").textContent), null, { timeout: 30000 });
    const v = await page.textContent("#one-out .verdict");
    ok(/prêt selon les règles|à surveiller|refusé|données incomplètes|Pas de trade/i.test(v), "Analyser SOL : « " + v.trim() + " »");
    let cf = await page.textContent("#one-out .cfg"), tried = ["SOL"];
    ok(/Configuration du moment/.test(cf) && /atteint le TP1|aucune configuration/.test(cf), "Analyser SOL : carte « Configuration du moment »");
    for (const s of Object.keys(MARKET).map(x => x.replace(/USDT$/, ""))) {
      if (/atteint le TP1/.test(cf)) break; if (tried.includes(s)) continue; tried.push(s);
      await page.fill("#one-sym", s); await page.click("#one-form button");
      await page.waitForFunction(() => document.querySelector("#one-out .cfg"), null, { timeout: 30000 }); cf = await page.textContent("#one-out .cfg");
    }
    ok(/\d+ %de ces setups ont atteint le TP1/.test(cf.replace(/\s+/g, "")) || /\d+ %\s*de ces setups ont atteint le TP1/.test(cf), tried[tried.length - 1] + " : " + cf.replace(/\s+/g, " ").slice(24, 170) + "…");
    if (SHOTS) { await page.$eval("#one-out .cfg", e => e.scrollIntoView()); await page.screenshot({ path: path.join(SHOTS, "p10-config.png") }); }
    ok(tabs.length === 23, tabs.length + " pages ouvertes depuis l'accueil (Global compris), plus l'analyse d'une crypto");
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" / ") : ""));
    await ctx.close();
  });

  await test("P11", "Export Excel de l'historique Binance Futures", async ok => {
    /* 24 trades on 3 contracts over 30 days, one with a second entry, the last one still open; income rows built from the same fills */
    const now = NOW + (Date.now() - T0), fills = [], inc = { REALIZED_PNL: [], COMMISSION: [], FUNDING_FEE: [] }, syms = ["SOLUSDT", "ETHUSDT", "BTCUSDT"], base = { SOLUSDT: 150, ETHUSDT: 3000, BTCUSDT: 60000 };
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
    await nav(page, "res").catch(() => {});
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

  await test("P12", "Après sortie : un trade clôturé reste simulé, sans toucher à l'historique", async ok => {
    const M = MARKET.SOLUSDT.m, at = M.length - 96 * 3, c0 = M[at], tc = c0.t, ex = c0.o;
    let lo = Infinity, hi = -Infinity; for (let i = at; i < M.length; i++) { lo = Math.min(lo, M[i].l); hi = Math.max(hi, M[i].h); }
    const d = last("SOLUSDT") >= ex ? 1 : -1, far = d > 0 ? hi : lo, back = d > 0 ? lo : hi;
    const old = { id: "a0", sym: "SOL", full: "SOLUSDT", dir: d, entry: ex * (1 - d * 0.02), qty: 10, sl: back * (1 - d * 0.1), tp: far * (1 + d * 0.1), r0: ex * 0.05, t0: tc - 864e5, tc, exit: ex, net: 12.5, src: "main", out: null, at: 0, hi: 0, lo: 0, last: 0 };
    const hit = Object.assign({}, old, { id: "a1", sl: 0, tp: ex + (far - ex) * 0.5 });
    const live = { id: "m1", sym: "ETH", full: "ETHUSDT", dir: 1, entry: last("ETHUSDT") * 0.99, qty: 0.5, sl: last("ETHUSDT") * 0.95, tp: last("ETHUSDT") * 1.08, t: NOW - 36e5 };
    const { ctx, page, errors } = await open(browser, { init: `if(!sessionStorage.getItem("seeded")){sessionStorage.setItem("seeded","1");localStorage.setItem("radar-after",${JSON.stringify(JSON.stringify([old, hit]))});localStorage.setItem("radar-trades",${JSON.stringify(JSON.stringify([live, { id: "m2", sym: "ZIG", full: "ZIGUSDT", dir: 1, entry: last("ZIGUSDT") * 0.9, qty: 1, sl: last("ZIGUSDT") * 0.88, tp: last("ZIGUSDT") * 1.01, t: NOW - 5 * 36e5 }, { id: "m3", sym: "LVL", full: "LVLUSDT", dir: 1, entry: last("LVLUSDT") * 0.997, qty: 1, sl: last("LVLUSDT") * 0.975, tp: last("LVLUSDT") * 1.07, t: NOW - 5 * 36e5 }, { id: "m4", sym: "ZIG", full: "ZIGUSDT", dir: 1, entry: last("ZIGUSDT") * 0.9, qty: 2, sl: last("ZIGUSDT") * 0.902, r0: last("ZIGUSDT") * 0.02, tp: last("ZIGUSDT") * 1.3, t: NOW - 5 * 36e5 }]))})}` });
    await nav(page, "aft");
    await page.waitForFunction(() => document.querySelectorAll("#view-aft .af").length === 2 && !/lecture…/.test(document.querySelector("#view-aft").textContent), null, { timeout: 20000 });
    const cards = await page.$$eval("#view-aft .af", a => a.map(e => e.textContent.replace(/\s+/g, " ")));
    const want = (last("SOLUSDT") - ex) * d * 10, got = await page.$eval("#view-aft .af .net", e => parseFloat(e.textContent.replace(/[^0-9,+\-−]/g, "").replace("−", "-").replace(",", ".")));
    ok(/Si tu étais resté/.test(cards[0]) && Math.abs(got - want) < 0.02, "trade gardé en cours : " + got + " $ de plus en restant (attendu " + want.toFixed(2) + ")");
    ok(/TP touché\s*sortie trop tôt/.test(cards[1]) && /objectif à .* a été atteint/.test(cards[1]), "objectif atteint après la sortie : « TP touché · sortie trop tôt »");
    await nav(page, "trades");
    await page.waitForFunction(() => /\$/.test((document.querySelector("#net-m1") || {}).textContent || ""), null, { timeout: 20000 });
    await page.waitForFunction(() => /Fiabilité \d+ % · (Sortir|Attendre)/.test((document.querySelector("#fi-m1") || {}).textContent || ""), null, { timeout: 60000 }).catch(() => {});
    const fi = await page.evaluate(() => [document.querySelector("#fi-m1").textContent, document.querySelector("#fx-m1").textContent]);
    ok(/^Fiabilité \d+ % · (Sortir|Attendre)$/.test(fi[0]) && /Sur deux ans de test, \d+ % des trades/.test(fi[1]), "étiquette du trade actif : « " + fi[0] + " »");
    await page.waitForFunction(() => /TP ↑/.test((document.querySelector("#tu-m2") || {}).textContent || ""), null, { timeout: 60000 }).catch(() => {});
    const tu = await page.evaluate(() => [document.querySelector("#tu-m2").textContent, document.querySelector("#tu-m2").hidden, document.querySelector("#tu-m1").hidden, document.querySelector("#tp-m2").textContent]);
    ok(/^Potentiel · TP ↑ /.test(tu[0]) && !tu[1] && tu[2] && /atteint 59 fois sur 100/.test(tu[3]) && /Monte d'abord ton stop/.test(tu[3]), "trade proche de son objectif : étiquette « " + tu[0] + " » avec les chiffres du test ; rien sur l'autre trade");
    await page.waitForFunction(() => /TP ↓/.test((document.querySelector("#tu-m3") || {}).textContent || ""), null, { timeout: 60000 }).catch(() => {});
    const td = await page.evaluate(() => [document.querySelector("#tu-m3").textContent, document.querySelector("#tu-m3").className, document.querySelector("#tp-m3").textContent]);
    ok(/^Prudence · TP ↓ /.test(td[0]) && / dn/.test(td[1]) && /objectif réduit 50 fois sur 100/.test(td[2]), "niveaux 4H avant l'objectif : étiquette « " + td[0] + " » avec les chiffres du test");
    await page.waitForFunction(() => /SL ↑/.test((document.querySelector("#ts-m4") || {}).textContent || ""), null, { timeout: 60000 }).catch(() => {});
    const ts = await page.evaluate(() => [document.querySelector("#ts-m4").textContent, document.querySelector("#be-m4").textContent, document.querySelector("#ts-m2").hidden, document.querySelector("#ts-m1").hidden]);
    ok(/^Sécuriser · SL ↑ /.test(ts[0]) && /Sécuriser plus/.test(ts[1]) && /\+\d,\d R verrouillés/.test(ts[1]) && ts[2] && ts[3], "trade déjà au break-even et bien avancé : étiquette « " + ts[0] + " » ; rien sur les trades pas encore au break-even");
    if (SHOTS) { await page.$eval("#ts-m4", e => e.scrollIntoView()); await page.screenshot({ path: path.join(SHOTS, "p12-trail.png") }); }
    await page.click('[data-trl="m4"]');
    await page.waitForFunction(() => document.querySelector("#ts-m4") && document.querySelector("#ts-m4").hidden, null, { timeout: 15000 }).catch(() => {});
    const m4 = await page.evaluate(() => [JSON.parse(localStorage.getItem("radar-trades")).filter(x => x.id === "m4")[0], document.querySelector("#ts-m4").hidden]);
    ok(m4[0].sl > m4[0].entry * 1.05 && m4[1], "bouton « J'ai déplacé mon stop » : stop enregistré à " + m4[0].sl.toFixed(2) + ", l'étiquette disparaît");
    if (SHOTS) { await page.$eval("#tu-m3", e => e.scrollIntoView()); await page.screenshot({ path: path.join(SHOTS, "p12-tpdn.png") }); }
    if (SHOTS) { await page.$eval("#tu-m2", e => e.scrollIntoView()); await page.screenshot({ path: path.join(SHOTS, "p12-tpup.png") }); await page.evaluate(() => scrollTo(0, 0)); }
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "p12-fiab.png") });
    const xl = await page.evaluate(() => { const e = document.getElementById("p-exlv"), t0 = document.getElementById("p-exlv-s").textContent, v0 = e.value; e.value = "0"; e.dispatchEvent(new Event("change")); const r = { v0, t0, t1: document.getElementById("p-exlv-s").textContent, saved: JSON.parse(localStorage.getItem("radar-settings")).exlv }; e.value = "2"; e.dispatchEvent(new Event("change")); return r; });
    ok(xl.v0 === "2" && /48 trades perdants sur 100/.test(xl.t0) && /coupe 22 trades gagnants/.test(xl.t0) && xl.saved === 0 && /18 trades perdants sur 100/.test(xl.t1), "réglage « Conseil de sortie » : réactif par défaut (48 stops sur 100 anticipés, 22 gagnants coupés), modifiable et enregistré");
    await page.click('[data-close="m1"]'); await page.click('[data-close="m1"]');
    const st = await page.evaluate(() => ({ t: JSON.parse(localStorage.getItem("radar-trades")), a: JSON.parse(localStorage.getItem("radar-after")) }));
    ok(st.t.length === 4 && st.t[0].closed && st.a.length === 3 && st.a[0].sym === "ETH" && st.a[0].exit === st.t[0].exit, "clôture dans Mes trades : le trade arrive dans Après sortie avec son prix de sortie");
    await nav(page, "aft");
    await page.waitForFunction(() => document.querySelectorAll("#view-aft .af").length === 3, null, { timeout: 20000 });
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "p12-apres.png"), fullPage: true });
    await page.click('[data-adel="a1"]'); await page.click('[data-adel="a1"]');
    const st2 = await page.evaluate(() => ({ t: JSON.parse(localStorage.getItem("radar-trades")), a: JSON.parse(localStorage.getItem("radar-after")) }));
    ok(st2.a.length === 2 && !st2.a.some(x => x.id === "a1") && st2.t.length === 4 && st2.t[0].closed, "suppression dans Après sortie : l'historique de Mes trades ne bouge pas");
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" / ") : ""));
    await ctx.close();
  });

  await test("P13", "Après sortie : une position Binance fermée y arrive avec son vrai prix de sortie", async ok => {
    const { ctx, page, errors } = await open(browser, { session: { keys: { binance: true }, pos: POS, ord: { SOLUSDT: [{ symbol: "SOLUSDT", side: "SELL", positionSide: "BOTH", type: "STOP_MARKET", stopPrice: "140", origQty: "0", closePosition: "true" }] } }, suffix: "#trades" });
    await nav(page, "trades").catch(() => {});
    await page.waitForSelector("#view-trades .lv", { timeout: 30000 });
    const p0 = { dir: 1, qty: 10 }, exit = +(last("SOLUSDT") * 1.004).toFixed(3);
    await page.evaluate(x => { window.__M.pos = []; window.__M.fills = [{ symbol: "SOLUSDT", id: 9, orderId: 9, time: Date.now() - 2000, side: "SELL", qty: String(x.qty), price: String(x.exit), quoteQty: "0", realizedPnl: "3.2", commission: "0.1", commissionAsset: "USDT", positionSide: "BOTH" }]; }, { qty: p0.qty, exit });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("radar-after") || "[]").length === 1, null, { timeout: 45000 });
    let a = await page.evaluate(() => JSON.parse(localStorage.getItem("radar-after") || "[]"));
    ok(a.length === 1 && a[0].sym === "SOL" && a[0].approx && a[0].src === "binance" && a[0].sl === 140 && a[0].qty === p0.qty, "position disparue : ajoutée à Après sortie avec son stop et sa taille");
    await nav(page, "aft");
    await page.waitForFunction(() => { const x = JSON.parse(localStorage.getItem("radar-after") || "[]")[0]; return x && !x.approx && x.chk; }, null, { timeout: 20000 });
    a = await page.evaluate(() => JSON.parse(localStorage.getItem("radar-after")));
    ok(Math.abs(a[0].exit - exit) < 1e-6, "prix de sortie exact lu dans les exécutions Binance : " + a[0].exit);
    ok(await page.$eval("#view-aft .af", e => /Si tu étais resté/.test(e.textContent)), "carte affichée dans l'onglet");
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" / ") : ""));
    await ctx.close();
  });

  await test("P14", "Synchronisation : téléphone et Chrome partagent les mêmes données par un dépôt GitHub privé", async ok => {
    const G = { repo: "moi/radar-sync", token: "github_pat_TESTTOKEN0123456789abcdef" }, cfg = JSON.stringify({ repo: G.repo, token: G.token, dev: "test" });
    const tr = { id: "m7", sym: "ETH", full: "ETHUSDT", dir: 1, entry: last("ETHUSDT") * 0.99, qty: 0.5, sl: last("ETHUSDT") * 0.95, tp: last("ETHUSDT") * 1.08, t: NOW - 36e5 };
    const data = () => JSON.parse(G.text).data, wait = async (f, ms) => { const t = Date.now(); while (Date.now() - t < (ms || 30000)) { try { if (G.text && f(data())) return true; } catch (e) {} await new Promise(r => setTimeout(r, 200)); } return false; };
    /* 1. the phone: Binance keys, one position with its stop, one trade followed by hand, risk set to 1.5 % */
    const ph = await open(browser, { gh: G, session: { keys: { binance: true }, pos: POS, ord: { SOLUSDT: [{ symbol: "SOLUSDT", side: "SELL", positionSide: "BOTH", type: "STOP_MARKET", stopPrice: "140", origQty: "0", closePosition: "true" }] } }, suffix: "#trades",
      init: `if(!sessionStorage.getItem("i")){sessionStorage.setItem("i","1");localStorage.setItem("radar-sync",${JSON.stringify(cfg)});localStorage.setItem("radar-settings",JSON.stringify({risk:1.5,atr:true,nt43:1,nt44:1,profOk:true,account:1000}));localStorage.setItem("radar-trades",${JSON.stringify(JSON.stringify([tr]))})}` });
    await nav(ph.page, "trades").catch(() => {});
    ok(await wait(d => d["radar-live-view"] && d["radar-live-view"].list.length === 1 && d["radar-trades"].length === 1), "téléphone : réglages, trade suivi et copie de la position envoyés dans le dépôt");
    const d1 = data();
    ok(d1["radar-settings"].risk === 1.5 && d1["radar-settings"].atr === undefined && d1["radar-live-view"].list[0].sl === 140, "réglages envoyés sans les interrupteurs d'alerte ; stop de la position dans la copie");
    ok(!/TESTTOKEN|apiKey|secret/i.test(G.text) && !("radar-sync" in d1), "ni clé API ni code d'accès dans le fichier");
    /* 2. Chrome: no bridge, no keys, same repository */
    const web = await open(browser, { gh: G, web: true, suffix: "#trades", init: `if(!sessionStorage.getItem("i")){sessionStorage.setItem("i","1");localStorage.setItem("radar-sync",${JSON.stringify(cfg)});localStorage.setItem("radar-settings",JSON.stringify({risk:2,atr:false,nt43:1,nt44:1,profOk:true,account:500}))}` });
    await web.page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem("radar-trades") || "[]").length === 1 && JSON.parse(localStorage.getItem("radar-settings")).risk === 1.5; } catch (e) { return false; } }, null, { timeout: 30000 });
    await web.page.waitForTimeout(2500); await web.page.waitForLoadState("load");
    const ws = await web.page.evaluate(() => JSON.parse(localStorage.getItem("radar-settings")));
    ok(ws.risk === 1.5 && ws.account === 1000 && ws.atr === false, "Chrome : reçoit le trade et les réglages du téléphone, garde son propre interrupteur d'alerte");
    await web.page.waitForFunction(() => document.querySelector('.tabs button[data-v="trades"]'), null, { timeout: 20000 });
    await nav(web.page, "trades");
    await web.page.waitForFunction(() => /copie de ton téléphone/.test(document.querySelector("#view-trades").textContent) && document.querySelector("#net-cpbnSOLUSDTL") && /\$/.test(document.querySelector("#net-cpbnSOLUSDTL").textContent), null, { timeout: 40000 });
    ok(true, "Chrome : position Binance affichée en copie, avec son gain en direct");
    await web.page.waitForFunction(() => /Fiabilité/.test((document.querySelector("#fi-cpbnSOLUSDTL") || {}).textContent || ""), null, { timeout: 60000 }).catch(() => {});
    ok(/Fiabilité \d+ % · (Sortir|Attendre)/.test(await web.page.textContent("#fi-cpbnSOLUSDTL")), "Chrome : étiquette de fiabilité sur la position copiée (" + await web.page.textContent("#fi-cpbnSOLUSDTL") + ")");
    if (SHOTS) await web.page.screenshot({ path: path.join(SHOTS, "p14-chrome.png"), fullPage: false });
    /* 3. a change made on Chrome comes back to the phone */
    await web.page.click('[data-del="m7"]'); await web.page.click('[data-del="m7"]');
    ok(await wait(d => d["radar-trades"].length === 0, 20000), "Chrome : trade supprimé, envoyé dans le dépôt");
    await ph.page.evaluate(() => document.getElementById("sy-now").click());
    await ph.page.waitForFunction(() => JSON.parse(localStorage.getItem("radar-trades") || "[1]").length === 0, null, { timeout: 20000 });
    const ps = await ph.page.evaluate(() => JSON.parse(localStorage.getItem("radar-settings")));
    ok(ps.atr === true && ps.risk === 1.5, "téléphone : la suppression est arrivée, ses alertes n'ont pas bougé");
    ok(G.puts <= 6, "envois limités : " + G.puts + " écritures dans le dépôt, " + G.calls + " appels");
    const er = ph.errors.concat(web.errors);
    ok(er.length === 0, "aucune erreur JavaScript" + (er.length ? " : " + er.slice(0, 3).join(" / ") : ""));
    await ph.ctx.close(); await web.ctx.close();
  });

  await test("P15", "Notification d'un trade prêt : un appui ouvre directement ce trade", async ok => {
    const { ctx, page, errors } = await open(browser, {});
    await waitScan(page);
    const mode = await page.$eval('.tabs button[aria-selected="true"]', b => b.dataset.v);
    const syms = await page.$$eval('#view-scan button.row[data-s]', a => a.map(b => b.dataset.s)), s = syms[syms.length - 1];
    ok(syms.length >= 2, syms.length + " setups dans la liste « " + mode + " » ; cible : " + s + ", le dernier");
    const opened = () => page.evaluate(x => { const b = document.querySelector('#view-scan button.row[data-s="' + x[0] + '"]'), a = b && b.closest("article"); return { sel: document.querySelector('.tabs button[data-v="' + x[1] + '"]').getAttribute("aria-selected"), vis: !document.querySelector("#view-scan").hidden, flash: !!a && a.classList.contains("flash"), exp: b ? b.getAttribute("aria-expanded") : null, box: !!a && !!a.querySelector(".stbox") }; }, [s, mode]);
    const before = await opened();
    /* 1. the app is already open on another tab: Android calls window.openTab with the notification's target */
    await nav(page, "trades");
    await page.evaluate(x => { window.__scans = 0; window.openTab(x[1] + "~" + x[0]); }, [s, mode]);
    await page.waitForFunction(x => { const b = document.querySelector('#view-scan button.row[data-s="' + x + '"]'); return b && b.closest("article").classList.contains("flash"); }, s, { timeout: 15000 }).catch(() => {});
    const a1 = await opened();
    ok(before.exp !== "true" && a1.sel === "true" && a1.vis && a1.flash && a1.exp === "true" && a1.box, "appli déjà ouverte : bon onglet, trade " + s + " déplié et mis en avant (dernier de la liste, fermé avant)");
    /* 2. the app was closed: Android opens the page with the target in the address */
    await page.evaluate(x => { location.hash = "#" + x[1] + "~" + x[0]; location.reload(); }, [s, mode]);
    await page.waitForFunction(x => { const b = document.querySelector('#view-scan button.row[data-s="' + x + '"]'); return b && b.closest("article").classList.contains("flash"); }, s, { timeout: 30000 }).catch(() => {});
    const a2 = await opened(), st = await page.evaluate(() => (document.querySelector("#status") || {}).textContent || "");
    ok(a2.sel === "true" && a2.flash && a2.exp === "true" && a2.box, "appli fermée : elle s'ouvre directement sur le trade " + s);
    ok(!/en cours|Lecture/.test(st), "le trade est affiché tel qu'il a été notifié, sans relancer de scan (" + st.trim().slice(0, 60) + ")");
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" / ") : ""));
    await ctx.close();
  });

  await test("P16", "Trade actif : stop exposé juste derrière le dernier creux, avec un stop plus sûr", async ok => {
    const m = MK("ZIGUSDT").m, L = last("ZIGUSDT"), t0 = Math.floor((NOW - 2 * 36e5) / 36e5) * 36e5;
    let lo = Infinity; m.forEach(c => { if (c.t >= t0 - 24 * 36e5 && c.t < t0) lo = Math.min(lo, c.l); });
    const tr = [{ id: "e1", sym: "ZIG", full: "ZIGUSDT", dir: 1, entry: L, qty: 10, sl: lo * 1.0005, tp: L * 1.05, t: t0 + 60e3 },
      { id: "e2", sym: "ZIG", full: "ZIGUSDT", dir: 1, entry: L, qty: 10, sl: lo * 0.95, tp: L * 1.05, t: t0 + 60e3 }];
    const { ctx, page, errors } = await open(browser, { init: `if(!sessionStorage.getItem("s")){sessionStorage.setItem("s","1");localStorage.setItem("radar-trades",${JSON.stringify(JSON.stringify(tr))})}` });
    await nav(page, "trades");
    await page.waitForFunction(() => ["e1", "e2"].every(id => /vérifié à/.test((document.querySelector("#hl-" + id) || {}).textContent || "")), null, { timeout: 60000 }).catch(() => {});
    const h = await page.evaluate(() => [document.querySelector("#hl-e1").textContent, document.querySelector("#hl-e2").textContent]);
    ok(/Stop exposé : creux récent à .*juste derrière ton stop.*Stop plus sûr : .*réduis la position à .* de moins\)/.test(h[0].replace(/\s+/g, " ")), "stop collé au dernier creux : « " + (h[0].match(/Stop exposé[^)]*\)/) || ["rien"])[0] + " »");
    ok(!/Stop exposé/.test(h[1]), "stop bien en dessous du creux : pas d'avertissement");
    if (SHOTS) { await page.$eval("#hl-e1", e => e.scrollIntoView()); await page.screenshot({ path: path.join(SHOTS, "p16-stop-expose.png") }); }
    /* a setup: the same check holds back a plan whose stop sits right behind the last 1H swing */
    const src = fs.readFileSync(path.join(__dirname, "..", "..", "app", "src", "main", "assets", "index.html"), "utf8");
    ok(/var SLSW_H=24;[\s\S]{0,6000}?function opts\(\)\{return\{[^}]*slsw:SLSW_H,slmode:"flag",reb:REB,prof:S\.prof!==false\?1:0,big:S\.prof!==false\?1:0\}\}/.test(src) && /var REB=0;/.test(src), "moteur de l'appli : stop exposé vérifié sur 24 h, setup retenu en « À surveiller »");
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" / ") : ""));
    await ctx.close();
  });

  await test("P18", "Compte qui bloque : un trade sans stop dans Mes trades, le scan le dit en haut", async ok => {
    const L = last("ETHUSDT"), tr = [{ id: "b1", sym: "ETH", full: "ETHUSDT", dir: 1, entry: L, qty: 1, sl: 0, tp: L * 1.04, t: NOW - 36e5 }];
    const { ctx, page, errors } = await open(browser, { init: `if(!sessionStorage.getItem("s")){sessionStorage.setItem("s","1");localStorage.setItem("radar-trades",${JSON.stringify(JSON.stringify(tr))})}` });
    await waitScan(page);
    const b = await page.evaluate(() => { const e = document.getElementById("acctblk"); return { hid: e.hidden, t: e.textContent, n: JSON.parse(localStorage.getItem("radar-last-l1")).results.filter(r => r.plan).length }; });
    ok(b.n > 0 && !b.hid && /Ton compte bloque les nouveaux trades/.test(b.t) && /sans stop complet/.test(b.t), "bandeau : « " + b.t.slice(0, 160) + " »");
    if (SHOTS) { await page.$eval("#acctblk", e => e.scrollIntoView()); await page.screenshot({ path: path.join(SHOTS, "p18-compte-bloque.png") }); }
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" / ") : ""));
    await ctx.close();
  });

  await test("P19", "Trade prêt sans notification : les deux sens notifiés, une alerte par setup, et sur la carte la raison", async ok => {
    /* background, with the list filter left on « Shorts »: the longs ready are notified too */
    const { ctx, page, errors } = await open(browser, { suffix: "?bg=1",
      init: `localStorage.setItem("radar-settings",JSON.stringify({alv:"12",side:"short",longs:true,amin:30,strict:0,nt43:1,nt44:1,nt45:1,profOk:true,account:1000}))` });
    await page.evaluate(() => window.bgScan(false, true));
    await page.waitForFunction(() => window.__M.done, null, { timeout: 150000 });
    const r1 = await page.evaluate(() => ({ notes: window.__M.notes.filter(n => n.ch === "setups" && /prêt à saisir/.test(n.title)).map(n => n.title.replace(/^(\S+) · (Long|Short) .*$/, "$1:$2")),
      ready: JSON.parse(localStorage.getItem("radar-last-l12")).results.filter(r => r.st === "ready").map(r => r.sym + ":" + (r.dir > 0 ? "Long" : "Short")),
      al: JSON.parse(localStorage.getItem("radar-alerted") || "{}"), set: JSON.parse(localStorage.getItem("radar-settings")) }));
    ok(r1.ready.length > 0 && r1.ready.some(x => /Long$/.test(x)) && r1.ready.every(x => r1.notes.includes(x)), "filtre de la liste sur « Shorts » : chaque setup prêt notifié, longs compris (" + r1.ready.join(", ") + " · notifiés " + r1.notes.join(", ") + ")");
    ok(Object.values(r1.al).every(v => v && v.t > 0 && v.s > 0), "chaque alerte gardée avec l'heure du setup");
    const raw = await page.evaluate(() => window.__M.notes.filter(n => n.ch === "setups" && /prêt à saisir/.test(n.title)).map(n => n.title + " | " + n.text.slice(0, 60)));
    ok(raw.length > 0 && raw.every(t => /prêt à saisir · Level [1-5] \| Level [1-5], n°\d+ par capitalisation · /.test(t)), "notification avec le Level et le rang : « " + (raw[0] || "") + " »");
    ok(r1.set.amin === 15 && r1.set.nt46 === 1, "contrôle toutes les 30 min laissé par défaut : passe à 15 min (" + r1.set.amin + ")");
    await page.evaluate(() => { window.__M.notes = []; window.__M.done = null; window.bgScan(false, true); });
    await page.waitForFunction(() => window.__M.done, null, { timeout: 150000 });
    const n2 = await page.evaluate(() => window.__M.notes.filter(n => n.ch === "setups" && /prêt à saisir/.test(n.title)).length);
    ok(n2 === 0, "contrôle suivant, mêmes setups : aucune nouvelle notification (" + n2 + ")");
    /* a setup gone more than 2 hours and back is a new one: notified again */
    await page.evaluate(() => { const M = JSON.parse(localStorage.getItem("radar-seen")); for (const k in M) { M[k].t -= 5 * 36e5; M[k].l -= 3 * 36e5; } localStorage.setItem("radar-seen", JSON.stringify(M)); window.__M.notes = []; window.__M.done = null; window.bgScan(false, true); });
    await page.waitForFunction(() => window.__M.done, null, { timeout: 150000 });
    const n3 = await page.evaluate(() => window.__M.notes.filter(n => n.ch === "setups" && /prêt à saisir/.test(n.title)).length);
    ok(n3 === r1.ready.length, "setup revenu après plus de 2 heures : notifié de nouveau (" + n3 + ")");
    await ctx.close();
    /* in the app: the ready card says whether it was notified, or why not */
    const o2 = await open(browser, { session: { next: NOW + 9 * 60e3 }, init: `if(!sessionStorage.getItem("s")){sessionStorage.setItem("s","1");localStorage.setItem("radar-settings",JSON.stringify({alv:"2",strict:0,longs:true,nt43:1,nt44:1,nt45:1,nt46:1,profOk:true,account:1000}))}` });
    await waitScan(o2.page);
    const lc = await o2.page.$$eval("#view-scan .card .lvc", a => a.map(e => e.textContent));
    ok(lc.length > 0 && lc.every(t => /^Level 1 · n°\d+$/.test(t)), "cartes du Level 1 : « " + lc.slice(0, 3).join(" », « ") + " »");
    const c1 = await o2.page.$$eval("#view-scan .alinfo", a => a.map(e => e.textContent));
    ok(c1.length > 0 && c1.every(t => /Pas de notification : le Level 1 n'est pas surveillé en arrière-plan\s*Surveiller le Level 1/.test(t)), "Level 1 non surveillé : « " + (c1[0] || "rien") + " »");
    if (SHOTS) { await o2.page.$eval("#view-scan .alinfo", e => e.closest(".stbox").scrollIntoView()); await o2.page.screenshot({ path: path.join(SHOTS, "p19-pas-surveille.png") }); }
    await o2.page.click("#view-scan .alinfo [data-watchlv]");
    const c2 = await o2.page.evaluate(() => ({ alv: JSON.parse(localStorage.getItem("radar-settings")).alv, w: window.__M.watch, t: [...document.querySelectorAll("#view-scan .alinfo")].map(e => e.textContent) }));
    ok(c2.alv === "12" && c2.w && c2.w.on === true && c2.t.every(x => /Pas encore vu par la surveillance en arrière-plan : prochain contrôle à \d\d:\d\d/.test(x)), "un appui : Level 1 surveillé, carte « " + (c2.t[0] || "") + " »");
    await o2.page.evaluate(() => { const al = {}; JSON.parse(localStorage.getItem("radar-last-l1")).results.filter(r => r.st === "ready").forEach(r => { al[r.sym + (r.dir > 0 ? "L" : "S") + "r"] = { t: Date.now() - 600e3, s: r.seen }; }); localStorage.setItem("radar-alerted", JSON.stringify(al)); });
    await o2.page.reload(); await waitScan(o2.page);
    const c3 = await o2.page.$$eval("#view-scan .alinfo", a => a.map(e => e.textContent));
    ok(c3.length > 0 && c3.every(t => /^Notification envoyée à \d\d:\d\d$/.test(t)), "setup déjà notifié : « " + (c3[0] || "rien") + " »");
    if (SHOTS) { await o2.page.$eval("#view-scan .alinfo", e => e.closest(".stbox").scrollIntoView()); await o2.page.screenshot({ path: path.join(SHOTS, "p19-notifie.png") }); }
    ok(errors.length === 0 && o2.errors.length === 0, "aucune erreur JavaScript" + (errors.concat(o2.errors).length ? " : " + errors.concat(o2.errors).slice(0, 3).join(" / ") : ""));
    await o2.ctx.close();
  });

  await test("P20", "Longs ou shorts en pause : la ligne du marché dit quel côté Bitcoin bloque", async ok => {
    const { ctx, page, errors } = await open(browser, { init: `if(!sessionStorage.getItem("s")){sessionStorage.setItem("s","1");localStorage.setItem("radar-settings",JSON.stringify({alv:"12",longs:true,nt43:1,nt44:1,nt45:1,nt46:1,profOk:true,account:1000}))}` });
    await waitScan(page);
    const x = await page.evaluate(() => { const r = JSON.parse(localStorage.getItem("radar-last-l1")).results.find(r => r.f && r.dir && r.f.btc4 !== null && r.f.btc4 !== undefined);
      const rb = r && r.f.btcReb !== null && r.f.btcReb !== undefined ? r.f.btcReb : null;
      return { b: r ? r.f.btc4 * r.dir : null, s: r && r.f.btcSh !== null ? r.f.btcSh * r.dir : null, u: rb !== null && r.dir < 0 ? rb : null, d: rb !== null && r.dir > 0 ? -rb : null, t: document.getElementById("mkt-line").textContent }; });
    const noL = x.b < 0 || (x.s !== null && x.s <= -1.5), noS = x.b > 0 || (x.s !== null && x.s >= 1.5);
    const want = noL && noS ? /Longs et shorts en pause/ : noL ? /Longs en pause : Bitcoin (baisse sur 4H|a perdu|a reculé de \d+,\d % depuis son plus haut de 72 h)/ : noS ? /Shorts en pause : Bitcoin (monte sur 4H|a pris|a rebondi de \d+,\d % depuis son plus bas de 72 h)/ : null;
    ok(x.b !== null && (want ? want.test(x.t) : !/en pause/.test(x.t)), "Bitcoin 4H " + x.b + ", " + (x.s === null ? "?" : x.s.toFixed(2)) + " % en 4 h : « " + ((x.t.match(/(Longs|Shorts)[^›]*/) || ["rien en pause"])[0]).trim() + " »");
    await ctx.close();
    /* Bitcoin falling for four days: the line says the longs are on hold, and no long is ready */
    const o2 = await open(browser, { btcDown: true, init: `if(!sessionStorage.getItem("s")){sessionStorage.setItem("s","1");localStorage.setItem("radar-settings",JSON.stringify({alv:"12",longs:true,nt43:1,nt44:1,nt45:1,nt46:1,profOk:true,account:1000}))}` });
    await waitScan(o2.page);
    const y = await o2.page.evaluate(() => { const R = JSON.parse(localStorage.getItem("radar-last-l1")).results, r = R.find(r => r.f && r.dir && r.f.btc4 !== null && r.f.btc4 !== undefined);
      return { b: r ? r.f.btc4 * r.dir : null, t: document.getElementById("mkt-line").textContent, longsReady: R.filter(r => r.dir > 0 && r.st === "ready" && r.sym !== "BTC").length,
        longsMkt: R.filter(r => r.dir > 0 && r.plan && r.sym !== "BTC").map(r => r.sym + ":" + (r.gates ? (r.gates.find(g => g.k === "mkt") || {}).ok : "?")) }; });
    ok(y.b === -1 && /Longs en pause : Bitcoin baisse sur 4H/.test(y.t), "Bitcoin en baisse sur 4H : « " + ((y.t.match(/(Longs|Shorts)[^›]*/) || ["rien"])[0]).trim() + " »");
    ok(y.longsReady === 0 && y.longsMkt.length > 0 && y.longsMkt.every(x => /:false$/.test(x)), "réglage par défaut : aucun long prêt tant que Bitcoin baisse, contrôle « Marché » raté par chaque long (" + y.longsMkt.join(", ") + ")");
    if (SHOTS) { await o2.page.$eval("#mkt-line", e => e.scrollIntoView()); await o2.page.screenshot({ path: path.join(SHOTS, "p20-longs-en-pause.png") }); }
    /* Bitcoin rebounding 15 % in a day: no pause any more (« ne bloque rien du tout », 23/11/2026), no short holds the rebound reason */
    const o3 = await open(browser, { btcReb: true, init: `if(!sessionStorage.getItem("s")){sessionStorage.setItem("s","1");localStorage.setItem("radar-settings",JSON.stringify({alv:"12",strict:0,nt43:1,nt44:1,nt45:1,nt46:1,profOk:true,account:1000}))}` });
    await waitScan(o3.page);
    const z = await o3.page.evaluate(() => { const R = JSON.parse(localStorage.getItem("radar-last-l1")).results, sh = R.filter(r => r.dir < 0 && r.plan && r.sym !== "BTC");
      return { n: sh.length, why: sh.filter(r => (r.gates || []).some(g => (g.items || []).some(i => /a rebondi de/.test(i.t)))).length, t: document.getElementById("mkt-line").textContent }; });
    ok(z.n > 0 && z.why === 0 && !/a rebondi de/.test(z.t), "Bitcoin +15 % en un jour : " + z.n + " short(s) analysés, aucun mis en pause pour le rebond");
    await o3.ctx.close();
    ok(errors.length === 0 && o2.errors.length === 0, "aucune erreur JavaScript" + (errors.concat(o2.errors).length ? " : " + errors.concat(o2.errors).slice(0, 3).join(" / ") : ""));
    await o2.ctx.close();
  });

  await test("P21", "Accueil et vue simple : pages en un appui, cryptos en vert, orange ou rouge, détail à la demande", async ok => {
    const set = `if(!sessionStorage.getItem("s")){sessionStorage.setItem("s","1");localStorage.setItem("radar-settings",JSON.stringify({alv:"12",strict:0,longs:true,nt43:1,nt44:1,nt45:1,nt46:1,profOk:true,account:1000}))}`;
    const { ctx, page, errors } = await open(browser, { home: true, simple: true, init: set });
    await page.waitForSelector("#view-home:not([hidden])", { timeout: 15000 });
    const h = await page.evaluate(() => ({ title: document.getElementById("title").textContent, back: document.getElementById("back").hidden, scanHidden: document.getElementById("view-scan").hidden,
      lv: [...document.querySelectorAll("#hm-lv .hm-l")].map(b => b.dataset.go + ":" + b.querySelector("b").textContent), tiles: [...document.querySelectorAll("#view-home .hm-t")].map(b => b.dataset.go), tabsShown: !document.querySelector(".tabs").hidden }));
    ok(h.title === "Radar Trades" && h.back && h.scanHidden && !h.tabsShown, "l'appli s'ouvre sur l'accueil, sans la barre d'onglets");
    ok(h.lv.join() === "l12345:Global,l1:Level 1,l2:Level 2,l3:Level 3,l4:Level 4,l5:Level 5" && h.tiles.length === 17, "accueil : Global, 5 Levels et " + h.tiles.length + " pages (" + h.tiles.join(", ") + ")");
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "p21-accueil.png") });
    /* a level: the cryptos in colour */
    await page.click('#hm-lv [data-go="l1"]'); await waitScan(page);
    await page.waitForFunction(() => document.querySelectorAll("#sgrid .sg").length > 0, null, { timeout: 30000 });
    const g = await page.evaluate(() => { const R = JSON.parse(localStorage.getItem("radar-last-l1")).results, col = r => r.plan && r.st === "ready" ? "g" : r.plan && (r.st === "watch" || r.st === "incomplete") ? "o" : "r";
      const tiles = [...document.querySelectorAll("#sgrid .sg")].map(b => ({ s: b.dataset.sg, c: ["g", "o", "r"].find(c => b.classList.contains("k" + c)) }));
      return { title: document.getElementById("title").textContent, back: !document.getElementById("back").hidden, detHidden: document.getElementById("vdet").hidden, tiles, want: Object.fromEntries(R.map(r => [r.sym, col(r)])), leg: document.getElementById("sleg").textContent }; });
    const okCol = g.tiles.length === Object.keys(g.want).length && g.tiles.every(x => g.want[x.s] === x.c), cnt = c => g.tiles.filter(x => x.c === c).length;
    ok(g.title === "Level 1" && g.back && g.detHidden, "Level 1 : titre, retour vers l'accueil, listes détaillées masquées");
    ok(okCol && cnt("g") > 0, "chaque crypto dans sa couleur : " + cnt("g") + " vert, " + cnt("o") + " orange, " + cnt("r") + " rouge (" + g.tiles.map(x => x.s + ":" + x.c).join(" ") + ")");
    ok(g.tiles.map(x => x.c).join("") === g.tiles.map(x => x.c).sort((a, b) => "gor".indexOf(a) - "gor".indexOf(b)).join(""), "verts d'abord, puis orange, puis rouge");
    ok(new RegExp("^" + cnt("g") + "Prêts?" + cnt("o") + "En cours" + cnt("r") + "Pas de trade$").test(g.leg), "légende : « " + g.leg + " »");
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "p21-level.png") });
    /* one crypto: a few words, then the detail on demand */
    const green = g.tiles.find(x => x.c === "g").s;
    await page.click('#sgrid [data-sg="' + green + '"]');
    const b = await page.evaluate(() => { const e = document.querySelector("#spick .brief"); return e && { cls: e.className, t: e.textContent, card: !!document.querySelector("#spick article.card") }; });
    ok(b && /brief kg/.test(b.cls) && new RegExp("^" + green).test(b.t) && /Prêt/.test(b.t) && /Entrée .*Stop .*TP1 /.test(b.t) && !b.card, green + " : « " + (b ? b.t.replace(/\s+/g, " ").slice(0, 110) : "rien") + " »");
    if (SHOTS) { await page.$eval("#spick", e => e.scrollIntoView()); await page.screenshot({ path: path.join(SHOTS, "p21-resume.png") }); }
    await page.click('#spick [data-det="scan"]');
    const d = await page.evaluate(() => ({ card: !!document.querySelector("#spick article.card .detail"), cv: !!document.querySelector("#spick canvas#cv") }));
    ok(d.card && d.cv, "« Voir le détail » : la carte complète, graphique compris");
    const red = g.tiles.find(x => x.c === "r");
    if (red) { await page.click('#sgrid [data-sg="' + red.s + '"]'); const t = await page.textContent("#spick .brief");
      ok(/Pas de trade/.test(t) && !/Entrée /.test(t), red.s + " en rouge : « " + t.replace(/\s+/g, " ").slice(0, 100) + " »"); }
    /* back: the header button, and Android's back key (history) */
    await page.click("#back"); await page.waitForSelector("#view-home:not([hidden])");
    const c1 = await page.$eval('#hm-lv [data-go="l1"] .hm-c', e => [...e.querySelectorAll("i")].map(i => i.className + i.textContent).join(" "));
    ok(c1 === "kg" + cnt("g") + " ko" + cnt("o") + " kr" + cnt("r"), "accueil : le Level 1 affiche ses comptes (" + c1 + ")");
    await nav(page, "trades"); await page.goBack(); await page.waitForSelector("#view-home:not([hidden])", { timeout: 5000 }).catch(() => {});
    ok(await page.isVisible("#view-home"), "touche retour d'Android (historique) : retour à l'accueil");
    /* the Analyser from the home page: the short answer, the detail on demand */
    await page.fill("#hm-sym", "SUI"); await page.click("#hm-one button");
    await page.waitForFunction(() => document.querySelector("#one-out .brief"), null, { timeout: 30000 });
    const o = await page.evaluate(() => ({ title: document.getElementById("title").textContent, t: document.querySelector("#one-out .brief").textContent, verdict: !!document.querySelector("#one-out .verdict") }));
    ok(o.title === "Analyser" && /^SUI/.test(o.t) && /Prêt|En cours|Pas de trade/.test(o.t) && !o.verdict, "Analyser depuis l'accueil : « " + o.t.replace(/\s+/g, " ").slice(0, 90) + " »");
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "p21-analyser.png") });
    await page.click('#one-out [data-det="one"]');
    ok(await page.isVisible("#one-out .verdict"), "« Voir le détail » : l'analyse complète");
    /* « Vue détaillée » brings the old lists back; the switch sits at the top, above the grid (24/11/2026) */
    await nav(page, "l1");
    const sw = await page.evaluate(() => ({ seg: document.getElementById("vseg").getBoundingClientRect().top, grid: document.getElementById("sgrid").getBoundingClientRect().top, on: (document.querySelector('#vseg [aria-pressed="true"]') || {}).textContent }));
    ok(sw.seg < sw.grid && sw.on === "Vue simple", "le choix « Vue simple · Vue détaillée » est en haut, au-dessus de la grille (" + Math.round(sw.seg) + " px)");
    await page.click('#vseg [data-vue="detail"]');
    ok(await page.isVisible("#top article.card") && !(await page.isVisible("#sgrid")), "« Vue détaillée » : les listes complètes reviennent");
    await page.click('#vseg [data-vue="simple"]');
    ok(await page.isVisible("#sgrid .sg"), "« Vue simple » : retour à la grille");
    /* Global: Levels 1 to 5 in one page */
    await nav(page, "l12345");
    await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem("radar-last-l12345")).results.length > 0; } catch (e) { return false; } }, null, { timeout: 60000 });
    const gl = await page.evaluate(() => ({ title: document.getElementById("title").textContent, lv: [...new Set(JSON.parse(localStorage.getItem("radar-last-l12345")).results.map(r => r.cap <= 30 ? 1 : r.cap <= 60 ? 2 : r.cap <= 200 ? 3 : r.cap <= 400 ? 4 : 5))].sort(), tiles: document.querySelectorAll("#sgrid .sg").length, pressed: (document.querySelector('#lvseg [aria-pressed="true"]') || {}).textContent }));
    ok(gl.title === "Global" && gl.pressed === "Global" && gl.lv.length >= 2 && gl.tiles > 0, "Global : " + gl.tiles + " cryptos des Levels " + gl.lv.join(", ") + " sur une seule page");
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" / ") : ""));
    await ctx.close();
    /* a notification in the simple view: its crypto opens below the grid, the home page one step back */
    const n = await open(browser, { simple: true, at: "l1~" + green, init: set });
    await n.page.waitForFunction(() => document.querySelector("#spick .brief"), null, { timeout: 40000 });
    const nb = await n.page.evaluate(() => ({ t: document.querySelector("#spick .brief b").textContent, pressed: (document.querySelector('#sgrid [aria-pressed="true"]') || {}).dataset }));
    ok(nb.t === green, "notification sur " + green + " : son résumé s'ouvre sous la grille");
    await n.page.goBack(); await n.page.waitForSelector("#view-home:not([hidden])", { timeout: 5000 }).catch(() => {});
    ok(await n.page.isVisible("#view-home"), "retour depuis la notification : l'accueil");
    ok(n.errors.length === 0, "aucune erreur JavaScript" + (n.errors.length ? " : " + n.errors.slice(0, 3).join(" / ") : ""));
    await n.ctx.close();
  });

  await test("P22", "Mouvement brutal de Bitcoin : une notification pour regarder le marché, une seule, et réglable", async ok => {
    const set = (x) => `localStorage.setItem("radar-settings",JSON.stringify(Object.assign({alv:"12",atr:true,nt43:1,nt44:1,nt45:1,nt46:1,profOk:true,account:1000},${JSON.stringify(x || {})})))`;
    const { ctx, page, errors } = await open(browser, { suffix: "?bg=1", btcJump: true, init: set() });
    const run = async () => { await page.evaluate(() => { window.__M.notes = []; window.__M.done = null; window.bgScan(false, true); }); await page.waitForFunction(() => window.__M.done, null, { timeout: 150000 });
      return page.evaluate(() => window.__M.notes.filter(n => n.tag === "brutal")); };
    const n1 = await run();
    ok(n1.length === 1 && /^Bitcoin \+4,2 % en 15 min · mouvement brutal$/.test(n1[0].title) && /Volume ×\d+ la normale/.test(n1[0].text) && /pas un trade proposé/.test(n1[0].text) && n1[0].tab === "mkt",
      "notification : « " + (n1[0] ? n1[0].title + " » · « " + n1[0].text : "aucune") + " »");
    const log = await page.evaluate(() => (JSON.parse(localStorage.getItem("radar-bglog") || "[]")[0] || {}));
    ok(/Bitcoin \+4,2 % en 15 min/.test(JSON.stringify(log)), "le journal des contrôles le note");
    const n2 = await run();
    ok(n2.length === 0, "contrôle suivant : pas de deuxième notification (" + n2.length + ")");
    await ctx.close();
    const o2 = await open(browser, { suffix: "?bg=1", btcJump: true, init: set({ abrut: false }) });
    await o2.page.evaluate(() => window.bgScan(false, true)); await o2.page.waitForFunction(() => window.__M.done, null, { timeout: 150000 });
    const n3 = await o2.page.evaluate(() => window.__M.notes.filter(n => n.tag === "brutal").length);
    ok(n3 === 0, "réglage coupé : aucune notification");
    const o3 = await open(browser, { suffix: "?bg=1", init: set() });
    await o3.page.evaluate(() => window.bgScan(false, true)); await o3.page.waitForFunction(() => window.__M.done, null, { timeout: 150000 });
    const n4 = await o3.page.evaluate(() => window.__M.notes.filter(n => n.tag === "brutal").length);
    ok(n4 === 0, "marché normal : aucune notification");
    ok(errors.length + o2.errors.length + o3.errors.length === 0, "aucune erreur JavaScript");
    await o2.ctx.close(); await o3.ctx.close();
  });

  await test("P23", "Profils gagnants : « Prêt » seulement pour un long en marché agité ou un short quand Bitcoin baisse de 0 à 1 % sur 4 h, les deux sens analysés", async ok => {
    const { ctx, page, errors } = await open(browser, { init: `if(!sessionStorage.getItem("s")){sessionStorage.setItem("s","1");localStorage.setItem("radar-settings",JSON.stringify({alv:"12",strict:0,nt43:1,nt44:1,nt45:1,nt46:1,profOk:true,account:1000}))}` });
    await waitScan(page);
    const read = () => page.evaluate(() => { const R = JSON.parse(localStorage.getItem("radar-last-l1")).results.filter(r => r.plan && r.st0);
      const held = R.filter(r => (r.blk || []).some(b => b.k === "prof"));
      return { n: R.length, longs: R.filter(r => r.dir > 0).length, shorts: R.filter(r => r.dir < 0).length, ready: R.filter(r => r.st === "ready").length,
        readyOff: R.filter(r => r.st === "ready" && r.prof !== 1).length, held: held.length,
        heldReady: held.filter(r => r.st === "ready").length, heldWhy: held.filter(r => (r.blk || []).some(b => b.k === "prof" && /^Profil sans avantage : sur deux ans, les (longs n'ont gagné que dans un marché agité|shorts ont gagné quand Bitcoin baissait de 0 à 1 % sur 4 h)/.test(b.t))).length,
        win: R.filter(r => r.prof === 1 && (r.gates || []).some(g => g.k === "mkt" && (g.items || []).some(i => /^Profil gagnant : /.test(i.t)))).length,
        prof1: R.filter(r => r.prof === 1).length, set: JSON.parse(localStorage.getItem("radar-settings")).prof }; });
    const a = await read();
    ok(a.longs > 0 && a.shorts > 0, "les deux sens analysés : " + a.longs + " long(s), " + a.shorts + " short(s)");
    ok(a.readyOff === 0 && a.heldReady === 0 && a.held === a.heldWhy, "aucun « Prêt » hors profil gagnant ; " + a.held + " setup(s) gardés « À surveiller » avec la raison ; " + a.ready + " prêt(s)");
    ok(a.win === a.prof1, "chaque profil gagnant le dit sur sa carte (" + a.win + "/" + a.prof1 + ")");
    await nav(page, "set");
    await page.evaluate(() => { document.getElementById("prec").open = true; });
    const c = await page.$eval("#p-prof", e => ({ on: e.checked, t: e.closest("label").textContent }));
    ok(c.on && /profils gagnants sur deux ans/.test(c.t), "Réglages › Précision : « " + c.t.trim().slice(0, 90) + "… » coché par défaut");
    await page.click("#p-prof");
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("radar-settings")).prof === false, null, { timeout: 10000 });
    const b = await read();
    ok(b.held === 0 && b.ready >= a.ready, "décoché : plus aucun setup retenu pour son profil (" + b.ready + " prêt(s))");
    if (SHOTS) { await page.$eval("#p-prof", e => e.scrollIntoView()); await page.screenshot({ path: path.join(SHOTS, "p23-profils.png") }); }
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" / ") : ""));
    await ctx.close();
  });

  await test("P24", "Annonce forte (CPI, PCE, Fed) dans moins de 24 h : bandeau et moitié de taille conseillée, rien n'est bloqué", async ok => {
    const { ctx, page, errors } = await open(browser, { init: `if(!sessionStorage.getItem("s")){sessionStorage.setItem("s","1");localStorage.setItem("radar-settings",JSON.stringify({alv:"12",nt43:1,nt44:1,nt45:1,nt46:1,profOk:true,account:1000}))}` });
    await waitScan(page);
    const a = await page.evaluate(() => ({ hidden: document.getElementById("annbox").hidden, pce: radarAnn.soon(Date.parse("2026-11-24T20:00:00Z")), none: radarAnn.soon(Date.parse("2026-11-19T16:50:00Z")) }));
    ok(a.hidden && a.none === null, "le 19/11 : aucune annonce dans les 24 h, pas de bandeau");
    ok(a.pce && a.pce.k === "PCE" && Math.abs(a.pce.h - 17.5) < 0.01, "le 24/11 à 20:00 UTC : PCE du 25/11 à 13:30 UTC dans 17,5 h");
    const b = await page.evaluate(() => { const rd = () => JSON.parse(localStorage.getItem("radar-last-l1")).results.filter(r => r.st === "ready").length, ready0 = rd();
      radarAnn.list.unshift([new Date(Date.now() + 5 * 36e5).toISOString(), "CPI"]); radarAnn.box();
      return { t: document.getElementById("annbox").textContent, hidden: document.getElementById("annbox").hidden, ready0, ready1: rd() }; });
    ok(!b.hidden && /^Inflation US \(CPI\) aujourd'hui à \d\d:\d\d · annonce forte dans 5 h : moitié de taille conseillée sur les nouveaux trades/.test(b.t), "bandeau : « " + b.t + " »");
    ok(b.ready1 === b.ready0, "aucun trade retiré : " + b.ready1 + " prêt(s) avant et après");
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "p24-annonce.png") });
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" / ") : ""));
    await ctx.close();
  });

  await test("P25", "Suivi : chaque trade « Prêt » enregistré, joué sur les vrais prix avec son stop et son TP1, bilan en R", async ok => {
    const { ctx, page, errors } = await open(browser, { init: `if(!sessionStorage.getItem("s")){sessionStorage.setItem("s","1");localStorage.setItem("radar-settings",JSON.stringify({alv:"12",strict:0,prof:false,nt43:1,nt44:1,nt45:1,nt46:1,profOk:true,account:1000}))}` });
    await waitScan(page);
    const a = await page.evaluate(() => ({ ready: JSON.parse(localStorage.getItem("radar-last-l1")).results.filter(r => r.st === "ready").map(r => r.sym + (r.dir > 0 ? "L" : "S")),
      trk: JSON.parse(localStorage.getItem("radar-track") || "[]").map(x => x.sym + (x.dir > 0 ? "L" : "S")) }));
    ok(a.ready.length > 0 && a.ready.every(k => a.trk.includes(k)), "chaque setup prêt est enregistré (" + a.trk.join(", ") + ")");
    const p = await page.evaluate(() => { const x = { t: 0, dir: -1, e: 100, sl: 102, tp: 96 }, c = (t, o, h, l, cl) => ({ t, o, h, l, c: cl });
      return { tp: radarTrk.play(x, [c(0, 100, 101, 99, 99.5), c(9e5, 99.5, 100, 95.5, 96)]), sl: radarTrk.play(x, [c(0, 100, 102.5, 95, 96)]), run: radarTrk.play(x, [c(0, 100, 101, 98, 99)]) }; });
    ok(p.tp.k === "tp" && Math.abs(p.tp.r - (2 - 0.12 * 100 / 2 / 100)) < 0.01 && p.sl.k === "sl" && p.run.k === "run" && Math.abs(p.run.r - 0.44) < 0.01,
      "un short à 100, stop 102, TP 96 : TP = " + p.tp.r.toFixed(2) + " R ; bougie qui touche les deux = stop ; en cours = " + p.run.r.toFixed(2) + " R");
    await nav(page, "trk");
    await page.waitForFunction(() => document.querySelectorAll("#view-trk .trk-r").length > 0 && !/à lire/.test(document.getElementById("view-trk").textContent), null, { timeout: 30000 });
    const v = await page.evaluate(() => ({ t: document.getElementById("title").textContent, rows: document.querySelectorAll("#view-trk .trk-r").length, top: document.querySelector("#view-trk .funnel").textContent }));
    ok(v.t === "Suivi" && v.rows === a.trk.length && /terminés/.test(v.top) && /total/.test(v.top), "page Suivi : " + v.rows + " ligne(s) · « " + v.top + " »");
    const u = await page.evaluate(() => ({ line: document.querySelector("#view-trk .trk-u").textContent, b: JSON.parse(localStorage.getItem("radar-track"))[0].b }));
    ok(/^taille [\d\s\u202f,]+ \$ · risque [\d\s\u202f,]+ \$$/.test(u.line) && u.b > 0, "montants en USDT : « " + u.line + " » (risque enregistré " + u.b + " $)");
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "p25-suivi.png") });
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" / ") : ""));
    await ctx.close();
  });

  await test("P17", "Mise à jour du 17/11 : Levels, heure de la reco, périodes, cycle, temporalité, exposition, après sortie, actus, capital", async ok => {
    const L = last("ETHUSDT"), A = last("SOLUSDT");
    const tr = [{ id: "x1", sym: "ETH", full: "ETHUSDT", dir: 1, entry: L, qty: 1, sl: L * 0.98, tp: L * 1.04, t: NOW - 36e5 }, { id: "x2", sym: "SOL", full: "SOLUSDT", dir: -1, entry: A, qty: 10, sl: A * 1.02, tp: A * 0.95, t: NOW - 36e5 }];
    const m = MARKET.SOLUSDT.m, at = m.length - 96 * 2, ex = m[at].o;
    const af = [{ id: "s1", sym: "SOL", full: "SOLUSDT", dir: 1, entry: ex * 1.02, qty: 1, sl: ex, tp: ex * 1.5, r0: ex * 0.02, tc: m[at].t, exit: ex, net: -2, src: "main", out: null, at: 0, hi: 0, lo: 0, last: 0 }];
    const { ctx, page, errors } = await open(browser, { init: `if(!sessionStorage.getItem("s")){sessionStorage.setItem("s","1");localStorage.setItem("radar-trades",${JSON.stringify(JSON.stringify(tr))});localStorage.setItem("radar-after",${JSON.stringify(JSON.stringify(af))});localStorage.setItem("radar-settings",JSON.stringify({account:1000,fee:0.05,profOk:true,nt45:1}))}` });
    const tabs = await page.$$eval("#lvseg button", a => a.map(b => b.textContent));
    ok(tabs.join() === "Global,Level 1,Level 2,Level 3,Level 4,Level 5", "onglets du scanner : " + tabs.join(" · "));
    await waitScan(page);
    const l1 = await page.evaluate(() => ({ syms: JSON.parse(localStorage.getItem("radar-last-l1")).results.map(r => r.sym), caps: JSON.parse(localStorage.getItem("radar-last-l1")).results.map(r => r.cap), fd: (() => { const e = document.getElementById("fdet"); e.open = true; return e.textContent.replace(/\s+/g, " "); })() }));
    ok(l1.syms.length === 10 && l1.caps.every(c => c >= 1 && c <= 30) && !l1.syms.includes("APT"), "Level 1 : les 10 cryptos cotées parmi les 30 premières capitalisations (" + l1.syms.join(", ") + ")");
    ok(/12\s*cryptos du Level 1/.test(l1.fd) && /10\s*cotées sur Binance Futures/.test(l1.fd) && /2 sans contrat USDT perpétuel, ou stablecoins/.test(l1.fd), "détail du scan : 12 dans le Level, 10 cotées, 2 stablecoins écartés");
    const when = await page.$$eval("#view-scan .tags .when", a => a.map(e => e.textContent));
    ok(when.length > 0 && when.every(t => /^(reco|prêt) à \d\d:\d\d$/.test(t)), "heure de la reco sur chaque setup : « " + when[0] + " »");
    await nav(page, "l2"); await waitScan(page);
    const l2 = await page.evaluate(() => JSON.parse(localStorage.getItem("radar-last-l2")).results.map(r => r.sym + ":" + r.cap).sort());
    ok(l2.join() === "APT:45,ARB:52", "Level 2 (31e à 60e) : " + l2.join(", "));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "p17-level2.png") });
    await nav(page, "mkt");
    await page.waitForFunction(() => document.querySelectorAll("#view-mkt .spr:not(.hd)").length >= 4, null, { timeout: 60000 }).catch(() => {});
    const sp = await page.$$eval("#view-mkt .spr:not(.hd) b", a => a.map(e => e.textContent).filter(t => /^[A-Z]/.test(t)));
    const bc = await page.$eval("#view-mkt", e => e.textContent);
    ok(["Aujourd'hui", "Semaine", "Mois", "Trimestre", "Année"].every(x => sp.includes(x)) && /Largeur du marché sur 90 jours/.test(bc), "Tendance : jour, semaine, mois, 90 jours et année ; largeur du marché sur 90 jours");
    if (SHOTS) { await page.$eval("#view-mkt .spr", e => e.scrollIntoView()); await page.screenshot({ path: path.join(SHOTS, "p17-periodes.png") }); }
    await nav(page, "cyc");
    await page.waitForFunction(() => document.querySelectorAll("#view-cyc .cyd").length === 5, null, { timeout: 60000 }).catch(() => {});
    const cy = await page.$$eval("#view-cyc .cyd", a => a.map(e => e.textContent.replace(/\s+/g, " ")));
    ok(cy.length === 5 && /Fenêtre des sommets.*avril 2025 → octobre 2025/.test(cy[1]) && /Zone des creux.*octobre 2026 → octobre 2027.*en cours.*fin projetée/.test(cy[3]), "Cycle : dates projetées, phase en cours « " + (cy.find(x => /en cours/.test(x)) || "?") + " »");
    if (SHOTS) { await page.$eval("#view-cyc .cyd", e => e.scrollIntoView()); await page.screenshot({ path: path.join(SHOTS, "p17-cycle.png") }); }
    await nav(page, "tmp");
    await page.waitForFunction(() => /Décision pour un trade maintenant/.test(document.getElementById("view-tmp").textContent), null, { timeout: 30000 }).catch(() => {});
    const tp = await page.evaluate(() => ({ g: (document.querySelector("#view-tmp .gbig") || {}).textContent, det: !!document.querySelector("#view-tmp details.set:not([open])") }));
    ok(/^(Feu vert|Prudence : jour faible|Feu vert, marché calme|Pas de nouveau trade aujourd'hui)/.test(tp.g || "") && tp.det, "Temporalité : décision « " + tp.g + " », mesures repliées dessous");
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "p17-temporalite.png") });
    await nav(page, "trades");
    await page.waitForFunction(() => /risqué si tous les stops/.test((document.getElementById("expo") || {}).textContent || ""), null, { timeout: 20000 }).catch(() => {});
    const xp = await page.evaluate(() => [document.getElementById("expo").textContent.replace(/\s+/g, " "), [...document.querySelectorAll("#view-trades .lvt")].map(e => e.textContent.replace(/\s+/g, " "))]);
    const fee = 0.0005, leg = (e, d, p, q) => (p - e) * d * q - (e + p) * q * fee, risk = leg(L, 1, L * 0.98, 1) + leg(A, -1, A * 1.02, 10), gain = leg(L, 1, L * 1.04, 1) + leg(A, -1, A * 0.95, 10);
    const num = (t, k) => { const m = t.match(new RegExp("([−+-]?[\\d  ]+,\\d\\d) \\$ ?(\\+ \\?)?" + k)); return m ? +m[1].replace(/[  ]/g, "").replace("−", "-").replace(",", ".") : NaN; };
    ok(Math.abs(num(xp[0], "risqué") - risk) < 0.02 && Math.abs(num(xp[0], "gain si") - gain) < 0.02, "exposition totale : " + risk.toFixed(2) + " $ risqués, +" + gain.toFixed(2) + " $ de gain potentiel, frais compris");
    ok(xp[1].length === 2 && xp[1].every(t => /Au stop.*Au TP/.test(t)), "chaque trade : perte au stop et gain au TP (« " + xp[1][0].slice(0, 70) + " »)");
    if (SHOTS) { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: path.join(SHOTS, "p17-exposition.png") }); }
    await nav(page, "aft");
    await page.waitForFunction(() => document.querySelector("#view-aft .af .afv") && !/lecture…/.test(document.getElementById("view-aft").textContent), null, { timeout: 20000 }).catch(() => {});
    const av = await page.evaluate(() => [document.querySelector("#view-aft .af .afv").textContent, document.querySelector("#view-aft .funnel").textContent.replace(/\s+/g, " ")]);
    ok(/^(SL touché sorti par ton stop · TP surveillé|TP touché après ton stop : stop trop serré)$/.test(av[0].trim()) && /TP touché.*SL touché.*en cours/.test(av[1]), "après sortie, trade sorti par son stop : « " + av[0].trim() + " » ; compteurs TP / SL / en cours");
    ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" / ") : ""));
    await ctx.close();
  });

  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log("\n" + (results.length - fail) + "/" + results.length + " tests de page réussis");
  process.exit(fail ? 1 : 0);
})();
