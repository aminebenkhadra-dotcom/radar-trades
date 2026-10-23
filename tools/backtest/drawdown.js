// Drawdown of the account over 100 trades by risk per trade, with the results measured on version 41 (used by the profile card).
// Usage: node tools/backtest/drawdown.js
/* Drawdown simulation, corrected: the first version used a linear congruential generator computed in
   floating point (products above 2^53 lose their low bits), so its draws were not reliable.
   This one uses mulberry32 (exact 32-bit integer arithmetic with Math.imul).
   Model: 100 trades, 34 % winners at +1.94 R, losers at -1.06 R (-0.04 R per trade on average),
   risk taken as a fixed share of the CURRENT capital, drawdown measured from the running peak,
   the starting capital counting as the first peak. */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const N=100,RUNS=200000,P=0.34,W=1.94,L=1.06;
function run(risk,seed){
  const rnd=mulberry32(seed),dd=new Float64Array(RUNS),fin=new Float64Array(RUNS);let down=0,streakSum=0,streak8=0;const streaks=[];
  for(let r=0;r<RUNS;r++){let eq=1,peak=1,mdd=0,s=0,ms=0;
    for(let i=0;i<N;i++){const win=rnd()<P;eq*=win?1+risk*W:1-risk*L;if(win)s=0;else{s++;if(s>ms)ms=s}
      if(eq>peak)peak=eq;const d=1-eq/peak;if(d>mdd)mdd=d}
    dd[r]=mdd;fin[r]=eq;if(eq<1)down++;streakSum+=ms;streaks.push(ms);if(ms>=8)streak8++}
  dd.sort();fin.sort();streaks.sort((a,b)=>a-b);
  const q=(a,p)=>a[Math.floor(p*(a.length-1))];
  return{risk:risk*100,dd_median:+(q(dd,.5)*100).toFixed(1),dd_worst10:+(q(dd,.9)*100).toFixed(1),end_down_pct:+(down/RUNS*100).toFixed(1),
    final_median_pct:+((q(fin,.5)-1)*100).toFixed(1),streak_mean:+(streakSum/RUNS).toFixed(2),streak_median:q(streaks,.5),streak8_pct:+(streak8/RUNS*100).toFixed(0)}}
for(const [r,s] of [[0.02,20261023],[0.01,20261024],[0.005,20261025]])console.log(JSON.stringify(run(r,s)));
/* exact check of "ends below the start" at 2 %: losing when the number of winners k satisfies k*ln(1+2%*1.94) + (100-k)*ln(1-2%*1.06) < 0 */
function lnC(n,k){let s=0;for(let i=1;i<=k;i++)s+=Math.log((n-k+i)/i);return s}
for(const risk of [0.02,0.01,0.005]){let p=0;for(let k=0;k<=N;k++){if(k*Math.log(1+risk*W)+(N-k)*Math.log(1-risk*L)<0)p+=Math.exp(lnC(N,k)+k*Math.log(P)+(N-k)*Math.log(1-P))}console.log("exact P(end below start) at",risk*100,"% =",(p*100).toFixed(1),"%")}
