// Downloads Binance USD-M futures history from data.binance.vision (public archive).
// Usage: node fetch.js klines|metrics <outdir>
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const BASE = "https://data.binance.vision/data/futures/um/";
const LIST = "https://s3-ap-northeast-1.amazonaws.com/data.binance.vision?delimiter=/&prefix=data/futures/um/monthly/klines/";
const what = process.argv[2] || "klines", OUT = process.argv[3] || "out";
const START = process.env.START || "2025-10";   // first month of the test window (env START overrides)
const HIST = 24;           // months of daily candles kept before the window
const TOP = 60;            // universe size, ranked by volume in the START month
const EXTRA = ["PIXELUSDT"];
const FALLBACK = ("BTC ETH BNB SOL XRP DOGE ADA TRX LINK AVAX SUI LTC DOT NEAR APT ARB OP INJ TIA SEI WIF 1000PEPE 1000SHIB FET UNI AAVE FIL ATOM ETC BCH " +
  "HBAR XLM TON ENA JUP WLD ORDI HYPE TAO ONDO PENDLE CRV LDO RUNE GALA SAND 1000BONK 1000FLOKI ALGO VET ICP STX IMX GRT ZEC KAS POL RENDER JTO PYTH " +
  "STRK ZRO EIGEN PNUT TRUMP PENGU VIRTUAL FARTCOIN MOVE BERA KAITO IP DYDX APE AXS MANA").split(" ").map(s => s + "USDT");
const sleep = ms => new Promise(r => setTimeout(r, ms));
let calls = 0, miss = 0, fail = 0;
async function grab(url) {           // Buffer, null (404) or undefined (gave up)
  calls++;
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(url);
      if (r.status === 404) { miss++; return null; }
      if (r.ok) return Buffer.from(await r.arrayBuffer());
    } catch (e) {}
    await sleep(500 * (a + 1));
  }
  fail++; return undefined;
}
function unzip(buf) {               // archive with a single entry
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error("zip: no end record");
  const cd = buf.readUInt32LE(e + 16);
  if (buf.readUInt32LE(cd) !== 0x02014b50) throw new Error("zip: no directory");
  const method = buf.readUInt16LE(cd + 10), size = buf.readUInt32LE(cd + 20), lho = buf.readUInt32LE(cd + 42);
  const s = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28), raw = buf.subarray(s, s + size);
  return (method === 0 ? raw : zlib.inflateRawSync(raw)).toString("utf8");
}
const rows = txt => txt.split("\n").filter(l => l && l.charCodeAt(0) >= 48 && l.charCodeAt(0) <= 57).map(l => l.trim().split(","));
async function pool(items, n, fn) {
  let i = 0; const out = new Array(items.length);
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}
const p2 = n => String(n).padStart(2, "0");
function addMonths(ym, d) { let [y, m] = ym.split("-").map(Number); m += d; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return y + "-" + p2(m); }
function monthRange(a, b) { const o = []; for (let m = a; m <= b; m = addMonths(m, 1)) o.push(m); return o; }
function daysOf(ym, until) {          // days of a month, up to `until` (YYYY-MM-DD, exclusive)
  const [y, m] = ym.split("-").map(Number), o = [];
  for (let d = 1; d <= new Date(Date.UTC(y, m, 0)).getUTCDate(); d++) { const s = ym + "-" + p2(d); if (s < until) o.push(s); }
  return o;
}
const now = new Date(), TODAY = now.toISOString().slice(0, 10), THIS = TODAY.slice(0, 7), LAST = addMonths(THIS, -1), END = process.env.END || THIS;   // env END: last month to download
const ms = t => { t = +t; return t > 1e14 ? Math.round(t / 1000) : t; };
async function klines(sym, iv, months) {
  const out = [];
  for (const mo of months) {
    let b = mo < THIS ? await grab(`${BASE}monthly/klines/${sym}/${iv}/${sym}-${iv}-${mo}.zip`) : null;
    if (b) { out.push(...rows(unzip(b))); continue; }
    if (mo < LAST) continue;          // older month really missing (not listed yet, or delisted)
    const ds = await pool(daysOf(mo, TODAY), 8, d => grab(`${BASE}daily/klines/${sym}/${iv}/${sym}-${iv}-${d}.zip`));
    for (const x of ds) if (x) out.push(...rows(unzip(x)));
  }
  const seen = new Map();
  for (const r of out) seen.set(ms(r[0]), r);
  return [...seen.keys()].sort((a, b) => a - b).map(t => { const r = seen.get(t); return [t, r[1], r[2], r[3], r[4], Math.round(+r[7]), Math.round(+r[10])]; });
}
const gz = (f, lines) => fs.writeFileSync(path.join(OUT, f), zlib.gzipSync(lines.join("\n") + "\n", { level: 9 }));
async function universe() {
  if (process.env.SYMS) { const top = process.env.SYMS.split(","); return { listed: 0, candidates: top.length, withData: top.length, top, vol: {} }; }   // env SYMS: fixed list (Radar BTC·ETH)
  let syms = [];
  try {
    let marker = "";
    for (let p = 0; p < 12; p++) {
      const x = await (await fetch(LIST + (marker ? "&marker=" + encodeURIComponent(marker) : ""))).text();
      syms.push(...[...x.matchAll(/<Prefix>data\/futures\/um\/monthly\/klines\/([^<\/]+)\/<\/Prefix>/g)].map(a => a[1]));
      const nm = x.match(/<NextMarker>([^<]+)<\/NextMarker>/); if (!nm) break; marker = nm[1];
    }
  } catch (e) { console.log("listing failed", e.message); }
  const listed = syms.length;
  if (syms.length < 50) syms = FALLBACK.concat(EXTRA);
  syms = [...new Set(syms)].filter(s => /^[A-Z0-9]+USDT$/.test(s) && !/^(USDC|FDUSD|TUSD|BUSD|USDP|DAI|EUR|USD1|USDE)/.test(s));
  const vol = await pool(syms, 24, async s => {
    const b = await grab(`${BASE}monthly/klines/${s}/1d/${s}-1d-${START}.zip`); if (!b) return 0;
    const r = rows(unzip(b)); return r.length < 25 ? 0 : r.reduce((a, x) => a + +x[7], 0) / r.length;
  });
  const ranked = syms.map((s, i) => ({ s, v: vol[i] })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
  const top = ranked.slice(0, TOP).map(x => x.s);
  for (const e of EXTRA) if (!top.includes(e) && ranked.find(x => x.s === e)) top.push(e);
  return { listed, candidates: syms.length, withData: ranked.length, top, vol: Object.fromEntries(ranked.slice(0, 150).map(x => [x.s, Math.round(x.v)])) };
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  if (what === "klines") {
    const u = await universe();
    console.log("universe", u.listed, u.candidates, u.withData, u.top.length, u.top.join(" "));
    const win = monthRange(START, END), hist = monthRange(addMonths(START, -HIST), addMonths(START, -1));
    const info = {};
    await pool(u.top, 6, async s => {
      const m15 = await klines(s, "15m", win), d1 = await klines(s, "1d", hist);
      const fund = [];
      for (const mo of win) { const b = await grab(`${BASE}monthly/fundingRate/${s}/${s}-fundingRate-${mo}.zip`); if (b) for (const r of rows(unzip(b))) fund.push([Math.round(ms(r[0]) / 60000), r[2]]); }
      gz(s + ".m15.csv.gz", m15.map(r => [r[0] / 900000, r[1], r[2], r[3], r[4], r[5], r[6]].join(",")));
      gz(s + ".d1.csv.gz", d1.map(r => [r[0] / 86400000, r[1], r[2], r[3], r[4], r[5], r[6]].join(",")));
      gz(s + ".fund.csv.gz", fund.map(r => r.join(",")));
      info[s] = { m15: m15.length, d1: d1.length, fund: fund.length, from: m15.length ? new Date(m15[0][0]).toISOString() : null, to: m15.length ? new Date(m15[m15.length - 1][0]).toISOString() : null, vol: u.vol[s] };
      console.log(s, m15.length, d1.length, fund.length);
    });
    fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ made: now.toISOString(), start: START, universe: u, symbols: info, calls, miss, fail }, null, 1));
  } else {
    const idx = JSON.parse(fs.readFileSync(path.join(OUT, "index.json"), "utf8")), syms = Object.keys(idx.symbols);
    const days = monthRange(START, END).flatMap(m => daysOf(m, TODAY));
    const stat = {};
    for (const s of syms) {
      const got = await pool(days, 40, d => grab(`${BASE}daily/metrics/${s}/${s}-metrics-${d}.zip`));
      const lines = [];
      for (const b of got) {
        if (!b) continue;
        for (const r of rows(unzip(b))) {
          const t = Date.parse(r[0].replace(" ", "T") + "Z"); if (!(t % 3600000 === 0)) continue;
          lines.push([t / 3600000, Math.round(+r[3]), r[6], r[5], r[7]].join(","));   // hour, OI value, long/short accounts, top traders, taker ratio
        }
      }
      lines.sort((a, b) => parseInt(a) - parseInt(b));
      gz(s + ".met.csv.gz", lines); stat[s] = lines.length; console.log(s, lines.length);
    }
    idx.metrics = stat; idx.calls2 = calls; idx.miss2 = miss; idx.fail2 = fail;
    fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(idx, null, 1));
  }
  console.log("done", what, Math.round((Date.now() - t0) / 1000) + "s", "calls", calls, "404", miss, "failed", fail);
})().catch(e => { console.error(e); process.exit(1); });
