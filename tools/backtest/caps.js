// Contracts of the app's Levels: CoinGecko market-cap ranks matched to the Binance USD-M perpetuals listed in the public archive,
// the same matching as the app (symbol, then 1000 / 1000000 / 1M prefixes). Prints CAP12=<ranks 1-60> and CAP3=<ranks 61-200>.
const LIST = "https://s3-ap-northeast-1.amazonaws.com/data.binance.vision?delimiter=/&prefix=data/futures/um/monthly/klines/";
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let syms = [], marker = "";
  for (let p = 0; p < 12; p++) {
    const x = await (await fetch(LIST + (marker ? "&marker=" + encodeURIComponent(marker) : ""))).text();
    syms.push(...[...x.matchAll(/<Prefix>data\/futures\/um\/monthly\/klines\/([^<\/]+)\/<\/Prefix>/g)].map(a => a[1]));
    const nm = x.match(/<NextMarker>([^<]+)<\/NextMarker>/); if (!nm) break; marker = nm[1];
  }
  const fut = new Set(syms);
  let cg = [];
  for (let a = 0; a < 5 && !cg.length; a++) {
    const r = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1");
    if (r.ok) cg = await r.json(); else await sleep(15000);
  }
  if (!cg.length) { console.error("coingecko failed"); process.exit(1); }
  const out = { 12: [], 3: [] }, miss = [];
  cg.forEach((c, j) => {
    const r = c.market_cap_rank || j + 1, b = String(c.symbol).toUpperCase(), lv = r <= 60 ? 12 : r <= 200 ? 3 : 0; if (!lv) return;
    const s = [b, "1000" + b, "1000000" + b, "1M" + b].map(x => x + "USDT").find(x => fut.has(x));
    if (s && !out[lv].includes(s)) out[lv].push(s); else if (!s && r <= 60) miss.push(r + ":" + b);
  });
  console.error("level 1-2 on futures", out[12].length, "/ 60, not on futures:", miss.join(" "));
  console.error("level 3 on futures", out[3].length, "/ 140");
  console.log("CAP12=" + out[12].join(",")); console.log("CAP3=" + out[3].join(","));
})().catch(e => { console.error(e); process.exit(1); });
