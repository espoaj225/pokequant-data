/* ================= PokeQuant core: state, utils, charts ================= */
"use strict";
const $=(s,el=document)=>el.querySelector(s);
const $$=(s,el=document)=>[...el.querySelectorAll(s)];
const el=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;};

const ASSETS=DATA.assets, BYID={}; ASSETS.forEach(a=>BYID[a.id]=a);
const META=DATA.meta;
const DAY0=new Date(META.windowStart+"T00:00:00Z");
const N_DAYS=META.days;
const DATES=[...Array(N_DAYS)].map((_,i)=>{const d=new Date(DAY0);d.setUTCDate(d.getUTCDate()+i);return d;});
const dstr=d=>d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"});
const dshort=d=>d.toLocaleDateString("en-US",{month:"short",year:"2-digit",timeZone:"UTC"});

/* ---------- state ---------- */
const state={view:"overview",param:null,
  watch:new Set(["swsh7-215","sl-evs-box","base1-4","sv8pt5-161"].filter(id=>BYID[id])),
  // real edition: no volume/eBay/graded data collected yet
  caps:{volume:false,ebay:false,graded:false},
  compare:["base1-4","swsh7-215"],cmpRange:365,alerts:[
    {asset:"swsh7-215",type:"Price above",value:2500,note:"Take-profit review"},
    {asset:"sl-evs-box",type:"Price below",value:2000,note:"Add on weakness"}].filter(al=>BYID[al.asset]),
  seg:"all",cls:"all",theme:"dark",back:null};

function fm(v,dec){ if(v==null)return "–";
  const abs=Math.abs(v);
  if(dec==null) dec = abs>=1000?0 : abs>=20?0 : abs>=1?2 : 3;
  return "$"+v.toLocaleString("en-US",{minimumFractionDigits:dec,maximumFractionDigits:dec});}
function fmc(v){ if(v==null)return "–"; const a=Math.abs(v);
  if(a>=1e6)return "$"+(v/1e6).toFixed(1)+"M"; if(a>=1e3)return "$"+(v/1e3).toFixed(1)+"K"; return fm(v);}
function fp(v,dec=1){ if(v==null)return "–"; return (v>0?"+":"")+v.toFixed(dec)+"%";}
function pcls(v){ return v==null?"flat2":(v>0.05?"up":v<-0.05?"down":"flat2");}
function deltaSpan(v,dec=1,usd){const s=el("span",pcls(v));s.textContent=fp(v,dec)+(usd!=null?` (${(usd>=0?"+":"−")}${fm(Math.abs(usd))})`:"");return s;}
function esc(t){return t==null?"":String(t);}

/* ---------- theme ---------- */
function setTheme(t){state.theme=t;document.documentElement.dataset.theme=t;render();}
function cssv(name){return getComputedStyle(document.documentElement).getPropertyValue(name).trim();}
const SER=()=>[cssv("--s1"),cssv("--s2"),cssv("--s3"),cssv("--s4")];

/* ---------- tooltip ---------- */
const tip=el("div","viz-tip");tip.style.display="none";document.body.appendChild(tip);
function showTip(x,y,build){tip.textContent="";build(tip);tip.style.display="block";
  const r=tip.getBoundingClientRect();
  tip.style.left=Math.min(x+14,innerWidth-r.width-10)+"px";
  tip.style.top=Math.max(8,Math.min(y+14,innerHeight-r.height-10))+"px";}
function hideTip(){tip.style.display="none";}

/* ---------- series helpers ---------- */
function assetSeries(a){const st=a.series.startIdx,p=a.series.p;
  return {start:st,at:i=>(i>=st&&i-st<p.length)?p[i-st]:null,arr:p};}
function sliceRange(a,days){const s=assetSeries(a);const from=Math.max(s.start,N_DAYS-days);
  const pts=[];for(let i=from;i<N_DAYS;i++){const v=s.at(i);if(v!=null)pts.push([i,v]);}return pts;}
function ma(points,w){const out=[];let sum=0;const q=[];
  for(const [x,y] of points){q.push(y);sum+=y;if(q.length>w)sum-=q.shift();
    if(q.length===w)out.push([x,sum/w]);}return out;}

/* ---------- nice ticks ---------- */
function niceTicks(lo,hi,n=4){if(hi===lo){hi=lo+1;}
  const span=hi-lo,step0=span/n,mag=Math.pow(10,Math.floor(Math.log10(step0)));
  const step=[1,2,2.5,5,10].map(m=>m*mag).find(s=>span/s<=n+1)||mag*10;
  const t=[];for(let v=Math.ceil(lo/step)*step;v<=hi+1e-9;v+=step)t.push(v);return t;}

/* =========================================================
   Line chart: series=[{name,color,pts:[[dayIdx,val],...],dash?}]
   opts: h, yFmt, area (single-series wash), vols (weekly bars [[dayIdx,val]]),
         normalized (index=100 at first common point)
========================================================= */
function lineChart(box,seriesIn,opts={}){
  box.textContent="";box.classList.add("chartbox");
  const H=opts.h||260, PB=22, PT=8, PL=8, volH=opts.vols?54:0;
  const W=Math.max(300,box.clientWidth||620), PR=52;
  let series=seriesIn.filter(s=>s.pts.length>1);
  if(!series.length){box.appendChild(el("div","empty","No history in range"));return;}
  if(opts.normalized){series=series.map(s=>{const b=s.pts[0][1]||1;
    return {...s,pts:s.pts.map(([x,y])=>[x,y/b*100])};});}
  const xs=series.flatMap(s=>[s.pts[0][0],s.pts[s.pts.length-1][0]]);
  const x0=Math.min(...xs),x1=Math.max(...xs);
  let lo=Infinity,hi=-Infinity;
  series.forEach(s=>s.pts.forEach(([,y])=>{if(y<lo)lo=y;if(y>hi)hi=y;}));
  const pad=(hi-lo)*0.07||hi*0.05||1;lo=Math.max(0,lo-pad);hi+=pad;
  const ticks=niceTicks(lo,hi);
  lo=Math.min(lo,ticks[0]);hi=Math.max(hi,ticks[ticks.length-1]);
  const plotW=W-PL-PR,plotH=H-PT-PB-volH-(volH?8:0);
  const X=i=>PL+(i-x0)/(x1-x0||1)*plotW;
  const Y=v=>PT+ (1-(v-lo)/(hi-lo||1))*plotH;
  const yFmt=opts.yFmt||(v=>fmc(v));
  const NS="http://www.w3.org/2000/svg";
  const svg=document.createElementNS(NS,"svg");
  svg.setAttribute("viewBox",`0 0 ${W} ${H}`);svg.setAttribute("width",W);svg.setAttribute("height",H);
  svg.style.height="auto";
  const add=(name,attrs,parent=svg)=>{const n=document.createElementNS(NS,name);
    for(const k in attrs)n.setAttribute(k,attrs[k]);parent.appendChild(n);return n;};
  // grid + y labels
  ticks.forEach(t=>{const y=Y(t);
    add("line",{x1:PL,x2:PL+plotW,y1:y,y2:y,stroke:cssv("--grid"),"stroke-width":1});
    const tx=add("text",{x:W-PR+6,y:y+4,"font-size":11,fill:cssv("--muted")});tx.textContent=yFmt(t);});
  // x labels
  const nx=Math.min(6,Math.floor(plotW/90));
  for(let k=0;k<=nx;k++){const i=Math.round(x0+(x1-x0)*k/nx);
    const tx=add("text",{x:X(i),y:H-6,"font-size":11,fill:cssv("--muted"),"text-anchor":k===0?"start":(k===nx?"end":"middle")});
    tx.textContent=dshort(DATES[i]);}
  // volume bars
  if(opts.vols){const vTop=PT+plotH+8;const vmax=Math.max(...opts.vols.map(v=>v[1]))||1;
    const bw=Math.max(2,plotW/opts.vols.length-2);
    opts.vols.forEach(([i,v])=>{if(i<x0||i>x1)return;const h=v/vmax*volH;
      add("rect",{x:X(i)-bw/2,y:vTop+volH-h,width:bw,height:Math.max(1,h),rx:1.5,
        fill:cssv("--baseline")});});
    const tx=add("text",{x:W-PR+6,y:vTop+10,"font-size":10,fill:cssv("--muted")});tx.textContent="sales/wk";}
  // series paths
  series.forEach((s,si)=>{
    const d=s.pts.map(([x,y],j)=>(j?"L":"M")+X(x).toFixed(1)+" "+Y(y).toFixed(1)).join("");
    if(opts.area&&series.length===1){
      const dd=d+`L${X(s.pts[s.pts.length-1][0]).toFixed(1)} ${PT+plotH}L${X(s.pts[0][0]).toFixed(1)} ${PT+plotH}Z`;
      add("path",{d:dd,fill:s.color,opacity:.10});}
    add("path",{d,fill:"none",stroke:s.color,"stroke-width":s.thin?1.5:2,
      "stroke-linejoin":"round","stroke-linecap":"round",...(s.dash?{"stroke-dasharray":"5 4"}:{})});
    const last=s.pts[s.pts.length-1];
    add("circle",{cx:X(last[0]),cy:Y(last[1]),r:4,fill:s.color,stroke:cssv("--surface"),"stroke-width":2});
  });
  // crosshair + hover
  const cross=add("line",{y1:PT,y2:PT+plotH,stroke:cssv("--baseline"),"stroke-width":1,visibility:"hidden"});
  const dots=series.map(s=>add("circle",{r:4.5,fill:s.color,stroke:cssv("--surface"),"stroke-width":2,visibility:"hidden"}));
  const hit=add("rect",{x:PL,y:0,width:plotW,height:H,fill:"transparent"});
  const lookup=series.map(s=>{const m=new Map();s.pts.forEach(([x,y])=>m.set(x,y));return m;});
  function hover(ev){
    const r=svg.getBoundingClientRect();
    const px=(ev.clientX-r.left)*(W/r.width);
    let i=Math.round(x0+(px-PL)/plotW*(x1-x0));i=Math.max(x0,Math.min(x1,i));
    // snap to nearest idx with any data
    let best=null;for(let d=0;d<15;d++){for(const cand of [i-d,i+d]){
      if(cand>=x0&&cand<=x1&&lookup.some(m=>m.has(cand))){best=cand;break;}}if(best!=null)break;}
    if(best==null)return;
    cross.setAttribute("x1",X(best));cross.setAttribute("x2",X(best));cross.setAttribute("visibility","visible");
    series.forEach((s,si)=>{const v=lookup[si].get(best);
      if(v==null){dots[si].setAttribute("visibility","hidden");return;}
      dots[si].setAttribute("cx",X(best));dots[si].setAttribute("cy",Y(v));dots[si].setAttribute("visibility","visible");});
    showTip(ev.clientX,ev.clientY,t=>{
      t.appendChild(el("div","tdate",dstr(DATES[best])));
      series.forEach((s,si)=>{const v=lookup[si].get(best);if(v==null)return;
        const row=el("div","trow");const k=el("i","key");k.style.borderTopColor=s.color;
        row.appendChild(k);row.appendChild(el("span","tn",s.name));
        row.appendChild(el("span","tv",opts.normalized?v.toFixed(1):yFmt(v)));t.appendChild(row);});});
  }
  hit.addEventListener("pointermove",hover);
  hit.addEventListener("pointerleave",()=>{cross.setAttribute("visibility","hidden");
    dots.forEach(d=>d.setAttribute("visibility","hidden"));hideTip();});
  box.appendChild(svg);
  if(series.length>1){const lg=el("div","legend");
    series.forEach(s=>{const li=el("span","li");const k=el("i","key");k.style.borderTopColor=s.color;
      li.appendChild(k);li.appendChild(document.createTextNode(s.name));lg.appendChild(li);});
    box.appendChild(lg);}
}

/* ---------- sparkline ---------- */
function spark(pts,w=90,h=26,color){
  if(!pts||pts.length<2)return el("span","note","–");
  const NS="http://www.w3.org/2000/svg";const svg=document.createElementNS(NS,"svg");
  svg.setAttribute("viewBox",`0 0 ${w} ${h}`);svg.setAttribute("width",w);svg.setAttribute("height",h);
  const ys=pts.map(p=>p[1]),lo=Math.min(...ys),hi=Math.max(...ys);
  const X=j=>j/(pts.length-1)*(w-6)+3, Y=v=>2+(1-(v-lo)/(hi-lo||1))*(h-6);
  const d=pts.map((p,j)=>(j?"L":"M")+X(j).toFixed(1)+" "+Y(p[1]).toFixed(1)).join("");
  const path=document.createElementNS(NS,"path");
  const c=color||((pts[pts.length-1][1]>=pts[0][1])?cssv("--up"):cssv("--down"));
  path.setAttribute("d",d);path.setAttribute("fill","none");path.setAttribute("stroke",c);
  path.setAttribute("stroke-width",1.6);svg.appendChild(path);
  const dot=document.createElementNS(NS,"circle");
  dot.setAttribute("cx",X(pts.length-1));dot.setAttribute("cy",Y(ys[ys.length-1]));
  dot.setAttribute("r",2.4);dot.setAttribute("fill",c);svg.appendChild(dot);
  return svg;}

/* ---------- score chip ---------- */
const SCORE_HELP=DATA.methodology;
function scoreChip(key,label,val,max=100,tone){
  const c=el("div","scorechip");const k=el("div","k");k.appendChild(el("span",null,label));
  const q=el("span","qmark","?");q.title=SCORE_HELP[key]||"";k.appendChild(q);c.appendChild(k);
  c.appendChild(el("div","v",typeof val==="number"?(max===1?Math.round(val*100)+"%":Math.round(val)):val));
  const m=el("div","meter"+(tone?" "+tone:""));const i=el("i");
  i.style.width=Math.min(100,(max===1?val*100:val/max*100))+"%";m.appendChild(i);c.appendChild(m);
  return c;}

/* ---------- price segments ---------- */
const SEGS=[["all","All prices",0,1/0],["u5","< $5",0,5],["5-25","$5–25",5,25],["25-100","$25–100",25,100],
  ["100-500","$100–500",100,500],["500-1k","$500–1K",500,1000],["1k+","> $1K",1000,1/0]];
function inSeg(a,segId){const s=SEGS.find(x=>x[0]===segId);return a.price>=s[2]&&a.price<s[3];}

/* ---------- ranking boards (client-side, filterable) ---------- */
const M=(a,k)=>a.metrics[k], MP=(a,k)=>a.metrics[k]?a.metrics[k].pct:null;
function meaningful(a){const mm=a.metrics.mom;if(!mm)return null;
  return Math.sign(mm.pct)*Math.pow(Math.abs(mm.pct),0.6)*Math.pow(Math.log10(1+Math.abs(mm.usd)),1.2);}
const BOARDS=[
 {id:"hot_singles",t:"Hottest cards",d:"Top Market Momentum Score — eligible singles only",pool:a=>a.type==="single",key:a=>a.scores.momentum,val:a=>Math.round(a.scores.momentum)},
 {id:"hot_sealed",t:"Hottest sealed",d:"Top Market Momentum Score — eligible sealed only",pool:a=>a.type==="sealed",key:a=>a.scores.momentum,val:a=>Math.round(a.scores.momentum)},
 {id:"mom_gain",t:"Meaningful monthly gainers",d:"Meaningful Move Score blends % and $ so penny spikes don't lead",key:meaningful,val:a=>fp(MP(a,"mom"))},
 {id:"mom_lose",t:"Meaningful monthly losers",d:"Largest financially meaningful MoM declines",key:a=>{const v=meaningful(a);return v==null?null:-v;},val:a=>fp(MP(a,"mom"))},
 {id:"usd_gain",t:"Top dollar gainers (30d)",d:"Largest absolute 30-day USD gain",key:a=>M(a,"r30")?M(a,"r30").usd:null,val:a=>"+"+fm(M(a,"r30").usd)},
 {id:"ytd",t:"Year-to-date leaders",d:"Best real return since Dec 31, 2025",key:a=>MP(a,"ytd"),val:a=>fp(MP(a,"ytd"))},
 {id:"win19",t:"Full-window champions",d:"Best real return over the full collected window",pool:a=>a.series.startIdx<=7,key:a=>MP(a,"window"),val:a=>fp(MP(a,"window"),0)},
 {id:"stable",t:"Most stable",d:"Top Stability Score",key:a=>a.scores.stability,val:a=>Math.round(a.scores.stability)},
 {id:"volatile",t:"Most volatile",d:"Highest 90-day realized volatility",key:a=>M(a,"vol90"),val:a=>Math.round(M(a,"vol90"))+"%"},
 {id:"quality",t:"Highest investment quality",d:"Composite of trend, stability, confidence, spread",key:a=>a.scores.quality,val:a=>Math.round(a.scores.quality)},
 {id:"tight",t:"Tightest spreads",d:"Smallest gap between lowest listing and mid — easiest to trade near quote",key:a=>a.scores.spread,val:a=>M(a,"spreadPct")+"% spread"},
 {id:"wide",t:"Widest spreads",d:"Quoted value is soft — negotiate or wait",key:a=>M(a,"spreadPct"),val:a=>M(a,"spreadPct")+"% spread"},
 {id:"breakout",t:"Breakout candidates",d:"Model probability of new highs",key:a=>a.scores.breakout,val:a=>Math.round(a.scores.breakout*100)+"%"},
 {id:"near_ath",t:"Approaching prior highs",d:"Within 8% of the window high, momentum > 50",pool:a=>a.metrics.ath.fromPct>-8&&a.scores.momentum>50,key:a=>a.metrics.ath.fromPct,val:a=>fp(a.metrics.ath.fromPct)+" vs high"},
 {id:"near_low",t:"Near potential support",d:"Close to the window low",pool:a=>a.metrics.atl.fromPct<18,key:a=>-a.metrics.atl.fromPct,val:a=>fp(a.metrics.atl.fromPct)+" vs low"},
 {id:"overext",t:"Most overextended",d:"Furthest above 200-day average — reversion risk",pool:a=>a.metrics.vsMa200!=null,key:a=>a.metrics.vsMa200,val:a=>fp(a.metrics.vsMa200,0)+" vs MA200"},
 {id:"underval",t:"Undervalued vs own history",d:"Deep below 200-day average",pool:a=>a.metrics.vsMa200!=null,key:a=>-a.metrics.vsMa200,val:a=>fp(a.metrics.vsMa200,0)+" vs MA200"},
 {id:"vintage",t:"Strongest vintage (6m)",d:"Best 180-day real return, WOTC era",pool:a=>a.era==="vintage",key:a=>MP(a,"r180"),val:a=>fp(MP(a,"r180"))},
 {id:"modern",t:"Strongest modern (6m)",d:"Best 180-day real return, SWSH/SV/Mega eras",pool:a=>a.era==="modern",key:a=>MP(a,"r180"),val:a=>fp(MP(a,"r180"))},
];
function boardItems(b,seg,cls,n=8){
  let pool=ASSETS.filter(a=>b.all?true:a.eligible.eligible);
  if(b.pool)pool=pool.filter(b.pool);
  if(seg&&seg!=="all")pool=pool.filter(a=>inSeg(a,seg));
  if(cls&&cls!=="all")pool=pool.filter(a=>a.type===cls);
  pool=pool.filter(a=>b.key(a)!=null);
  pool.sort((x,y)=>b.key(y)-b.key(x));
  return pool.slice(0,n);}

/* ---------- market breadth (computed live) ---------- */
function breadth(){let above=0,tot=0;ASSETS.forEach(a=>{if(a.metrics.vsMa50!=null){tot++;if(a.metrics.vsMa50>0)above++;}});
  return Math.round(above/tot*100);}

/* ---------- navigation ---------- */
function go(view,param){if(view==="product")state.back={view:state.view,param:state.param};
  state.view=view;state.param=param??null;render();scrollTo({top:0});}

/* ---------- full-catalog search + lazy product data (live site only) ---------- */
let CATALOG=null,CATALOG_P=null;
const TIERPIDS=new Set(ASSETS.map(a=>a.pid).filter(Boolean));
function loadCatalog(){
  if(!location.protocol.startsWith("http"))return Promise.resolve(null);
  if(CATALOG)return Promise.resolve(CATALOG);
  CATALOG_P=CATALOG_P||fetch("catalog.json").then(r=>r.json())
    .then(d=>{CATALOG=d.rows;return CATALOG;}).catch(()=>null);
  return CATALOG_P;}
function catalogFind(pid){return CATALOG?CATALOG.find(r=>r[0]===pid):null;}
const shardCache={};
function loadShard(cat,gid){
  const key=cat+"-"+gid;
  if(shardCache[key])return Promise.resolve(shardCache[key]);
  return fetch("series/"+key+".json").then(r=>r.json())
    .then(d=>{shardCache[key]=d;return d;});}
function liteMetrics(startIdx,p){
  const now=p[p.length-1],m={price:now};
  const ret=d=>p.length>d?{pct:(now/p[p.length-1-d]-1)*100,usd:now-p[p.length-1-d]}:null;
  m.r7=ret(7);m.r30=ret(30);m.r90=ret(90);m.r180=ret(180);
  m.window={pct:(now/p[0]-1)*100,usd:now-p[0]};
  let hi=-1e18,lo=1e18,hiI=0,loI=0;
  p.forEach((v,i)=>{if(v>hi){hi=v;hiI=i;}if(v<lo){lo=v;loI=i;}});
  m.ath={price:hi,idx:startIdx+hiI,fromPct:(now/hi-1)*100};
  m.atl={price:lo,idx:startIdx+loI,fromPct:(now/lo-1)*100};
  const mean=(arr)=>arr.reduce((s,v)=>s+v,0)/arr.length;
  if(p.length>=50)m.ma50=mean(p.slice(-50));
  if(p.length>=200)m.ma200=mean(p.slice(-200));
  const seg=p.slice(-91),rs=[];
  for(let i=1;i<seg.length;i++){const r=Math.log(seg[i]/seg[i-1]);if(Math.abs(r)>1e-12)rs.push(r);}
  if(rs.length>=8){const mu=mean(rs);m.vol90=Math.sqrt(mean(rs.map(r=>(r-mu)*(r-mu))))*Math.sqrt(365)*100;}
  return m;}
