// Temporalité : résultats des setups par session, jour et heure (UTC), et validation d'une année sur l'autre.
// Trades produits par le workflow timing.yml (branches timing-A et timing-B) : placer leurs fichiers dans tm/A et tm/B, puis node timing.js
const fs=require("fs");
function load(dir,tag){let tr=[];for(let k=0;k<4;k++)tr=tr.concat(JSON.parse(fs.readFileSync(`tm/${dir}/${tag}-${k}.json`)).trades);return tr.map(t=>{const d=new Date(t.t+9e5);return Object.assign(t,{h:d.getUTCHours(),wd:(d.getUTCDay()+6)%7})})}
const st=a=>{const n=a.length,w=a.filter(t=>t.r>0).length,s=a.reduce((x,t)=>x+t.r,0),m=n?s/n:0,v=a.reduce((x,t)=>x+(t.r-m)**2,0);return{n,win:n?w/n*100:0,avg:m,se:n>1?Math.sqrt(v/(n-1)/n):0}};
const f=x=>(x.avg>=0?"+":"")+x.avg.toFixed(2)+"±"+x.se.toFixed(2)+" ("+x.n+","+x.win.toFixed(0)+"%)";
const corr=(a,b)=>{const ma=a.reduce((x,y)=>x+y)/a.length,mb=b.reduce((x,y)=>x+y)/b.length;let s=0,sa=0,sb=0;a.forEach((v,i)=>{s+=(v-ma)*(b[i]-mb);sa+=(v-ma)**2;sb+=(b[i]-mb)**2});return s/Math.sqrt(sa*sb)};
const SES=[["Nuit/Asie 0-7h",0,7],["Europe 7-13h",7,13],["Europe+US 13-17h",13,17],["US 17-21h",17,21],["Soir 21-24h",21,24]];
const DAYS=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
for(const tag of ["ref-2","ref-0"]){
  const A=load("A",tag),B=load("B",tag);
  console.log("\n######",tag,"A(25-26)",f(st(A)),"B(24-25)",f(st(B)));
  console.log("Sessions (UTC):");for(const [l,a,b] of SES){const g=x=>x.filter(t=>t.h>=a&&t.h<b);console.log("  ",l.padEnd(18),"A",f(st(g(A))).padEnd(28),"B",f(st(g(B))))}
  console.log("Jours:");DAYS.forEach((d,i)=>{const g=x=>x.filter(t=>t.wd===i);console.log("  ",d,"A",f(st(g(A))).padEnd(28),"B",f(st(g(B))))});
  const ha=[...Array(24)].map((_,h)=>st(A.filter(t=>t.h===h)).avg),hb=[...Array(24)].map((_,h)=>st(B.filter(t=>t.h===h)).avg);
  console.log("corr heures A/B:",corr(ha,hb).toFixed(2),"  corr jours:",corr(DAYS.map((_,i)=>st(A.filter(t=>t.wd===i)).avg),DAYS.map((_,i)=>st(B.filter(t=>t.wd===i)).avg)).toFixed(2));
  // pick top 8 hours on one year, test on other
  for(const [P,T,lab] of [[A,B,"choisi sur A, testé sur B"],[B,A,"choisi sur B, testé sur A"]]){const hp=[...Array(24)].map((_,h)=>({h,a:st(P.filter(t=>t.h===h)).avg})).sort((x,y)=>y.a-x.a);
    const best=new Set(hp.slice(0,8).map(x=>x.h)),worst=new Set(hp.slice(-8).map(x=>x.h));
    console.log("  ",lab,": 8 meilleures heures",[...best].sort((a,b)=>a-b).join(","),"→",f(st(T.filter(t=>best.has(t.h)))),"| 8 pires →",f(st(T.filter(t=>worst.has(t.h)))),"| reste",f(st(T)))}
  const we=x=>x.filter(t=>t.wd>=5),wk=x=>x.filter(t=>t.wd<5);console.log("  semaine A",f(st(wk(A))),"B",f(st(wk(B)))," | week-end A",f(st(we(A))),"B",f(st(we(B))));
}
{
function load(dir,tag){let tr=[];for(let k=0;k<4;k++)tr=tr.concat(JSON.parse(fs.readFileSync(`tm/${dir}/${tag}-${k}.json`)).trades);return tr.map(t=>{const d=new Date(t.t+9e5);return Object.assign(t,{h:d.getUTCHours(),wd:(d.getUTCDay()+6)%7,q:Math.floor(d.getUTCMonth()/3)})})}
const st=a=>{const n=a.length,w=a.filter(t=>t.r>0).length,s=a.reduce((x,t)=>x+t.r,0),m=n?s/n:0,v=a.reduce((x,t)=>x+(t.r-m)**2,0);return{n,win:n?w/n*100:0,avg:m,se:n>1?Math.sqrt(v/(n-1)/n):0}};
const f=x=>(x.avg>=0?"+":"")+x.avg.toFixed(3)+"±"+x.se.toFixed(3)+" ("+x.n+","+x.win.toFixed(0)+"%)";
for(const tag of ["ref-2","ref-0"]){const A=load("A",tag),B=load("B",tag);console.log("##",tag);
 for(const [P,T,l] of [[A,B,"A→B"],[B,A,"B→A"]]){const good=[0,1,2,3,4,5,6].filter(d=>st(P.filter(t=>t.wd===d)).avg>st(P).avg);console.log(" ",l,"jours meilleurs que la moyenne sur la 1re année:",good.join(","),"→ 2e année",f(st(T.filter(t=>good.includes(t.wd)))),"vs autres",f(st(T.filter(t=>!good.includes(t.wd)))))}
 // Thursday by quarter
 for(const [X,l] of [[A,"A"],[B,"B"]]){const qs={};X.forEach(t=>{const k=new Date(t.t).toISOString().slice(0,7);});
   const months={};X.forEach(t=>{const k=Math.floor((t.t-X[0].t)/(91*864e5));(months[k]=months[k]||[]).push(t)});
   console.log("  ",l,"jeudi vs autres par trimestre:",Object.keys(months).map(k=>{const M=months[k];return (st(M.filter(t=>t.wd===3)).avg-st(M.filter(t=>t.wd!==3)).avg).toFixed(2)}).join(" "),
     "| lun-mar vs autres:",Object.keys(months).map(k=>{const M=months[k];return (st(M.filter(t=>t.wd<=1)).avg-st(M.filter(t=>t.wd>1)).avg).toFixed(2)}).join(" "))}
 const both=A.concat(B);console.log("  2 ans : sans lundi-mardi",f(st(both.filter(t=>t.wd>1))),"| lundi-mardi",f(st(both.filter(t=>t.wd<=1))),"| tout",f(st(both)))}
}
