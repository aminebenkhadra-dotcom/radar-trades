// Recent days, as the app would have seen them: version 42 replayed (funnel mode) on one universe, then per day the ready episodes,
// the alerts a check every 30 minutes would send (one per market every 4 hours) and where the markets stopped on average.
// Usage: node live42.js <dir with v42-*.json> <first day YYYY-MM-DD>
const fs = require("fs"), path = require("path"), dir = process.argv[2], FROM = Date.parse(process.argv[3] + "T00:00:00Z"), M15 = 9e5;
const fn = {};
fs.readdirSync(dir).filter(f => /^v42-\d+\.json$/.test(f)).forEach(f => Object.assign(fn, JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).fn));
const days = {}, eps = [];
const D = t => new Date(t).toISOString().slice(0, 10);
Object.keys(fn).forEach(s => {
  const z = fn[s].s, t0 = fn[s].t0; let a = -1, lastAlert = -1e15;
  for (let i = 0; i <= z.length; i++) {
    const t = t0 + i * M15; if (t < FROM) { if (i < z.length && +z[i] !== 7) a = -1; continue; }
    const c = i < z.length ? +z[i] : -1;
    if (i < z.length) { const d = days[D(t)] = days[D(t)] || { st: new Array(8).fill(0), n: 0, ready: 0, alerts: 0, rdy6: 0 }; d.st[c]++; d.n++; }
    if (c === 7 && a < 0) a = i;
    if (c !== 7 && a >= 0) {
      const ta = t0 + a * M15, len = i - a; days[D(ta)].ready++;
      /* a 30-minute check catches it when a check lands inside the episode; at most one alert per market every 4 hours */
      const ck = Math.ceil(ta / 18e5) * 18e5; if (ck < ta + len * M15 && ck - lastAlert >= 4 * 36e5) { days[D(ta)].alerts++; lastAlert = ck; }
      eps.push({ s, at: new Date(ta).toISOString().slice(5, 16).replace("T", " "), min: len * 15 }); a = -1;
    }
  }
});
const N = Object.keys(fn).length;
const per = Object.keys(days).sort().map(d => { const x = days[d]; return { day: d, ready: x.ready, alerts30: x.alerts, stages: x.st.map(v => +(v / x.n * N).toFixed(1)) }; });
console.log(JSON.stringify({ markets: N, days: per, last: eps.slice().sort((a, b) => a.at < b.at ? 1 : -1).slice(0, 25) }, null, 1));
