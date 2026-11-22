// Longs and shorts over recent days, from a funnel replay with funnelWhy: per day the ready setups of each side, how many markets
// had a setup of each side, and, at the zone, which checks held the longs and the shorts back.
// Usage: node side42.js <dir with v42-*.json> <first day YYYY-MM-DD>
const fs = require("fs"), path = require("path"), dir = process.argv[2], FROM = Date.parse(process.argv[3] + "T00:00:00Z"), M15 = 9e5;
const fn = {};
fs.readdirSync(dir).filter(f => /^v42-\d+\.json$/.test(f)).forEach(f => Object.assign(fn, JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).fn));
const D = t => new Date(t).toISOString().slice(0, 10), days = {}, why = { L: {}, S: {} }, eps = [];
Object.keys(fn).forEach(s => {
  const x = fn[s]; if (!x.d) return; let open = null;
  for (let i = 0; i <= x.s.length; i++) {
    const t = x.t0 + i * M15, c = i < x.s.length ? +x.s[i] : -1, sd = i < x.s.length ? x.d[i] : "-";
    if (t >= FROM && i < x.s.length) {
      const d = days[D(t)] = days[D(t)] || { n: 0, plan: { L: 0, S: 0 }, zone: { L: 0, S: 0 }, ready: { L: 0, S: 0 } };
      d.n++; if (c >= 2 && sd !== "-") d.plan[sd]++; if (c >= 5 && sd !== "-") d.zone[sd]++;
      if (c >= 5 && c < 7 && sd !== "-") { const w = x.w[i] || "?"; w.split("+").forEach(k => { why[sd][k] = (why[sd][k] || 0) + 1; }); }
    }
    const rd = c === 7 ? sd : null;
    if (open && open.sd !== rd) { if (open.t >= FROM) { days[D(open.t)].ready[open.sd]++; eps.push({ s, sd: open.sd, at: new Date(open.t).toISOString().slice(5, 16).replace("T", " "), min: (i - open.i) * 15 }); } open = null; }
    if (rd && !open) open = { sd: rd, t, i };
  }
});
const per = Object.keys(days).sort().map(k => { const d = days[k], m = d.n / 96;
  return { day: k, markets: Math.round(m), setupsLong: +(d.plan.L / 96).toFixed(1), setupsShort: +(d.plan.S / 96).toFixed(1), atZoneLong: +(d.zone.L / 96).toFixed(2), atZoneShort: +(d.zone.S / 96).toFixed(2), readyLong: d.ready.L, readyShort: d.ready.S }; });
console.log(JSON.stringify({ markets: Object.keys(fn).length, days: per, why, longs: eps.filter(e => e.sd === "L").slice(-30), shortsN: eps.filter(e => e.sd === "S").length }, null, 1));
