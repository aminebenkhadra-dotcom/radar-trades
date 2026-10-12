// Shared helpers for the backtest: data loading, multi-timeframe frames as the live app would see them, trade resolution, statistics.
const fs = require("fs"), zlib = require("zlib"), path = require("path");
const M15 = 900000;
function readGz(file) {
  if (!fs.existsSync(file)) return [];
  return zlib.gunzipSync(fs.readFileSync(file)).toString("utf8").split("\n").filter(Boolean).map(l => l.split(","));
}
function loadSymbol(dir, sym) {
  const m15 = readGz(path.join(dir, sym + ".m15.csv.gz")).map(r => ({ t: +r[0] * M15, o: +r[1], h: +r[2], l: +r[3], c: +r[4], q: +r[5], b: +r[6] }));
  const d1 = readGz(path.join(dir, sym + ".d1.csv.gz")).map(r => ({ t: +r[0] * 86400000, o: +r[1], h: +r[2], l: +r[3], c: +r[4], q: +r[5], b: +r[6] }));
  const fund = readGz(path.join(dir, sym + ".fund.csv.gz")).map(r => [+r[0] * 60000, +r[1]]);
  const met = readGz(path.join(dir, sym + ".met.csv.gz")).map(r => ({ t: +r[0] * 3600000, oi: +r[1], ls: +r[2], top: +r[3], taker: +r[4] }));
  return { sym, m15, d1, fund, met };
}
function aggregate(m15, ms) {
  const out = []; let cur = null;
  for (let i = 0; i < m15.length; i++) {
    const k = m15[i], key = Math.floor(k.t / ms);
    if (!cur || cur.key !== key) { cur = { key, t: key * ms, o: k.o, h: k.h, l: k.l, c: k.c, q: k.q, b: k.b, i0: i, i1: i }; out.push(cur); }
    else { if (k.h > cur.h) cur.h = k.h; if (k.l < cur.l) cur.l = k.l; cur.c = k.c; cur.q += k.q; cur.b += k.b; cur.i1 = i; }
  }
  return out;
}
/* Frames: at the close of 15m candle i, the candles the live app would be given (complete ones plus the one in progress). */
class Frames {
  constructor(m15, d1hist) {
    this.m15 = m15;
    const first = m15.length ? m15[0].t : 0;
    const hist = (d1hist || []).filter(k => k.t + 86400000 <= first);
    this.tf = {
      h1: { ms: 3600000, full: aggregate(m15, 3600000), off: 0 },
      h4: { ms: 14400000, full: aggregate(m15, 14400000), off: 0 },
      d1: { ms: 86400000, full: hist.concat(aggregate(m15, 86400000)), off: hist.length }
    };
    for (const k in this.tf) { const f = this.tf[k]; f.j = f.off; f.p = null; f.pi = -2; }
  }
  /* must be called with i increasing; returns nothing, only moves the cursors */
  step(i) {
    const k = this.m15[i];
    for (const name in this.tf) {
      const f = this.tf[name];
      while (f.j + 1 < f.full.length && f.full[f.j + 1].i0 <= i) { f.j++; f.p = null; }
      if (!f.p || f.pi !== i - 1) {
        const c = f.full[f.j]; let p = null;
        for (let x = c.i0; x <= i; x++) { const b = this.m15[x]; if (!p) p = { t: c.t, o: b.o, h: b.h, l: b.l, c: b.c, q: b.q, b: b.b }; else { if (b.h > p.h) p.h = b.h; if (b.l < p.l) p.l = b.l; p.c = b.c; p.q += b.q; p.b += b.b; } }
        f.p = p;
      } else { const p = f.p; if (k.h > p.h) p.h = k.h; if (k.l < p.l) p.l = k.l; p.c = k.c; p.q += k.q; p.b += k.b; }
      f.pi = i;
    }
    this.i = i;
  }
  get(name, n) {
    const f = this.tf[name], T = this.m15[this.i].t + M15, c = f.full[f.j];
    let done, last;
    if (c.t + f.ms <= T) { done = f.j + 1; last = { t: c.t + f.ms, o: c.c, h: c.c, l: c.c, c: c.c, q: 0, b: 0 }; }   // candle just closed: a new one opens at the same price
    else { done = f.j; last = { t: f.p.t, o: f.p.o, h: f.p.h, l: f.p.l, c: f.p.c, q: f.p.q, b: f.p.b }; }
    const a = f.full.slice(Math.max(0, done - (n - 1)), done); a.push(last); return a;
  }
  m(n) { return this.m15.slice(Math.max(0, this.i + 1 - n), this.i + 1); }
}
/* Resolve a trade. Entry is a market fill at the close of bar i, or a limit waiting up to `wait` bars. Stop first when both are touched in a bar. */
function resolve(m15, i, o) {
  const dir = o.dir, n = m15.length, R = Math.abs(o.entry - o.sl);
  let j = i, filled = !o.limit;
  if (!filled) {
    const end = Math.min(n - 1, i + (o.wait || 24));
    for (j = i + 1; j <= end; j++) { const k = m15[j]; if (dir > 0 ? k.l <= o.entry : k.h >= o.entry) { filled = true; break; } if (dir > 0 ? k.h >= o.tp : k.l <= o.tp) break; }
    if (!filled) return { how: "nofill", j: Math.min(j, end), r: 0 };
    const k = m15[j];
    if (dir > 0 ? k.l <= o.sl : k.h >= o.sl) return { how: "sl", jin: j, j, r: -1, bars: 0 };
  }
  const jin = j, end = Math.min(n - 1, jin + (o.max || 960));
  let mfe = 0, mae = 0;
  for (j = jin + 1; j <= end; j++) {
    const k = m15[j];
    if (dir > 0 ? k.l <= o.sl : k.h >= o.sl) { const fill = dir > 0 ? Math.min(k.o, o.sl) : Math.max(k.o, o.sl); return { how: "sl", jin, j, r: dir * (fill - o.entry) / R, bars: j - jin, mfe, mae: Math.max(mae, 1) }; }
    if (dir > 0 ? k.h >= o.tp : k.l <= o.tp) return { how: "tp", jin, j, r: Math.abs(o.tp - o.entry) / R, bars: j - jin, mfe: Math.abs(o.tp - o.entry) / R, mae };
    const fav = dir > 0 ? (k.h - o.entry) / R : (o.entry - k.l) / R, adv = dir > 0 ? (o.entry - k.l) / R : (k.h - o.entry) / R;
    if (fav > mfe) mfe = fav; if (adv > mae) mae = adv;
  }
  j = Math.min(j, n - 1);
  return { how: j >= n - 1 && end === n - 1 && jin + (o.max || 960) > n - 1 ? "end" : "time", jin, j, r: dir * (m15[j].c - o.entry) / R, bars: j - jin, mfe, mae };
}
function stats(tr) {
  const n = tr.length; if (!n) return { n: 0 };
  let w = 0, sum = 0, gp = 0, gl = 0, streak = 0, worst = 0, bars = 0, eq = 0, peak = 0, dd = 0;
  for (const t of tr) { if (t.r > 0) { w++; gp += t.r; streak = 0; } else { gl -= t.r; streak++; if (streak > worst) worst = streak; } sum += t.r; bars += t.bars || 0; eq += t.r; if (eq > peak) peak = eq; if (peak - eq > dd) dd = peak - eq; }
  const mean = sum / n; let v = 0; for (const t of tr) v += (t.r - mean) * (t.r - mean);
  const sd = Math.sqrt(v / Math.max(1, n - 1));
  return { n, win: w / n * 100, avg: mean, se: sd / Math.sqrt(n), tot: sum, pf: gl > 0 ? gp / gl : Infinity, streak: worst, dd, hours: bars / n / 4 };
}
const f = (v, d = 2) => (v === undefined || v === null || !isFinite(v) ? "–" : v.toFixed(d));
function line(label, s) {
  if (!s.n) return label.padEnd(26) + "     0";
  return label.padEnd(26) + String(s.n).padStart(6) + "  win " + f(s.win, 1).padStart(5) + " %  avg " + (s.avg >= 0 ? "+" : "") + f(s.avg, 3) + "R ±" + f(s.se, 3) + "  tot " + (s.tot >= 0 ? "+" : "") + f(s.tot, 1).padStart(6) + "R  PF " + f(s.pf, 2) + "  streak " + s.streak + "  dd " + f(s.dd, 1) + "R  hold " + f(s.hours, 0) + "h";
}
function listSymbols(dir) {
  const idx = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
  return { idx, syms: Object.keys(idx.symbols).sort((a, b) => (idx.symbols[b].vol || 0) - (idx.symbols[a].vol || 0)) };
}
module.exports = { M15, readGz, loadSymbol, aggregate, Frames, resolve, stats, line, f, listSymbols };
