// Monthly candles of every Binance spot USDT pair listed by mid-2020, from data.binance.vision, for the cycle study.
const https = require("https"), zlib = require("zlib"), fs = require("fs");
const get = u => new Promise((ok, ko) => https.get(u, r => { if (r.statusCode !== 200) { r.resume(); return ok(null); } const b = []; r.on("data", c => b.push(c)); r.on("end", () => ok(Buffer.concat(b))); }).on("error", ko));
function unzip1(buf) { const n = buf.readUInt16LE(26), x = buf.readUInt16LE(28), sz = buf.readUInt32LE(18), m = buf.readUInt16LE(8); const d = buf.slice(30 + n + x, 30 + n + x + sz); return (m === 8 ? zlib.inflateRawSync(d) : d).toString(); }
async function list() { let out = [], marker = ""; for (;;) { const b = await get("https://s3-ap-northeast-1.amazonaws.com/data.binance.vision?delimiter=/&prefix=data/spot/monthly/klines/" + (marker ? "&marker=" + encodeURIComponent(marker) : "")); const t = b.toString(); const ps = [...t.matchAll(/<Prefix>data\/spot\/monthly\/klines\/([A-Z0-9]+)\/<\/Prefix>/g)].map(m => m[1]); out = out.concat(ps); const nm = t.match(/<NextMarker>([^<]+)<\/NextMarker>/); if (!nm) break; marker = nm[1]; } return out; }
const months = []; for (let y = 2019; y <= 2026; y++) for (let m = 1; m <= 12; m++) { const k = y + "-" + String(m).padStart(2, "0"); if (k >= "2019-06" && k <= "2026-09") months.push(k); }
(async () => {
  const all = (await list()).filter(s => /USDT$/.test(s) && !/(UP|DOWN|BULL|BEAR)USDT$/.test(s));
  console.log("usdt pairs", all.length);
  const out = {}; let i = 0;
  async function one(s) {
    const probe = await get(`https://data.binance.vision/data/spot/monthly/klines/${s}/1mo/${s}-1mo-2020-06.zip`); if (!probe) return;
    const rows = [];
    await Promise.all(months.map(async mo => { const b = mo === "2020-06" ? probe : await get(`https://data.binance.vision/data/spot/monthly/klines/${s}/1mo/${s}-1mo-${mo}.zip`); if (!b) return;
      unzip1(b).trim().split("\n").forEach(l => { const c = l.split(","); if (!/^\d/.test(c[0])) return; rows.push([mo, +c[1], +c[2], +c[3], +c[4], +c[7]]); }); }));
    rows.sort((a, b) => a[0] < b[0] ? -1 : 1); out[s] = rows;
  }
  const q = all.slice(); await Promise.all(Array.from({ length: 24 }, async () => { while (q.length) { const s = q.shift(); try { await one(s); } catch (e) { } if (++i % 100 === 0) console.log(i); } }));
  fs.mkdirSync("out", { recursive: true }); fs.writeFileSync("out/cycles.json", JSON.stringify(out)); console.log("symbols with 2020 data", Object.keys(out).length);
})();
