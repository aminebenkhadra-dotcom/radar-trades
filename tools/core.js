/* ---------- calculations shared by the app and its tests (version 42) ----------
   Contract grid and plan rounding, position size, stop coverage, final status, realised results, paper tracking.
   Pure functions: no page, no network. tools/inject.js copies this file into the app page, tests/run.js tests it. */
var CORE_VERSION=42;
var STATUS={ready:"Prêt selon les règles",watch:"À surveiller",refused:"Refusé",incomplete:"Données incomplètes",none:"Pas de trade"};
var ST_RANK={ready:4,watch:3,incomplete:2,refused:1,none:0};

/* ---------- contract grid ---------- */
/* decimals written in a contract step such as 0.25, 2.5 or 1e-7 */
function stepDec(step){
  if(!(step>0))return 0;
  var s=String(step),m=s.match(/^(\d+)(?:\.(\d+))?e-(\d+)$/i);
  if(m)return(m[2]?m[2].length:0)+(+m[3]);
  var i=s.indexOf(".");return i<0?0:s.length-i-1}
/* a price or a quantity put on the contract's grid: mode "near", "down" (toward lower values) or "up" */
function onGrid(v,step,mode){
  if(!(step>0)||!isFinite(v))return v;
  var q=v/step,eps=1e-9*Math.max(1,Math.abs(q));
  var n=mode==="down"?Math.floor(q+eps):mode==="up"?Math.ceil(q-eps):Math.round(q);
  return+(n*step).toFixed(Math.min(20,stepDec(step)))}
function isOnGrid(v,step){if(!(step>0))return true;var q=v/step;return Math.abs(q-Math.round(q))<1e-7*Math.max(1,Math.abs(q))}
/* the trading rules of one Binance Futures contract, from its exchangeInfo entry */
function contractOf(s){
  var x={sym:s&&s.symbol,tick:0,minP:0,maxP:0,step:0,minQ:0,maxQ:0,mstep:0,mminQ:0,mmaxQ:0,minN:0,pUp:0,pDn:0};
  ((s&&s.filters)||[]).forEach(function(f){
    if(f.filterType==="PRICE_FILTER"){x.tick=+f.tickSize||0;x.minP=+f.minPrice||0;x.maxP=+f.maxPrice||0}
    else if(f.filterType==="LOT_SIZE"){x.step=+f.stepSize||0;x.minQ=+f.minQty||0;x.maxQ=+f.maxQty||0}
    else if(f.filterType==="MARKET_LOT_SIZE"){x.mstep=+f.stepSize||0;x.mminQ=+f.minQty||0;x.mmaxQ=+f.maxQty||0}
    else if(f.filterType==="MIN_NOTIONAL"){x.minN=+(f.notional||f.minNotional)||0}
    else if(f.filterType==="PERCENT_PRICE"){x.pUp=+f.multiplierUp||0;x.pDn=+f.multiplierDown||0}});
  return x}

/* ---------- the plan as it can be typed on Binance ----------
   entry to the nearest tick; stop away from the entry and targets toward it (both rounding directions protect the size and the
   reward); then the order of the levels, their distance and the contract's price limits are checked again on the rounded values */
function roundPlan(p,dir,X){
  var o={ok:true,why:[],plan:null};
  if(!p||!(dir===1||dir===-1)){o.ok=false;o.why.push("plan absent");return o}
  var t=X&&X.tick>0?X.tick:0,m=dir>0?"down":"up",q={},k;
  for(k in p)q[k]=p[k];
  if(t){q.entry=onGrid(p.entry,t,"near");q.sl=onGrid(p.sl,t,m);q.tp1=onGrid(p.tp1,t,m);if(p.tp2>0)q.tp2=onGrid(p.tp2,t,m)}
  o.plan=q;
  if(!t){o.ok=false;o.why.push("pas de grille de prix connue pour ce contrat");return o}
  var R=Math.abs(q.entry-q.sl);
  q.rr=R?Math.abs(q.tp1-q.entry)/R:0;q.rr2=R&&q.tp2>0?Math.abs(q.tp2-q.entry)/R:0;q.tick=t;q.dec=stepDec(t);
  if(!((q.entry-q.sl)*dir>=t*(1-1e-9)))o.why.push("stop à moins d'un pas de prix de l'entrée, ou du mauvais côté");
  if(!((q.tp1-q.entry)*dir>=t*(1-1e-9)))o.why.push("objectif à moins d'un pas de prix de l'entrée, ou du mauvais côté");
  if(q.tp2>0&&(q.tp2-q.tp1)*dir<0)o.why.push("TP2 avant TP1");
  [["entrée",q.entry],["stop",q.sl],["TP1",q.tp1]].forEach(function(v){
    if(!(v[1]>0))o.why.push(v[0]+" négatif ou nul");
    else if((X.minP>0&&v[1]<X.minP)||(X.maxP>0&&v[1]>X.maxP))o.why.push(v[0]+" hors des prix acceptés par Binance pour ce contrat")});
  o.ok=!o.why.length;return o}

/* ---------- position size ----------
   A = {capital, bmode:"pct"|"usdt", risk (% of capital), budget (USDT), lev, mtype:"isolated"|"cross", marginPct (cap of the margin
        engaged on all positions, % of capital), fee (% per side), slip (% slippage reserve), mmr (% maintenance margin, default 1),
        avail (USDT free on the futures wallet, or null), usedMargin (USDT already engaged), openRisk (USDT at the stops of open positions),
        unbounded:[positions without full stop], unknown:[positions whose protection is unread], totPct (cap of total open risk, % of
        capital, 0 = off), dayPnl (USDT realised today, or null), dayPct (daily loss limit, % of capital, 0 = off)}
   X = contract rules (contractOf); market = true when the entry is a market order.
   The modelled loss at the stop = quantity × (distance to the stop + fees both ways + slippage reserve) and never exceeds the budget;
   a stop-market order can still fill worse in a fast or thin market. */
function sizePlan(p,dir,A,X,market){
  var o={ok:false,incomplete:false,limit:false,minSize:false,qty:0,notional:0,margin:0,lev:0,levMax:null,loss:0,lossPx:0,lossCost:0,costPct:0,budget:0,by:"",qd:0,why:[],warn:[],info:[]};
  var e=+(p&&p.entry),sl=+(p&&p.sl),d=Math.abs(e-sl),cap=+A.capital||0;
  if(!(e>0&&sl>0&&d>0)||(sl-e)*dir>=0){o.minSize=true;o.why.push("plan sans stop valide");return o}
  if(!(cap>0)){o.incomplete=true;o.why.push("taille du compte inconnue");return o}
  var b=A.bmode==="usdt"?+A.budget||0:cap*(+A.risk||0)/100;
  if(!(b>0)){o.limit=true;o.why.push("budget de risque nul");return o}
  /* account limits: they stop new entries, they do not judge the setup */
  if(A.dayPct>0&&A.dayPnl!==null&&A.dayPnl!==undefined&&isFinite(A.dayPnl)&&A.dayPnl<=-cap*A.dayPct/100){
    o.limit=true;o.why.push("perte du jour atteinte ("+fr(A.dayPnl,2)+" $, limite −"+fr(cap*A.dayPct/100,2)+" $)")}
  if(A.totPct>0){
    if(A.unbounded&&A.unbounded.length){o.limit=true;o.why.push("position sans stop complet ouverte ("+A.unbounded.join(", ")+") : protège-la avant un nouveau trade")}
    else if(A.unknown&&A.unknown.length){o.incomplete=true;o.why.push("protection non lue sur "+A.unknown.join(", "))}
    else{var room=cap*A.totPct/100-(+A.openRisk||0);
      if(room<=0){o.limit=true;o.why.push("risque total au plafond ("+fr(+A.openRisk||0,2)+" $ engagés, plafond "+fr(cap*A.totPct/100,2)+" $)")}
      else if(room<b){b=room;o.info.push("budget ramené à "+fr(room,2)+" $ par le plafond de risque total")}}}
  o.budget=b;
  /* leverage: in isolated margin the liquidation must stay beyond the stop, with a quarter of the stop distance to spare */
  var lev=Math.max(1,Math.floor(+A.lev||1)),s=d/e,mmr=(A.mmr>0?+A.mmr:1)/100;
  if(A.mtype!=="cross"){o.levMax=Math.max(1,Math.floor(1/(1.25*s+mmr)));
    if(o.levMax<lev){o.warn.push("à x"+lev+" la liquidation arriverait avant le stop : prends x"+o.levMax+" au plus");lev=o.levMax}}
  else o.info.push("marge croisée : la liquidation dépend de tout le solde Futures");
  o.lev=lev;
  var costU=(2*(+A.fee||0)+(+A.slip||0))/100*Math.max(e,sl),per=d+costU;
  o.costPct=costU/d*100;
  var qR=b/per,
    qM=A.marginPct>0?Math.max(0,cap*A.marginPct/100-(+A.usedMargin||0))*lev/e:Infinity,
    qA=A.avail!==null&&A.avail!==undefined&&isFinite(A.avail)?Math.max(0,A.avail)*lev/e*0.98:Infinity,
    mxQ=X?(market&&X.mmaxQ>0?X.mmaxQ:X.maxQ>0?X.maxQ:Infinity):Infinity,
    q=Math.min(qR,qM,qA,mxQ);
  o.by=q===qR?"risque":q===qM?"marge max":q===qA?"solde disponible":"taille max du contrat";
  var step=X?(market&&X.mstep>0?X.mstep:X.step):0;
  if(step>0){q=onGrid(q,step,"down");o.qd=stepDec(step)}else o.qd=q>=100?0:q>=1?2:4;
  if(!(q>=0))q=0;
  o.qty=q;o.notional=q*e;o.margin=o.notional/lev;o.lossPx=q*d;o.lossCost=q*costU;o.loss=o.lossPx+o.lossCost;
  var minQ=X?(market&&X.mminQ>0?X.mminQ:X.minQ):0,minN=X?X.minN:0;
  if(!o.limit){
    if(o.by==="marge max"&&qM===0){o.limit=true;o.why.push("marge max déjà engagée par les positions ouvertes")}
    else if(o.by==="solde disponible"&&qA===0){o.limit=true;o.why.push("aucun solde Futures disponible")}
    else if(!(q>0)||(minQ>0&&q<minQ*(1-1e-9))||(minN>0&&q*e<minN*(1-1e-9))){o.minSize=true;
      o.why.push("taille trop petite pour ce contrat (minimum "+fr(Math.max(minQ*e,minN),2)+" $ de position"+(o.by!=="risque"?", taille limitée par "+o.by:"")+")")}}
  if(o.by==="marge max"&&q>0)o.info.push("taille réduite pour rester sous la marge max de "+fr(+A.marginPct,0)+" %");
  if(o.by==="solde disponible"&&q>0)o.info.push("taille réduite au solde Futures disponible");
  o.ok=!o.why.length;
  return o}
/* share of winning trades needed to break even at this net reward-to-risk */
function beWin(rrNet){return rrNet>0?1/(1+rrNet):null}

/* ---------- protection of a live position ----------
   p = {full, dir, ps:"BOTH"|"LONG"|"SHORT", qty, mark, entry}; ords = open orders and conditional (algo) orders of the contract.
   A stop counts when it closes this position: closing side, same position side (hedge mode), stop or stop-market type.
   Stops close the position in the order the price meets them; quantity beyond the position covers nothing.
   cover = share of the position those stops would close (closePosition = all of it). */
function stopCover(p,ords){
  var close=p.dir>0?"SELL":"BUY",o={sl:[],tp:[],trail:[],cover:0,covQ:0,risk:0,first:0,nonRO:false};
  (ords||[]).forEach(function(x){
    if(!x||x.side!==close||(x.symbol&&x.symbol!==p.full))return;
    var ps=x.positionSide||"BOTH";if(ps!=="BOTH"&&ps!==(p.ps||"BOTH"))return;
    var ty=String(x.orderType||x.type||""),trig=+(x.triggerPrice||x.stopPrice)||0,lim=+x.price||0,q=+(x.quantity||x.origQty)||0;
    var all=x.closePosition===true||x.closePosition==="true",ro=all||x.reduceOnly===true||x.reduceOnly==="true"||ps!=="BOTH";
    var qq=all?p.qty:Math.min(q,p.qty);
    if(/TRAILING/.test(ty)){o.trail.push({q:qq});return}
    if(/STOP/.test(ty)&&trig>0){o.sl.push({px:trig,q:qq,ro:ro,all:all});return}
    if(/TAKE_PROFIT/.test(ty)&&trig>0){o.tp.push({px:trig,q:qq});return}
    if(ty==="LIMIT"&&lim>0&&ro&&(lim-p.mark)*p.dir>0)o.tp.push({px:lim,q:qq})});
  o.sl.sort(function(a,b){return(b.px-a.px)*p.dir});o.tp.sort(function(a,b){return(a.px-b.px)*p.dir});
  var left=p.qty;
  o.sl.forEach(function(s){var c=Math.min(s.q,left);s.c=c;left-=c;o.risk+=c*(s.px-p.entry)*p.dir});
  o.covQ=p.qty-left;o.cover=p.qty>0?Math.min(1,o.covQ/p.qty):0;o.first=o.sl.length?o.sl[0].px:0;
  o.nonRO=o.sl.some(function(s){return!s.ro});
  return o}
/* risk already engaged across open positions: x = {name, cover (0..1, or null when the orders could not be read), risk (P&L at the
   stops, negative for a loss), margin} */
function openRiskOf(list){
  var o={risk:0,margin:0,unbounded:[],unknown:[]};
  (list||[]).forEach(function(x){o.margin+=+x.margin||0;
    if(x.cover===null||x.cover===undefined){o.unknown.push(x.name);return}
    if(x.cover<0.999)o.unbounded.push(x.name);
    o.risk+=Math.max(0,-(+x.risk||0))});
  return o}

/* ---------- final status: the engine's reading, then the plan as typed, the size and the account limits ---------- */
function finalStatus(r,rp,sz,hasX){
  if(!r||!r.plan)return{st:"none",why:[]};
  var st=r.st,why=[];
  (r.blk||[]).forEach(function(b){why.push(b.t)});
  if(r.miss&&r.miss.length)why.push("non lu : "+r.miss.join(", "));
  if(!hasX){if(st!=="refused"){st="incomplete";why.push("règles du contrat non lues")}return{st:st,why:why}}
  if(rp&&!rp.ok)return{st:"refused",why:why.concat(rp.why)};
  if(sz&&!sz.ok){why=why.concat(sz.why);
    /* a contract minimum the budget cannot reach: never tradable as planned; an account limit: no entry now; unknown: incomplete */
    if(sz.minSize)st="refused";
    else if(sz.limit){if(st==="ready"||st==="incomplete")st="refused"}
    else if(sz.incomplete&&st==="ready")st="incomplete"}
  return{st:st,why:why}}

/* ---------- realised results from Binance's income history ----------
   rows = {pnl:[REALIZED_PNL], fee:[COMMISSION], fund:[FUNDING_FEE]}; conv(asset, time) = USDT value of one unit, or null.
   Closing fills of one symbol within ten minutes make one exit. A commission sharing its trade id with a closing fill is that exit's
   fee; the other commissions (opening fills) and the funding go to the next exit of the symbol. Each exit is therefore counted after
   its costs: a winner is a trade whose net is above zero. Rows in another asset than a dollar stablecoin are converted; when a
   conversion is missing the result says so instead of passing for complete. from = first time counted (older rows only carry costs). */
var STABLES={USDT:1,USDC:1,FDUSD:1,BUSD:1,BFUSD:1,TUSD:1,USDP:1,DAI:1,USD1:1};
function incomeNet(rows,conv,from){
  rows=rows||{};from=+from||0;
  var miss={},exits=[],open={},dayMap={},bySym={},gross=0,fees=0,fund=0,nConv=0;
  function usdt(r){var a=String(r.asset||"USDT").toUpperCase(),v=+r.income||0;if(STABLES[a])return v;
    var px=conv?conv(a,+r.time):null;if(px>0){nConv++;return v*px}miss[a]=1;return null}
  function day(t,v){var d=new Date(t);d.setHours(0,0,0,0);dayMap[+d]=(dayMap[+d]||0)+v}
  /* exits: closing fills clustered per symbol */
  var last={},byTrade={},bySymExits={};
  (rows.pnl||[]).slice().sort(function(a,b){return a.time-b.time}).forEach(function(r){
    var v=usdt(r);if(v===null)return;var s=String(r.symbol||""),t=+r.time,e=last[s];
    if(e&&t-e.t<=600000){e.pnl+=v;e.t=t}
    else{e={sym:s.replace(/(USDT|USDC)$/,""),full:s,t:t,pnl:v,fee:0,fund:0,net:0};last[s]=e;exits.push(e);(bySymExits[s]=bySymExits[s]||[]).push(e)}
    if(r.tradeId)byTrade[s+"|"+r.tradeId]=e});
  function nextExit(s,t){var L=bySymExits[s]||[];for(var i=0;i<L.length;i++)if(L[i].t>=t)return L[i];return null}
  (rows.fee||[]).forEach(function(r){var v=usdt(r);if(v===null)return;var s=String(r.symbol||""),t=+r.time,e=r.tradeId?byTrade[s+"|"+r.tradeId]:null;
    if(!e)e=nextExit(s,t);
    if(e)e.fee+=v;else open[s]=(open[s]||0)+v;
    if(t>=from){fees+=v;day(t,v)}});
  (rows.fund||[]).forEach(function(r){var v=usdt(r);if(v===null)return;var s=String(r.symbol||""),t=+r.time,e=nextExit(s,t);
    if(e)e.fund+=v;else open[s]=(open[s]||0)+v;
    if(t>=from){fund+=v;day(t,v)}});
  var out=[];
  exits.forEach(function(e){e.net=e.pnl+e.fee+e.fund;if(e.t<from)return;out.push(e);gross+=e.pnl;day(e.t,e.pnl);
    var o=bySym[e.full]||(bySym[e.full]={sym:e.sym,net:0,n:0});o.net+=e.net;o.n++});
  var notes=[],missing=Object.keys(miss);
  if(missing.length)notes.push("Montants en "+missing.join(", ")+" non convertis : résultat incomplet");
  if(nConv)notes.push("Frais payés en BNB ou autre monnaie convertis au cours de clôture du jour");
  notes.push("Chaque sortie est comptée nette : frais d'entrée et de sortie et funding compris");
  return{exits:out,gross:gross,fees:fees,fund:fund,net:gross+fees+fund,dayMap:dayMap,bySym:bySym,openCosts:open,missing:missing,notes:notes,
    wins:out.filter(function(e){return e.net>0}).length,n:out.length}}
/* every row of [start, end] when one call returns at most 1000: a full answer splits the window in two, whatever the order of the rows */
function pagedRows(get,start,end,depth){
  depth=depth||0;
  return get(start,end).then(function(rows){
    if(!Array.isArray(rows))throw{code:"rows"};
    if(rows.length<1000)return{rows:rows,full:false};
    if(end-start<2000||depth>=12)return{rows:rows,full:true};
    var mid=Math.floor((start+end)/2);
    return pagedRows(get,start,mid,depth+1).then(function(a){
      return pagedRows(get,mid+1,end,depth+1).then(function(b){return{rows:a.rows.concat(b.rows),full:a.full||b.full}})})})}

/* ---------- paper tracking ----------
   t = {e, sl, tp, dir, t0}; candles = 1-minute candles from the first whole minute after t0 to the next 15-minute boundary, then
   15-minute candles, each {o,h,l,c,ot,ct}. No price from before t0 is used and only closed candles count.
   Exit: at the stop when a candle reaches it, at the open when the candle opens beyond it (gap); at the target when a candle
   reaches it; the stop first when both are reached in the same candle; at the close once maxMs has passed. null while still open.
   r = result in R, costs (fees and slippage, share of the price) included. */
function paperWalk(t,candles,now,cost,maxMs){
  var R=Math.abs(t.e-t.sl),d=t.dir;if(!(R>0))return null;
  for(var i=0;i<(candles||[]).length;i++){var c=candles[i];
    if(!(c.ct<=now))break;
    if(c.ot<t.t0)continue;
    var ex=null,why="";
    if(d>0?c.l<=t.sl:c.h>=t.sl){var gap=d>0?c.o<=t.sl:c.o>=t.sl;ex=gap?c.o:t.sl;why=gap?"gap":"stop"}
    else if(d>0?c.h>=t.tp:c.l<=t.tp){ex=t.tp;why="tp1"}
    else if(c.ct-t.t0>=maxMs){ex=c.c;why="5j"}
    if(ex!==null)return{t:c.ct,px:ex,why:why,r:(ex-t.e)*d/R-cost*t.e/R}}
  return null}
