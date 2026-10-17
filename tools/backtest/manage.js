// Trade management replayed on the reference setups of both years: fixed stop and target against break-even moves, partial exits and trailing stops.
const fs = require("fs"), L = require("/home/claude/radar-trades/tools/backtest/lib.js"), [N, OLD] = process.argv.slice(2), COST = 0.0012;
function load(dir, s) { let tr = []; for (let k = 0; k < 8; k++) { const f = dir + "/ref-" + s + "-" + k + ".json"; if (!fs.existsSync(f)) break; tr = tr.concat(JSON.parse(fs.readFileSync(f, "utf8")).trades); } return tr; }
function atr(k, n) { let s = 0; for (let i = k.length - n; i < k.length; i++) s += Math.max(k[i].h - k[i].l, Math.abs(k[i].h - k[i - 1].c), Math.abs(k[i].l - k[i - 1].c)); return s / n; }
const V = {
  fixe: { },
  be1: { be: 1 }, be15: { be: 1.5 }, be2: { be: 2 },
  part1: { part: 1, be: 1 }, part1nobe: { part: 1 },
  trail1: { trail: 1, k: 2 }, trail15: { trail: 1.5, k: 2 }, trail1k3: { trail: 1, k: 3 },
  tp1R: { tp: 1 }, tp15R: { tp: 1.5 },
};
const res = {}; for (const v in V) res[v] = { 24: [], 25: [] };
for (const [y, fl, data] of [["24", N + "/fl25", OLD + "/data25"], ["25", N + "/fl26", OLD + "/data"]]) {
  const tr = load(fl, 0), by = {}; tr.forEach(t => (by[t.sym] = by[t.sym] || []).push(t));
  for (const sym of Object.keys(by)) {
    let D; try { D = L.loadSymbol(data, sym + "USDT"); } catch (e) { continue; }
    const m = D.m15, idx = new Map(); m.forEach((k, i) => idx.set(k.t, i));
    const h1 = L.aggregate(m, 36e5), hidx = new Map(); h1.forEach((k, i) => hidx.set(k.t, i));
    for (const t of by[sym]) {
      const i = idx.get(t.t); if (i === undefined) continue; const hi = hidx.get(Math.floor(t.t / 36e5) * 36e5); if (!hi || hi < 20) continue;
      const d = t.dir, e = t.entry, R = Math.abs(e - t.sl), a1 = atr(h1.slice(0, hi), 14), cost = COST * e / R, N2 = Math.min(m.length - 1, i + 960);
      for (const v in V) {
        const o = V[v], tp = o.tp ? e + d * o.tp * R : t.tp; let sl = t.sl, part = 0, out = null, best = e, moved = false, trailOn = false;
        for (let j = i + 1; j <= N2; j++) { const c = m[j], H = d > 0 ? c.h : -c.l, Lw = d > 0 ? c.l : -c.h, E = d * e, S = d * sl, T = d * tp;
          if (Lw <= S) { const fill = d > 0 ? Math.min(c.o, sl) : Math.max(c.o, sl); out = part ? 0.5 * o.part + 0.5 * d * (fill - e) / R : d * (fill - e) / R; break; }
          if (H >= T) { out = part ? 0.5 * o.part + 0.5 * Math.abs(tp - e) / R : Math.abs(tp - e) / R; break; }
          const gainR = (H - E) / R;
          if (o.part && !part && gainR >= o.part) part = 1;
          if (o.be && !moved && gainR >= o.be) { moved = true; const b = e * (d > 0 ? 1.0012 : 0.9988); if ((b - sl) * d > 0) sl = b; }
          if (o.trail && gainR >= o.trail) trailOn = true;
          if (trailOn) { best = d > 0 ? Math.max(best, c.c) : Math.min(best, c.c); const ts = best - d * o.k * a1; if ((ts - sl) * d > 0) sl = ts; }
        }
        if (out === null) { const c = m[N2].c; out = part ? 0.5 * o.part + 0.5 * d * (c - e) / R : d * (c - e) / R; }
        res[v][y].push(out - cost);
      }
    }
  }
}
const st = a => { const n = a.length, mu = a.reduce((s, x) => s + x, 0) / n, sd = Math.sqrt(a.reduce((s, x) => s + (x - mu) ** 2, 0) / (n - 1)); return { n, mu, se: sd / Math.sqrt(n), win: a.filter(x => x > 0).length / n * 100 }; };
for (const v in V) { const a = st(res[v]["24"]), b = st(res[v]["25"]); console.log(v.padEnd(10), "2024-25", a.mu.toFixed(3), "(" + a.win.toFixed(0) + "% >0)", "| 2025-26", b.mu.toFixed(3), "(" + b.win.toFixed(0) + "% >0)", "n", a.n, b.n); }
// paired differences vs fixed
for (const v in V) if (v !== "fixe") { const out = []; for (const y of ["24", "25"]) { const d = res[v][y].map((x, i) => x - res.fixe[y][i]), s = st(d); out.push(y + ": " + (s.mu >= 0 ? "+" : "") + s.mu.toFixed(3) + " ±" + (1.96 * s.se).toFixed(3)); } console.log("diff " + v.padEnd(10), out.join(" | ")); }
