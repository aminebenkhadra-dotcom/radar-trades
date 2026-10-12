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
  if(len<2*n+2)return{adx:0,pdi:0,mdi:0};
  for(i=1;i<len;i++){
    var up=k[i].h-k[i-1].h,dn=k[i-1].l-k[i].l,p=up>dn&&up>0?up:0,m=dn>up&&dn>0?dn:0,
      t=Math.max(k[i].h-k[i].l,Math.abs(k[i].h-k[i-1].c),Math.abs(k[i].l-k[i-1].c));
    if(i<=n){sT+=t;sP+=p;sM+=m;if(i<n)continue}else{sT=sT-sT/n+t;sP=sP-sP/n+p;sM=sM-sM/n+m}
    P=sT?100*sP/sT:0;M=sT?100*sM/sT:0;dx.push(P+M?100*Math.abs(P-M)/(P+M):0)}
  var a=0;for(i=0;i<n;i++)a+=dx[i];a/=n;for(i=n;i<dx.length;i++)a=(a*(n-1)+dx[i])/n;
  return{adx:a,pdi:P,mdi:M}}
/* support and resistance: swing points of candle bodies, clustered; nh/nl tell whether the level acted as a top, a bottom, or both */
function levels(k,tol){var L=3,pts=[],i,j;
  function top(c){return Math.max(c.o,c.c)}
  function bot(c){return Math.min(c.o,c.c)}
  for(i=L;i<k.length-L;i++){var H=true,Lo=true;
    for(j=i-L;j<=i+L;j++){if(j===i)continue;if(top(k[j])>=top(k[i]))H=false;if(bot(k[j])<=bot(k[i]))Lo=false}
    if(H)pts.push({p:top(k[i]),t:1,i:i});if(Lo)pts.push({p:bot(k[i]),t:-1,i:i})}
  pts.sort(function(a,b){return a.p-b.p});
  var out=[],g=[];
  pts.forEach(function(q){if(g.length&&q.p-g[g.length-1].p>tol){out.push(g);g=[]}g.push(q)});
  if(g.length)out.push(g);
  return out.map(function(g){var s=0,nh=0,nl=0,last=0;g.forEach(function(q){s+=q.p;if(q.t>0)nh++;else nl++;if(q.i>last)last=q.i});
    return{p:s/g.length,n:g.length,nh:nh,nl:nl,last:last}})}
function orderBlocks(k,a){var out=[],i,j,c,ok;
  for(i=2;i<k.length-3;i++){c=k[i];
    if(c.c<c.o&&k[i+1].c>k[i+1].o&&Math.max(k[i+1].c,k[i+2].c,k[i+3].c)-c.h>1.5*a){
      ok=true;for(j=i+4;j<k.length;j++)if(k[j].c<c.l){ok=false;break}
      if(ok)out.push({dir:1,lo:c.l,hi:c.h,i:i})}
    if(c.c>c.o&&k[i+1].c<k[i+1].o&&c.l-Math.min(k[i+1].c,k[i+2].c,k[i+3].c)>1.5*a){
      ok=true;for(j=i+4;j<k.length;j++)if(k[j].c>c.h){ok=false;break}
      if(ok)out.push({dir:-1,lo:c.l,hi:c.h,i:i})}}
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
function swings(k,L,from,to){var out=[],i,j;from=Math.max(L,from||0);to=Math.min(k.length-L,to===undefined?k.length:to);
  function add(t,p,i){var last=out[out.length-1];
    if(last&&last.t===t){if(t>0?p>last.p:p<last.p){last.p=p;last.i=i}}else out.push({t:t,p:p,i:i})}
  for(i=from;i<to;i++){var H=true,Lo=true;
    for(j=i-L;j<=i+L;j++){if(j===i)continue;if(k[j].h>=k[i].h)H=false;if(k[j].l<=k[i].l)Lo=false}
    if(H)add(1,k[i].h,i);if(Lo)add(-1,k[i].l,i)}
  return out}
function corr(a,b){var n=Math.min(a.length,b.length),i,sa=0,sb=0,x,y;if(n<20)return 0;
  a=a.slice(-n);b=b.slice(-n);for(i=0;i<n;i++){sa+=a[i];sb+=b[i]}sa/=n;sb/=n;
  var va=0,vb=0,cv=0;for(i=0;i<n;i++){x=a[i]-sa;y=b[i]-sb;va+=x*x;vb+=y*y;cv+=x*y}
  return va>0&&vb>0?cv/Math.sqrt(va*vb):0}
function rets(c){var o=[];for(var i=1;i<c.length;i++)o.push(c[i-1]?c[i]/c[i-1]-1:0);return o}
function share(k,from,to){var q=0,b=0,i;for(i=Math.max(0,from);i<to;i++){if(k[i].b===undefined||isNaN(k[i].b))return null;q+=k[i].q;b+=k[i].b}return q>0?b/q:null}

/* ---------- market context: what Bitcoin is doing while an altcoin sets up ---------- */
function calm(d1,h4,h1){
  /* how agitated the last 24 hours were: range against the usual daily range, volume against the 30-day average */
  var nd=d1.length,n1=h1.length,n4=h4.length,i,adr=0,hi=-Infinity,lo=Infinity,h8=-Infinity,l8=Infinity,q6=0,q180=0,nq=0;
  if(nd>15){for(i=nd-15;i<nd-1;i++)adr+=d1[i].h-d1[i].l;adr/=14}
  for(i=Math.max(0,n1-24);i<n1;i++){if(h1[i].h>hi)hi=h1[i].h;if(h1[i].l<lo)lo=h1[i].l;if(i>=n1-8){if(h1[i].h>h8)h8=h1[i].h;if(h1[i].l<l8)l8=h1[i].l}}
  for(i=Math.max(0,n4-7);i<n4-1;i++)q6+=h4[i].q;for(i=Math.max(0,n4-181);i<n4-1;i++){q180+=h4[i].q;nq++}
  return{rng24:adr>0?(hi-lo)/adr:null,rng8:adr>0?(h8-l8)/adr:null,relVol:q180>0?(q6/6)/(q180/nq):null,adr:adr}}
function market(d1,h4,h1){
  var c4=closes(h4),c1=closes(h1),n=c1.length,a1=atr(h1),m=c4.length,cm=calm(d1,h4,h1);
  return{rng24:cm.rng24,relVol:cm.relVol,b4:bias(h4),bd:bias(d1.length>90?d1.slice(-90):d1),adx:adx(h4).adx,r4:rsi(c4),price:c1[n-1],
    r4h:(c1[n-1]/c1[Math.max(0,n-5)]-1)*100,r24:(c1[n-1]/c1[Math.max(0,n-25)]-1)*100,a1p:a1/c1[n-1]*100,
    r7:c4[m-1]/c4[Math.max(0,m-43)]-1,ret4:rets(c4.slice(-62))}}

/* ---------- setup engine ---------- */
function targets(lv,dir,entry,R,k60){
  /* levels come from candle bodies, so a lone wick is never TP1 */
  var ahead=lv.map(function(l){return dir>0?l.p-entry:entry-l.p}).filter(function(d){return d>0}).sort(function(x,y){return x-y});
  var near=ahead.filter(function(d){return d>=R&&d<=3*R});
  var t1=near.length?near[0]:2*R,beyond=ahead.filter(function(d){return d>=t1+R&&d<=6*R});
  var wick=dir>0?Math.max.apply(null,k60.map(function(x){return x.h}))-entry:entry-Math.min.apply(null,k60.map(function(x){return x.l}));
  return{t1:t1,res:near.length>0,t2:beyond.length?beyond[0]:(wick>=t1+R&&wick<=6*R?wick:t1+2*R),
    block:ahead.some(function(d){return d>0.3*R&&d<R}),ahead:ahead.slice(0,6)}}
function mkPlan(r,entry,sl){
  var z=r.z,dir=r.dir,R=Math.abs(entry-sl),t=targets(r.lv,dir,entry,R,r.h4);
  r.plan={entry:entry,sl:sl,tp1:entry+dir*t.t1,tp2:entry+dir*t.t2,rr:t.t1/R,rr2:t.t2/R,zlo:z.lo,zhi:z.hi,res:t.res};
  r.f.rr=t.t1/R;r.f.block=t.block?1:0;r.f.stop=R/entry*100;r.f.res=t.res?1:0;r.ahead=t.ahead;return r.plan}

function analyze(sym,d1,h4,h1,ctx,opt){
  opt=opt||{};
  var n4=h4.length,n1=h1.length,price=h1[n1-1].c,a=atr(h4),d90=d1.length>90?d1.slice(-90):d1,bd=bias(d90),b4=bias(h4),i,j;
  var c1=closes(h1),c4=closes(h4),r1=rsi(c1),r4=rsi(c4);
  var r={v:3,sym:sym,price:price,bd:bd,b4:b4,r1:r1,r4:r4,h4:h4.slice(-60),dir:0,score:0,st:"wait",why:[],plan:null,f:{},a:a};
  if(b4===0||bd===-b4){r.st="none";r.none=b4===0?"flat":"opp";return r}
  var dir=b4,f=r.f;r.dir=dir;
  var lv=levels(h4,0.5*a),obs=orderBlocks(h4,a),zs=[];
  lv.forEach(function(l){if(dir>0?l.p<=price+0.25*a:l.p>=price-0.25*a)zs.push({lo:l.p-0.25*a,hi:l.p+0.25*a,kind:"sr",n:l.n,nh:l.nh,nl:l.nl,last:l.last})});
  obs.forEach(function(o){if(o.dir===dir&&(dir>0?o.lo<price:o.hi>price))zs.push({lo:o.lo,hi:o.hi,kind:"ob",n:1,nh:0,nl:0,last:o.i})});
  f.bd=bd===b4?1:0;
  if(!zs.length){r.none="zone";return r}
  zs.sort(function(x,y){return dir>0?y.hi-x.hi:x.lo-y.lo});
  var z=zs[0],conf=zs.some(function(o){return o!==z&&o.kind!==z.kind&&o.lo<=z.hi&&o.hi>=z.lo});
  r.z=z;r.lv=lv;
  var entry=dir>0?Math.min(price,z.hi):Math.max(price,z.lo),K=opt.slk||0.5;
  var dist=Math.max(0,(dir>0?price-entry:entry-price)/a);
  r.dist=dist;r.distPct=Math.abs(price-entry)/price*100;
  f.dist=dist;f.depth=(dir>0?z.hi-price:price-z.lo)/Math.max(1e-12,z.hi-z.lo);

  /* trend */
  var e20=ema(c4,20),e50=ema(c4,50),ad=adx(h4);
  f.adx=ad.adx;f.di=(ad.pdi-ad.mdi)*dir;
  f.slope=(e50[n4-1]-e50[Math.max(0,n4-11)])/a*dir;
  f.ext=(price-e20[n4-1])/a*dir;f.e50=(price-e50[n4-1])/a*dir;
  var age=0;for(i=n4-1;i>50;i--){if(dir>0?(c4[i]>e50[i]&&e20[i]>e50[i]):(c4[i]<e50[i]&&e20[i]<e50[i]))age++;else break}
  f.age=age;
  var sw=swings(h4,3),hs=sw.filter(function(s){return s.t>0}),ls=sw.filter(function(s){return s.t<0});
  var st=0,broken=0;
  if(hs.length>=2&&ls.length>=2){var H2=hs[hs.length-1],H1=hs[hs.length-2],L2=ls[ls.length-1],L1=ls[ls.length-2];
    var up=H2.p>H1.p&&L2.p>L1.p,dn=H2.p<H1.p&&L2.p<L1.p;
    st=dir>0?(up?2:dn?0:1):(dn?2:up?0:1);
    broken=dir>0?(price<L2.p?1:0):(price>H2.p?1:0)}
  f.struct=st;f.broken=broken;
  var nd=d1.length,cd=closes(d1);
  if(nd>=200){var e200=ema(cd,200);f.lt=(price>e200[nd-1]?1:-1)*dir}else f.lt=0;
  f.mom7=nd>8?(price/cd[nd-8]-1)*100*dir:0;f.mom30=nd>31?(price/cd[nd-31]-1)*100*dir:0;
  var ed20=ema(cd.slice(-90),20);f.dext=(price-ed20[ed20.length-1])/price*100*dir;

  /* last impulse in the trend direction and how much of it the pullback has given back */
  var W=Math.min(60,n4-1),xi=n4-1,xp=dir>0?-Infinity:Infinity;
  for(i=n4-1;i>=n4-W;i--){if(dir>0?h4[i].h>xp:h4[i].l<xp){xp=dir>0?h4[i].h:h4[i].l;xi=i}}
  var base=null;for(i=sw.length-1;i>=0;i--){if(sw[i].t===-dir&&sw[i].i<xi){base=sw[i];break}}
  if(!base){var bp=dir>0?Infinity:-Infinity,bi=Math.max(0,xi-20);for(i=Math.max(0,xi-20);i<xi;i++){if(dir>0?h4[i].l<bp:h4[i].h>bp){bp=dir>0?h4[i].l:h4[i].h;bi=i}}base={p:bp,i:bi}}
  var imp=Math.abs(xp-base.p);
  f.retr=imp>0?(dir>0?xp-price:price-xp)/imp:0;f.impA=imp/a;f.since=n4-1-xi;f.impBars=xi-base.i;
  r.imp={top:xp,base:base.p,ti:xi,bi:base.i};
  var qi=0,ni=0,qp=0,np=0;
  for(i=base.i;i<=xi;i++){qi+=h4[i].q;ni++}for(i=xi+1;i<n4-1;i++){qp+=h4[i].q;np++}
  f.pbVol=ni&&np>=2&&qi>0?(qp/np)/(qi/ni):null;

  /* zone quality */
  f.zkind=z.kind==="ob"?1:0;f.zn=z.n;f.flip=z.nh>0&&z.nl>0?1:0;f.conf=conf?1:0;f.zw=(z.hi-z.lo)/a;f.zage=n4-1-z.last;
  var keys=[],day=d1[nd-1],pd=d1[nd-2];
  function near(p){return p>=z.lo-0.25*a&&p<=z.hi+0.25*a}
  f.kE50=near(e50[n4-1])?1:0;
  if(n4>=200){var e200h=ema(c4,200);f.kE200=near(e200h[n4-1])?1:0}else f.kE200=0;
  f.kPD=pd&&(near(pd.h)||near(pd.l))?1:0;
  var wo=null,mo=null,pwh=null,pwl=null;
  for(i=nd-1;i>=Math.max(0,nd-8);i--){if(new Date(d1[i].t).getUTCDay()===1){wo=d1[i].o;
    if(i>=7){pwh=-Infinity;pwl=Infinity;for(j=i-7;j<i;j++){if(d1[j].h>pwh)pwh=d1[j].h;if(d1[j].l<pwl)pwl=d1[j].l}}break}}
  for(i=nd-1;i>=Math.max(0,nd-32);i--){if(new Date(d1[i].t).getUTCDate()===1){mo=d1[i].o;break}}
  f.kWO=wo!==null&&near(wo)?1:0;f.kMO=mo!==null&&near(mo)?1:0;f.kPW=(pwh!==null&&near(pwh))||(pwl!==null&&near(pwl))?1:0;
  f.kDO=day&&near(day.o)?1:0;
  var f50=dir>0?xp-0.5*imp:xp+0.5*imp,f62=dir>0?xp-0.618*imp:xp+0.618*imp;
  f.kFib=imp>0&&Math.min(f50,f62)<=z.hi+0.25*a&&Math.max(f50,f62)>=z.lo-0.25*a?1:0;
  var gap=0;for(i=Math.max(1,n4-60);i<n4-2;i++){
    var glo=dir>0?h4[i-1].h:h4[i+1].h,ghi=dir>0?h4[i+1].l:h4[i-1].l;
    if(ghi-glo>0.25*a&&glo<=z.hi&&ghi>=z.lo){var open=true;for(j=i+2;j<n4-1;j++){if(dir>0?h4[j].l<=glo:h4[j].h>=ghi){open=false;break}}if(open){gap=1;break}}}
  f.kFvg=gap;
  f.kN=f.conf+f.kE50+f.kE200+f.kPD+f.kWO+f.kMO+f.kPW+f.kFib+f.kFvg;
  var vis=0,inz=false;for(i=Math.max(xi+1,n4-40);i<n4-1;i++){var t=dir>0?h4[i].l<=z.hi:h4[i].h>=z.lo;if(t&&!inz)vis++;inz=t}
  f.retest=Math.max(0,vis-(inz?1:0));

  /* momentum and volume */
  f.r1=dir>0?r1:100-r1;f.r4=dir>0?r4:100-r4;r.div=divergence(h1,dir);f.div=r.div?1:0;
  var s4=share(h4,n4-7,n4-1),s1=share(h1,n1-13,n1-1);
  f.dl4=s4===null?null:(dir>0?s4:1-s4);f.dl1=s1===null?null:(dir>0?s1:1-s1);
  var cm=calm(d1,h4,h1);f.relVol=cm.relVol;f.rng24=cm.rng24;f.rng8=cm.rng8;
  f.ret24=(price/c1[Math.max(0,n1-25)]-1)*100*dir;f.ret24a=cm.adr>0?(price-c1[Math.max(0,n1-25)])/cm.adr*dir:0;
  /* rejection on the last closed 4H and 1H candles */
  function rej(k){var body=Math.abs(k.c-k.o),rng=k.h-k.l,tail=dir>0?Math.min(k.o,k.c)-k.l:k.h-Math.max(k.o,k.c);return rng>0&&tail>=0.45*rng&&tail>=1.5*body?1:0}
  f.t4=n4>2?rej(h4[n4-2]):0;f.t1h=n1>2?rej(h1[n1-2]):0;
  var tr14=0,tr100=0,nt=0;for(i=Math.max(1,n4-100);i<n4;i++){var tv=Math.max(h4[i].h-h4[i].l,Math.abs(h4[i].h-h4[i-1].c),Math.abs(h4[i].l-h4[i-1].c));tr100+=tv;nt++;if(i>=n4-14)tr14+=tv}
  f.volReg=tr100>0?(tr14/14)/(tr100/nt):1;f.atrp=a/price*100;
  var a1=atr(h1);r.a1=a1;f.a1p=a1/price*100;
  if(day&&nd>15){var adr=0;for(i=nd-15;i<nd-1;i++)adr+=d1[i].h-d1[i].l;adr/=14;f.dayR=adr>0?(day.h-day.l)/adr:0;f.dayPos=day.h>day.l?(dir>0?(price-day.l):(day.h-price))/(day.h-day.l):0.5}else{f.dayR=0;f.dayPos=0.5}

  /* Bitcoin context */
  if(ctx&&ctx.btc&&sym!=="BTC"){var B=ctx.btc;
    f.btc4=B.b4*dir;f.btcd=B.bd*dir;f.btcSh=B.r4h*dir;f.btcShA=B.a1p>0?B.r4h/B.a1p*dir:0;f.btc24=B.r24*dir;f.btcAdx=B.adx;
    f.corr=corr(rets(c4.slice(-62)),B.ret4);f.rs=((n4>43?price/c4[n4-43]-1:0)-B.r7)*100*dir;f.btcR4=dir>0?B.r4:100-B.r4;f.bRng=B.rng24;f.bVol=B.relVol}
  else{f.btc4=1;f.btcd=bd===dir?1:0;f.btcSh=(c1[n1-1]/c1[Math.max(0,n1-5)]-1)*100*dir;f.btcShA=a1>0?f.btcSh/(a1/price*100):0;f.btc24=(c1[n1-1]/c1[Math.max(0,n1-25)]-1)*100*dir;f.btcAdx=ad.adx;f.corr=1;f.rs=0;f.btcR4=f.r4;f.bRng=f.rng24;f.bVol=f.relVol}
  var now=new Date(h1[n1-1].t);f.hour=now.getUTCHours();f.dow=now.getUTCDay();

  mkPlan(r,entry,dir>0?z.lo-K*a:z.hi+K*a);
  /* score of the previous engine, kept as a reference */
  var s2=(bd===b4?25:12)+(dist<=0.5?20:dist<=1.5?12:dist<=3?4:0)+(f.r1<=45?10:f.r1<=55?5:0)+(f.r4<70?5:0)+(r.div?5:0)+(conf?10:0)+(f.rr>=2?10:f.rr>=1.5?7:2)-(f.block?8:0);
  f.s2=s2;r.base=s2;
  return r}

/* 15-minute evidence that the pullback is turning at the zone */
function triggers(m,dir,z,a4){
  var n=m.length,T={sweep:0,bos:0,candle:0,rsiT:0,delta:0,climax:0,m15e:0,bounce:0,ds3:null,ext15:null,r15:null,a15:0};
  if(n<60)return T;
  var w=m.slice(Math.max(0,n-97),n-1),W=w.length,price=m[n-1].c,i,j,a15=atr(w.slice(-60));T.a15=a15;
  var c=closes(m),rs=rsiSeries(c),nr=rs.length;
  if(nr>10){var now=rs[nr-1],prev=rs[nr-2],win=rs.slice(-8),ext=dir>0?Math.min.apply(null,win):Math.max.apply(null,win);
    T.r15=now;T.rExt=ext;T.rsiT=(dir>0?(ext<=35&&now>prev&&now>ext+3):(ext>=65&&now<prev&&now<ext-3))?1:0}
  var lo=function(k){return dir>0?k.l:-k.h},hi=function(k){return dir>0?k.h:-k.l},P=dir>0?price:-price;
  var zTop=dir>0?z.hi+0.25*a4:-(z.lo-0.25*a4),zBot=dir>0?z.lo-0.75*a4:-(z.hi+0.75*a4);
  /* extreme of the last 6 hours: the low of the dip for a long */
  var xi=W-1,xv=Infinity;for(i=W-1;i>=Math.max(0,W-24);i--){if(lo(w[i])<xv){xv=lo(w[i]);xi=i}}
  T.ext15=dir>0?xv:-xv;T.bounce=a15>0?(P-xv)/a15:0;T.extAge=W-1-xi;
  var e=ema(c.slice(-120),20);T.m15e=a15>0?(price-e[e.length-1])/a15*dir:0;
  var atZone=xv<=zTop&&xv>=zBot;
  /* liquidity sweep: a wick takes out an earlier 15m swing, then price closes back above it */
  var sw=swings(w,2),piv=sw.filter(function(s){return s.t===-dir});
  for(j=Math.max(3,W-8);j<W&&!T.sweep;j++){
    for(i=piv.length-1;i>=0;i--){var s=piv[i],sp=dir>0?s.p:-s.p;if(s.i>j-3)continue;if(j-s.i>60)break;
      if(lo(w[j])<sp&&(dir>0?w[j].c:-w[j].c)>sp||(lo(w[j])<sp&&j+1<W&&(dir>0?w[j+1].c:-w[j+1].c)>sp)){
        var first=true;for(var q=s.i+1;q<j;q++)if(lo(w[q])<sp){first=false;break}
        if(first&&P>sp&&lo(w[j])<=zTop&&lo(w[j])>=zBot){T.sweep=1;break}}}}
  /* break of the last lower high after the low was set at the zone */
  if(atZone&&xi<=W-2&&xi>=3){var ref=null;
    for(i=sw.length-1;i>=0;i--){if(sw[i].t===dir&&sw[i].i<xi){ref=dir>0?sw[i].p:-sw[i].p;break}}
    if(ref===null){ref=-Infinity;for(i=Math.max(0,xi-6);i<xi;i++)if(hi(w[i])>ref)ref=hi(w[i])}
    var fb=-1;for(i=xi+1;i<W;i++){if((dir>0?w[i].c:-w[i].c)>ref){fb=i;break}}
    if(fb>=0&&fb>=W-3&&P>ref)T.bos=1;T.bosRef=dir>0?ref:-ref}
  /* reversal candle on the last closed 15m candle: engulfing or long rejection wick */
  if(W>=3){var k0=w[W-1],k1=w[W-2],body=Math.abs(k0.c-k0.o),rng=k0.h-k0.l,bull=dir>0?k0.c>k0.o:k0.c<k0.o;
    var tail=dir>0?Math.min(k0.o,k0.c)-k0.l:k0.h-Math.max(k0.o,k0.c),nose=dir>0?k0.h-Math.max(k0.o,k0.c):Math.min(k0.o,k0.c)-k0.l;
    var eng=bull&&(dir>0?k1.c<k1.o:k1.c>k1.o)&&body>=0.6*a15&&(dir>0?(k0.c>=k1.o&&k0.o<=k1.c):(k0.c<=k1.o&&k0.o>=k1.c));
    var pin=rng>=a15&&tail>=2*body&&nose<=0.35*rng&&tail>=0.5*rng;
    if((eng||pin)&&lo(k0)<=zTop&&lo(k0)>=zBot)T.candle=1}
  /* taker flow turning: buyers dominate the last three candles after sellers dominated the eight before (for a long) */
  var s3=share(w,W-3,W),s8=share(w,W-11,W-3);
  if(s3!==null&&s8!==null){if(dir<0){s3=1-s3;s8=1-s8}T.ds3=s3;T.ds8=s8;T.delta=s3>=0.54&&s8<=0.49?1:0}
  /* volume climax absorbed at the zone */
  for(j=Math.max(41,W-6);j<W;j++){var av=0;for(i=j-40;i<j;i++)av+=w[i].q;av/=40;var kk=w[j],md=(kk.h+kk.l)/2;
    if(av>0&&kk.q>=2.5*av&&lo(kk)<=zTop&&lo(kk)>=zBot&&(dir>0?kk.c>md:kk.c<md)&&(dir>0?price>=kk.c:price<=kk.c)){T.climax=1;break}}
  return T}

/* second pass: 15-minute trigger, order book, squeeze */
function enrich(r,m15,book,sqd,opt){
  opt=opt||{};var f=r.f,dir=r.dir,z=r.z,a=r.a;
  if(m15&&m15.length>30){var T=triggers(m15,dir,z,a);r.trig=T;r.r15=T.r15;
    f.tSweep=T.sweep;f.tBos=T.bos;f.tCandle=T.candle;f.tRsi=T.rsiT;f.tDelta=T.delta;f.tClimax=T.climax;
    f.m15e=T.m15e;f.bounce=T.bounce;f.ds3=T.ds3;f.extAge=T.extAge===undefined?null:T.extAge;f.a15p=T.a15/r.price*100;
    f.r15=T.r15===null?null:(dir>0?T.r15:100-T.r15);
    f.tN=T.sweep+T.bos+T.candle+T.rsiT+T.delta+T.climax}
  var b=bookStats(book,dir,r.plan);r.book=b;
  if(b){f.bk=dir>0?b.bid:100-b.bid;f.wall=b.block?1:0;f.spread=b.spread}
  var hm=opt.noHeat?null:(m15&&m15.length>=100?heatModel(m15):null);
  r.sq=squeeze(sqd||{fund:r.fund===undefined?null:r.fund,ls:null,oi:null},hm);r.hm=hm?{above:hm.above,below:hm.below}:null;
  f.sqA=dir>0?r.sq.dn:r.sq.up;f.sqF=dir>0?r.sq.up:r.sq.dn;
  var d=r.sq.d;f.fund=d.fund===null||d.fund===undefined?null:d.fund*100*dir;f.ls=d.ls===null||d.ls===undefined?null:d.ls;f.oi=d.oi===null||d.oi===undefined?null:d.oi;
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
