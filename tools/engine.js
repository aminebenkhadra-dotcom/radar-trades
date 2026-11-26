/* ---------- formatting ---------- */
function fr(v,d){return Number(v).toLocaleString("fr-FR",{minimumFractionDigits:d,maximumFractionDigits:d})}
function px(p){var a=Math.abs(p);return fr(p,a>=1000?1:a>=100?2:a>=1?3:a>=0.01?5:7)}
function pct(v){return fr(v,1)+" %"}
function usd(v){return v>=1e6?fr(v/1e6,1)+" M$":fr(v/1e3,0)+" k$"}
function sgn(v,d){return(v>=0?"+":"−")+fr(Math.abs(v),d)}

/* ---------- indicators ---------- */
function closes(k){var o=new Array(k.length);for(var i=0;i<k.length;i++)o[i]=k[i].c;return o}
function ema(v,n){var k=2/(n+1),e=v[0],o=[e];for(var i=1;i<v.length;i++){e=v[i]*k+e*(1-k);o.push(e)}return o}
function rsi(c,n){n=n||14;if(c.length<n+2)return 50;var g=0,l=0,i,d;
  for(i=1;i<=n;i++){d=c[i]-c[i-1];if(d>0)g+=d;else l-=d}g/=n;l/=n;
  for(i=n+1;i<c.length;i++){d=c[i]-c[i-1];g=(g*(n-1)+Math.max(d,0))/n;l=(l*(n-1)+Math.max(-d,0))/n}
  return l===0?100:100-100/(1+g/l)}
function rsiSeries(c,n){n=n||14;var out=[],g=0,l=0,i,d;if(c.length<n+2)return out;
  for(i=1;i<=n;i++){d=c[i]-c[i-1];if(d>0)g+=d;else l-=d}g/=n;l/=n;
  for(i=0;i<n;i++)out.push(50);out.push(l===0?100:100-100/(1+g/l));
  for(i=n+1;i<c.length;i++){d=c[i]-c[i-1];g=(g*(n-1)+Math.max(d,0))/n;l=(l*(n-1)+Math.max(-d,0))/n;out.push(l===0?100:100-100/(1+g/l))}
  return out}
function atr(k,n){n=n||14;var t=[],i;for(i=1;i<k.length;i++)t.push(Math.max(k[i].h-k[i].l,Math.abs(k[i].h-k[i-1].c),Math.abs(k[i].l-k[i-1].c)));
  if(t.length<n)return t.reduce(function(a,b){return a+b},0)/Math.max(1,t.length);
  var a=0;for(i=0;i<n;i++)a+=t[i];a/=n;for(i=n;i<t.length;i++)a=(a*(n-1)+t[i])/n;return a}
function bias(k){var c=closes(k),e20=ema(c,20),e50=ema(c,50),p=c[c.length-1],a=e20[e20.length-1],b=e50[e50.length-1];
  if(p>b&&a>b)return 1;if(p<b&&a<b)return -1;return 0}
/* trend strength (Wilder): above 25 a trend is established, under 18 the market is ranging */
function adx(k,n){n=n||14;var len=k.length,dx=[],sT=0,sP=0,sM=0,i,P=0,M=0;
  if(len<2*n+2)return 0;
  for(i=1;i<len;i++){
    var up=k[i].h-k[i-1].h,dn=k[i-1].l-k[i].l,p=up>dn&&up>0?up:0,m=dn>up&&dn>0?dn:0,
      t=Math.max(k[i].h-k[i].l,Math.abs(k[i].h-k[i-1].c),Math.abs(k[i].l-k[i-1].c));
    if(i<=n){sT+=t;sP+=p;sM+=m;if(i<n)continue}else{sT=sT-sT/n+t;sP=sP-sP/n+p;sM=sM-sM/n+m}
    P=sT?100*sP/sT:0;M=sT?100*sM/sT:0;dx.push(P+M?100*Math.abs(P-M)/(P+M):0)}
  var a=0;for(i=0;i<n;i++)a+=dx[i];a/=n;for(i=n;i<dx.length;i++)a=(a*(n-1)+dx[i])/n;
  return a}
/* support and resistance: swing points of candle bodies, clustered; nh/nl tell whether the level acted as a top, a bottom, or both */
function levels(k,tol){var L=3,pts=[],i,j;
  function top(c){return Math.max(c.o,c.c)}
  function bot(c){return Math.min(c.o,c.c)}
  for(i=L;i<k.length-L;i++){var H=true,Lo=true;
    for(j=i-L;j<=i+L;j++){if(j===i)continue;if(top(k[j])>=top(k[i]))H=false;if(bot(k[j])<=bot(k[i]))Lo=false}
    if(H)pts.push({p:top(k[i]),t:1});if(Lo)pts.push({p:bot(k[i]),t:-1})}
  pts.sort(function(a,b){return a.p-b.p});
  var out=[],g=[];
  pts.forEach(function(q){if(g.length&&q.p-g[g.length-1].p>tol){out.push(g);g=[]}g.push(q)});
  if(g.length)out.push(g);
  return out.map(function(g){var s=0,nh=0,nl=0;g.forEach(function(q){s+=q.p;if(q.t>0)nh++;else nl++});
    return{p:s/g.length,n:g.length,nh:nh,nl:nl}})}
function orderBlocks(k,a){var out=[],i,j,c,ok;
  for(i=2;i<k.length-3;i++){c=k[i];
    if(c.c<c.o&&k[i+1].c>k[i+1].o&&Math.max(k[i+1].c,k[i+2].c,k[i+3].c)-c.h>1.5*a){
      ok=true;for(j=i+4;j<k.length;j++)if(k[j].c<c.l){ok=false;break}
      if(ok)out.push({dir:1,lo:c.l,hi:c.h})}
    if(c.c>c.o&&k[i+1].c<k[i+1].o&&c.l-Math.min(k[i+1].c,k[i+2].c,k[i+3].c)>1.5*a){
      ok=true;for(j=i+4;j<k.length;j++)if(k[j].c>c.h){ok=false;break}
      if(ok)out.push({dir:-1,lo:c.l,hi:c.h})}}
  return out}
/* price makes a new extreme while RSI does not: last two closing swings, the latest within 12 candles */
function divergence(k,dir){
  var c=closes(k),rs=rsiSeries(c),n=c.length,L=2,piv=[],i,j;
  if(rs.length<40)return false;
  for(i=Math.max(L,n-60);i<n-L;i++){var ok=true;
    for(j=i-L;j<=i+L;j++){if(j===i)continue;if(dir>0?c[j]<=c[i]:c[j]>=c[i]){ok=false;break}}
    if(ok)piv.push(i)}
  if(piv.length<2)return false;
  var a=piv[piv.length-2],b=piv[piv.length-1];
  if(b<n-12)return false;
  return dir>0?(c[b]<c[a]&&rs[b]>rs[a]+3):(c[b]>c[a]&&rs[b]<rs[a]-3)}
/* alternating swing highs and lows on wicks */
function swings(k,L){var out=[],i,j;
  function add(t,p,i){var last=out[out.length-1];
    if(last&&last.t===t){if(t>0?p>last.p:p<last.p){last.p=p;last.i=i}}else out.push({t:t,p:p,i:i})}
  for(i=L;i<k.length-L;i++){var H=true,Lo=true;
    for(j=i-L;j<=i+L;j++){if(j===i)continue;if(k[j].h>=k[i].h)H=false;if(k[j].l<=k[i].l)Lo=false}
    if(H)add(1,k[i].h,i);if(Lo)add(-1,k[i].l,i)}
  return out}
/* share of taker buying in the traded volume; null when the candles carry no flow data */
function share(k,from,to){var q=0,b=0,i;for(i=Math.max(0,from);i<to;i++){if(k[i].b===undefined||isNaN(k[i].b))return null;q+=k[i].q;b+=k[i].b}return q>0?b/q:null}

/* ---------- market context ---------- */
/* how agitated the last 24 hours were: range against the usual daily range, volume against the 30-day average */
function calm(d1,h4,h1){
  var nd=d1.length,n1=h1.length,n4=h4.length,i,adr=0,hi=-Infinity,lo=Infinity,q6=0,q180=0,nq=0;
  if(nd>15){for(i=nd-15;i<nd-1;i++)adr+=d1[i].h-d1[i].l;adr/=14}
  for(i=Math.max(0,n1-24);i<n1;i++){if(h1[i].h>hi)hi=h1[i].h;if(h1[i].l<lo)lo=h1[i].l}
  for(i=Math.max(0,n4-7);i<n4-1;i++)q6+=h4[i].q;for(i=Math.max(0,n4-181);i<n4-1;i++){q180+=h4[i].q;nq++}
  return{rng24:adr>0?(hi-lo)/adr:null,relVol:q180>0?(q6/6)/(q180/nq):null}}
/* what Bitcoin is doing while an altcoin sets up */
function market(d1,h4,h1){var n=h1.length,lo=Infinity,hi=-Infinity,i,p=h1[n-1].c;
  /* up3 / dn3: how far Bitcoin stands from its lowest low / highest high of the last 72 hours, in % (study of 23/11/2026) */
  for(i=Math.max(0,n-72);i<n;i++){if(h1[i].l<lo)lo=h1[i].l;if(h1[i].h>hi)hi=h1[i].h}
  /* r24 / r7: Bitcoin's move over 24 hours and 7 days, in % (strength of a crypto against Bitcoin, memo of 24/11/2026) */
  return{b4:bias(h4),bd:bias(d1.length>90?d1.slice(-90):d1),r4h:(h1[n-1].c/h1[Math.max(0,n-5)].c-1)*100,up3:(p/lo-1)*100,dn3:(p/hi-1)*100,
    r24:(p/h1[Math.max(0,n-25)].c-1)*100,r7:h4.length>43?(h4[h4.length-1].c/h4[h4.length-43].c-1)*100:null}}

/* ---------- setup engine ---------- */
function targets(lv,dir,entry,R,k60){
  /* levels come from candle bodies, so a lone wick is never TP1 */
  var ahead=lv.map(function(l){return dir>0?l.p-entry:entry-l.p}).filter(function(d){return d>0}).sort(function(x,y){return x-y});
  var near=ahead.filter(function(d){return d>=R&&d<=3*R});
  var t1=near.length?near[0]:2*R,beyond=ahead.filter(function(d){return d>=t1+R&&d<=6*R});
  var wick=dir>0?Math.max.apply(null,k60.map(function(x){return x.h}))-entry:entry-Math.min.apply(null,k60.map(function(x){return x.l}));
  return{t1:t1,res:near.length>0,t2:beyond.length?beyond[0]:(wick>=t1+R&&wick<=6*R?wick:t1+2*R),
    block:ahead.some(function(d){return d>0.3*R&&d<R})}}
function mkPlan(r,entry,sl){
  var dir=r.dir,R=Math.abs(entry-sl),t=targets(r.lv,dir,entry,R,r.h4);
  r.plan={entry:entry,sl:sl,tp1:entry+dir*t.t1,tp2:entry+dir*t.t2,rr:t.t1/R,rr2:t.t2/R,zlo:r.z.lo,zhi:r.z.hi,res:t.res,block:t.block};
  return r.plan}
/* at the zone the plan is an entry at the current price; further away, a limit order on the edge of the zone */
function replan(r,opt){
  var K=+(opt&&opt.slk)||PREC.slk,z=r.z,dir=r.dir,edge=dir>0?Math.min(r.price,z.hi):Math.max(r.price,z.lo),entry=r.dist<=0.5?r.price:edge,sl=dir>0?z.lo-K*r.a:z.hi+K*r.a;
  /* stop exposed: the last high (short) or low (long) of the 1H candles of the last hours, on the stop side, sits beyond the stop or
     less than 0.15 4H ATR inside it: a retest of that swing takes the stop. opt.slsw: hours looked at (0: not checked);
     opt.slmode "move": the stop goes 0.15 ATR beyond the swing (when it stays within 1.5 ATR of the first stop), "flag": noted only */
  var nh=opt&&opt.slsw!==undefined?+opt.slsw:PREC.slsw;r.slx=null;
  if(nh>0&&r.h1t&&r.h1t.length){var k=r.h1t.slice(-nh),ext=dir>0?Infinity:-Infinity;
    k.forEach(function(c){ext=dir>0?Math.min(ext,c.l):Math.max(ext,c.h)});
    var gap=(ext-sl)*dir;
    if(isFinite(ext)&&(entry-ext)*dir>0&&gap<0.15*r.a&&gap>-1.5*r.a){
      var nsl=ext-dir*0.15*r.a;r.slx={p:ext,sl0:sl,sl:nsl,h:nh,moved:false};
      if((opt&&opt.slmode||PREC.slmode)==="move"){sl=nsl;r.slx.moved=true}}}
  return mkPlan(r,entry,sl)}

/* first pass, on daily, 4H and 1H candles: direction, entry zone, plan, and everything that describes the context */
function analyze(sym,d1,h4,h1,ctx,opt){
  opt=opt||{};
  var n4=h4.length,n1=h1.length,price=h1[n1-1].c,a=atr(h4),bd=bias(d1.length>90?d1.slice(-90):d1),b4=bias(h4),i,j;
  var c1=closes(h1),c4=closes(h4),r1=rsi(c1),r4=rsi(c4);
  var r={v:3,sym:sym,price:price,bd:bd,b4:b4,r1:r1,r4:r4,h4:h4.slice(-60),h1t:h1.slice(-49,-1).concat(h1.slice(-1)),dir:0,score:0,st:"wait",why:[],plan:null,f:{},a:a};
  if(b4===0||bd===-b4){r.st="none";r.why.push({t:b4===0?"4H sans tendance nette":"1J et 4H en sens opposé",k:"no"});return r}
  var dir=b4,f=r.f;r.dir=dir;f.bd=bd===b4?1:0;
  /* weekly pivots and highs / lows of the last and current weeks (memo of 24/11/2026) */
  r.wk=weekPivots(d1);r.midR=midRange(h1);
  /* memo 2, point 4: daily ATR (14) over price, percentile among the last 365 days (compressed when 10 or less) */
  if(d1.length>120){var vc=d1.slice(-366,-1),vv=[],vi;for(vi=15;vi<vc.length;vi++)vv.push(atr(vc.slice(vi-15,vi))/vc[vi-1].c);var vcur=vv[vv.length-1];r.volPct=Math.round(vv.filter(function(v){return v<=vcur}).length/vv.length*100)}
  var lv=levels(h4,0.5*a),obs=orderBlocks(h4,a),zs=[];
  lv.forEach(function(l){if(dir>0?l.p<=price+0.25*a:l.p>=price-0.25*a)zs.push({lo:l.p-0.25*a,hi:l.p+0.25*a,kind:"sr",n:l.n,flip:l.nh>0&&l.nl>0})});
  obs.forEach(function(o){if(o.dir===dir&&(dir>0?o.lo<price:o.hi>price))zs.push({lo:o.lo,hi:o.hi,kind:"ob",n:1,flip:false})});
  if(!zs.length){r.why.push({t:"Aucune zone d'entrée exploitable",k:"no"});return r}
  zs.sort(function(x,y){return dir>0?y.hi-x.hi:x.lo-y.lo});
  var z=zs[0],conf=zs.some(function(o){return o!==z&&o.kind!==z.kind&&o.lo<=z.hi&&o.hi>=z.lo});
  r.z=z;r.lv=lv;
  var edge=dir>0?Math.min(price,z.hi):Math.max(price,z.lo),dist=Math.max(0,(dir>0?price-edge:edge-price)/a);
  r.dist=dist;r.distPct=Math.abs(price-edge)/price*100;f.dist=dist;

  /* trend: strength, swing structure, long-term side */
  var e50=ema(c4,50);f.adx=adx(h4);
  var sw=swings(h4,3),hs=sw.filter(function(s){return s.t>0}),ls=sw.filter(function(s){return s.t<0});
  f.struct=1;f.broken=0;
  if(hs.length>=2&&ls.length>=2){var H2=hs[hs.length-1],H1=hs[hs.length-2],L2=ls[ls.length-1],L1=ls[ls.length-2];
    var up=H2.p>H1.p&&L2.p>L1.p,dn=H2.p<H1.p&&L2.p<L1.p;
    f.struct=dir>0?(up?2:dn?0:1):(dn?2:up?0:1);
    f.broken=(dir>0?price<L2.p:price>H2.p)?1:0}
  var nd=d1.length,cd=closes(d1);
  if(nd>=200){var e200=ema(cd,200);f.lt=(price>e200[nd-1]?1:-1)*dir}else f.lt=0;

  /* last impulse in the trend direction, and how much of it the pullback has given back */
  var W=Math.min(60,n4-1),xi=n4-1,xp=dir>0?-Infinity:Infinity;
  for(i=n4-1;i>=n4-W;i--){if(dir>0?h4[i].h>xp:h4[i].l<xp){xp=dir>0?h4[i].h:h4[i].l;xi=i}}
  var base=null;for(i=sw.length-1;i>=0;i--){if(sw[i].t===-dir&&sw[i].i<xi){base=sw[i];break}}
  if(!base){var bp=dir>0?Infinity:-Infinity,bi=Math.max(0,xi-20);for(i=bi;i<xi;i++){if(dir>0?h4[i].l<bp:h4[i].h>bp){bp=dir>0?h4[i].l:h4[i].h;bi=i}}base={p:bp,i:bi}}
  var imp=Math.abs(xp-base.p);
  f.retr=imp>0?(dir>0?xp-price:price-xp)/imp:0;
  var qi=0,ni=0,qp=0,np=0;
  for(i=base.i;i<=xi;i++){qi+=h4[i].q;ni++}for(i=xi+1;i<n4-1;i++){qp+=h4[i].q;np++}
  f.pbVol=ni&&np>=2&&qi>0?(qp/np)/(qi/ni):null;

  /* zone: what else sits at the same price */
  function near(p){return p>=z.lo-0.25*a&&p<=z.hi+0.25*a}
  var keys=[],day=d1[nd-1],pd=d1[nd-2],wo=null,mo=null,pwh=null,pwl=null;
  if(conf)keys.push(z.kind==="ob"?(dir>0?"support 4H":"résistance 4H"):"order block");
  if(near(e50[n4-1]))keys.push("moyenne 50 (4H)");
  if(n4>=200&&near(ema(c4,200)[n4-1]))keys.push("moyenne 200 (4H)");
  if(pd&&(near(pd.h)||near(pd.l)))keys.push(near(pd.h)?"plus haut de la veille":"plus bas de la veille");
  for(i=nd-1;i>=Math.max(0,nd-8);i--){if(new Date(d1[i].t).getUTCDay()===1){wo=d1[i].o;
    if(i>=7){pwh=-Infinity;pwl=Infinity;for(j=i-7;j<i;j++){if(d1[j].h>pwh)pwh=d1[j].h;if(d1[j].l<pwl)pwl=d1[j].l}}break}}
  for(i=nd-1;i>=Math.max(0,nd-32);i--){if(new Date(d1[i].t).getUTCDate()===1){mo=d1[i].o;break}}
  if(wo!==null&&near(wo))keys.push("ouverture de la semaine");
  if(mo!==null&&near(mo))keys.push("ouverture du mois");
  if(pwh!==null&&near(pwh))keys.push("plus haut de la semaine passée");else if(pwl!==null&&near(pwl))keys.push("plus bas de la semaine passée");
  var f50=dir>0?xp-0.5*imp:xp+0.5*imp,f62=dir>0?xp-0.618*imp:xp+0.618*imp;
  if(imp>0&&Math.min(f50,f62)<=z.hi+0.25*a&&Math.max(f50,f62)>=z.lo-0.25*a)keys.push("repli de 50 à 62 %");
  for(i=Math.max(1,n4-60);i<n4-2;i++){
    var glo=dir>0?h4[i-1].h:h4[i+1].h,ghi=dir>0?h4[i+1].l:h4[i-1].l;
    if(ghi-glo>0.25*a&&glo<=z.hi&&ghi>=z.lo){var open=true;for(j=i+2;j<n4-1;j++){if(dir>0?h4[j].l<=glo:h4[j].h>=ghi){open=false;break}}
      if(open){keys.push("vide de prix non comblé");break}}}
  r.keys=keys;f.kN=keys.length;f.zkind=z.kind==="ob"?1:0;f.zn=z.n;f.flip=z.flip?1:0;f.conf=conf?1:0;

  /* momentum and volume */
  f.r1=dir>0?r1:100-r1;f.r4=dir>0?r4:100-r4;r.div=divergence(h1,dir);f.div=r.div?1:0;
  var s4=share(h4,n4-7,n4-1);f.dl4=s4===null?null:(dir>0?s4:1-s4);
  var cm=calm(d1,h4,h1);f.rng24=cm.rng24;f.relVol=cm.relVol;

  /* Bitcoin */
  if(ctx&&ctx.btc&&sym!=="BTC"){f.btc4=ctx.btc.b4*dir;f.btcSh=ctx.btc.r4h*dir}else{f.btc4=null;f.btcSh=null}
  /* how far Bitcoin has moved against the trade from its 72-hour extreme: its rise from the low for a short, its fall from the high for a long */
  f.btcReb=ctx&&ctx.btc&&ctx.btc.up3!==undefined?(dir<0?ctx.btc.up3:-ctx.btc.dn3):null;

  /* Nico (memo of 24/11/2026, point 4): the 1H and 4H tunnels (EMA 20 to 50), for the dead zone read with the 15-minute one in enrich;
     point 5: the move over 24 hours against Bitcoin's, in points */
  r.tun={h1:tunnel(h1),h4:tunnel(h4)};
  if(ctx&&ctx.btc&&isFinite(ctx.btc.r24)&&n1>25&&sym!=="BTC")r.rs24=(price/h1[n1-25].c-1)*100-ctx.btc.r24;
  replan(r,opt);
  r.flow=flowRead(h1,h4,dir,r.plan,a,f.struct);
  r.a1=atr(h1);
  return r}

/* ---------- reliability and time to target ---------- */
/* share of the stop-to-target span already behind the price. Averaged over about 20 000 distinct setups of two years it matched
   the share of trades reaching TP1 within 2 points, but it is not the chance of one given setup: since version 42 it is not shown as such. */
function tpOdds(price,sl,tp,dir){
  if(!(sl>0)||!(tp>0)||!(price>0))return null;
  var den=(tp-sl)*dir;if(!(den>0))return null;
  return Math.max(0,Math.min(1,(price-sl)*dir/den))}
/* hours the winning setups of version 42 took to reach TP1, by TP distance in 1H ATR (Wilder, as the app reads it):
   [up to, median, quarter, three quarters]; 4 319 distinct trades over the two years (tools/backtest/ttp42.js, results/ttp-v42.txt).
   The 6-8 ATR group (45.5 h measured, 73 trades) is held at 46.5 h so the time never falls as the distance grows; beyond 8 ATR
   it is scaled with the distance. */
var TTP=[[2,6.5,4.5,11.3],[3,11,5.5,17.8],[4,18.8,11,30.8],[5,27.3,14.5,52.5],[6,46.5,23.8,73.8],[8,46.5,23,72]];
function tpTime(dist,a1){
  if(!(dist>0)||!(a1>0))return null;var k=dist/a1;
  for(var i=0;i<TTP.length;i++)if(k<TTP[i][0])return{k:k,med:TTP[i][1],lo:TTP[i][2],hi:TTP[i][3]};
  var x=k/7;return{k:k,med:46.5*x,lo:23*x,hi:72*x,far:true}}
function hrs(h){if(h<1)return"moins d'1 h";if(h<24)return Math.round(h)+" h";var d=Math.floor(h/24),r=Math.round(h-24*d);if(r===24){d++;r=0}return d+" j"+(r&&d<4?" "+r+" h":"")}

/* ---------- volume profile, anchored VWAP, order flow and price action, read on the last 5 days of 1H candles ---------- */
/* volume at each price: every candle's volume spread evenly over its range; value area = the 70 % of volume around the POC */
function vprofile(k,bins){
  var lo=Infinity,hi=-Infinity,i,j;k.forEach(function(c){if(c.l<lo)lo=c.l;if(c.h>hi)hi=c.h});
  var st=(hi-lo)/bins||1,v=[],vb=[],tot=0;for(i=0;i<bins;i++){v.push(0);vb.push(0)}
  k.forEach(function(c){var a=Math.floor((c.l-lo)/st),b=Math.min(bins-1,Math.floor((c.h-lo)/st)),n=b-a+1,bq=isFinite(c.b)?c.b:c.q/2;
    for(j=a;j<=b;j++){v[j]+=c.q/n;vb[j]+=bq/n}tot+=c.q});
  var pi=0;for(i=1;i<bins;i++)if(v[i]>v[pi])pi=i;
  var up=pi,dn=pi,acc=v[pi];
  while(acc<0.7*tot&&(up<bins-1||dn>0)){var nu=up<bins-1?v[up+1]:-1,nd=dn>0?v[dn-1]:-1;if(nu>=nd){up++;acc+=nu}else{dn--;acc+=nd}}
  return{lo:lo,hi:hi,st:st,v:v,vb:vb,poc:lo+(pi+0.5)*st,vah:lo+(up+1)*st,val:lo+dn*st,tot:tot}}
/* volume-weighted average price from candle i0 to now (q is volume in dollars) */
function avwap(k,i0){var sq=0,sb=0,out=[];for(var i=0;i<k.length;i++){if(i<i0){out.push(null);continue}var tp=(k[i].h+k[i].l+k[i].c)/3;sq+=k[i].q;sb+=k[i].q/tp;out.push(sb>0?sq/sb:null)}return out}
/* candle pattern on one closed candle, read for a long (dir 1) or a short (dir -1): 1 for, -1 against, 0 none */
function paCandle(k1,k0,a,dir){
  if(!k1||!k0||!(a>0))return{s:0};
  var body=Math.abs(k0.c-k0.o),rng=k0.h-k0.l,lw=Math.min(k0.o,k0.c)-k0.l,uw=k0.h-Math.max(k0.o,k0.c),b1=Math.abs(k1.c-k1.o);
  var bullE=k0.c>k0.o&&k1.c<k1.o&&k0.c>=k1.o&&k0.o<=k1.c&&body>=Math.max(b1,0.3*a),bearE=k0.c<k0.o&&k1.c>k1.o&&k0.c<=k1.o&&k0.o>=k1.c&&body>=Math.max(b1,0.3*a);
  var hammer=rng>=0.6*a&&lw>=2*body&&lw>=0.55*rng,star=rng>=0.6*a&&uw>=2*body&&uw>=0.55*rng;
  var s=0,t="";
  if(bullE){s=dir;t="avalement haussier"}else if(bearE){s=-dir;t="avalement baissier"}
  else if(hammer){s=dir;t="mèche de rejet par le bas"}else if(star){s=-dir;t="mèche de rejet par le haut"}
  return{s:s,t:t}}
function flowRead(h1,h4,dir,plan,a,struct){
  var n=h1.length;if(n<60||!plan||!(a>0))return null;
  var w=h1.slice(Math.max(0,n-120)),N=w.length,price=w[N-1].c,i,it=[],sc=0,cat="vp",C={vp:0,aw:0,of:0,dv:0,pa:0};
  function add(pts,k,t){sc+=pts;C[cat]+=pts;it.push({k:k,t:t,c:cat})}
  /* volume profile */
  var vp=vprofile(w,40),e=plan.entry,tp=plan.tp1,near=0.3*a;
  var sup=dir>0?[["POC",vp.poc],["bas de la zone de valeur",vp.val]]:[["POC",vp.poc],["haut de la zone de valeur",vp.vah]];
  var onLvl=sup.filter(function(x){return Math.abs(e-x[1])<=near})[0];
  if(onLvl)add(1,"ok","Entrée sur le "+onLvl[0]+" ("+px(onLvl[1])+") : prix où beaucoup de volume s'est échangé, il sert souvent d'appui");
  var wall=[["POC",vp.poc],[dir>0?"haut de la zone de valeur":"bas de la zone de valeur",dir>0?vp.vah:vp.val]].filter(function(x){return(x[1]-e)*dir>near&&(x[1]-price)*dir>0&&(tp-x[1])*dir>near})[0];
  if(wall)add(-1,"no","Le "+wall[0]+" ("+px(wall[1])+") est entre l'entrée et l'objectif : zone de gros volume qui peut freiner le prix");
  var inVa=price>=vp.val&&price<=vp.vah;
  if(!inVa&&(price-(dir>0?vp.vah:vp.val))*dir>0)add(0,"ok","Prix sorti de la zone de valeur dans ton sens : le marché accepte des prix "+(dir>0?"plus hauts":"plus bas"));
  cat="aw";
  /* anchored VWAP from the highest high and the lowest low of the window */
  var ih=0,il=0;for(i=1;i<N;i++){if(w[i].h>w[ih].h)ih=i;if(w[i].l<w[il].l)il=i}
  var aH=avwap(w,ih),aL=avwap(w,il),vH=aH[N-1],vL=aL[N-1],ab=(price>vH?1:0)+(price>vL?1:0);
  var aw={ih:ih,il:il,hi:vH,lo:vL,sH:aH,sL:aL};
  if(dir>0?ab===2:ab===0)add(1,"ok","Prix "+(dir>0?"au-dessus":"en dessous")+" des deux VWAP ancrés (depuis le plus haut et le plus bas) : "+(dir>0?"acheteurs":"vendeurs")+" en gain");
  else if(dir>0?ab===0:ab===2)add(-1,"no","Prix "+(dir>0?"sous":"au-dessus")+" des deux VWAP ancrés : ceux qui ont "+(dir>0?"acheté":"vendu")+" récemment sont en perte");
  else add(0,"mid","Prix entre les deux VWAP ancrés ("+px(Math.min(vH,vL))+" et "+px(Math.max(vH,vL))+") : pas de camp dominant");
  /* order flow: aggressive buyers minus aggressive sellers (taker volume), cumulated */
  cat="of";
  var cv=[],cum=0,ok=true;w.forEach(function(c){if(!isFinite(c.b)){ok=false;cum+=0}else cum+=2*c.b-c.q;cv.push(cum)});
  var d24=null;
  if(ok&&N>=48){var q=0,d=0;for(i=N-24;i<N;i++){q+=w[i].q;d+=2*w[i].b-w[i].q}d24=q>0?d/q:0;
    if(d24*dir>=0.03)add(1,"ok","Flux d'ordres sur 24 h : "+(dir>0?"acheteurs":"vendeurs")+" agressifs majoritaires (delta "+sgn(d24*100,0)+" %)");
    else if(d24*dir<=-0.03)add(-1,"no","Flux d'ordres sur 24 h contre toi : "+(dir>0?"vendeurs":"acheteurs")+" agressifs majoritaires (delta "+sgn(d24*100,0)+" %)");
    else add(0,"mid","Flux d'ordres équilibré sur 24 h (delta "+sgn(d24*100,0)+" %)");
    cat="dv";
    /* divergence: price makes a new extreme over 12 hours but the cumulative delta does not follow */
    var pH=-Infinity,pL=Infinity,qH=-Infinity,qL=Infinity,cH=-Infinity,cL=Infinity,kH=-Infinity,kL=Infinity;
    for(i=N-24;i<N-12;i++){pH=Math.max(pH,w[i].h);pL=Math.min(pL,w[i].l);cH=Math.max(cH,cv[i]);cL=Math.min(cL,cv[i])}
    for(i=N-12;i<N;i++){qH=Math.max(qH,w[i].h);qL=Math.min(qL,w[i].l);kH=Math.max(kH,cv[i]);kL=Math.min(kL,cv[i])}
    if(qH>pH&&kH<cH)add(dir>0?-1:1,dir>0?"no":"ok","Divergence : nouveau plus haut sans hausse du delta cumulé, les acheteurs s'essoufflent");
    else if(qL<pL&&kL>cL)add(dir>0?1:-1,dir>0?"ok":"no","Divergence : nouveau plus bas sans baisse du delta cumulé, les vendeurs s'essoufflent")}
  cat="pa";
  /* price action: last closed 4H and 1H candles, swing structure */
  var n4=h4.length,a1=atr(w.slice(-60)),c4=paCandle(h4[n4-3],h4[n4-2],a,dir),c1=paCandle(w[N-3],w[N-2],a1,dir);
  [[c4,"4H"],[c1,"1H"]].forEach(function(x){if(x[0].s)add(x[0].s,x[0].s>0?"ok":"no","Bougie "+x[1]+" : "+x[0].t+(x[0].s>0?", dans ton sens":", contre toi"))});
  if(struct===2)add(0,"ok","Structure 4H "+(dir>0?"haussière : plus hauts et plus bas croissants":"baissière : plus hauts et plus bas décroissants"));
  else if(struct===0)add(0,"no","Structure 4H contre toi : "+(dir>0?"plus hauts et plus bas décroissants":"plus hauts et plus bas croissants"));
  var ord={no:0,mid:1,ok:2};it.sort(function(x,y){return ord[y.k]-ord[x.k]});
  return{sc:sc,c:C,v:sc>=2?"ok":sc<=-2?"no":"mid",items:it,poc:vp.poc,vah:vp.vah,val:vp.val,d24:d24,awH:vH,awL:vL,
    vp:{lo:vp.lo,st:vp.st,v:vp.v.map(function(x){return Math.round(x)}),vb:vp.vb.map(function(x){return Math.round(x)})},
    k:w.map(function(c){return[c.o,c.h,c.l,c.c]}),cvd:cv.map(function(x){return Math.round(x)}),ih:ih,il:il,
    sH:aH.map(function(x){return x===null?null:+x.toPrecision(7)}),sL:aL.map(function(x){return x===null?null:+x.toPrecision(7)})}}

/* 15-minute evidence that the pullback is turning at the zone (the last candle of m is the one in progress) */
function triggers(m,dir,z,a4){
  var n=m.length,T={sweep:0,bos:0,candle:0,rsiT:0,delta:0,climax:0,r15:null,ext:null};
  if(n<60)return T;
  var w=m.slice(Math.max(0,n-97),n-1),W=w.length,price=m[n-1].c,i,j,a15=atr(w.slice(-60));
  var rs=rsiSeries(closes(m)),nr=rs.length;
  if(nr>10){var now=rs[nr-1],prev=rs[nr-2],win=rs.slice(-8),ext=dir>0?Math.min.apply(null,win):Math.max.apply(null,win);
    T.r15=now;T.ext=ext;T.rsiT=(dir>0?(ext<=35&&now>prev&&now>ext+3):(ext>=65&&now<prev&&now<ext-3))?1:0}
  /* mirror shorts so that every test below reads as a long */
  function lo(k){return dir>0?k.l:-k.h}
  function hi(k){return dir>0?k.h:-k.l}
  function cl(k){return dir>0?k.c:-k.c}
  var P=dir>0?price:-price,zTop=dir>0?z.hi+0.25*a4:-(z.lo-0.25*a4),zBot=dir>0?z.lo-0.75*a4:-(z.hi+0.75*a4);
  function atZone(v){return v<=zTop&&v>=zBot}
  /* low of the last 6 hours */
  var xi=W-1,xv=Infinity;for(i=W-1;i>=Math.max(0,W-24);i--){if(lo(w[i])<xv){xv=lo(w[i]);xi=i}}
  var sw=swings(w,2),piv=sw.filter(function(s){return s.t===-dir});
  /* liquidity sweep: a wick takes out an earlier 15m swing, then price closes back above it */
  for(j=Math.max(3,W-8);j<W&&!T.sweep;j++){
    for(i=piv.length-1;i>=0;i--){var s=piv[i],sp=dir>0?s.p:-s.p;if(s.i>j-3)continue;if(j-s.i>60)break;
      if(lo(w[j])<sp&&(cl(w[j])>sp||(j+1<W&&cl(w[j+1])>sp))){
        var first=true;for(var q=s.i+1;q<j;q++)if(lo(w[q])<sp){first=false;break}
        if(first&&P>sp&&atZone(lo(w[j]))){T.sweep=1;break}}}}
  /* break of the last lower high once the low is set at the zone */
  if(atZone(xv)&&xi<=W-2&&xi>=3){var ref=null;
    for(i=sw.length-1;i>=0;i--){if(sw[i].t===dir&&sw[i].i<xi){ref=dir>0?sw[i].p:-sw[i].p;break}}
    if(ref===null){ref=-Infinity;for(i=Math.max(0,xi-6);i<xi;i++)if(hi(w[i])>ref)ref=hi(w[i])}
    var fb=-1;for(i=xi+1;i<W;i++){if(cl(w[i])>ref){fb=i;break}}
    if(fb>=W-3&&P>ref)T.bos=1}
  /* reversal candle on the last closed 15m candle: engulfing or long rejection wick */
  if(W>=3){var k0=w[W-1],k1=w[W-2],body=Math.abs(k0.c-k0.o),rng=k0.h-k0.l,bull=dir>0?k0.c>k0.o:k0.c<k0.o;
    var tail=dir>0?Math.min(k0.o,k0.c)-k0.l:k0.h-Math.max(k0.o,k0.c),nose=dir>0?k0.h-Math.max(k0.o,k0.c):Math.min(k0.o,k0.c)-k0.l;
    var eng=bull&&(dir>0?k1.c<k1.o:k1.c>k1.o)&&body>=0.6*a15&&(dir>0?(k0.c>=k1.o&&k0.o<=k1.c):(k0.c<=k1.o&&k0.o>=k1.c));
    var pin=rng>=a15&&tail>=2*body&&nose<=0.35*rng&&tail>=0.5*rng;
    if((eng||pin)&&atZone(lo(k0)))T.candle=1}
  /* taker flow turning: buyers dominate the last three candles after sellers dominated the eight before (for a long) */
  var s3=share(w,W-3,W),s8=share(w,W-11,W-3);
  if(s3!==null&&s8!==null){if(dir<0){s3=1-s3;s8=1-s8}T.delta=s3>=0.54&&s8<=0.49?1:0}
  /* volume climax absorbed at the zone */
  for(j=Math.max(41,W-6);j<W;j++){var av=0;for(i=j-40;i<j;i++)av+=w[i].q;av/=40;var kk=w[j];
    if(av>0&&kk.q>=2.5*av&&atZone(lo(kk))&&cl(kk)>(lo(kk)+hi(kk))/2&&P>=cl(kk)){T.climax=1;break}}
  return T}

/* second pass on the finalists: 15-minute trigger, order book, squeeze */
function enrich(r,m15,book,sqd,opt){
  opt=opt||{};var f=r.f,dir=r.dir;
  if(m15&&m15.length>=60){var T=triggers(m15,dir,r.z,r.a);r.trig=T;r.r15=T.r15}
  /* memo 3, change 2: the same reading on closed 15-minute candles only, to tell « Confirmé » from « En formation » */
  if(m15&&m15.length>=61&&!opt.noConf){var Tc=triggers(m15.slice(0,-1),dir,r.z,r.a);r.trigC=Tc;r.t15=m15[m15.length-1].t}
  if(m15&&m15.length>=60&&r.tun){var t15=tunnel(m15),pz=m15[m15.length-1].c;r.dz=deadZone(pz,t15,r.tun.h1)?"15 min / 1H":deadZone(pz,r.tun.h1,r.tun.h4)?"1H / 4H":null}
  var b=bookStats(book,dir,r.plan);r.book=b;
  var hm=opt.noHeat?null:(m15&&m15.length>=100?heatModel(m15):null);
  r.sq=squeeze(sqd||{fund:r.fund===undefined?null:r.fund,ls:null,oi:null},hm);
  /* memo 2 of 25/11/2026, point 1: the price and the open interest over 24 hours (open interest read on 25 hourly points) */
  if(m15&&m15.length>97){var c0=m15[m15.length-97].c,c1=m15[m15.length-1].c;r.px24=c0>0?(c1/c0-1)*100:null}
  r.oi24=sqd&&sqd.oi!==null&&sqd.oi!==undefined&&isFinite(sqd.oi)?+sqd.oi:null;r.fr=sqd&&sqd.fund!==null&&isFinite(sqd.fund)?sqd.fund*100:(isFinite(r.fund)?r.fund*100:null);
  f.sqA=dir>0?r.sq.dn:r.sq.up;f.sqF=dir>0?r.sq.up:r.sq.dn;
  if(hm){var p=r.plan;
    r.liqOwn=(dir>0?hm.below:hm.above).filter(function(z){return dir>0?(z.p>p.sl&&z.p<p.entry):(z.p<p.sl&&z.p>p.entry)})[0]||null;
    r.liqMag=(dir>0?hm.above:hm.below).filter(function(z){var g=(z.p-r.price)/r.price*dir;return g>0&&g<0.15})[0]||null}
  return r}

/* ---------- verdict: six checks, a score, a status ----------
   Tendance, Zone and Risque must pass for a setup to be "Prêt"; the strictness setting adds Déclencheur, then Marché and Élan.
   Four statuses: "ready" (prêt selon les règles), "watch" (à surveiller), "refused" (refusé), "incomplete" (données incomplètes).
   Missing data never earns points, and a critical blocker (wide spread, obstacle before 1R) takes "ready" away. */
/* reb: off by default here (the sister apps keep their rules); Radar Trades passes reb 7, see REB in its page */
var PREC={strict:2,minRR:1.5,slk:0.5,feeCap:8,fee:0.05,lev:5,spreadWatch:0.15,spreadRefuse:0.5,slsw:0,slmode:"move",reb:0};
function judge(r,opt){
  opt=opt||{};
  if(!r.plan){r.score=r.dir?(r.f.bd?25:12):0;r.blk=[];r.miss=[];return r}
  var f=r.f,dir=r.dir,L=dir>0,p=r.plan,q=!!opt.quiet,strict=opt.strict===undefined?PREC.strict:+opt.strict,
    minRR=+opt.minRR||PREC.minRR,lev=+opt.lev||PREC.lev,cap=+opt.feeCap||PREC.feeCap,
    cost=(2*(opt.fee===undefined?PREC.fee:+opt.fee)+0.02)/100,blk=[],md=[];
  function fam(k,label){return{k:k,label:label,ok:true,pts:0,items:[],head:""}}
  function add(g,k,pts,text){g.pts+=pts;if(!q)g.items.push({k:k,t:text()})}
  var G={trend:fam("trend","Tendance"),mkt:fam("mkt","Marché"),zone:fam("zone","Zone"),trig:fam("trig","Déclencheur"),mom:fam("mom","Élan"),risk:fam("risk","Risque")},g;

  /* Tendance */
  g=G.trend;
  if(f.bd)add(g,"ok",15,function(){return"Tendance 1J et 4H alignées ("+(L?"haussière":"baissière")+")"});
  else add(g,"mid",9,function(){return"1J neutre, 4H "+(L?"haussier":"baissier")});
  if(f.adx>=25)add(g,"ok",4,function(){return"ADX 4H à "+Math.round(f.adx)+" : tendance installée"});
  else if(f.adx>=18)add(g,"mid",2,function(){return"ADX 4H à "+Math.round(f.adx)+" : tendance modérée"});
  else add(g,"no",0,function(){return"ADX 4H à "+Math.round(f.adx)+" : marché sans direction nette"});
  if(f.broken){g.ok=false;add(g,"no",0,function(){return(L?"Dernier creux 4H enfoncé":"Dernier sommet 4H dépassé")+" : tendance remise en cause"})}
  else if(f.struct===2)add(g,"ok",3,function(){return"Sommets et creux 4H de plus en plus "+(L?"hauts":"bas")});
  else if(f.struct===1)add(g,"mid",1,function(){return"Structure 4H mixte"});
  else add(g,"no",0,function(){return"Structure 4H encore orientée à l'inverse"});
  if(f.lt>0)add(g,"ok",3,function(){return"Prix "+(L?"au-dessus de":"sous")+" sa moyenne 200 jours"});
  else if(f.lt<0)add(g,"no",0,function(){return"Trade contre la tendance de fond (moyenne 200 jours)"});
  else add(g,"mid",1,function(){return"Moins de 200 jours d'historique : tendance de fond inconnue"});
  if(strict>=2&&(!f.bd||f.adx<18))g.ok=false;
  /* opt.side (study of 23/11/2026): -1 shorts only, 1 longs only, 0 or absent both sides; the other side is shown, never "ready" */
  var sd=+opt.side||0;
  if(sd&&dir!==sd){g.ok=false;add(g,"no",0,function(){return L?"Longs de tendance pas proposés : ils ont perdu sur deux ans de rejeu":"Shorts de tendance pas proposés"})}
  if(!q)g.head=(L?"Haussière":"Baissière")+(f.bd?" 1J + 4H":" 4H seule")+" · ADX "+Math.round(f.adx);

  /* Marché */
  g=G.mkt;var agit=(f.rng24!==null&&f.rng24>1.3)||(f.relVol!==null&&f.relVol>1.5),quiet=f.rng24!==null&&f.rng24<0.75&&(f.relVol===null||f.relVol<0.8);
  if(f.btc4===null){
    if(r.sym==="BTC")add(g,"ok",7,function(){return"Bitcoin lui-même : pas de filtre de marché"});
    else{g.ok=false;if(strict>=2)md.push("contexte Bitcoin");add(g,"no",0,function(){return"Contexte Bitcoin non lu : contrôle impossible, aucun point accordé"})}}
  else{
    if(f.btc4>0)add(g,"ok",5,function(){return"Bitcoin dans le même sens sur 4H"});
    else if(f.btc4===0)add(g,"mid",3,function(){return"Bitcoin sans tendance sur 4H"});
    else{g.ok=false;add(g,"no",0,function(){return"Bitcoin en tendance inverse sur 4H"})}
    if(f.btcSh<=-1.5){g.ok=false;add(g,"no",0,function(){return"Bitcoin : "+sgn(f.btcSh*dir,1)+" % en 4 h, contre le trade"})}
    else g.pts+=2}
  /* opt.reb (study of 23/11/2026): no short while Bitcoin stands reb % or more above its 72-hour low, no long reb % under its 72-hour high */
  var rebT=opt.reb!==undefined?+opt.reb:PREC.reb;
  if(rebT>0&&f.btcReb!==null&&f.btcReb>=rebT){g.ok=false;add(g,"no",0,function(){return dir<0?"Bitcoin a rebondi de "+fr(f.btcReb,1)+" % depuis son plus bas de 72 h : pas de short pendant un rebond":"Bitcoin a reculé de "+fr(f.btcReb,1)+" % depuis son plus haut de 72 h : pas de long pendant une chute"})}
  if(f.rng24!==null){
    if(agit)add(g,"mid",0,function(){return"Marché agité : amplitude 24 h à "+fr(f.rng24*100,0)+" % de la normale"+(f.relVol>1.5?", volume ×"+fr(f.relVol,1):"")});
    else if(quiet)add(g,"ok",3,function(){return"Marché calme : amplitude 24 h à "+fr(f.rng24*100,0)+" % de la normale"});
    else add(g,"ok",2,function(){return"Activité normale sur 24 h"})}
  if(!q)g.head=(f.btc4===null?(r.sym==="BTC"?"Bitcoin":"Bitcoin non lu"):f.btc4>0?"Bitcoin aligné":f.btc4===0?"Bitcoin neutre":"Bitcoin contre")+(agit?" · agité":quiet?" · calme":"");

  /* Zone */
  g=G.zone;var kind=f.conf?"Order block et "+(L?"support":"résistance")+" 4H":f.zkind?"Order block 4H":(L?"Support":"Résistance")+" 4H";
  if(r.dist<=0.5)add(g,"ok",12,function(){return r.dist===0?"Prix dans la zone d'entrée":"Prix au contact de la zone d'entrée"});
  else{g.ok=false;
    if(r.dist<=1.5)add(g,"mid",7,function(){return"Prix à "+pct(r.distPct)+" de la zone"});
    else add(g,"no",r.dist<=3?2:0,function(){return"Prix encore à "+pct(r.distPct)+" de la zone"})}
  var extra=r.keys||[],nk=extra.length+(f.flip?1:0);
  add(g,nk?"ok":"mid",Math.min(8,3*nk),function(){
    return"Zone : "+kind.charAt(0).toLowerCase()+kind.slice(1)+(!f.zkind&&f.zn>1?" ("+f.zn+" points de contact)":"")+(f.flip?", "+(L?"ancienne résistance devenue support":"ancien support devenu résistance"):"")
      +(extra.length?". Au même niveau : "+extra.join(", "):nk?"":", sans autre repère au même niveau")});
  var rp=Math.round(f.retr*100);
  if(f.retr>0.79){g.ok=false;add(g,"no",0,function(){return"Impulsion presque effacée : "+rp+" % déjà rendus"})}
  else if(f.retr>=0.25&&f.retr<=0.7)add(g,"ok",5,function(){return"Repli de "+rp+" % de la dernière impulsion"});
  else add(g,"mid",2,function(){return f.retr<0.25?"Repli faible ("+Math.max(0,rp)+" %) : entrée proche "+(L?"des sommets":"des creux"):"Repli profond ("+rp+" %)"});
  if(strict>=2&&!nk)g.ok=false;
  if(!q)g.head=(r.dist>0.5?"À "+pct(r.distPct)+" · ":"")+kind.replace(" 4H","")+(nk?" · "+nk+(nk>1?" repères":" repère"):(f.zkind||f.conf||L?" isolé":" isolée"));

  /* Déclencheur */
  g=G.trig;var T=r.dist<=0.5?r.trig:null;
  if(!T){g.ok=false;if(r.dist<=0.5&&strict>=1)md.push("bougies 15 min");
    add(g,"mid",0,function(){return r.dist<=0.5?"Signal 15 min non vérifié : bougies 15 min non lues":"Signal 15 min à lire quand le prix sera sur la zone"});if(!q)g.head=r.dist<=0.5?"Non vérifié":"En attente du prix"}
  else{var names=[];
    if(T.bos){g.pts+=8;names.push("cassure")}if(T.sweep){g.pts+=6;names.push("balayage")}if(T.candle){g.pts+=4;names.push("bougie")}
    if(T.rsiT){g.pts+=3;names.push("RSI")}if(T.delta){g.pts+=3;names.push("flux")}if(T.climax){g.pts+=3;names.push("volume")}
    g.pts=Math.min(15,g.pts);g.ok=!!(T.bos||T.sweep||T.candle+T.rsiT+T.delta+T.climax>=2);
    if(!q){
      if(T.bos)g.items.push({k:"ok",t:"Cassure du dernier "+(L?"sommet":"creux")+" 15 min après le point "+(L?"bas":"haut")});
      if(T.sweep)g.items.push({k:"ok",t:"Mèche "+(L?"sous un creux":"au-dessus d'un sommet")+" récent puis retour : stops balayés"});
      if(T.candle)g.items.push({k:"ok",t:"Bougie de retournement 15 min sur la zone"});
      if(T.rsiT)g.items.push({k:"ok",t:"RSI 15 min se retourne ("+Math.round(T.ext)+" → "+Math.round(T.r15)+")"});
      if(T.delta)g.items.push({k:"ok",t:"Les "+(L?"acheteurs":"vendeurs")+" reprennent la main sur 15 min"});
      if(T.climax)g.items.push({k:"ok",t:"Pic de volume absorbé sur la zone"});
      if(!names.length)g.items.push({k:"no",t:"Aucun signal de retournement sur 15 min"});
      else if(!g.ok)g.items.push({k:"mid",t:"Un seul signal léger : pas encore de confirmation"});
      g.head=g.ok?names.slice(0,3).join(" + ")+" 15 min":names.length?"Signal léger seulement ("+names[0]+")":"Aucun signal 15 min"}}

  /* Élan */
  g=G.mom;var lab="RSI 1H à "+Math.round(r.r1);
  if(f.r1<=45)add(g,"ok",4,function(){return lab+" : repli en place"});
  else if(f.r1<=55)add(g,"mid",2,function(){return lab+" : repli partiel"});
  else{g.ok=false;add(g,"no",0,function(){return lab+" : pas encore de repli"})}
  if(f.r4<70)g.pts+=2;else{g.ok=false;add(g,"no",0,function(){return"RSI 4H déjà en excès ("+Math.round(r.r4)+")"})}
  if(r.div)add(g,"ok",2,function(){return"Divergence RSI 1H "+(L?"haussière":"baissière")});
  if(f.pbVol!==null){
    if(f.pbVol<0.8)add(g,"ok",1,function(){return"Volume plus faible dans le repli que dans l'impulsion"});
    else if(f.pbVol>1.2)add(g,"no",0,function(){return"Volume plus fort dans le repli que dans l'impulsion"})}
  if(f.dl4!==null){
    if(f.dl4>=0.52)add(g,"ok",1,function(){return(L?"Acheteurs":"Vendeurs")+" à l'initiative sur 24 h ("+Math.round(f.dl4*100)+" % du volume)"});
    else if(f.dl4<=0.47)add(g,"no",0,function(){return(L?"Vendeurs":"Acheteurs")+" à l'initiative sur 24 h ("+Math.round((1-f.dl4)*100)+" % du volume)"})}
  var b=r.book;
  if(b){var sh=L?b.bid:100-b.bid,rg=" à ±"+fr(b.range,b.range<1?2:1)+" %";
    if(sh>=55)add(g,"ok",0,function(){return"Carnet : "+Math.round(sh)+" % "+(L?"d'acheteurs":"de vendeurs")+rg});
    else if(sh<45)add(g,"no",0,function(){return"Carnet contre le trade ("+Math.round(sh)+" % "+(L?"d'acheteurs":"de vendeurs")+rg+")"})}
  if(!q)g.head=lab+(f.r1<=45?" · repli en place":f.r1<=55?" · repli partiel":" · pas de repli")+(r.div?" · divergence":"");

  /* Risque */
  g=G.risk;var R=Math.abs(p.entry-p.sl),c=cost*p.entry,fees=R?c/R*100:99,rrNet=R?(Math.abs(p.tp1-p.entry)-c)/(R+c):0,stopPct=R/p.entry*100;
  r.costPct=fees;r.rrNet=rrNet;
  var tgt=p.res?" sur "+(L?"une résistance":"un support")+" 4H":" (aucun niveau proche, objectif fixe)";
  if(rrNet>=2)add(g,"ok",6,function(){return"TP1 à "+fr(rrNet,1)+"R net de frais"+tgt});
  else if(rrNet>=minRR)add(g,"ok",4,function(){return"TP1 à "+fr(rrNet,1)+"R net de frais"+tgt});
  else{g.ok=false;add(g,"no",1,function(){return"TP1 à "+fr(rrNet,1)+"R net de frais : sous ton minimum de "+fr(minRR,1)+"R"})}
  if(fees<=cap)add(g,"ok",3,function(){return"Frais et glissement ≈ "+fr(fees,0)+" % du risque"});
  else{g.ok=false;add(g,"no",0,function(){return"Frais et glissement ≈ "+fr(fees,0)+" % du risque : stop trop serré"})}
  /* critical obstacle: a 4H level the price has to cross before it has even made 1R */
  if(p.block){blk.push({k:"obst",sev:"watch",t:"Niveau 4H entre l'entrée et 1R : obstacle avant même le premier R"});
    add(g,"no",0,function(){return"Obstacle critique : niveau 4H avant 1R (bloque le statut « Prêt »)"})}
  else g.pts+=3;
  /* the leverage only decides where the liquidation sits: the size step lowers it when the stop is too far, it does not fail the setup */
  if(stopPct>=90/lev)add(g,"mid",0,function(){return"Stop à "+pct(stopPct)+" : à levier x"+lev+" la liquidation arriverait avant, un levier plus bas est indiqué dans la taille"});
  else g.pts+=1;
  if(r.sq){var nA=L?"long squeeze":"short squeeze",wA=(L?r.sq.wd:r.sq.wu).join(", "),wF=(L?r.sq.wu:r.sq.wd).join(", ");
    if(f.sqA>=60){g.ok=false;add(g,"no",0,function(){return"Risque élevé de "+nA+" contre le trade"+(wA?" ("+wA+")":"")})}
    else if(f.sqA>=35)add(g,"mid",1,function(){return"Risque modéré de "+nA+(wA?" ("+wA+")":"")});
    else g.pts+=2;
    if(f.sqF>=60)add(g,"ok",0,function(){return"Potentiel de "+(L?"short squeeze":"long squeeze")+" dans le sens du trade"+(wF?" ("+wF+")":"")})}
  else add(g,"mid",0,function(){return"Risque de squeeze non mesuré (données de positionnement non lues)"});
  if(b){
    /* a resting wall counts as critical only when it sits before 1R; further away it is shown, not blocking */
    if(b.block){var wR=Math.abs(b.block.p-p.entry)<R;
      if(wR)blk.push({k:"mur",sev:"watch",t:"Mur "+(L?"vendeur":"acheteur")+" à "+px(b.block.p)+" avant 1R"});
      add(g,"no",0,function(){return"Mur "+(L?"vendeur":"acheteur")+" à "+px(b.block.p)+" ("+usd(b.block.n)+") avant TP1"+(wR?", et même avant 1R : obstacle critique":"")})}
    if(b.guard)add(g,"ok",0,function(){return"Mur "+(L?"acheteur":"vendeur")+" à "+px(b.guard.p)+" ("+usd(b.guard.n)+") devant le stop"});
    if(b.spread>PREC.spreadRefuse){blk.push({k:"spread",sev:"refuse",t:"Écart achat-vente de "+fr(b.spread,2)+" % (au-delà de "+fr(PREC.spreadRefuse,2)+" %)"});
      add(g,"no",0,function(){return"Écart achat-vente de "+fr(b.spread,2)+" % : marché trop peu liquide, setup refusé"})}
    else if(b.spread>PREC.spreadWatch){blk.push({k:"spread",sev:"watch",t:"Écart achat-vente de "+fr(b.spread,2)+" % (au-delà de "+fr(PREC.spreadWatch,2)+" %)"});
      add(g,"no",0,function(){return"Écart achat-vente large ("+fr(b.spread,2)+" %) : pas de « Prêt » tant qu'il dépasse "+fr(PREC.spreadWatch,2)+" %"})}}
  else if(r.dist<=0.5&&!opt.noBook)md.push("carnet d'ordres");
  /* stop exposed: refused, not just held back (17/11/2026, XMR short taken while « À surveiller », stopped by a retest of the swing
     then back to the entry). Same trades left out as the f24 test of stop42.js: -0.064 R and +0.062 R a trade, against -0.081 and +0.017 */
  /* not p.sl===sl0: in the app the plan is rounded to the contract's tick before this check, so the stop never matched and an exposed
     stop was never flagged in a live scan (18/11/2026, BTW short « Prêt » with the 24 h high above its stop) */
  if(r.slx&&!r.slx.moved&&(opt.slmode||PREC.slmode)==="flag")blk.push({k:"stopx",sev:"refuse",t:"Stop exposé : "+(L?"creux":"sommet")+" récent à "+px(r.slx.p)+", juste derrière le stop. Un retour sur ce niveau le déclenche : ne pas prendre"});
  if(r.liqOwn)add(g,"no",0,function(){return"Zone de liquidation de "+(L?"longs":"shorts")+" vers "+px(r.liqOwn.p)+", entre l'entrée et le stop : mèche possible"});
  if(r.liqMag)add(g,"mid",0,function(){return"Aimant possible : liquidations de "+(L?"shorts":"longs")+" vers "+px(r.liqMag.p)+" ("+sgn((r.liqMag.p-r.price)/r.price*100,1)+" %)"});
  g.pts=Math.min(15,g.pts);
  if(!q)g.head="R:R "+fr(rrNet,1)+" net · frais "+fr(fees,0)+"\u00a0%";

  /* opt.prof (study of 23/11/2026, Radar Trades): « Prêt » only for the two profiles that won on both years of replay (60 markets, fees
     included, feat.yml + prof42.js): a long in an agitated market (24-hour range above 130 % of normal), a short while Bitcoin moved 0
     to 1 % its way over 4 hours. Any other setup stays « À surveiller » with the reason; both sides are always analysed */
  /* opt.oiTag (memo 2 of 25/11/2026, point 1, top 30 by capitalisation): price against open interest over 24 hours, labels only.
     « hausse sans acheteurs »: price up 1 % or more while open interest fell 2 % or more; « vendeurs qui ajoutent »: price down 1 % or
     more while open interest rose 2 % or more. An extreme funding (+0.05 % or −0.03 % or beyond) is added to the label, never alone */
  if(opt.oiTag&&r.cap&&r.cap<=30&&r.px24!==null&&r.px24!==undefined&&r.oi24!==null){var tg=null,fx=r.fr!==null&&(r.fr>=0.05||r.fr<=-0.03)?" · funding "+(r.fr>0?"+":"")+fr(r.fr,3)+" %":"";
    if(r.px24>=1&&r.oi24<=-2)tg=["Hausse sans acheteurs","prix "+sgn(r.px24,1)+" % en 24 h, positions ouvertes "+sgn(r.oi24,1)+" %",-1];
    else if(r.px24<=-1&&r.oi24>=2)tg=["Vendeurs qui ajoutent","prix "+sgn(r.px24,1)+" % en 24 h, positions ouvertes "+sgn(r.oi24,1)+" %",-1];
    /* a label, not a signal: on the replay (memo2.yml) these cases did not win more often, either side */
    if(tg){r.oiTag=tg[0];add(G.mkt,"mid",0,function(){return tg[0]+" : "+tg[1]+fx})}}
  /* opt.volTag (memo 2, point 4): compressed volatility, a warning only */
  if(opt.volTag&&isFinite(r.volPct)&&r.volPct<=10)add(G.risk,"mid",0,function(){return"Volatilité compressée ("+r.volPct+"e centile de l'année) : un gros mouvement peut arriver, garde le stop prévu, pas plus serré"});
  /* opt.big (memo of 24/11/2026, point 3, longs only): a long with a big resistance less than 3 % above its entry (weekly R1 or pivot,
     high of last week or of this week) stays « À surveiller »: on both years of replay these longs lost, the others won */
  if(opt.big&&L&&r.wk&&r.plan){var wk=r.wk,eb=r.plan.entry,bl=[[wk.R1,"R1 hebdo"],[wk.P,"pivot hebdo"],[wk.H,"plus haut de la semaine passée"],[wk.cH,"plus haut de la semaine"]].filter(function(x){return isFinite(x[0])&&x[0]>eb}).sort(function(a,b){return a[0]-b[0]})[0];
    if(bl&&(bl[0]-eb)/eb*100<3)blk.push({k:"big",sev:"watch",t:"Grosse résistance à "+fr((bl[0]-eb)/eb*100,1)+" % au-dessus de l'entrée ("+bl[1]+", "+px(bl[0])+") : sur deux ans, les longs dans ce cas ont perdu"})}
  /* Nico (memo of 24/11/2026): opt.big2, a big level less than 3 % on the way, both sides (support under a short, resistance over a
     long), and opt.dz, the dead zone between two tunnels: « À surveiller », as the memo asks. opt.nicoPts: weekly pivot near the zone or
     the target, and strength against Bitcoin over 24 hours, as score only */
  if(opt.big2&&r.wk&&r.plan){var w2=r.wk,e2=r.plan.entry,b2=(L?[[w2.R1,"R1 hebdo"],[w2.P,"pivot hebdo"],[w2.H,"plus haut de la semaine passée"],[w2.cH,"plus haut de la semaine"]]:[[w2.S1,"S1 hebdo"],[w2.P,"pivot hebdo"],[w2.L,"plus bas de la semaine passée"],[w2.cL,"plus bas de la semaine"]])
      .filter(function(x){return isFinite(x[0])&&(x[0]-e2)*dir>0}).sort(function(a,b){return Math.abs(a[0]-e2)-Math.abs(b[0]-e2)})[0];
    if(b2&&Math.abs(b2[0]-e2)/e2*100<3)blk.push({k:"big",sev:"watch",t:(L?"Grosse résistance":"Gros support")+" à "+fr(Math.abs(b2[0]-e2)/e2*100,1)+" % de l'entrée ("+b2[1]+", "+px(b2[0])+") : Nico conseille d'attendre"})}
  if(opt.dz&&r.dz)blk.push({k:"dz",sev:"watch",t:"Zone morte : prix coincé entre les moyennes "+r.dz+" (Nico)"});
  if(opt.nicoPts&&r.wk&&r.plan){var pvs=[r.wk.P,r.wk.R1,r.wk.S1].filter(isFinite),ax=r.a||0;
    if(ax>0&&pvs.some(function(v){return Math.abs(v-r.plan.entry)<0.25*ax||Math.abs(v-r.plan.tp1)<0.25*ax}))add(G.zone,"ok",3,function(){return"Pivot hebdomadaire sur la zone ou le TP (Nico)"});
    if(isFinite(r.rs24)&&r.rs24*dir>0)add(G.mkt,"ok",3,function(){return(L?"Plus forte":"Plus faible")+" que Bitcoin sur 24 h ("+sgn(r.rs24*dir,1)+" points) (Nico)"})}
  /* memo 3: « Milieu de range — pas d'avantage », an orange label and a small score cut, never a block */
  if(opt.midTag&&r.midR)add(G.zone,"mid",-4,function(){return"Milieu de range, pas d'avantage : prix à "+fr(r.midR.pos*100,0)+" % entre le plus bas ("+px(r.midR.lo)+") et le plus haut ("+px(r.midR.hi)+") des 48 dernières heures, moyennes 1H à plat"});
  if(opt.prof){var pw=L?f.rng24!==null&&f.rng24>1.3:f.btcSh!==null&&f.btcSh>=0&&f.btcSh<1;r.prof=pw?1:0;
    if(pw)add(G.mkt,"ok",0,function(){return L?"Profil gagnant : marché agité (amplitude 24 h à "+fr(f.rng24*100,0)+" % de la normale), le seul où les longs ont gagné sur deux ans":"Profil gagnant : Bitcoin "+sgn(-f.btcSh,1)+" % sur 4 h, le cas où les shorts ont le mieux gagné sur deux ans"});
    else blk.push({k:"prof",sev:"watch",t:L?"Profil sans avantage : sur deux ans, les longs n'ont gagné que dans un marché agité (amplitude 24 h au-dessus de 130 % de la normale)"+(f.rng24!==null?" ; ici "+fr(f.rng24*100,0)+" %":""):"Profil sans avantage : sur deux ans, les shorts ont gagné quand Bitcoin baissait de 0 à 1 % sur 4 h"+(f.btcSh!==null?" ; ici "+sgn(-f.btcSh,1)+" %":"")})}
  var list=[G.trend,G.mkt,G.zone,G.trig,G.mom,G.risk],sc=0,miss=0;
  list.forEach(function(x){sc+=x.pts});
  if(strict>=1&&!G.trig.ok)miss++;if(strict>=2&&!G.mkt.ok)miss++;if(strict>=2&&!G.mom.ok)miss++;
  var core=G.trend.ok&&G.risk.ok;
  r.score=Math.max(0,Math.min(100,Math.round(sc)));
  /* refused when a core check fails, ready when every required check passes, watch otherwise;
     a critical blocker then takes "ready" away (or refuses), and missing essential data makes the reading incomplete */
  var st=!core?"refused":G.zone.ok&&!miss?"ready":"watch";r.st0=st;
  if(blk.some(function(x){return x.sev==="refuse"}))st="refused";
  else if(st==="ready"&&blk.length)st="watch";
  if(st!=="refused"&&md.length)st="incomplete";
  r.st=st;r.blk=blk;r.miss=md;
  if(!q){
    /* green: passes cleanly; amber: passes with a weak point, or still pending; red: fails */
    var pend={trig:!T,zone:r.dist>0.5&&r.dist<=1.5&&f.retr<=0.79};
    r.gates=list.map(function(x){var bad=x.items.some(function(i){return i.k==="no"});
      return{k:x.k,label:x.label,ok:x.ok,st:x.ok?(bad?"mid":"ok"):(pend[x.k]?"mid":"no"),head:x.head,items:x.items}});
    r.why=[];
    r.need=strict>=2?["trend","mkt","zone","trig","mom","risk"]:strict>=1?["trend","zone","trig","risk"]:["trend","zone","risk"]}
  return r}

/* order book snapshot: who is heavier near the price, and where the big resting orders sit */
function bookStats(book,dir,p){
  function side(a){return(a||[]).map(function(x){return[+x[0],+x[1]]}).filter(function(x){return x[0]>0&&x[1]>0})}
  var bids=side(book&&book.bids),asks=side(book&&book.asks);
  if(bids.length<5||asks.length<5)return null;
  var mid=(bids[0][0]+asks[0][0])/2, spread=(asks[0][0]-bids[0][0])/mid*100;
  var cover=Math.min((mid-bids[bids.length-1][0])/mid,(asks[asks.length-1][0]-mid)/mid);
  var range=Math.min(0.015,cover), B=0,A=0;
  bids.forEach(function(x){if(x[0]>=mid*(1-range))B+=x[0]*x[1]});
  asks.forEach(function(x){if(x[0]<=mid*(1+range))A+=x[0]*x[1]});
  if(B+A<=0)return null;
  var size=mid*Math.max(0.001,cover/25), all=[];
  function buckets(rows,sgn){var m={},out=[];
    rows.forEach(function(x){var i=Math.floor(Math.abs(x[0]-mid)/size);m[i]=(m[i]||0)+x[0]*x[1]});
    for(var i in m)out.push({p:mid+sgn*(+i+0.5)*size,n:m[i]});
    out.forEach(function(b){all.push(b.n)});return out}
  var bb=buckets(bids,-1),ab=buckets(asks,1);
  all.sort(function(x,y){return x-y});var med=all[Math.floor(all.length/2)]||0;
  function big(list,lo,hi){var best=null;
    list.forEach(function(b){if(b.n>=4*med&&b.p>lo&&b.p<hi&&(!best||b.n>best.n))best=b});return best}
  var s={bid:B/(B+A)*100,range:range*100,spread:spread,
    topBid:big(bb,0,Infinity),topAsk:big(ab,0,Infinity),block:null,guard:null};
  if(dir>0){s.block=big(ab,p.entry,p.tp1);s.guard=big(bb,p.sl,p.entry)}
  else{s.block=big(bb,p.tp1,p.entry);s.guard=big(ab,p.entry,p.sl)}
  return s}

/* ---------- squeeze risk: crowded side (funding, account ratio), rising open interest, nearby liquidation pools ---------- */
/* share of unswept estimated liquidations sitting within 3 % above (shorts) and below (longs) the price */
function nearLiq(m){
  var s=0,l=0,b,p;
  for(b=0;b<m.B;b++){p=m.lo+(b+0.5)*m.step;
    if(p>m.price&&p<=m.price*1.03)s+=m.liveS[b];
    if(p<m.price&&p>=m.price*0.97)l+=m.liveL[b]}
  return{s:s,l:l,tot:s+l}}
function squeeze(d,m){
  var up=0,dn=0,wu=[],wd=[];
  if(d&&d.fund!==null){var fp=d.fund*100,ft="funding "+(fp>0?"+":"")+fr(fp,3)+" %";
    if(fp<=-0.03){up+=30;wu.push(ft)}else if(fp<=-0.01){up+=15;wu.push(ft)}
    if(fp>=0.05){dn+=30;wd.push(ft)}else if(fp>=0.02){dn+=15;wd.push(ft)}}
  if(d&&d.ls!==null){var lt="ratio long/short "+fr(d.ls,2);
    if(d.ls<=0.6){up+=30;wu.push(lt)}else if(d.ls<=0.85){up+=18;wu.push(lt)}
    if(d.ls>=3){dn+=30;wd.push(lt)}else if(d.ls>=2){dn+=18;wd.push(lt)}}
  if(d&&d.oi!==null&&d.oi>=8){var ot="positions ouvertes +"+fr(d.oi,0)+" % en 24 h";up+=15;dn+=15;wu.push(ot);wd.push(ot)}
  if(m){var n=nearLiq(m);if(n.tot>0){var sh=n.s/n.tot;
    if(sh>=0.6){up+=Math.round(25*Math.min(1,(sh-0.5)/0.35));wu.push("liquidations de shorts à moins de 3 %")}
    if(sh<=0.4){dn+=Math.round(25*Math.min(1,(0.5-sh)/0.35));wd.push("liquidations de longs à moins de 3 %")}}}
  return{up:Math.min(100,up),dn:Math.min(100,dn),wu:wu,wd:wd,d:d||{}}}
function sqLevel(v){return v>=60?"Élevé":v>=35?"Modéré":"Faible"}

/* ---------- estimated liquidation heatmap ----------
   Not exchange data: every past candle is assumed to open longs and shorts at 10x-100x, weighted by its volume.
   Each implied liquidation level stays lit, fading with age, until price trades through it. */
function heatModel(k,show){
  var n=k.length,lo=Infinity,hi=-Infinity,i,j;
  show=Math.min(show||n,n);var from=n-show;
  for(i=from;i<n;i++){if(k[i].l<lo)lo=k[i].l;if(k[i].h>hi)hi=k[i].h}
  var pad=Math.max(0.015,Math.min(0.08,(hi-lo)/k[n-1].c));
  lo*=1-pad;hi*=1+pad;
  var B=160,step=(hi-lo)/B,grid=new Float32Array(show*B),liveL=new Float32Array(B),liveS=new Float32Array(B);
  var LV=[[10,0.3],[25,0.3],[50,0.25],[100,0.15]],mm=0.004,half=n/3;
  for(i=0;i<n;i++){
    var c=k[i],p=(c.h+c.l+c.c)/3,q=c.q||0;
    LV.forEach(function(L){
      [[p*(1-1/L[0]+mm),1],[p*(1+1/L[0]-mm),-1]].forEach(function(s){
        var lv=s[0],b=Math.floor((lv-lo)/step);if(b<0||b>=B)return;
        for(j=i+1;j<n;j++){
          if(s[1]>0?k[j].l<=lv:k[j].h>=lv)break;
          if(j>=from)grid[(j-from)*B+b]+=q*L[1]*Math.pow(0.5,(j-i)/half)}
        if(j===n)(s[1]>0?liveL:liveS)[b]+=q*L[1]*Math.pow(0.5,(n-i)/half)})})}
  var vals=[];for(i=0;i<grid.length;i+=7)if(grid[i]>0)vals.push(grid[i]);
  vals.sort(function(a,b){return a-b});
  function peaks(arr){var sm=[],out=[];
    for(var b=0;b<B;b++)sm.push((arr[b-1]||0)+arr[b]+(arr[b+1]||0));
    for(b=1;b<B-1;b++)if(sm[b]>0&&sm[b]>=sm[b-1]&&sm[b]>=sm[b+1])out.push({p:lo+(b+0.5)*step,n:sm[b],b:b});
    out.sort(function(x,y){return y.n-x.n});
    var keep=[];out.forEach(function(z){if(keep.length<3&&!keep.some(function(o){return Math.abs(o.b-z.b)<5}))keep.push(z)});
    return keep}
  var price=k[n-1].c;
  return{k:k.slice(from),n:show,B:B,lo:lo,hi:hi,step:step,liveL:liveL,liveS:liveS,grid:grid,cap:vals.length?vals[Math.floor(vals.length*0.97)]:1,price:price,
    above:peaks(liveS).filter(function(z){return z.p>price}).sort(function(a,b){return a.p-b.p}),
    below:peaks(liveL).filter(function(z){return z.p<price}).sort(function(a,b){return b.p-a.p})}}

/* ---------- history test: replay the engine candle by candle on past 15-minute data ---------- */
/* group 15m candles into a larger timeframe, remembering where each group starts */
function btAgg(m,ms){var out=[],cur=null,i,k,key;
  for(i=0;i<m.length;i++){k=m[i];key=Math.floor(k.t/ms);
    if(!cur||cur.key!==key){cur={key:key,t:key*ms,o:k.o,h:k.h,l:k.l,c:k.c,q:k.q,b:k.b,i0:i};out.push(cur)}
    else{if(k.h>cur.h)cur.h=k.h;if(k.l<cur.l)cur.l=k.l;cur.c=k.c;cur.q+=k.q;cur.b+=k.b}}
  return out}
/* at the close of 15m candle i, the candles the live app would be handed: finished ones plus the one in progress */
/* ---------- study of 23/11/2026: a reversal after an excess, and trend trades taken too late (options off by default) ----------
   An excess and its turn, long side: the price fell at least revAtr daily ATR (3) from its 10-day high and the closed 4H RSI was under
   revRsi (25) in the last 2 days; the lowest 1H low of the last 48 hours is at most revAge (24) closed 1H candles old, and the last closed
   1H candle closes above the high of that low's candle and above the 1H EMA20. Entry at the price, stop 0.3 1H ATR beyond the extreme,
   TP1 at the 4H EMA20 (the mean the price left, or revR R with revTp "r"), kept when TP1 is at least revMin R (1.2) away.
   The short side is the mirror after a rise. Returns {dir, plan, ext} or null. */
function revSetup(d1,h4,h1,o){
  o=o||{};var n1=h1.length,n4=h4.length,nd=d1.length;if(n1<80||n4<60||nd<20)return null;
  var c1=h1.slice(0,-1),k=c1.slice(-48),last=c1[c1.length-1],price=h1[n1-1].c,aD=atr(d1.slice(-31,-1)),a1=atr(c1),
    rs4=rsiSeries(closes(h4.slice(0,-1))).slice(-12),e1=ema(closes(c1),20),m1=e1[e1.length-1],e4=ema(closes(h4),20),mean=e4[e4.length-1],
    d10=d1.slice(-11),top=-Infinity,bot=Infinity,lo=Infinity,li=-1,hi=-Infinity,hj=-1,X=+o.revAtr||3,RS=+o.revRsi||25,AGE=+o.revAge||24;
  if(rs4.length<12)return null;
  d10.forEach(function(x){if(x.h>top)top=x.h;if(x.l<bot)bot=x.l});
  k.forEach(function(c,i){if(c.l<lo){lo=c.l;li=i}if(c.h>hi){hi=c.h;hj=i}});
  function mk(dir,ext,ix){
    var bar=k[ix];if(ix>=k.length-1||k.length-1-ix>AGE)return null;
    if(!(dir>0?last.c>bar.h&&last.c>m1:last.c<bar.l&&last.c<m1))return null;
    var sl=ext-dir*0.3*a1,R=(price-sl)*dir;if(!(R>0))return null;
    var tp=o.revTp==="r"?price+dir*(+o.revR||1.5)*R:mean;if((tp-price)*dir<(+o.revMin||1.2)*R)return null;
    return{dir:dir,plan:{entry:price,sl:sl,tp1:tp,tp2:tp,rr:(tp-price)*dir/R},ext:ext}}
  var res=null;
  if(Math.min.apply(null,rs4)<RS&&top-lo>=X*aD)res=mk(1,lo,li);
  if(!res&&Math.max.apply(null,rs4)>100-RS&&hi-bot>=X*aD)res=mk(-1,hi,hj);
  return res}
/* a trend trade in the direction of a move already stretched: 4H RSI beyond o.late, or daily RSI beyond o.lateD
   (25: under 25 for a short, over 75 for a long); 0 or absent: not checked */
function lateHit(r,d1,o){var L4=+o.late||0,LD=+o.lateD||0,rd=LD?rsi(closes(d1)):50;
  return r.dir<0?(L4>0&&r.r4<L4)||(LD>0&&rd<LD):(L4>0&&r.r4>100-L4)||(LD>0&&rd>100-LD)}
/* o.feat (study of 23/11/2026): the profile of each trend trade taken, to find which profiles won, longs and shorts apart.
   Side-relative where it matters: b4 / bsh / bbd are Bitcoin's 4H trend, 4-hour move and daily trend counted in the trade's direction,
   reb how far Bitcoin moved against the trade from its 72-hour extreme, r4 / r1 the 4H / 1H RSI counted in the trade's direction */
function featOf(r,bc){var f=r.f||{},T=r.trig||{},p=r.plan||{},d=r.dir,R=Math.abs(p.entry-p.sl);
  function n(x,k){return x===null||x===undefined||!isFinite(x)?null:+(+x).toFixed(k)}
  return{bd:f.bd?1:0,adx:n(f.adx,0),lt:n(f.lt,0),st:n(f.struct,0),b4:n(f.btc4,0),bsh:n(f.btcSh,2),reb:n(f.btcReb,1),bbd:bc&&isFinite(bc.bd)?bc.bd*d:null,
    r4:n(f.r4,0),r1:n(f.r1,0),rt:n(f.retr,2),rg:n(f.rng24,2),rv:n(f.relVol,2),kN:n(f.kN,0),fl:f.flip?1:0,cc:f.conf?1:0,zk:f.zkind?1:0,zn:n(f.zn,0),
    dv:f.div?1:0,d4:n(f.dl4,2),pv:n(f.pbVol,2),tg:(T.bos?1:0)|(T.sweep?2:0)|(T.candle?4:0)|(T.rsiT?8:0)|(T.delta?16:0)|(T.climax?32:0),
    sc:n(r.score,0),fw:r.flow?n(r.flow.sc,0):null,rr:n(p.rr,2),rp:p.entry?n(R/p.entry*100,2):null}}
/* ---------- memo of 24/11/2026 (video of a trader): weekly pivots, big levels, dead zone, strength against Bitcoin ----------
   weekPivots: classic pivots of the last full UTC week (Monday to Sunday) and that week's high and low; null without 5 days of it */
/* memo 3 of 26/11/2026 (video « 6 stratégies », point 6): a range, never trade its middle. Range: the high and low of the last 48 closed
   1H candles while the 1H EMA 20 and EMA 50 are flat (moved less than 0.3 ATR 1H over 10 hours) and the last close has not broken out.
   Returns the price's place in the range (0 at the low, 1 at the high) when it is between 40 % and 60 %, else null */
function midRange(h1){var n=h1.length;if(n<70)return null;var k=h1.slice(0,-1),w=k.slice(-48),hi=-Infinity,lo=Infinity,i;
  for(i=0;i<w.length;i++){if(w[i].h>hi)hi=w[i].h;if(w[i].l<lo)lo=w[i].l}
  var a1=atr(k.slice(-40)),cl=closes(k),e20=ema(cl,20),e50=ema(cl,50),m=cl.length;if(!(a1>0)||!(hi>lo))return null;
  if(Math.abs(e20[m-1]-e20[m-11])>=0.3*a1||Math.abs(e50[m-1]-e50[m-11])>=0.3*a1)return null;
  var prev=w.slice(0,-1),ph=Math.max.apply(null,prev.map(function(x){return x.h})),pl=Math.min.apply(null,prev.map(function(x){return x.l})),c=w[w.length-1].c;
  if(c>ph||c<pl)return null;
  var pos=(h1[n-1].c-lo)/(hi-lo);return pos>=0.4&&pos<=0.6?{pos:pos,hi:hi,lo:lo}:null}
function weekPivots(d1){var n=d1.length;if(n<10)return null;var t=d1[n-1].t,wd=(new Date(t).getUTCDay()+6)%7,ws=t-wd*864e5,H=-Infinity,L=Infinity,C=null,k=0,i,cH=-Infinity,cL=Infinity;
  for(i=0;i<n;i++){var c=d1[i];if(c.t>=ws-7*864e5&&c.t<ws){if(c.h>H)H=c.h;if(c.l<L)L=c.l;C=c.c;k++}else if(c.t>=ws){if(c.h>cH)cH=c.h;if(c.l<cL)cL=c.l}}
  if(k<5)return null;var P=(H+L+C)/3;return{P:P,R1:2*P-L,S1:2*P-H,H:H,L:L,cH:cH,cL:cL}}
/* tunnel of a timeframe: the band between its EMA 20 and EMA 50 */
function tunnel(k){var c=closes(k),a=ema(c,20),b=ema(c,50),x=a[a.length-1],y=b[b.length-1];return[Math.min(x,y),Math.max(x,y)]}
/* price stuck between two tunnels (above the lower one, under the upper one) */
function deadZone(p,A,B){var lo=A[0]+A[1]<B[0]+B[1]?A:B,hi=lo===A?B:A;return p>lo[1]&&p<hi[0]}
/* memoFeat: the memo's measures for a setup at its entry, side-relative where it matters */
function memoFeat(r,d1,h4,h1,m15,bc){var p=r.plan||{},d=r.dir,e=p.entry,R=Math.abs(p.entry-p.sl),aD=atr(d1.slice(-31,-1)),w=weekPivots(d1),o={},n1=h1.length,n4=h4.length,px=r.price||e;
  function n(x,k){return x===null||x===undefined||!isFinite(x)?null:+(+x).toFixed(k)}
  if(w&&aD>0){var lv=[w.P,w.R1,w.S1];
    o.pvE=n(Math.min.apply(null,lv.map(function(v){return Math.abs(e-v)}))/aD,2);
    o.pvT=n(Math.min.apply(null,lv.map(function(v){return Math.abs(p.tp1-v)}))/aD,2);
    o.pvW=lv.filter(function(v){return d<0?v<e&&v>p.tp1:v>e&&v<p.tp1}).length;
    /* nearest big level on the trade's way: S1, P, last week's low, this week's low (short); R1, P, last week's high, this week's high (long) */
    var big=(d<0?[w.S1,w.P,w.L,w.cL]:[w.R1,w.P,w.H,w.cH]).filter(function(v){return isFinite(v)&&(d<0?v<e:v>e)}),nb=big.length?(d<0?Math.max.apply(null,big):Math.min.apply(null,big)):null;
    o.bigP=nb===null?null:n(Math.abs(e-nb)/e*100,2);o.bigR=nb===null||!R?null:n(Math.abs(e-nb)/R,2)}
  if(m15&&m15.length>60&&n1>60&&n4>60){var t15=tunnel(m15),t1=tunnel(h1),t4=tunnel(h4);o.dz1=deadZone(px,t15,t1)?1:0;o.dz4=deadZone(px,t1,t4)?1:0}
  if(n1>25)o.c24=n((px/h1[n1-25].c-1)*100,2);if(n4>43)o.c7=n((px/h4[n4-43].c-1)*100,2);
  if(bc&&r.sym!=="BTC"){if(o.c24!==undefined&&isFinite(bc.r24))o.rs24=n(d*(o.c24-bc.r24),2);if(o.c7!==undefined&&isFinite(bc.r7))o.rs7=n(d*(o.c7-bc.r7),2)}
  return o}
/* o.inv (memo, point 1): each trade also run with an exit at the close beyond the last confirmed swing against it, 1H (x1) or 4H (x4),
   followed while the trade lives; stop and target as usual, fees in. Result in rec.ix[rule] = [R, how] */
var INV_RULES=["x1","x4"];
function lastSwing(k,d,L){var i,j,n=k.length;for(i=n-1-L;i>=L;i--){var ok=true;for(j=i-L;j<=i+L;j++){if(j===i)continue;if(d<0?k[j].h>=k[i].h:k[j].l<=k[i].l){ok=false;break}}if(ok)return d<0?k[i].h:k[i].l}return null}
function btInv(S,F,m,i,N){
  if(!S.isims||!S.isims.length)return;var c=m[i],end1=(c.t+9e5)%36e5===0,end4=(c.t+9e5)%144e5===0,s1={},s4={};
  S.isims=S.isims.filter(function(q){if(i<=q.i)return true;var t=q.t,d=t.dir,left=0;
    INV_RULES.forEach(function(r){var v=q.v[r];if(v.done)return;
      if(d>0?c.l<=t.sl:c.h>=t.sl){var f=d>0?Math.min(c.o,t.sl):Math.max(c.o,t.sl);v.done=[+((f-t.entry)*d/t.r0-q.cr).toFixed(3),"sl"];return}
      if(d>0?c.h>=t.tp:c.l<=t.tp){v.done=[+(Math.abs(t.tp-t.entry)/t.r0-q.cr).toFixed(3),"tp"];return}
      if(i>=q.end||i>=N){v.done=[+((c.c-t.entry)*d/t.r0-q.cr).toFixed(3),"time"];return}
      if((r==="x1"&&end1)||(r==="x4"&&end4)){var key=r+d,lv;if(!(key in s1)){var kk=r==="x1"?F.get("h1",80):F.get("h4",80);s1[key]=lastSwing(kk,d,3)}lv=s1[key];
        if(lv!==null&&(d<0?lv<t.sl&&c.c>lv:lv>t.sl&&c.c<lv)){v.done=[+((c.c-t.entry)*d/t.r0-q.cr).toFixed(3),"inv"];return}}
      left++});
    if(left)return true;q.rec.ix={};INV_RULES.forEach(function(r){q.rec.ix[r]=q.v[r].done});return false})}
/* o.rng (memo, point 6): in a market without trend (ADX 4H under 20, no trend setup at its zone), a long when the last closed 1H candle
   dipped under the low of the 4H value area (last 120 bars) and closed back inside, a short at the top the same way; stop 0.3 ATR 4H
   beyond that candle, target the point of control, kept when it is at least 1.2 R away */
function rngSetup(h4,h1){var n4=h4.length,n1=h1.length;if(n4<130||n1<30)return null;var a=adx(h4.slice(0,-1));if(!(a<20))return null;
  var vp=vprofile(h4.slice(-121,-1),40),a4=atr(h4.slice(0,-1)),c=h1[n1-2],px=h1[n1-1].c,res=null;
  if(c.l<vp.val&&c.c>vp.val&&px>vp.val&&px<vp.poc){var sl=c.l-0.3*a4,R=px-sl;if(R>0&&(vp.poc-px)/R>=1.2)res={dir:1,plan:{entry:px,sl:sl,tp1:vp.poc,tp2:vp.poc,rr:(vp.poc-px)/R}}}
  else if(c.h>vp.vah&&c.c<vp.vah&&px<vp.vah&&px>vp.poc){var sl2=c.h+0.3*a4,R2=sl2-px;if(R2>0&&(px-vp.poc)/R2>=1.2)res={dir:-1,plan:{entry:px,sl:sl2,tp1:vp.poc,tp2:vp.poc,rr:(px-vp.poc)/R2}}}
  return res}
/* ---------- RSI · Volume · Niveaux (réglage du 26/11/2026): a rebound on a 4H support for a long, a rejection under a 4H resistance for
   a short, whatever the trend. Ready: the last closed 1H candle touched the level (0.2 ATR 4H) and closed back on the right side, the RSI
   1H reached o.srLo (30) or less for a long, 100 − o.srLo or more for a short, over the last 3 closed candles, and that candle's volume is
   o.srVol (1.5) times the usual. Watch: price within half an ATR 4H of the level with the RSI 1H within 5 points of the threshold.
   Stop 0.25 ATR 4H beyond the level or the candle; target the next level, 1.5 R at least, 3 R at most ---------- */
function srSetup(h4,h1,o){o=o||{};var n1=h1.length,n4=h4.length;if(n1<60||n4<60)return null;
  var k4=h4.slice(0,-1),a4=atr(k4);if(!(a4>0))return null;
  var lv=levels(k4,0.5*a4).filter(function(l){return l.n>=(o.srN||2)}),c=h1[n1-2],px=h1[n1-1].c,rs=rsiSeries(closes(h1.slice(0,-1)));if(!lv.length||rs.length<3)return null;
  var rl=rs.slice(-3),rlo=Math.min.apply(null,rl),rhi=Math.max.apply(null,rl),rn=rs[rs.length-1],q=0,i;for(i=n1-22;i<n1-2;i++)q+=h1[i].q;q/=20;
  var vr=q>0?c.q/q:0,LO=o.srLo||30,HI=100-LO,best=null;
  lv.forEach(function(l){[1,-1].forEach(function(d){var S=l.p;if((S-px)*d>0.2*a4)return;
    var touch=d>0?c.l<=S+0.2*a4:c.h>=S-0.2*a4,back=(c.c-S)*d>0&&(px-S)*d>0,rsiOk=d>0?rlo<=LO:rhi>=HI,volOk=vr>=(o.srVol||1.5);
    var st=touch&&back&&rsiOk&&volOk?"ready":Math.abs(px-S)<=0.5*a4&&(d>0?rn<=LO+5:rn>=HI-5)?"watch":null;if(!st)return;
    var sl=d>0?Math.min(c.l,S)-0.25*a4:Math.max(c.h,S)+0.25*a4,e=st==="ready"?px:S,R=Math.abs(e-sl);
    if(!(R>0)||(sl-e)*d>=0||R/e>0.05||R/e<0.003)return;
    var nx=lv.filter(function(m){return(m.p-e)*d>0.5*R}).sort(function(x,y){return(x.p-y.p)*d})[0],tp=nx?nx.p:e+d*2*R;
    if(Math.abs(tp-e)>3*R)tp=e+d*3*R;var rr=Math.abs(tp-e)/R;if(rr<(o.srRR||1.5))return;
    var cd={dir:d,st:st,lvl:S,n:l.n,rsi:+(d>0?rlo:rhi).toFixed(0),rsiNow:+rn.toFixed(0),vol:+vr.toFixed(1),a4:a4,plan:{entry:e,sl:sl,tp1:tp,tp2:tp,rr:rr}};
    if(!best||(cd.st==="ready")>(best.st==="ready")||(cd.st===best.st&&Math.abs(px-S)<Math.abs(px-best.lvl)))best=cd})});
  return best}
/* ---------- memo 2 of 25/11/2026 (video of a trader): open interest, retest of a V move, compressed volatility, extreme funding, daily
   pivot. memo2Feat: those measures for a setup at its entry; fund [[ms, rate]], met [{t, oi}] hourly, from data.binance.vision ---------- */
function lastAt(a,t,key){var lo=0,hi=a.length-1,k=-1;while(lo<=hi){var mid=(lo+hi)>>1,v=key?a[mid][key]:a[mid][0];if(v<=t){k=mid;lo=mid+1}else hi=mid-1}return k}
function memo2Feat(r,d1,h1,t,fund,met){var p=r.plan||{},d=r.dir,e=p.entry,o={},n1=h1.length,px=r.price||e,aD=atr(d1.slice(-31,-1));
  function n(x,k){return x===null||x===undefined||!isFinite(x)?null:+(+x).toFixed(k)}
  /* 1. open interest over 24 hours, with the price over 24 hours */
  if(met&&met.length){var a=lastAt(met,t,"t"),b=lastAt(met,t-864e5,"t");if(a>=0&&b>=0&&met[b].oi>0&&t-met[a].t<3*36e5){o.oi24=n((met[a].oi/met[b].oi-1)*100,2)}}
  if(n1>25)o.px24=n((px/h1[n1-25].c-1)*100,2);
  /* 5. funding: the last rate before the entry, in % per 8 hours */
  if(fund&&fund.length){var fk=lastAt(fund,t);if(fk>=0&&t-fund[fk][0]<12*36e5)o.fr=n(fund[fk][1]*100,4)}
  /* 2. a V move: more than 10 % in under 3 days (the last 72 hours); how far the price has come back into it (0 = still at the end) */
  if(n1>75){var w=h1.slice(-73,-1),lo=Infinity,li=0,hi=-Infinity,hj=0;w.forEach(function(c,i){if(c.l<lo){lo=c.l;li=i}if(c.h>hi){hi=c.h;hj=i}});
    if(hi/lo-1>0.10){var up=li<hj;o.vDir=up?1:-1;o.vRet=n(up?(hi-px)/(hi-lo):(px-lo)/(hi-lo),3)}else o.vDir=0}
  /* 3. compressed volatility: daily ATR (14) over price, percentile among the last 365 days */
  if(d1.length>120){var c=d1.slice(-366,-1),vals=[],i;for(i=15;i<c.length;i++){vals.push(atr(c.slice(i-15,i))/c[i-1].c)}var cur=vals[vals.length-1];
    o.volPct=n(vals.filter(function(v){return v<=cur}).length/vals.length*100,0)}
  /* 6. daily pivot of the last full UTC day */
  var dd=d1[d1.length-2];if(dd&&aD>0){var P=(dd.h+dd.l+dd.c)/3,lv=[P,2*P-dd.l,2*P-dd.h];
    o.pdE=n(Math.min.apply(null,lv.map(function(v){return Math.abs(e-v)}))/aD,2);
    o.pdW=lv.filter(function(v){return d<0?v<e&&v>p.tp1:v>e&&v<p.tp1}).length}
  return o}
function btFrames(m,d1){
  var first=m.length?m[0].t:0,hist=(d1||[]).filter(function(k){return k.t+864e5<=first});
  var tf={h1:{ms:36e5,full:btAgg(m,36e5),off:0},h4:{ms:144e5,full:btAgg(m,144e5),off:0},d1:{ms:864e5,full:hist.concat(btAgg(m,864e5)),off:hist.length}},at=-1,name;
  for(name in tf){tf[name].j=tf[name].off;tf[name].p=null}
  return{
    step:function(i){var k=m[i],f,p;
      for(var nm in tf){f=tf[nm];
        while(f.j+1<f.full.length&&f.full[f.j+1].i0<=i){f.j++;f.p=null}
        p=f.p;
        if(!p)f.p={t:f.full[f.j].t,o:k.o,h:k.h,l:k.l,c:k.c,q:k.q,b:k.b};
        else{if(k.h>p.h)p.h=k.h;if(k.l<p.l)p.l=k.l;p.c=k.c;p.q+=k.q;p.b+=k.b}}
      at=i},
    get:function(nm,n){var f=tf[nm],T=m[at].t+9e5,c=f.full[f.j],done,last;
      if(c.t+f.ms<=T){done=f.j+1;last={t:c.t+f.ms,o:c.c,h:c.c,l:c.c,c:c.c,q:0,b:0}}
      else{done=f.j;last={t:f.p.t,o:f.p.o,h:f.p.h,l:f.p.l,c:f.p.c,q:f.p.q,b:f.p.b}}
      var a=f.full.slice(Math.max(0,done-(n-1)),done);a.push(last);return a},
    m15:function(n){var a=m.slice(Math.max(0,at+1-n),at+1),k=m[at];a.push({t:k.t+9e5,o:k.c,h:k.c,l:k.c,c:k.c,q:0,b:0});return a}}}
/* configuration of a setup, as the Analyser names it: direction, kind of zone, and how many other price marks sit on it.
   key = L|S + c (order block and 4H level together) | o (order block) | f (4H level that changed side) | s (4H level) */
function cfgOf(r){var f=r.f||{};if(!r.z)return null;
  return{key:(r.dir>0?"L":"S")+(f.conf?"c":f.zkind?"o":f.flip?"f":"s"),k:f.kN||0}}
/* state of an open trade, from candles alone: the candle-based points of the trade check in Mes trades (trend 4H and 1J, volume and
   flow, opposite or same-side setup, progress, distance to the stop, age, momentum). t: {dir,entry,sl,tp,t,r0}. hard: both trends
   against the trade, or the 4H against it with an opposite setup. r: progress in risk units. Calibrated by tools/backtest/state42.js. */
function tradeState(sym,d1,h4,h1,m15,t,now,opt){
  var dir=t.dir,price=h1[h1.length-1].c,sc=0,b4=bias(h4),bd=bias(d1.length>90?d1.slice(-90):d1);
  sc+=b4===dir?2:b4===0?-1:-3;sc+=bd===dir?1:bd===-dir?-2:0;
  var eng=judge(analyze(sym,d1,h4,h1,null,opt||{}),{quiet:true,strict:0,noBook:true});
  var a4=atr(h4),fl=flowRead(h1,h4,dir,{entry:t.entry,tp1:t.tp>0?t.tp:t.entry+dir*3*a4},a4,null);
  if(fl){if(fl.v==="no")sc-=1;else if(fl.v==="ok")sc+=1}
  var opp=!!(eng.plan&&eng.dir===-dir&&eng.score>=50);
  if(opp)sc-=3;else if(eng.plan&&eng.dir===dir)sc+=1;
  var risk=t.r0||Math.abs(t.entry-t.sl),rNow=risk>0?(price-t.entry)*dir/risk:0,left=risk>0&&t.sl>0?(price-t.sl)*dir/risk:1;
  if(rNow>=1)sc+=1;if(left<0.25)sc-=1;
  if(now-t.t>48*36e5&&rNow<0.5)sc-=1;
  var r1=rsi(closes(h1)),r15=null;
  if(m15&&m15.length>30){var rs=rsiSeries(closes(m15));r15=rs[rs.length-1]}
  var wk=dir>0?(r1<40&&(r15===null||r15<45)):(r1>60&&(r15===null||r15>55));if(wk)sc-=1;
  return{sc:sc,hard:b4===-dir&&(bd===-dir||opp),r:rNow,known:risk>0,b4:b4===dir?1:b4===0?0:-1,bd:bd===dir?1:bd===0?0:-1,weak:!!wk,opp:opp,fl:fl?fl.v:null,left:left}}
/* room to raise the target of an open trade, from candles alone: the price has covered three quarters of the way to the target, the
   4H and 1J trends both go with the trade, momentum is neither fading nor stretched, and at most one 4H level stands before the target.
   Proposed target: just before the next 4H level beyond the current one, or one risk unit (or one 4H ATR) further when there is none.
   Measured by tools/backtest/tpup42.js. */
function tpUp(d1,h4,h1,m15,t){
  var dir=t.dir,price=h1[h1.length-1].c;if(!(t.tp>0))return null;
  var left=(t.tp-price)*dir,span=Math.abs(t.tp-t.entry);if(!(left>0)||!span||left/span>=0.25)return null;
  if(bias(h4)!==dir||bias(d1.length>90?d1.slice(-90):d1)!==dir)return null;
  var r1=rsi(closes(h1)),r15=null;if(m15&&m15.length>30){var rs=rsiSeries(closes(m15));r15=rs[rs.length-1]}
  if(dir>0?(r1<40&&(r15===null||r15<45)):(r1>60&&(r15===null||r15>55)))return null;
  if(dir>0?r1>=72:r1<=28)return null;
  var a4=atr(h4),ahead=levels(h4,0.5*a4).filter(function(l){return(l.p-price)*dir>0.3*a4}).sort(function(x,y){return(x.p-y.p)*dir});
  var before=ahead.filter(function(l){return(t.tp-l.p)*dir>0.4*a4}),after=ahead.filter(function(l){return(l.p-t.tp)*dir>0.4*a4});
  if(before.length>=2)return null;
  var r0=t.r0||Math.abs(t.entry-t.sl);
  return after.length?{px:after[0].p-dir*0.1*a4,lvl:after[0].p}:{px:t.tp+dir*Math.max(r0||0,a4),lvl:0}}
/* reason to lower the target of an open trade, from candles alone. The trade is no longer carried by a clean trend (4H or 1J not with
   it, or momentum fading) or two 4H levels stand before the target. kind "lvl": a 4H level stands before the target, the proposed
   target sits just before it. kind "exh": no level, but the 4H trend has turned against the trade, or momentum fades while the 4H
   is no longer with it: the proposed target is half a 4H ATR ahead of the price. Always beyond break-even and ahead of the price.
   Measured by tools/backtest/tpdn42.js. */
function tpDown(d1,h4,h1,m15,t){
  var dir=t.dir,price=h1[h1.length-1].c;if(!(t.tp>0))return null;
  if(!((t.tp-price)*dir>0))return null;
  var b4=bias(h4),bd=bias(d1.length>90?d1.slice(-90):d1),r1=rsi(closes(h1)),r15=null;if(m15&&m15.length>30){var rs=rsiSeries(closes(m15));r15=rs[rs.length-1]}
  var weak=dir>0?(r1<40&&(r15===null||r15<45)):(r1>60&&(r15===null||r15>55)),strong=b4===dir&&bd===dir&&!weak;
  var a4=atr(h4),ahead=levels(h4,0.5*a4).filter(function(l){return(l.p-price)*dir>0.3*a4}).sort(function(x,y){return(x.p-y.p)*dir});
  var before=ahead.filter(function(l){return(t.tp-l.p)*dir>0.4*a4}),be=t.entry*(1+dir*0.0015),sug,kind;
  if(before.length&&(!strong||before.length>=2)){sug=before[0].p-dir*0.1*a4;kind="lvl"}
  else if(!before.length&&(b4===-dir||(weak&&b4!==dir))){sug=price+dir*0.5*a4;kind="exh"}
  else return null;
  if(!((sug-be)*dir>0)||!((sug-price)*dir>0.2*a4)||!((t.tp-sug)*dir>0.3*a4))return null;
  return{px:sug,kind:kind,lvl:kind==="lvl"?before[0].p:0,rev:b4===-dir,weak:weak}}
/* where a stop already at break-even may be moved to lock profit, once the trade has gained one risk unit. t: {dir,entry,r0};
   far: the best price reached since the entry; a4: 4H ATR; sw: the last 4H swing against the trade (lowest low of the six closed
   4H candles for a long, highest high for a short). Rules: be (entry plus fees, no further), step (one risk unit behind each full
   unit gained), r1 (one risk unit behind the best price), a1 / a2 (one / two 4H ATR behind the best price), sw (just beyond the
   last 4H swing). Never under break-even; null before +1 R. Compared by tools/backtest/trail42.js. */
function trailStop(rule,t,far,a4,sw){
  var d=t.dir,R=t.r0,be=t.entry*(1+d*0.0012),g=(far-t.entry)*d/R,p;if(!(R>0)||g<1)return null;
  if(rule==="be")p=be;
  else if(rule==="step")p=t.entry+d*(Math.floor(g+1e-9)-1)*R;
  else if(rule==="r1")p=far-d*R;
  else if(rule==="a1")p=far-d*a4;
  else if(rule==="a2")p=far-d*2*a4;
  else if(rule==="sw")p=sw>0?sw-d*0.1*a4:be;
  else return null;
  return d>0?Math.max(p,be):Math.min(p,be)}
function swing4(h4,dir){var k=h4.slice(-7,-1),v=dir>0?Infinity:-Infinity;k.forEach(function(c){v=dir>0?Math.min(v,c.l):Math.max(v,c.h)});return isFinite(v)?v:0}
var TRAIL_RULES=["be","step","r1","a1","a2","sw"];
/* o.trail: each replayed trade is also run with every trailing rule, from its entry: original stop until +1 R, then the rule; the
   first target stays in place for "be" only, the others let the trade run. Stop before target in one candle, gaps at the open,
   10 days at most, fees in. Result in rec.tr[rule] = [R, how]. */
function btTrail(S,F,m,i,N){
  if(!S.sims||!S.sims.length)return;var c=m[i],a4=0,h4=null;
  S.sims=S.sims.filter(function(q){
    if(i<=q.i)return true;
    var t=q.t,d=t.dir,left=0;
    if(!h4){h4=F.get("h4",200);a4=atr(h4)}
    TRAIL_RULES.forEach(function(r){var v=q.v[r];if(v.done)return;
      if(d>0?c.l<=v.sl:c.h>=v.sl){var f=d>0?Math.min(c.o,v.sl):Math.max(c.o,v.sl);v.done=[+((f-t.entry)*d/t.r0-q.cr).toFixed(3),v.sl===t.sl?"sl":"lock"];return}
      if(r==="be"&&(d>0?c.h>=t.tp:c.l<=t.tp)){v.done=[+(Math.abs(t.tp-t.entry)/t.r0-q.cr).toFixed(3),"tp"];return}
      if(i>=q.end||i>=N){v.done=[+((c.c-t.entry)*d/t.r0-q.cr).toFixed(3),"time"];return}
      left++});
    q.far=d>0?Math.max(q.far,c.h):Math.min(q.far,c.l);
    if(left){var sw=swing4(h4,d);TRAIL_RULES.forEach(function(r){var v=q.v[r];if(v.done)return;var p=trailStop(r,t,q.far,a4,sw);if(p!==null)v.sl=d>0?Math.max(v.sl,p):Math.min(v.sl,p)});return true}
    q.rec.tr={};TRAIL_RULES.forEach(function(r){q.rec.tr[r]=q.v[r].done});q.rec.far=+((q.far-t.entry)*d/t.r0).toFixed(2);return false})}
/* cell of the calibration table for a trade state: H (hard) or score band a..d, then progress band 0..4 */
function stateKey(s){var r=s.r;return(s.hard?"H":s.sc<=-3?"a":s.sc<=0?"b":s.sc<=3?"c":"d")+(r<-0.5?0:r<0?1:r<0.5?2:r<1?3:4)}
var BT_WARM=96*34;
/* Bitcoin's state at every 15m close, for the Marché check of altcoins */
function btMarket(m,d1){var F=btFrames(m,d1),out={},i;
  for(i=0;i<m.length;i++){F.step(i);if(i>=BT_WARM)out[m[i].t]=market(F.get("d1",90),F.get("h4",200),F.get("h1",200))}
  return out}
/* opt: the precision settings; opt.btc: result of btMarket. Call btStep until it returns true. */
function btStart(sym,m,d1,opt){
  return{sym:sym,m:m,F:btFrames(m,d1),opt:opt||{},i:0,free:BT_WARM,trades:[],evals:0,ready:0,first:null,done:m.length<BT_WARM+200}}
function btStep(S,n){
  var m=S.m,F=S.F,o=S.opt,N=m.length-1,cost=(2*(o.fee===undefined?PREC.fee:+o.fee)+0.02)/100,end=Math.min(N,S.i+n),jo={quiet:true,noBook:true},k;
  for(k in o)jo[k]=o[k];
  for(;S.i<end;S.i++){var i=S.i;F.step(i);
    if(o.trail)btTrail(S,F,m,i,N);
    if(o.inv)btInv(S,F,m,i,N);
    /* o.state: every 4 hours of a replayed trade, its state as the app would read it (study of the reliability label) */
    if(o.state&&S.cur&&i>S.cur.i&&i<S.cur.j&&(i-S.cur.i)%16===0){var ts=tradeState(S.sym,F.get("d1",400),F.get("h4",200),F.get("h1",200),F.m15(500),S.cur.t,m[i].t,o);
      S.cur.rec.hs.push([ts.sc,ts.hard?1:0,+ts.r.toFixed(2),stateKey(ts)])}
    /* o.exits: every hour of a replayed trade, its state with the parts that make it (study of earlier exit advice):
       [bars since entry, score, hard, progress in R, 4H trend with/flat/against, 1J trend, fading momentum, opposite setup, flow] */
    if(o.exits&&S.cur&&i>S.cur.i&&i<S.cur.j&&(i-S.cur.i)%4===0){var xs=tradeState(S.sym,F.get("d1",400),F.get("h4",200),F.get("h1",200),F.m15(500),S.cur.t,m[i].t,o);
      (S.cur.rec.xs=S.cur.rec.xs||[]).push([i-S.cur.i,xs.sc,xs.hard?1:0,+xs.r.toFixed(2),xs.b4,xs.bd,xs.weak?1:0,xs.opp?1:0,xs.fl==="no"?-1:xs.fl==="ok"?1:0])}
    /* o.tpup: the first hour of a replayed trade where the target could be raised, and what the raised target then gave: with the
       stop left where it was (a), with the stop moved to the entry (b), with the stop moved to the old target once it is passed (c) */
    if(o.tpup&&S.cur&&!S.cur.rec.up&&i>S.cur.i&&i<S.cur.j&&(i-S.cur.i)%4===0){var tu=tpUp(F.get("d1",400),F.get("h4",200),F.get("h1",200),F.m15(500),S.cur.t);
      if(tu){var ct=S.cur.t,cR=ct.r0,cc=S.cur.rec.cr,lim=Math.min(N,S.cur.i+960),alt=function(sl0,trail){var sl=sl0,j,c,res=null;
          for(j=i+1;j<=lim;j++){c=m[j];
            if(ct.dir>0?c.l<=sl:c.h>=sl){var fl=ct.dir>0?Math.min(c.o,sl):Math.max(c.o,sl);res={how:sl===sl0?"sl":"lock",r:ct.dir*(fl-ct.entry)/cR};break}
            if(ct.dir>0?c.h>=tu.px:c.l<=tu.px){res={how:"tp",r:Math.abs(tu.px-ct.entry)/cR};break}
            if(trail&&(ct.dir>0?c.h>=ct.tp:c.l<=ct.tp))sl=ct.tp-ct.dir*0.25*cR}
          if(!res){j=Math.min(j,N);res={how:"time",r:ct.dir*(m[j].c-ct.entry)/cR}}
          res.r=+(res.r-cc).toFixed(3);return res};
        S.cur.rec.up={k:i-S.cur.i,px:tu.px,rr:+(Math.abs(tu.px-ct.entry)/cR).toFixed(2),r:+((m[i].c-ct.entry)*ct.dir/cR).toFixed(2),a:alt(ct.sl,false),b:alt(ct.entry,false),c:alt(ct.sl,true)}}}
    /* o.tpdn: the first hour of a replayed trade where the target could be lowered, and what the lowered target then gave (stop unchanged) */
    if(o.tpdn&&S.cur&&!S.cur.rec.dn&&i>S.cur.i&&i<S.cur.j&&(i-S.cur.i)%4===0){var td=tpDown(F.get("d1",400),F.get("h4",200),F.get("h1",200),F.m15(500),S.cur.t);
      if(td){var dt=S.cur.t,dR=dt.r0,dlim=Math.min(N,S.cur.i+960),dj,dc,dres=null,dst=tradeState(S.sym,F.get("d1",400),F.get("h4",200),F.get("h1",200),F.m15(500),dt,m[i].t,o);
        for(dj=i+1;dj<=dlim;dj++){dc=m[dj];
          if(dt.dir>0?dc.l<=dt.sl:dc.h>=dt.sl){var df=dt.dir>0?Math.min(dc.o,dt.sl):Math.max(dc.o,dt.sl);dres={how:"sl",r:dt.dir*(df-dt.entry)/dR};break}
          if(dt.dir>0?dc.h>=td.px:dc.l<=td.px){dres={how:"tp",r:Math.abs(td.px-dt.entry)/dR};break}}
        if(!dres){dj=Math.min(dj,N);dres={how:"time",r:dt.dir*(m[dj].c-dt.entry)/dR}}
        dres.r=+(dres.r-S.cur.rec.cr).toFixed(3);
        S.cur.rec.dn={k:i-S.cur.i,kind:td.kind,rev:td.rev?1:0,weak:td.weak?1:0,out:dst.hard||dst.sc<=0?1:0,rr:+(Math.abs(td.px-dt.entry)/dR).toFixed(2),r:+((m[i].c-dt.entry)*dt.dir/dR).toFixed(2),a:dres}}}
    /* o.funnel: no trade is taken; every 15 minutes the stage the market stops at is noted, as one digit: 0 no 1J trend, 1 no 4H
       trend or 4H against 1J, 2 no entry zone, 3 zone further than 1 ATR, 4 zone between 0.5 and 1 ATR, 5 at the zone but checks
       not passed, 6 checks passed but a blocker holds it back, 7 ready (study of how often and how long a setup is ready) */
    if(o.funnel){if(i<BT_WARM)continue;var fd=F.get("d1",400);if(fd.length<55)continue;
      if(S.first===null){S.first=m[i].t;S.fn=[]}
      var fc;if(bias(fd.length>90?fd.slice(-90):fd)===0)fc=0;
      else{var fr0=analyze(S.sym,fd,F.get("h4",200),F.get("h1",200),o.btc?{btc:o.btc[m[i].t]||null}:null,o);
        if(!fr0.plan)fc=fr0.st==="none"?1:2;else if(fr0.dist>1)fc=3;else if(fr0.dist>0.5)fc=4;
        else{enrich(fr0,F.m15(500),null,null,{noHeat:true});judge(fr0,o.funnelWhy?{noBook:true}:jo);fc=fr0.st==="ready"?7:fr0.st0==="ready"?6:5}}
      /* o.funnelWhy (study only): the side of each step (L long, S short, - none) and, at the zone, the checks that fail or the blockers */
      if(o.funnelWhy){S.fd=S.fd||[];S.fw=S.fw||{};S.fd.push(fr0&&fr0.dir?(fr0.dir>0?"L":"S"):"-");
        if(fc>=5)S.fw[S.fn.length]=fc===6?"blk:"+(fr0.blk||[]).map(function(b){return b.k}).join("+"):(fr0.gates||[]).filter(function(g){return!g.ok}).map(function(g){return g.k}).join("+")}
      S.fn.push(fc);S.evals++;continue}
    if(i<BT_WARM||i<S.free)continue;
    var d1=F.get("d1",400);if(d1.length<55)continue;
    if(S.first===null)S.first=m[i].t;
    /* o.sr (réglage RSI · Volume · Niveaux): only those trades, no trend setup */
    if(o.sr){S.evals++;var sx=srSetup(F.get("h4",200),F.get("h1",200),o);
      if(sx&&sx.st==="ready"&&(!o.srSide||sx.dir===+o.srSide)){var sp=sx.plan,sR=Math.abs(sp.entry-sp.sl),sres=btResolve(m,i,sp,sx.dir,N,cost);
        if(sres.how!=="open")S.trades.push({t:m[i].t,x:m[sres.j].t,dir:sx.dir,entry:sp.entry,sl:sp.sl,tp:sp.tp1,how:sres.how,r:sres.r,rp:+(sR/sp.entry*100).toFixed(3),cf:"sr",kind:"sr",cr:cost*sp.entry/sR,hs:[]});
        S.free=sres.j+17}
      continue}
    S.evals++;
    var r=analyze(S.sym,d1,F.get("h4",200),F.get("h1",200),o.btc?{btc:o.btc[m[i].t]||null}:null,o);
    /* o.rev (study): a reversal after an excess, when no trend setup is at its zone; o.revBtc: Bitcoin must have moved the same way over
       the last 4 hours (altcoins), o.revSide: 1 longs only, -1 shorts only */
    if(o.rev&&(!r.plan||r.dist>0.5)){var rv=revSetup(d1,F.get("h4",200),F.get("h1",200),o),bc=o.btc?o.btc[m[i].t]:null;
      if(rv&&(!o.revSide||rv.dir===+o.revSide)&&(!o.revBtc||S.sym==="BTC"||(bc&&bc.r4h*rv.dir>0))){
        var rp=rv.plan,rR=Math.abs(rp.entry-rp.sl),rres=btResolve(m,i,rp,rv.dir,N,cost);
        if(rres.how!=="open")S.trades.push({t:m[i].t,x:m[rres.j].t,dir:rv.dir,entry:rp.entry,sl:rp.sl,tp:rp.tp1,how:rres.how,r:rres.r,rp:+(rR/rp.entry*100).toFixed(3),cf:"rev",kind:"rev",cr:cost*rp.entry/rR,hs:[]});
        S.free=rres.j+17;continue}}
    if(o.rng&&(!r.plan||r.dist>0.5)){var rg=rngSetup(F.get("h4",200),F.get("h1",200));
      if(rg){var gp=rg.plan,gR=Math.abs(gp.entry-gp.sl),gres=btResolve(m,i,gp,rg.dir,N,cost);
        if(gres.how!=="open")S.trades.push({t:m[i].t,x:m[gres.j].t,dir:rg.dir,entry:gp.entry,sl:gp.sl,tp:gp.tp1,how:gres.how,r:gres.r,rp:+(gR/gp.entry*100).toFixed(3),cf:"rng",kind:"rng",cr:cost*gp.entry/gR,hs:[]});
        S.free=gres.j+17;continue}}
    if(!r.plan||r.dist>0.5)continue;
    enrich(r,F.m15(500),null,null,{noHeat:true});judge(r,jo);
    /* o.reb (study): no short while Bitcoin stands o.reb % or more above its 72-hour low (a rebound under way), no long while it stands
       o.reb % or more under its 72-hour high; what those trades would have given is kept apart */
    var bcx=o.reb&&o.btc?o.btc[m[i].t]:null;
    if(bcx&&r.st==="ready"&&(r.dir<0?bcx.up3>=+o.reb:bcx.dn3<=-o.reb)){
      var br=btResolve(m,i,r.plan,r.dir,N,cost);if(br.how!=="open")(S.late=S.late||[]).push({t:m[i].t,dir:r.dir,how:br.how,r:br.r,r4:+r.r4.toFixed(1)});continue}
    /* o.late (study): a ready trend trade in the direction of a stretched move is not taken; what it would have given is kept apart */
    if((o.late||o.lateD)&&r.st==="ready"&&lateHit(r,d1,o)){var lr=btResolve(m,i,r.plan,r.dir,N,cost);
      if(lr.how!=="open")(S.late=S.late||[]).push({t:m[i].t,dir:r.dir,how:lr.how,r:lr.r,r4:+r.r4.toFixed(1)});
      continue}
    if(r.st!=="ready"){
      /* o.shadow: also follow the setups the checks alone would call ready but a blocker or missing data holds back (study only) */
      if(o.shadow&&r.st0==="ready"){var sh=btResolve(m,i,r.plan,r.dir,N,cost);
        if(sh.how!=="open")(S.shadow=S.shadow||[]).push({t:m[i].t,x:m[sh.j].t,dir:r.dir,how:sh.how,r:sh.r,st:r.st,blk:(r.blk||[]).map(function(b){return b.k}),miss:r.miss||[],cf:cfgOf(r)})}
      continue}
    S.ready++;
    var p=r.plan,dir=r.dir,e=p.entry,R=Math.abs(e-p.sl),res=btResolve(m,i,p,dir,N,cost),j=res.j;
    if(res.how!=="open")S.trades.push({t:m[i].t,x:m[j].t,dir:dir,entry:e,sl:p.sl,tp:p.tp1,how:res.how,r:res.r,sx:r.slx?(r.slx.sl===p.sl?2:1):0,rp:+(R/e*100).toFixed(3),score:r.score,fl:r.flow?r.flow.sc:null,fc:r.flow?r.flow.c:null,cf:cfgOf(r),mid:r.midR?1:0,cr:cost*e/R,hs:[]});
    if(o.feat&&res.how!=="open"){var fbc=o.btc?o.btc[m[i].t]:null,fx=featOf(r,fbc),mf=memoFeat(r,d1,F.get("h4",200),F.get("h1",200),F.m15(200),fbc),fk;for(fk in mf)fx[fk]=mf[fk];
      if(o.feat2){var m2=memo2Feat(r,F.get("d1",400),F.get("h1",200),m[i].t+9e5,o.fund,o.met);for(fk in m2)fx[fk]=m2[fk]}S.trades[S.trades.length-1].fx=fx}
    if(o.inv&&res.how!=="open"){var iq={i:i,end:i+960,cr:cost*e/R,rec:S.trades[S.trades.length-1],t:{dir:dir,entry:e,sl:p.sl,tp:p.tp1,r0:R},v:{}};
      INV_RULES.forEach(function(r){iq.v[r]={done:null}});(S.isims=S.isims||[]).push(iq)}
    if(o.trail&&res.how!=="open"){var tq={i:i,end:i+960,cr:cost*e/R,far:e,rec:S.trades[S.trades.length-1],t:{dir:dir,entry:e,sl:p.sl,tp:p.tp1,r0:R},v:{}};
      TRAIL_RULES.forEach(function(r){tq.v[r]={sl:p.sl,done:null}});(S.sims=S.sims||[]).push(tq)}
    if((o.state||o.tpup||o.tpdn||o.exits)&&res.how!=="open")S.cur={i:i,j:j,rec:S.trades[S.trades.length-1],t:{dir:dir,entry:e,sl:p.sl,tp:p.tp1,t:m[i].t,r0:R}};else S.cur=null;
    S.free=j+17}
  if(S.i>=N)S.done=true;
  return S.done}
/* entry at the close of candle i, exit at the stop (or at the open when the candle opens beyond it) or at TP1, stop first when both are
   reached in the same candle, at the close after ten days; r in R, costs included */
function btResolve(m,i,p,dir,N,cost){
  var e=p.entry,R=Math.abs(e-p.sl),j,res=null,stop=Math.min(N,i+960);
  for(j=i+1;j<=stop;j++){var c=m[j];
    if(dir>0?c.l<=p.sl:c.h>=p.sl){var fill=dir>0?Math.min(c.o,p.sl):Math.max(c.o,p.sl);res={how:"sl",r:dir*(fill-e)/R};break}
    if(dir>0?c.h>=p.tp1:c.l<=p.tp1){res={how:"tp",r:Math.abs(p.tp1-e)/R};break}}
  if(!res){j=Math.min(j,N);res={how:j>=N?"open":"time",r:dir*(m[j].c-e)/R}}
  res.j=j;res.r-=cost*e/R;return res}
function btStats(tr){
  var n=tr.length,w=0,sum=0,gp=0,gl=0,streak=0,worst=0,curve=[],i;
  for(i=0;i<n;i++){var x=tr[i].r;if(x>0){w++;gp+=x;streak=0}else{gl-=x;streak++;if(streak>worst)worst=streak}sum+=x;curve.push(sum)}
  var mean=n?sum/n:0,v=0;for(i=0;i<n;i++)v+=(tr[i].r-mean)*(tr[i].r-mean);
  return{n:n,wins:w,win:n?w/n*100:0,avg:mean,se:n>1?Math.sqrt(v/(n-1)/n):0,tot:sum,pf:gl>0?gp/gl:null,streak:worst,curve:curve}}
