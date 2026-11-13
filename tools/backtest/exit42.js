// Earlier exit advice: on the version 42 replay the state of every trade was noted each hour (o.exits). Each rule below is run
// as a policy: the trade is closed at the first hour the rule is true (at that hour's price, fees in), otherwise it ends as it
// did (stop, target or time). Out, per rule: share of trades closed early, average result per trade against the plain plan,
// what the early exits did to the trades that ended on their stop (share caught, loss at the exit) and to those that reached
// their target (share closed by mistake, gain at the exit). Usage: node exit42.js <dir with v42-*.json>
const fs = require("fs"), path = require("path"), dir = process.argv[2];
const tr = [];
fs.readdirSync(dir).filter(f => /^v42-\d+\.json$/.test(f)).forEach(f => tr.push(...JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).trades));
// x = [bars, score, hard, r, b4, bd, weak, opp, flow]
const twice = f => (x, p) => f(x) && p && f(p);
const R = {
  "now: score<=0 or hard": x => x[2] || x[1] <= 0,
  "score<=1": x => x[2] || x[1] <= 1,
  "score<=2": x => x[2] || x[1] <= 2,
  "score<=3": x => x[2] || x[1] <= 3,
  "4H against": x => x[4] === -1,
  "4H not with": x => x[4] !== 1,
  "4H not with, twice": twice(x => x[4] !== 1),
  "4H against or opposite setup": x => x[4] === -1 || x[7],
  "4H not with + fading": x => x[4] !== 1 && x[6],
  "4H not with + in loss": x => x[4] !== 1 && x[3] < 0,
  "4H not with + loss<-0.3": x => x[4] !== 1 && x[3] < -0.3,
  "score<=2 + in loss": x => (x[2] || x[1] <= 2) && x[3] < 0,
  "score<=3 + in loss": x => (x[2] || x[1] <= 3) && x[3] < 0,
  "score<=3 + loss<-0.3": x => (x[2] || x[1] <= 3) && x[3] < -0.3,
  "fading + in loss": x => x[6] && x[3] < 0,
  "opposite setup": x => !!x[7],
  "loss<-0.5 (any state)": x => x[3] < -0.5,
};
const av = (L, f) => L.length ? +(L.reduce((s, t) => s + f(t), 0) / L.length).toFixed(3) : 0, pc = (n, d) => d ? +(n / d * 100).toFixed(1) : 0;
const out = { trades: tr.length, base: av(tr, t => t.r), baseSl: pc(tr.filter(t => t.how === "sl").length, tr.length), rules: {} };
Object.keys(R).forEach(k => { const f = R[k], res = tr.map(t => { const xs = t.xs || []; for (let i = 0; i < xs.length; i++) if (f(xs[i], i ? xs[i - 1] : null)) return { r: +(xs[i][3] - t.cr).toFixed(3), early: true, t }; return { r: t.r, early: false, t }; });
  const E = res.filter(x => x.early), SL = res.filter(x => x.t.how === "sl"), TP = res.filter(x => x.t.how === "tp");
  out.rules[k] = { exits: pc(E.length, res.length), avg: av(res, x => x.r), gain: +(av(res, x => x.r) - out.base).toFixed(3), exitR: av(E, x => x.r),
    slCaught: pc(SL.filter(x => x.early).length, SL.length), slExitR: av(SL.filter(x => x.early), x => x.r), tpLost: pc(TP.filter(x => x.early).length, TP.length), tpExitR: av(TP.filter(x => x.early), x => x.r), tpBaseR: av(TP.filter(x => x.early), x => x.t.r) }; });
console.log(JSON.stringify(out));
