// Contracts of the app's Levels: CoinGecko market-cap ranks matched to the Binance USD-M perpetuals listed in the public archive,
// the same matching as the app (symbol, then 1000 / 1000000 / 1M prefixes). Prints CAP12=<ranks 1-60>, CAP3=<ranks 61-200> and
// CAP45=<ranks 201-1000>, and writes ranks.json (contract -> rank).
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
  for (let page = 1; page <= 4; page++) {
    let got = null;
    for (let a = 0; a < 6 && !got; a++) {
      const r = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=" + page);
      if (r.ok) got = await r.json(); else await sleep(20000);
    }
    if (!got) { if (page === 1) { console.error("coingecko failed"); process.exit(1); } break; }
    got.forEach((c, j) => { c._r = c.market_cap_rank || (page - 1) * 250 + j + 1; }); cg.push(...got); await sleep(8000);
  }
  const out = { 12: [], 3: [], 45: [] }, miss = [];
  cg.forEach(c => {
    const r = c._r, b = String(c.symbol).toUpperCase(), lv = r <= 60 ? 12 : r <= 200 ? 3 : r <= 1000 ? 45 : 0; if (!lv) return;
    const s = [b, "1000" + b, "1000000" + b, "1M" + b].map(x => x + "USDT").find(x => fut.has(x));
    if (s && !out[lv].includes(s)) out[lv].push(s); else if (!s && r <= 60) miss.push(r + ":" + b);
  });
  console.error("level 1-2 on futures", out[12].length, "/ 60, not on futures:", miss.join(" "));
  console.error("level 3 on futures", out[3].length, "/ 140, levels 4-5 on futures", out[45].length, "/ 800");
  console.log("CAP12=" + out[12].join(",")); console.log("CAP3=" + out[3].join(",")); console.log("CAP45=" + out[45].join(","));
  /* rank of each contract, for the per-level report */
  const rk = {}; cg.forEach(c => { const b = String(c.symbol).toUpperCase(); ["", "1000", "1000000", "1M"].map(x => x + b + "USDT").forEach(s => { if (fut.has(s) && !rk[s]) rk[s] = c._r; }); });
  require("fs").writeFileSync("ranks.json", JSON.stringify(rk));
})().catch(e => { console.error(e); process.exit(1); });
