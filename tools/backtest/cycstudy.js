const d = require(process.argv[2]), STABLE = /^(BUSD|USDC|TUSD|PAX|USDS|EUR|GBP|AUD|DAI|FDUSD|USDP|SUSD|UST)USDT$/;
const W = (rows, a, b, f) => { const r = rows.filter(x => x[0] >= a && x[0] <= b); return r.length ? f(...r.map(x => x === undefined ? 0 : x)) : null; };
const lo = (rows, a, b) => { const r = rows.filter(x => x[0] >= a && x[0] <= b); return r.length ? Math.min(...r.map(x => x[3])) : null; };
const hi = (rows, a, b) => { const r = rows.filter(x => x[0] >= a && x[0] <= b); return r.length ? Math.max(...r.map(x => x[2])) : null; };
const last = (rows, a) => { const r = rows.filter(x => x[0] <= a); return r.length ? r[r.length - 1][4] : null; };
const rows = [], dead = [];
for (const s of Object.keys(d)) { if (STABLE.test(s)) continue; const k = d[s];
  const L1 = lo(k, "2020-03", "2020-12"), H1 = hi(k, "2021-01", "2021-12"), L2 = lo(k, "2022-06", "2023-09"), H2 = hi(k, "2023-10", "2025-10");
  if (!L1 || !H1) continue; if (!L2 || !H2 || k[k.length - 1][0] < "2025-06") { dead.push(s); continue; }
  const p23 = last(k, "2023-09"), vol = k.filter(x => x[0] >= "2023-01" && x[0] <= "2023-09").reduce((a, x) => a + x[5], 0);
  rows.push({ s, c1: H1 / L1, c2: H2 / L2, dd: L2 / H1, rec: H2 >= H1, pre: p23 / H1, vol }); }
const B = rows.find(r => r.s === "BTCUSDT");
console.log("coins with both cycles", rows.length, "| delisted or no data after mid-2025:", dead.length, dead.join(" "));
console.log("BTC cycle1 x" + B.c1.toFixed(1), "cycle2 x" + B.c2.toFixed(1));
function rank(a) { const o = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = []; o.forEach((x, j) => r[x[1]] = j); return r; }
function sp(a, b) { const ra = rank(a), rb = rank(b), n = a.length, ma = (n - 1) / 2; let s = 0, sa = 0, sb = 0; for (let i = 0; i < n; i++) { s += (ra[i] - ma) * (rb[i] - ma); sa += (ra[i] - ma) ** 2; sb += (rb[i] - ma) ** 2; } return s / Math.sqrt(sa * sb); }
const C2 = rows.map(r => r.c2);
console.log("rank correlation with cycle-2 multiple: cycle-1 multiple", sp(rows.map(r => r.c1), C2).toFixed(2), "| depth of 2022 bear (low/2021 high)", sp(rows.map(r => r.dd), C2).toFixed(2), "| price in 2023 vs 2021 high", sp(rows.map(r => r.pre), C2).toFixed(2), "| 2023 volume", sp(rows.map(r => r.vol), C2).toFixed(2));
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(p * (b.length - 1))]; };
console.log("cycle-2 multiple: median x" + q(C2, .5).toFixed(1), "quartiles x" + q(C2, .25).toFixed(1) + " – x" + q(C2, .75).toFixed(1), "| beat BTC:", rows.filter(r => r.c2 > B.c2).length + "/" + rows.length, "| back above 2021 high:", rows.filter(r => r.rec).length + "/" + rows.length);
// thirds of cycle-1 multiple and of bear depth
for (const [lab, key] of [["cycle-1 multiple", "c1"], ["bear depth (low/2021 high)", "dd"], ["2023 volume", "vol"]]) {
  const srt = rows.slice().sort((a, b) => a[key] - b[key]), t = Math.floor(srt.length / 3);
  console.log(lab + ": " + [srt.slice(0, t), srt.slice(t, 2 * t), srt.slice(2 * t)].map((g, i) => ["bas", "milieu", "haut"][i] + " → cycle-2 médian x" + q(g.map(r => r.c2), .5).toFixed(1) + ", bat BTC " + g.filter(r => r.c2 > B.c2).length + "/" + g.length + ", dépasse 2021 " + g.filter(r => r.rec).length + "/" + g.length).join(" | "));
}
console.log(rows.sort((a, b) => b.c2 - a.c2).slice(0, 12).map(r => r.s.replace("USDT", "") + " x" + r.c2.toFixed(1) + "(c1 x" + r.c1.toFixed(0) + ")").join("  "));
// combined: size (2023 volume, top half) and price held (2023 price vs 2021 high, top half)
const mv = q(rows.map(r => r.vol), .5), mp = q(rows.map(r => r.pre), .5);
for (const [lab, f] of [["gros et prix tenu", r => r.vol >= mv && r.pre >= mp], ["un des deux", r => (r.vol >= mv) !== (r.pre >= mp)], ["petit et prix effondré", r => r.vol < mv && r.pre < mp]]) {
  const g = rows.filter(f); console.log("COMBO " + lab + ": " + g.length + " cryptos, cycle-2 médian x" + q(g.map(r => r.c2), .5).toFixed(1) + ", bat BTC " + g.filter(r => r.c2 > B.c2).length + "/" + g.length + ", dépasse 2021 " + g.filter(r => r.rec).length + "/" + g.length); }
console.log("pre median", mp.toFixed(3));
