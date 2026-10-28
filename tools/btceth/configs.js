/* ---------- Radar BTC·ETH : trade configurations for one coin ----------
   Built on the Radar Trades engine (tools/engine.js: levels, order blocks, ATR, bias, targets, 15m triggers).
   Unlike the scanner, which keeps one zone in the 4H trend direction, this lists every nearby configuration on both sides:
   up to two long zones under the price and two short zones above it, each with its plan, its status and its key.
   Key = L|S + c (order block and 4H level together) | o (order block) | f (4H level that changed side) | s (4H level),
   the same eight configurations as the Analyser of Radar Trades. */
var BE_VERSION=1;
var BE={reach:3,atZone:0.5,minRR:1.5,slk:0.5,fee:0.05,slip:0.02,perSide:2};
var BE_NAMES={
  Lc:"Long sur order block + support 4H",Lo:"Long sur order block 4H",Lf:"Long sur ancienne résistance devenue support",Ls:"Long sur support 4H",
  Sc:"Short sous order block + résistance 4H",So:"Short sous order block 4H",Sf:"Short sous ancien support devenu résistance",Ss:"Short sous résistance 4H"};
var BE_SHORT={Lc:"OB + support",Lo:"Order block",Lf:"Résistance → support",Ls:"Support 4H",Sc:"OB + résistance",So:"Order block",Sf:"Support → résistance",Ss:"Résistance 4H"};
/* Prêt: in the 4H trend (daily not against it), price at the zone, net gain/risk at least 1.5, no 4H level before 1R.
   The 15m signal is shown but not required: on the two years it did not improve the result (tools/btceth/replay.js). */
var BE_STATUS={ready:"Prêt",wait:"Attendre le prix",mixed:"Tendance mitigée",counter:"Contre-tendance",refused:"Refusé"};
var BE_RANK={ready:5,wait:4,mixed:3,counter:2,refused:1};

/* weekly candles from daily ones (weeks start on Monday, UTC) */
function beWeekly(d1){var out=[],cur=null,i,k,wk;
  for(i=0;i<d1.length;i++){k=d1[i];wk=Math.floor((k.t/864e5+3)/7);
    if(!cur||cur.wk!==wk){cur={wk:wk,t:k.t,o:k.o,h:k.h,l:k.l,c:k.c,q:k.q||0};out.push(cur)}
    else{if(k.h>cur.h)cur.h=k.h;if(k.l<cur.l)cur.l=k.l;cur.c=k.c;cur.q+=k.q||0}}
  return out}

/* direction and RSI on each time unit, from the week down to 15 minutes */
function beFrames(d1,h4,h1,m15){
  var w=beWeekly(d1),out=[];
  function row(id,label,k){if(!k||k.length<30){out.push({id:id,label:label,b:null,rsi:null});return}
    out.push({id:id,label:label,b:bias(k),rsi:rsi(closes(k))})}
  row("w","1S",w.length>60?w.slice(-60):w);row("d","1J",d1.length>90?d1.slice(-90):d1);row("h4","4H",h4);row("h1","1H",h1);row("m15","15m",m15);
  return out}

/* candidate zones on one side: 4H levels and order blocks within reach, overlapping ones merged into one "c" zone */
function beZones(dir,price,a,lv,obs){
  var zs=[],i,j;
  lv.forEach(function(l){var lo=l.p-0.25*a,hi=l.p+0.25*a;
    if(dir>0?lo<price+0.25*a&&price-hi<=BE.reach*a:hi>price-0.25*a&&lo-price<=BE.reach*a)
      zs.push({lo:lo,hi:hi,sr:1,ob:0,flip:l.nh>0&&l.nl>0?1:0,n:l.n})});
  obs.forEach(function(o){if(o.dir!==dir)return;
    if(dir>0?o.lo<price&&price-o.hi<=BE.reach*a:o.hi>price&&o.lo-price<=BE.reach*a)zs.push({lo:o.lo,hi:o.hi,sr:0,ob:1,flip:0,n:1})});
  /* merge overlaps: an order block on a level becomes one confluence zone (the level's flip is kept) */
  zs.sort(function(x,y){return x.lo-y.lo});
  var m=[];
  for(i=0;i<zs.length;i++){var z=zs[i],last=m[m.length-1];
    if(last&&z.lo<=last.hi){last.lo=Math.min(last.lo,z.lo);last.hi=Math.max(last.hi,z.hi);last.sr|=z.sr;last.ob|=z.ob;last.flip|=z.flip;last.n+=z.n}
    else m.push({lo:z.lo,hi:z.hi,sr:z.sr,ob:z.ob,flip:z.flip,n:z.n})}
  /* a merged zone wider than 1.5 ATR is cut back around the edge nearest the price */
  for(j=0;j<m.length;j++){var q=m[j];if(q.hi-q.lo>1.5*a){if(dir>0)q.lo=q.hi-1.5*a;else q.hi=q.lo+1.5*a}}
  /* a long zone sits under the price and a short zone above it: a level at the price belongs to the side its middle is on */
  m=m.filter(function(z){var mid=(z.lo+z.hi)/2;return dir>0?mid<=price:mid>=price});
  m.forEach(function(z){z.kind=z.sr&&z.ob?"c":z.ob?"o":z.flip?"f":"s";
    var edge=dir>0?Math.min(price,z.hi):Math.max(price,z.lo);z.dist=Math.max(0,(dir>0?price-edge:edge-price)/a);z.edge=edge});
  m.sort(function(x,y){return x.dist-y.dist||(dir>0?y.hi-x.hi:x.lo-y.lo)});
  return m}

/* every configuration of one coin. ctx: {d1,h4,h1,m15}; opt: {minRR, fee} */
function beConfigs(sym,c,opt){
  opt=opt||{};
  var d1=c.d1,h4=c.h4,h1=c.h1,m15=c.m15||null,n1=h1.length,price=h1[n1-1].c,a=atr(h4),
    bd=bias(d1.length>90?d1.slice(-90):d1),b4=bias(h4),lv=levels(h4,0.5*a),obs=orderBlocks(h4,a),
    minRR=+opt.minRR||BE.minRR,cost=(2*(opt.fee===undefined?BE.fee:+opt.fee)+BE.slip)/100,out=[];
  [1,-1].forEach(function(dir){
    var zs=beZones(dir,price,a,lv,obs).slice(0,BE.perSide);
    zs.forEach(function(z,zi){
      var at=z.dist<=BE.atZone,entry=at?price:z.edge,sl=dir>0?z.lo-BE.slk*a:z.hi+BE.slk*a,R=Math.abs(entry-sl);
      if(!(R>0))return;
      var r={dir:dir,lv:lv,h4:h4.slice(-60)},t=targets(lv,dir,entry,R,r.h4);
      var key=(dir>0?"L":"S")+z.kind,
        tr=b4===dir&&bd!==-dir?"with":b4===-dir&&bd!==dir?"against":"mixed",
        p={entry:entry,sl:sl,tp1:entry+dir*t.t1,tp2:entry+dir*t.t2,rr:t.t1/R,rr2:t.t2/R,res:t.res,block:t.block,
          rrNet:(t.t1-cost*entry)/(R+cost*entry)};
      z.distPct=Math.abs(price-z.edge)/price*100;var trig=null;
      if(at&&m15&&m15.length>=60){var T=triggers(m15,dir,z,a);trig={sweep:T.sweep,bos:T.bos,candle:T.candle,rsi:T.rsiT,any:T.sweep||T.bos||T.candle||T.rsiT?1:0,r15:T.r15}}
      var st,why=[];
      if(p.rrNet<minRR||p.block){st="refused";why.push(p.block?"obstacle 4H avant 1R":"gain/risque sous "+fr(minRR,1))}
      else if(tr==="against"){st="counter";why.push("contre la tendance 4H et 1J")}
      else if(tr==="mixed"){st="mixed";why.push("tendances 4H et 1J pas alignées")}
      else if(!at){st="wait";why.push("prix à "+fr(z.distPct,2)+" % de la zone")}
      else st="ready";
      out.push({sym:sym,key:key,name:BE_NAMES[key],short:BE_SHORT[key],dir:dir,zone:{lo:z.lo,hi:z.hi,n:z.n},near:zi===0,
        at:at,dist:z.dist,distPct:Math.abs(price-z.edge)/price*100,trend:tr,trig:trig,plan:p,st:st,why:why,a:a})})});
  out.sort(function(x,y){return BE_RANK[y.st]-BE_RANK[x.st]||x.dist-y.dist});
  return{sym:sym,price:price,a:a,bd:bd,b4:b4,frames:beFrames(d1,h4,h1,m15),lv:lv,obs:obs,list:out}}

/* position for one plan: loss at the stop (distance + fees + slippage) never above the budget; margin at the chosen leverage.
   X: contract rules {tick, step, minQty, minNotional}; A: {capital, risk (% of capital), lev, fee} */
function beSize(p,dir,A,X){
  var cap=+A.capital,risk=cap*(+A.risk)/100,lev=+A.lev||10,fee=(A.fee===undefined?BE.fee:+A.fee)/100,
    step=X&&X.step>0?X.step:0.001,e=p.entry,unit=Math.abs(e-p.sl)+fee*(e+p.sl)+BE.slip/100*e;
  if(!(cap>0)||!(risk>0)||!(unit>0))return null;
  var q=Math.floor(risk/unit/step+1e-9)*step;q=+q.toFixed(8);
  var notional=q*e,margin=notional/lev,loss=q*unit,gain=q*(Math.abs(p.tp1-e)-fee*(e+p.tp1)),
    liq=dir>0?e*(1-1/lev+0.004):e*(1+1/lev-0.004),
    ok=q>=(X&&X.minQty||step)&&notional>=(X&&X.minNotional||5);
  return{qty:q,notional:notional,margin:margin,marginPct:cap>0?margin/cap*100:0,loss:loss,gain:gain,liq:liq,
    liqFirst:dir>0?liq>=p.sl:liq<=p.sl,ok:ok}}

/* ---------- replay: what each configuration did on this coin ----------
   At every 15m close, the configurations whose zone the price is touching are taken at the close (one trade at a time per side),
   then followed to TP1 or the stop (stop first when both are in the same candle, closed after ten days), costs included.
   Each trade notes its key, the trend class and whether a 15m signal was there, so the app can show the rate of the exact situation. */
function beReplayStart(sym,m,d1,opt){
  return{sym:sym,m:m,F:btFrames(m,d1),opt:opt||{},i:0,free:{"1":BT_WARM,"-1":BT_WARM},trades:[],done:m.length<BT_WARM+200}}
function beReplayStep(S,n){
  var m=S.m,F=S.F,N=m.length-1,end=Math.min(N,S.i+n),cost=(2*BE.fee+BE.slip)/100;
  for(;S.i<end;S.i++){var i=S.i;F.step(i);
    if(i<BT_WARM||(i<S.free["1"]&&i<S.free["-1"]))continue;
    var d1=F.get("d1",400);if(d1.length<55)continue;
    var R=beConfigs(S.sym,{d1:d1,h4:F.get("h4",200),h1:F.get("h1",200),m15:F.m15(300)},S.opt);
    [1,-1].forEach(function(dir){
      if(i<S.free[dir])return;
      var c=null;for(var j=0;j<R.list.length;j++){var x=R.list[j];if(x.dir===dir&&x.at&&x.st!=="refused"){c=x;break}}
      if(!c)return;
      var res=btResolve(m,i,c.plan,dir,N,cost);
      if(res.how!=="open")S.trades.push({t:m[i].t,x:m[res.j].t,dir:dir,key:c.key,tr:c.trend,sig:c.trig&&c.trig.any?1:0,st:c.st,rr:+c.plan.rr.toFixed(2),how:res.how,r:+res.r.toFixed(3)});
      S.free[dir]=res.j+17})}
  if(S.i>=N)S.done=true;
  return S.done}
