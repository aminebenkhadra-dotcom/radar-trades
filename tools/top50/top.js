/* ---------- Radar Top 50 : configurations you set, and their success rate ----------
   Built on tools/engine.js and tools/btceth/configs.js (zones, plans, statuses of Radar BTC·ETH).
   The replay notes every zone contact with all its parameters, so the app can recompute the success rate of any setting:
   kind of zone, direction, trend, Bitcoin, gain/risk, 4H obstacle, 15-minute signal, and the target (4H level, 1R, 1.5R, 2R). */
var T5_VERSION=1;
var T5_KINDS=["c","o","f","s"];                /* order block + level, order block, level that changed side, level */
var T5_TR=["with","mixed","against"];
var T5_TARGETS=[{id:"tp1",label:"Niveau 4H",k:0},{id:"r1",label:"1R",k:1},{id:"r15",label:"1,5R",k:1.5},{id:"r2",label:"2R",k:2}];
/* record fields */
var T5F={coin:0,h:1,dir:2,kind:3,tr:4,rr:5,blk:6,sig:7,btc:8,win:9,r:10};

/* Bitcoin's 4H direction at each 4H open, from finished candles only (for the replay of the other coins) */
function t5BtcDir(m){var h4=btAgg(m,144e5),out={},i;
  for(i=60;i<h4.length;i++)out[h4[i].t]=bias(h4.slice(Math.max(0,i-200),i));
  return out}
function t5BtcAt(map,t){return map?map[Math.floor(t/144e5)*144e5]:undefined}

/* the plan of a configuration for one target: 0 = the 4H level found by the engine, otherwise k times the risk */
function t5Plan(p,dir,k){if(!k)return p;var R=Math.abs(p.entry-p.sl);return Object.assign({},p,{tp1:p.entry+dir*k*R,rr:k})}

/* replay of one coin: at each 15m close, the nearest configuration whose zone the price is in (one trade at a time per side, taken at
   the close), followed to each target or the stop (stop first in the same candle, closed after ten days), costs included. */
function t5ReplayStart(ci,sym,m,d1,btc){
  return{ci:ci,sym:sym,m:m,F:btFrames(m,d1),btc:btc||null,i:0,free:{"1":BT_WARM,"-1":BT_WARM},rec:[],done:m.length<BT_WARM+200}}
function t5ReplayStep(S,n){
  var m=S.m,F=S.F,N=m.length-1,end=Math.min(N,S.i+n),cost=(2*BE.fee+BE.slip)/100;
  for(;S.i<end;S.i++){var i=S.i;F.step(i);
    if(i<BT_WARM||(i<S.free["1"]&&i<S.free["-1"]))continue;
    var d1=F.get("d1",400);if(d1.length<55)continue;
    var R=beConfigs(S.sym,{d1:d1,h4:F.get("h4",200),h1:F.get("h1",200),m15:F.m15(300)},{minRR:0.01});
    var bt=S.btc?t5BtcAt(S.btc,m[i].t):R.b4;
    [1,-1].forEach(function(dir){
      if(i<S.free[dir])return;
      var c=null;for(var j=0;j<R.list.length;j++){var x=R.list[j];if(x.dir===dir&&x.at){c=x;break}}
      if(!c)return;
      var win=0,rs=[],first=null;
      for(var g=0;g<T5_TARGETS.length;g++){
        var res=btResolve(m,i,t5Plan(c.plan,dir,T5_TARGETS[g].k),dir,N,cost);
        if(g===0)first=res;
        if(res.how==="tp")win|=1<<g;
        rs.push(Math.round(res.r*100))}
      if(first.how==="open"){S.free[dir]=N+1;return}
      S.rec.push([S.ci,Math.round(m[i].t/36e5),dir,T5_KINDS.indexOf(c.key.charAt(1)),T5_TR.indexOf(c.trend),Math.round(Math.min(9.99,c.plan.rrNet)*100),
        c.plan.block?1:0,c.trig&&c.trig.any?1:0,bt===undefined?0:bt*dir,win].concat(rs));
      S.free[dir]=first.j+17})}
  if(S.i>=N)S.done=true;
  return S.done}

/* ---------- a setting and what it did ----------
   P: {kinds: {Lc:true,...}, dir: 0|1|-1, trend: "with"|"notagainst"|"all", btc: "any"|"aligned"|"notagainst", minRR, noBlock, sig, target (0..3)}
   rank: coin index -> rank in the Top 50 (1 = most traded); P.group keeps the coins ranked up to it. */
function t5Match(P,f){
  /* f: {dir, kind ("c"...), tr ("with"...), rrNet, block, sig, btc (-1|0|1)} */
  var key=(f.dir>0?"L":"S")+f.kind;
  if(P.kinds&&P.kinds[key]===false)return"type "+(BE_SHORT[key]||key)+" désactivé";
  if(P.dir&&f.dir!==P.dir)return P.dir>0?"longs seulement":"shorts seulement";
  if(P.trend==="with"&&f.tr!=="with")return f.tr==="against"?"contre la tendance":"tendance mitigée";
  if(P.trend==="notagainst"&&f.tr==="against")return"contre la tendance";
  if(P.btc==="aligned"&&f.btc!==1)return"Bitcoin pas dans le même sens";
  if(P.btc==="notagainst"&&f.btc===-1)return"Bitcoin en sens inverse";
  if(!P.target&&f.rrNet<(+P.minRR||0))return"gain/risque sous "+fr(+P.minRR,1);
  if(P.noBlock&&f.block)return"obstacle 4H avant 1R";
  if(P.sig&&!f.sig)return"pas de signal 15 min";
  return null}
function t5Feat(r){return{dir:r[2],kind:T5_KINDS[r[3]],tr:T5_TR[r[4]],rrNet:r[5]/100,block:r[6],sig:r[7],btc:r[8]}}
/* success rate of a setting over the replay: H = {coins:[...], rank:[...], years:{A:[from,to],...}, rec:[...]}; opt: {coin, key} */
function t5Rate(H,P,opt){
  opt=opt||{};var g=+P.target||0,bit=1<<g,out={},y,Y={};
  for(y in H.years)Y[y]={n:0,w:0,s:0,rs:[],from:Date.parse(H.years[y][0])/36e5,to:Date.parse(H.years[y][1])/36e5};
  var keys={};
  for(var i=0;i<H.rec.length;i++){var r=H.rec[i];
    if(opt.coin!==undefined&&r[0]!==opt.coin)continue;
    if(opt.coin===undefined&&P.group&&H.rank[r[0]]>P.group)continue;
    var f=t5Feat(r);if(opt.key&&(f.dir>0?"L":"S")+f.kind!==opt.key)continue;
    if(t5Match(P,f))continue;
    var x=r[10+g]/100,w=r[9]&bit?1:0;
    for(y in Y){var A=Y[y];if(r[1]>=A.from&&r[1]<A.to){A.n++;A.w+=w;A.s+=x;
      if(opt.byKey){var k=(f.dir>0?"L":"S")+f.kind;(keys[k]=keys[k]||{n:0,w:0,s:0});keys[k].n++;keys[k].w+=w;keys[k].s+=x}}}}
  var tot={n:0,w:0,s:0};
  for(y in Y){var A=Y[y];out[y]={n:A.n,win:A.n?A.w/A.n*100:0,avg:A.n?A.s/A.n:0};tot.n+=A.n;tot.w+=A.w;tot.s+=A.s}
  out.all={n:tot.n,win:tot.n?tot.w/tot.n*100:0,avg:tot.n?tot.s/tot.n:0};
  if(opt.byKey){out.keys={};for(var k in keys)out.keys[k]={n:keys[k].n,win:keys[k].w/keys[k].n*100,avg:keys[k].s/keys[k].n}}
  return out}

/* live configurations of one coin seen through a setting: each gets a status and the reason when it does not fit */
function t5Live(R,P,btcDir){
  return R.list.map(function(c){
    var f={dir:c.dir,kind:c.key.charAt(1),tr:c.trend,rrNet:c.plan.rrNet,block:c.plan.block,sig:c.trig&&c.trig.any?1:0,btc:R.sym==="BTC"?1:btcDir===undefined||btcDir===null?0:btcDir*c.dir};
    var no=t5Match(Object.assign({},P,{sig:false}),f),plan=t5Plan(c.plan,c.dir,T5_TARGETS[+P.target||0].k),st;
    if(no)st="off";
    else if(!c.at)st="near";
    else if(P.sig&&!f.sig)st="sig";
    else st="ready";
    return Object.assign({},c,{f:f,st5:st,no:no,plan5:plan})})}
