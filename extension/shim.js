// Radar Trades for Chrome: what the Android app provides, done by the browser.
// 1. The page asks for "/fapi/...", "/cg/...": the same fixed list of public sources as Relay.java, read directly.
// 2. window.Android: alerts (Chrome notifications, scans repeated while the tab is open). No API keys, no account access.
(function () {
  "use strict";
  const FEEDS = { cryptoast: "https://cryptoast.fr/feed/", jdc: "https://journalducoin.com/feed/", cointribune: "https://www.cointribune.com/feed/",
    cointelegraph: "https://cointelegraph.com/rss", coindesk: "https://www.coindesk.com/arc/outboundfeeds/rss/", fng: "https://api.alternative.me/fng/?limit=30" };
  function target(path, query) {
    const q = query ? "?" + query : "";
    if (path.startsWith("/fapi/") || path.startsWith("/futures/data/")) return "https://fapi.binance.com" + path + q;
    if (path.startsWith("/cg/")) return "https://api.coingecko.com/api/v3/" + path.slice(4) + q;
    if (path.startsWith("/bspot/api/v3/ticker/")) return "https://api.binance.com/" + path.slice(7) + q;
    if (path.startsWith("/mexc/api/v3/ticker/")) return "https://api.mexc.com/" + path.slice(6) + q;
    if (path.startsWith("/news/")) return FEEDS[path.slice(6)] || null;
    if (path.startsWith("/llama/")) return "https://api.llama.fi/" + path.slice(7) + q;
    if (path === "/okx/api/v5/finance/savings/lending-rate-summary" || /^\/okx\/api\/v5\/finance\/staking-defi\/(eth|sol)\/apy-history$/.test(path)) return "https://www.okx.com/" + path.slice(5) + q;
    if (path === "/yields/pools") return "https://yields.llama.fi/pools";
    return null;
  }
  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const raw = typeof input === "string" ? input : input && input.url;
    if (typeof raw === "string" && raw.startsWith("/")) {
      const u = new URL(raw, "https://radar.local"), t = target(u.pathname, u.search.slice(1));
      if (!t) return Promise.resolve(new Response("", { status: 404 }));
      return nativeFetch(t, { cache: "no-store" }).then(r => r, () => new Response("{}", { status: 502 }));
    }
    return nativeFetch(input, init);
  };

  /* alerts: the page's own watch (bgScan) runs here every N minutes while the tab is open */
  const KEY = "radar-watch", note = new Map();
  let timer = null;
  function prefs() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function arm() {
    clearInterval(timer); timer = null; const p = prefs();
    if (!(p && p.on)) return;
    const run = () => { if (window.bgScan) window.bgScan(!!p.top10, !!p.top50); };
    setTimeout(run, 60000); timer = setInterval(run, Math.max(15, p.minutes || 30) * 60000);
  }
  function show(title, text, tag, tab) {
    const id = "rt-" + (tag || "setup") + "-" + Date.now() + "|" + (tab || "all");
    chrome.notifications.create(id, { type: "basic", iconUrl: "icons/icon128.png", title: String(title), message: String(text), priority: 2 });
  }
  window.Android = {
    startWatch(top10, top50, minutes) { localStorage.setItem(KEY, JSON.stringify({ on: true, top10, top50, minutes })); arm(); },
    stopWatch() { localStorage.setItem(KEY, JSON.stringify({ on: false })); arm(); },
    canNotify() { return true; }, batteryFree() { return true; }, askBattery() {},
    test() { show("Radar Trades · test", "Les alertes fonctionnent. Garde cet onglet ouvert (épinglé) pour les recevoir.", "test", "all"); },
    notify(title, text, tag, tab) { show(title, text, tag, tab); },
    protect(title, text, tag, tab) { show(title, text, tag, tab); },
    lastCheck() { return localStorage.getItem(KEY + "-last") || ""; },
    done(msg) { localStorage.setItem(KEY + "-last", new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) + " · " + (msg || "")); }
  };
  chrome.runtime.onMessage.addListener(m => { if (m && m.openTab && window.openTab) window.openTab(m.openTab); });
  window.addEventListener("load", arm);
})();
