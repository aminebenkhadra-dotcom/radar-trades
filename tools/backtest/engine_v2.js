/* Radar Trades engine v2 (as shipped in Version 19), extracted for the baseline */
function ema(v,n){var k=2/(n+1),e=v[0],o=[e];for(var i=1;i<v.length;i++){e=v[i]*k+e*(1-k);o.push(e)}return o}
function rsi(c,n){n=n||14;if(c.length<n+2)return 50;var g=0,l=0,i,d;
  for(i=1;i<=n;i++){d=c[i]-c[i-1];if(d>0)g+=d;else l-=d}g/=n;l/=n;
  for(i=n+1;i<c.length;i++){d=c[i]-c[i-1];g=(g*(n-1)+Math.max(d,0))/n;l=(l*(n-1)+Math.max(-d,0))/n}
  return l===0?100:100-100/(1+g/l)}
function atr(k,n){n=n||14;var t=[],i;for(i=1;i<k.length;i++)t.push(Math.max(k[i].h-k[i].l,Math.abs(k[i].h-k[i-1].c),Math.abs(k[i].l-k[i-1].c)));
  if(t.length<n)return t.reduce(function(a,b){return a+b},0)/Math.max(1,t.length);
  var a=0;for(i=0;i<n;i++)a+=t[i];a/=n;for(i=n;i<t.length;i++)a=(a*(n-1)+t[i])/n;return a}
function bias(k){var c=k.map(function(x){return x.c}),e20=ema(c,20),e50=ema(c,50),p=c[c.length-1],a=e20[e20.length-1],b=e50[e50.length-1];
  if(p>b&&a>b)return 1;if(p<b&&a<b)return -1;return 0}
function levels(k,tol){var L=3,pts=[],i,j;
  function top(c){return Math.max(c.o,c.c)}
  function bot(c){return Math.min(c.o,c.c)}
  for(i=L;i<k.length-L;i++){var H=true,Lo=true;
    for(j=i-L;j<=i+L;j++){if(j===i)continue;if(top(k[j])>=top(k[i]))H=false;if(bot(k[j])<=bot(k[i]))Lo=false}
    if(H)pts.push(top(k[i]));if(Lo)pts.push(bot(k[i]))}
  pts.sort(function(a,b){return a-b});
  var out=[],g=[];
  pts.forEach(function(p){if(g.length&&p-g[g.length-1]>tol){out.push(g);g=[]}g.push(p)});
  if(g.length)out.push(g);
  return out.map(function(g){return{p:g.reduce(function(a,b){return a+b},0)/g.length,n:g.length}})}
function orderBlocks(k,a){var out=[],i,j,c,ok;
  for(i=2;i<k.length-3;i++){c=k[i];
    if(c.c<c.o&&k[i+1].c>k[i+1].o&&Math.max(k[i+1].c,k[i+2].c,k[i+3].c)-c.h>1.5*a){
      ok=true;for(j=i+4;j<k.length;j++)if(k[j].c<c.l){ok=false;break}
      if(ok)out.push({dir:1,lo:c.l,hi:c.h})}
    if(c.c>c.o&&k[i+1].c<k[i+1].o&&c.l-Math.min(k[i+1].c,k[i+2].c,k[i+3].c)>1.5*a){
      ok=true;for(j=i+4;j<k.length;j++)if(k[j].c>c.h){ok=false;break}
      if(ok)out.push({dir:-1,lo:c.l,hi:c.h})}}
  return out}

/* ---------- setup engine ---------- */
function rsiSeries(c,n){n=n||14;var out=[],g=0,l=0,i,d;if(c.length<n+2)return out;
  for(i=1;i<=n;i++){d=c[i]-c[i-1];if(d>0)g+=d;else l-=d}g/=n;l/=n;
  for(i=0;i<n;i++)out.push(50);out.push(l===0?100:100-100/(1+g/l));
  for(i=n+1;i<c.length;i++){d=c[i]-c[i-1];g=(g*(n-1)+Math.max(d,0))/n;l=(l*(n-1)+Math.max(-d,0))/n;out.push(l===0?100:100-100/(1+g/l))}
  return out}
/* price makes a new extreme while RSI does not: last two closing swings, the latest within 12 candles */
function divergence(k,dir){
  var c=k.map(function(x){return x.c}),rs=rsiSeries(c),n=c.length,L=2,piv=[],i,j;
  if(rs.length<40)return false;
  for(i=Math.max(L,n-60);i<n-L;i++){var ok=true;
    for(j=i-L;j<=i+L;j++){if(j===i)continue;if(dir>0?c[j]<=c[i]:c[j]>=c[i]){ok=false;break}}
    if(ok)piv.push(i)}
  if(piv.length<2)return false;
  var a=piv[piv.length-2],b=piv[piv.length-1];
  if(b<n-12)return false;
  return dir>0?(c[b]<c[a]&&rs[b]>rs[a]+3):(c[b]>c[a]&&rs[b]<rs[a]-3)}

function analyze(sym,d1,h4,h1){
  var price=h1[h1.length-1].c, a=atr(h4), bd=bias(d1), b4=bias(h4);
  var r1=rsi(h1.map(function(x){return x.c})), r4=rsi(h4.map(function(x){return x.c}));
  var r={sym:sym,price:price,bd:bd,b4:b4,r1:r1,r4:r4,h4:h4.slice(-60),dir:0,score:0,st:"wait",why:[],plan:null};
  if(b4===0||bd===-b4){
    r.st="none";
    r.why.push({t:b4===0?"4H sans tendance nette":"1J et 4H en sens opposé",k:"no"});
    return r}
  var dir=b4; r.dir=dir;
  var lv=levels(h4,0.5*a), obs=orderBlocks(h4,a), zs=[];
  lv.forEach(function(l){if(dir>0?l.p<=price+0.25*a:l.p>=price-0.25*a)zs.push({lo:l.p-0.25*a,hi:l.p+0.25*a,kind:"sr"})});
  obs.forEach(function(o){if(o.dir===dir&&(dir>0?o.lo<price:o.hi>price))zs.push({lo:o.lo,hi:o.hi,kind:"ob"})});
  var sc=0;
  if(bd===b4){sc+=25;r.why.push({t:"Tendance 1J et 4H alignées ("+(dir>0?"haussière":"baissière")+")",k:"ok"})}
  else{sc+=12;r.why.push({t:"1J neutre, 4H "+(dir>0?"haussier":"baissier"),k:"mid"})}
  if(!zs.length){r.score=sc;r.why.push({t:"Aucune zone d'entrée exploitable",k:"no"});return r}
  zs.sort(function(x,y){return dir>0?y.hi-x.hi:x.lo-y.lo});
  var z=zs[0], conf=zs.some(function(o){return o!==z&&o.kind!==z.kind&&o.lo<=z.hi&&o.hi>=z.lo});
  var entry=dir>0?Math.min(price,z.hi):Math.max(price,z.lo);
  var sl=dir>0?z.lo-0.5*a:z.hi+0.5*a, R=Math.abs(entry-sl);

  /* targets: levels come from candle bodies, so a lone wick is never TP1 */
  var ahead=lv.map(function(l){return dir>0?l.p-entry:entry-l.p}).filter(function(d){return d>0}).sort(function(x,y){return x-y});
  var near=ahead.filter(function(d){return d>=R&&d<=3*R});
  var t1=near.length?near[0]:2*R, t1res=near.length>0;
  var beyond=ahead.filter(function(d){return d>=t1+R&&d<=6*R});
  var wick=dir>0?Math.max.apply(null,r.h4.map(function(x){return x.h}))-entry:entry-Math.min.apply(null,r.h4.map(function(x){return x.l}));
  var t2=beyond.length?beyond[0]:(wick>=t1+R&&wick<=6*R?wick:t1+2*R);
  var block=ahead.some(function(d){return d>0.3*R&&d<R});
  var dist=Math.max(0,(dir>0?price-entry:entry-price)/a), distPct=Math.abs(price-entry)/price*100;
  var rr=t1/R;

  if(dist<=0.5){sc+=20;r.why.push({t:dist===0?"Prix dans la zone d'entrée":"Prix au contact de la zone d'entrée",k:"ok"})}
  else if(dist<=1.5){sc+=12;r.why.push({t:"Prix à "+pct(distPct)+" de la zone",k:"mid"})}
  else{if(dist<=3)sc+=4;r.why.push({t:"Prix encore à "+pct(distPct)+" de la zone",k:"no"})}
  var rv=dir>0?r1:100-r1, lab="RSI 1H à "+Math.round(r1);
  if(rv<=45){sc+=10;r.why.push({t:lab+" : repli en place",k:"ok"})}
  else if(rv<=55){sc+=5;r.why.push({t:lab+" : repli partiel",k:"mid"})}
  else r.why.push({t:lab+" : pas encore de repli",k:"no"});
  if(dir>0?r4<70:r4>30)sc+=5; else r.why.push({t:"RSI 4H déjà en excès ("+Math.round(r4)+")",k:"no"});
  r.div=divergence(h1,dir);
  if(r.div){sc+=5;r.why.push({t:"Divergence RSI 1H "+(dir>0?"haussière":"baissière"),k:"ok"})}
  if(conf){sc+=10;r.why.push({t:"Order block et "+(dir>0?"support":"résistance")+" au même niveau",k:"ok"})}
  else r.why.push({t:z.kind==="ob"?"Zone : order block 4H":"Zone : "+(dir>0?"support":"résistance")+" 4H",k:"mid"});
  if(rr>=2)sc+=10;else if(rr>=1.5)sc+=7;else sc+=2;
  r.why.push({t:"TP1 à "+fr(rr,1)+"R"+(t1res?" sur une "+(dir>0?"résistance":"zone de support")+" 4H":" (aucun niveau proche, objectif fixe)"),k:rr>=2?"ok":rr>=1.5?"mid":"no"});
  if(block){sc-=8;r.why.push({t:"Obstacle proche avant TP1",k:"no"})}
  r.base=sc; r.dist=dist; r.distPct=distPct;
  r.plan={entry:entry,sl:sl,tp1:entry+dir*t1,tp2:entry+dir*t2,rr:rr,rr2:t2/R,zlo:z.lo,zhi:z.hi};
  settle(r,sc);
  return r}
function settle(r,sc){
  r.score=Math.max(0,Math.min(100,Math.round(sc)));
  r.st=(r.score>=70&&r.dist<=0.5&&r.plan.rr>=1.5)?"ready":r.score>=50?"watch":"wait";
  /* how close the setup is to "ready": score against the 70 threshold, then distance to the entry zone */
  var near=r.dist<=0.5?1:Math.max(0,1-(r.dist-0.5)/2);
  r.pct=r.st==="ready"?100:Math.min(99,Math.round(100*Math.min(1,r.score/70)*(0.7+0.3*near)*(r.plan.rr>=1.5?1:0.8)))}

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

/* second pass on the finalists: 15-minute RSI trigger and order book */
function enrich(r,m15,book,sqd){
  var sc=r.base,dir=r.dir;
  if(m15&&m15.length>30){
    var rs=rsiSeries(m15.map(function(x){return x.c})),n=rs.length,now=rs[n-1],prev=rs[n-2],win=rs.slice(-8);
    var ext=dir>0?Math.min.apply(null,win):Math.max.apply(null,win);
    var turn=dir>0?(ext<=35&&now>prev&&now>ext+3):(ext>=65&&now<prev&&now<ext-3);
    r.r15=now;
    if(turn){sc+=5;r.why.push({t:"RSI 15m se retourne ("+Math.round(ext)+" → "+Math.round(now)+")",k:"ok"})}
    else r.why.push({t:"RSI 15m à "+Math.round(now)+" : pas de signal de retournement",k:"mid"})}
  var b=bookStats(book,dir,r.plan);r.book=b;
  if(b){
    var share=dir>0?b.bid:100-b.bid,who=dir>0?"acheteurs":"vendeurs",rg=" à ±"+fr(b.range,b.range<1?2:1)+" %";
    if(share>=55){sc+=10;r.why.push({t:"Carnet : "+Math.round(share)+" % "+(dir>0?"d'acheteurs":"de vendeurs")+rg,k:"ok"})}
    else if(share>=45){sc+=5;r.why.push({t:"Carnet équilibré ("+Math.round(share)+" % de "+who+rg+")",k:"mid"})}
    else r.why.push({t:"Carnet contre le trade ("+Math.round(share)+" % de "+who+rg+")",k:"no"});
    if(b.block){sc-=5;r.why.push({t:"Mur "+(dir>0?"vendeur":"acheteur")+" à "+px(b.block.p)+" ("+usd(b.block.n)+") avant TP1",k:"no"})}
    if(b.guard)r.why.push({t:"Mur "+(dir>0?"acheteur":"vendeur")+" à "+px(b.guard.p)+" ("+usd(b.guard.n)+") devant le stop",k:"ok"})}
  else r.why.push({t:"Carnet d'ordres indisponible",k:"mid"});
  var hm=m15&&m15.length>=100?heatModel(m15):null,p=r.plan;
  r.sq=squeeze(sqd||{fund:r.fund===undefined?null:r.fund,ls:null,oi:null},hm);
  var against=dir>0?r.sq.dn:r.sq.up,forIt=dir>0?r.sq.up:r.sq.dn,nA=dir>0?"long squeeze":"short squeeze",nF=dir>0?"short squeeze":"long squeeze";
  var wA=(dir>0?r.sq.wd:r.sq.wu).join(", "),wF=(dir>0?r.sq.wu:r.sq.wd).join(", ");
  if(against>=60){sc-=8;r.why.push({t:"Risque élevé de "+nA+" contre le trade"+(wA?" ("+wA+")":""),k:"no"})}
  else if(against>=35){sc-=3;r.why.push({t:"Risque modéré de "+nA+(wA?" ("+wA+")":""),k:"mid"})}
  if(forIt>=60){sc+=5;r.why.push({t:"Potentiel de "+nF+" dans le sens du trade"+(wF?" ("+wF+")":""),k:"ok"})}
  if(hm){
    var own=(dir>0?hm.below:hm.above).filter(function(z){return dir>0?(z.p>p.sl&&z.p<p.entry):(z.p<p.sl&&z.p>p.entry)})[0];
    if(own)r.why.push({t:"Zone de liquidation de "+(dir>0?"longs":"shorts")+" vers "+px(own.p)+", entre l'entrée et le stop : mèche possible",k:"no"});
    var mag=(dir>0?hm.above:hm.below).filter(function(z){var g=(z.p-r.price)/r.price*dir;return g>0&&g<0.15})[0];
    if(mag)r.why.push({t:"Aimant possible : liquidations de "+(dir>0?"shorts":"longs")+" vers "+px(mag.p)+" ("+sgn((mag.p-r.price)/r.price*100,1)+" %)",k:"mid"})}
  settle(r,sc)}
function fr(v,d){return Number(v).toLocaleString("fr-FR",{minimumFractionDigits:d,maximumFractionDigits:d})}
function px(p){var a=Math.abs(p);return fr(p,a>=1000?1:a>=100?2:a>=1?3:a>=0.01?5:7)}
function pct(v){return fr(v,1)+" %"}
function vol(v){return v>=1e9?fr(v/1e9,1)+" Md$":fr(v/1e6,0)+" M$"}
function usd(v){return v>=1e6?fr(v/1e6,1)+" M$":fr(v/1e3,0)+" k$"}
function sgn(v,d){return(v>=0?"+":"−")+fr(Math.abs(v),d)}
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
