// Where the markets stop, and how long a setup stays ready: version 42 replayed without taking trades, the stage of every market
// noted every 15 minutes (digits written by btStep with o.funnel). Out: average number of markets at each stage at one moment,
// share of moments with at least one market ready, ready episodes per day and how long they last, and how many a check every
// 15, 30 or 60 minutes would catch (one alert per market every 4 hours, as the app does). The same without the blocker (stage 6).
// Usage: node funnel42.js <dir with v42-*.json>
const fs = require("fs"), path = require("path"), dir = process.argv[2], M15 = 9e5;
const fn = {};
fs.readdirSync(dir).filter(f => /^v42-\d+\.json$/.test(f)).forEach(f => Object.assign(fn, JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).fn));
const syms = Object.keys(fn), t0 = Math.min(...syms.map(s => fn[s].t0)), t1 = Math.max(...syms.map(s => fn[s].t0 + fn[s].s.length * M15)), N = Math.round((t1 - t0) / M15), days = (t1 - t0) / 864e5;
const stage = new Array(8).fill(0), live = new Array(N).fill(0), rdy = new Array(N).fill(0), rdy6 = new Array(N).fill(0);
let cells = 0;
const epi = ok => { const out = []; syms.forEach(s => { const z = fn[s].s, off = Math.round((fn[s].t0 - t0) / M15); let a = -1; for (let i = 0; i <= z.length; i++) { const on = i < z.length && ok(+z[i]); if (on && a < 0) a = i; if (!on && a >= 0) { out.push({ s, a: off + a, n: i - a }); a = -1; } } }); return out; };
syms.forEach(s => { const z = fn[s].s, off = Math.round((fn[s].t0 - t0) / M15); for (let i = 0; i < z.length; i++) { const c = +z[i]; stage[c]++; cells++; live[off + i]++; if (c === 7) rdy[off + i]++; if (c >= 6) rdy6[off + i]++; } });
const q = (a, p) => a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
/* a check every `step` bars, at every possible phase: an episode is caught when a check falls inside it; then one alert per market every 4 hours */
const caught = (E, step) => { let tot = 0; for (let ph = 0; ph < step; ph++) { const last = {}; E.filter(e => { const k = Math.ceil((e.a - ph) / step) * step + ph; return k < e.a + e.n; }).sort((x, y) => x.a - y.a).forEach(e => { if (last[e.s] !== undefined && e.a - last[e.s] < 16) return; last[e.s] = e.a; tot++; }); } return +(tot / step / days).toFixed(2); };
const rep = ok => { const E = epi(ok), d = E.map(e => e.n * 15); return { perDay: +(E.length / days).toFixed(2), medianMin: q(d, 0.5), meanMin: Math.round(d.reduce((a, b) => a + b, 0) / (d.length || 1)), only15: +(d.filter(x => x <= 15).length / (d.length || 1) * 100).toFixed(0), upTo30: +(d.filter(x => x <= 30).length / (d.length || 1) * 100).toFixed(0), over60: +(d.filter(x => x > 60).length / (d.length || 1) * 100).toFixed(0), alerts15: caught(E, 1), alerts30: caught(E, 2), alerts60: caught(E, 4) }; };
const at = a => { let n = 0, m = 0; for (let i = 0; i < N; i++) if (live[i] >= syms.length * 0.5) { m++; if (a[i] > 0) n++; } return +(n / m * 100).toFixed(1); };
console.log(JSON.stringify({ markets: syms.length, days: Math.round(days), perMoment: stage.map(x => +(x / cells * syms.length).toFixed(2)), share: stage.map(x => +(x / cells * 100).toFixed(2)),
  momentsWithReady: at(rdy), momentsWithReadyNoBlocker: at(rdy6), ready: rep(c => c === 7), noBlocker: rep(c => c >= 6) }));
