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
function market(d1,h4,h1){var n=h1.length;
  return{b4:bias(h4),bd:bias(d1.length>90?d1.slice(-90):d1),r4h:(h1[n-1].c/h1[Math.max(0,n-5)].c-1)*100}}

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
  var K=+(opt&&opt.slk)||PREC.slk,z=r.z,dir=r.dir,edge=dir>0?Math.min(r.price,z.hi):Math.max(r.price,z.lo);
  return mkPlan(r,r.dist<=0.5?r.price:edge,dir>0?z.lo-K*r.a:z.hi+K*r.a)}

/* first pass, on daily, 4H and 1H candles: direction, entry zone, plan, and everything that describes the context */
function analyze(sym,d1,h4,h1,ctx,opt){
  opt=opt||{};
  var n4=h4.length,n1=h1.length,price=h1[n1-1].c,a=atr(h4),bd=bias(d1.length>90?d1.slice(-90):d1),b4=bias(h4),i,j;
  var c1=closes(h1),c4=closes(h4),r1=rsi(c1),r4=rsi(c4);
  var r={v:3,sym:sym,price:price,bd:bd,b4:b4,r1:r1,r4:r4,h4:h4.slice(-60),dir:0,score:0,st:"wait",why:[],plan:null,f:{},a:a};
  if(b4===0||bd===-b4){r.st="none";r.why.push({t:b4===0?"4H sans tendance nette":"1J et 4H en sens opposé",k:"no"});return r}
  var dir=b4,f=r.f;r.dir=dir;f.bd=bd===b4?1:0;
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
  var b=bookStats(book,dir,r.plan);r.book=b;
  var hm=opt.noHeat?null:(m15&&m15.length>=100?heatModel(m15):null);
  r.sq=squeeze(sqd||{fund:r.fund===undefined?null:r.fund,ls:null,oi:null},hm);
  f.sqA=dir>0?r.sq.dn:r.sq.up;f.sqF=dir>0?r.sq.up:r.sq.dn;
  if(hm){var p=r.plan;
    r.liqOwn=(dir>0?hm.below:hm.above).filter(function(z){return dir>0?(z.p>p.sl&&z.p<p.entry):(z.p<p.sl&&z.p>p.entry)})[0]||null;
    r.liqMag=(dir>0?hm.above:hm.below).filter(function(z){var g=(z.p-r.price)/r.price*dir;return g>0&&g<0.15})[0]||null}
  return r}

/* ---------- verdict: six checks, a score, a status ----------
   Tendance, Zone and Risque must pass for a setup to be "Prêt"; the strictness setting adds Déclencheur, then Marché and Élan.
   Four statuses: "ready" (prêt selon les règles), "watch" (à surveiller), "refused" (refusé), "incomplete" (données incomplètes).
   Missing data never earns points, and a critical blocker (wide spread, obstacle before 1R) takes "ready" away. */
var PREC={strict:2,minRR:1.5,slk:0.5,feeCap:8,fee:0.05,lev:5,spreadWatch:0.15,spreadRefuse:0.5};
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
  if(r.liqOwn)add(g,"no",0,function(){return"Zone de liquidation de "+(L?"longs":"shorts")+" vers "+px(r.liqOwn.p)+", entre l'entrée et le stop : mèche possible"});
  if(r.liqMag)add(g,"mid",0,function(){return"Aimant possible : liquidations de "+(L?"shorts":"longs")+" vers "+px(r.liqMag.p)+" ("+sgn((r.liqMag.p-r.price)/r.price*100,1)+" %)"});
  g.pts=Math.min(15,g.pts);
  if(!q)g.head="R:R "+fr(rrNet,1)+" net · frais "+fr(fees,0)+"\u00a0%";

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
    if(i<BT_WARM||i<S.free)continue;
    var d1=F.get("d1",400);if(d1.length<55)continue;
    if(S.first===null)S.first=m[i].t;
    S.evals++;
    var r=analyze(S.sym,d1,F.get("h4",200),F.get("h1",200),o.btc?{btc:o.btc[m[i].t]||null}:null,o);
    if(!r.plan||r.dist>0.5)continue;
    enrich(r,F.m15(500),null,null,{noHeat:true});judge(r,jo);
    if(r.st!=="ready"){
      /* o.shadow: also follow the setups the checks alone would call ready but a blocker or missing data holds back (study only) */
      if(o.shadow&&r.st0==="ready"){var sh=btResolve(m,i,r.plan,r.dir,N,cost);
        if(sh.how!=="open")(S.shadow=S.shadow||[]).push({t:m[i].t,x:m[sh.j].t,dir:r.dir,how:sh.how,r:sh.r,st:r.st,blk:(r.blk||[]).map(function(b){return b.k}),miss:r.miss||[],cf:cfgOf(r)})}
      continue}
    S.ready++;
    var p=r.plan,dir=r.dir,e=p.entry,R=Math.abs(e-p.sl),res=btResolve(m,i,p,dir,N,cost),j=res.j;
    if(res.how!=="open")S.trades.push({t:m[i].t,x:m[j].t,dir:dir,entry:e,sl:p.sl,tp:p.tp1,how:res.how,r:res.r,score:r.score,fl:r.flow?r.flow.sc:null,fc:r.flow?r.flow.c:null,cf:cfgOf(r)});
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
