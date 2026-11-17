// One trade, replayed as the app saw it: downloads a symbol and Bitcoin from data.binance.vision, then runs the shipped engine every
// 15 minutes over a window and prints status, plan, stop-exposed reading and blockers.
// Usage: node case.js <SYMBOL> <from ISO> <to ISO>   e.g. node case.js XMRUSDT 2026-11-16T06:00Z 2026-11-16T16:00Z
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const SRC = fs.readFileSync(path.join(__dirname, "..", "engine.js"), "utf8");
const E = new Function(SRC + ";return {btFrames,btMarket,analyze,enrich,judge}")();
const BASE = "https://data.binance.vision/data/futures/um/";
const [SYM, FROM, TO] = process.argv.slice(2), T0 = Date.parse(FROM), T1 = Date.parse(TO);
const p2 = n => String(n).padStart(2, "0");
async function grab(u) { for (let a = 0; a < 4; a++) { try { const r = await fetch(u); if (r.status === 404) return null; if (r.ok) return Buffer.from(await r.arrayBuffer()); } catch (e) {} await new Promise(r => setTimeout(r, 600 * (a + 1))); } return null; }
function unzip(buf) { let e = buf.length - 22; while (buf.readUInt32LE(e) !== 0x06054b50) e--; const cd = buf.readUInt32LE(e + 16), mt = buf.readUInt16LE(cd + 10), sz = buf.readUInt32LE(cd + 20), lho = buf.readUInt32LE(cd + 42);
  const s = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28), raw = buf.subarray(s, s + sz); return (mt === 0 ? raw : zlib.inflateRawSync(raw)).toString("utf8"); }
const rows = t => t.split("\n").filter(l => /^\d/.test(l)).map(l => l.split(",")).map(r => ({ t: +r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], q: +r[7], b: +r[10] }));
async function series(sym, iv, months, days) {
  const out = [];
  for (const m of months) { const b = await grab(`${BASE}monthly/klines/${sym}/${iv}/${sym}-${iv}-${m}.zip`); if (b) out.push(...rows(unzip(b))); }
  for (const d of days) { const b = await grab(`${BASE}daily/klines/${sym}/${iv}/${sym}-${iv}-${d}.zip`); if (b) out.push(...rows(unzip(b))); }
  const seen = {}; return out.filter(k => !seen[k.t] && (seen[k.t] = 1)).sort((a, b) => a.t - b.t);
}
function monthsBack(n, end) { const o = []; let d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)); for (let i = 0; i < n; i++) { d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)); o.unshift(d.getUTCFullYear() + "-" + p2(d.getUTCMonth() + 1)); } return o; }
(async () => {
  const end = new Date(T1), mon15 = monthsBack(3, end), mond = monthsBack(16, end), days = [];
  for (let d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)); d <= end; d = new Date(+d + 864e5)) days.push(d.toISOString().slice(0, 10));
  const load = async s => ({ m15: await series(s, "15m", mon15, days), d1: await series(s, "1d", mond, days) });
  const X = await load(SYM), B = await load("BTCUSDT");
  console.log(SYM, "15m candles", X.m15.length, "last", new Date(X.m15[X.m15.length - 1].t).toISOString());
  const btc = E.btMarket(B.m15, B.d1), F = E.btFrames(X.m15, X.d1);
  for (let i = 0; i < X.m15.length; i++) {
    F.step(i); const t = X.m15[i].t + 9e5; if (t < T0 || t > T1) continue;
    const line = [new Date(t).toISOString().slice(5, 16)];
    for (const o of [{ strict: 2, slsw: 24, slmode: "flag" }, { strict: 2, slsw: 0 }]) {
      const r = E.analyze(SYM.replace(/USDT$/, ""), F.get("d1", 400), F.get("h4", 200), F.get("h1", 200), { btc: btc[X.m15[i].t] || null }, o);
      if (!r.plan) { line.push(r.st + ":" + (r.why || []).map(w => w.t).join("/").slice(0, 60)); continue; }
      E.enrich(r, F.m15(500), null, null, { noHeat: true }); E.judge(r, Object.assign({ quiet: true, noBook: true }, o));
      const p = r.plan;
      line.push(`${r.dir > 0 ? "L" : "S"} ${r.st}/${r.st0} dist${(+r.dist).toFixed(2)} e${p.entry.toFixed(2)} sl${p.sl.toFixed(2)} tp${p.tp1.toFixed(2)} atr${(+r.a).toFixed(2)} z${p.zlo.toFixed(1)}-${p.zhi.toFixed(1)}` +
        (r.slx ? ` slx@${r.slx.p}` : "") + ` blk[${(r.blk || []).map(b => b.k).join(",")}] miss[${(r.miss || []).join(",")}]`);
    }
    console.log(line.join("  ||  "));
  }
})();
