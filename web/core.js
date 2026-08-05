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
  const q=el("span","qmark","?");k.appendChild(q);c.appendChild(k);
  c.appendChild(el("div","v",typeof val==="number"?(max===1?Math.round(val*100)+"%":Math.round(val)):val));
  const m=el("div","meter"+(tone?" "+tone:""));const i=el("i");
  i.style.width=Math.min(100,(max===1?val*100:val/max*100))+"%";m.appendChild(i);c.appendChild(m);
  if(typeof GLOSSARY!=="undefined"&&GLOSSARY[key])tipFor(c,key,"Full formula: Methodology page.");
  else c.title=SCORE_HELP[key]||"";
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
 {id:"hot_singles",t:"Hottest cards",d:"Top Heat Score — confirmed multi-horizon strength, not one spike",pool:a=>a.type==="single",key:a=>a.scores.heat??a.scores.momentum,val:a=>Math.round(a.scores.heat??a.scores.momentum)},
 {id:"hot_sealed",t:"Hottest sealed",d:"Top Heat Score — eligible sealed only",pool:a=>a.type==="sealed",key:a=>a.scores.heat??a.scores.momentum,val:a=>Math.round(a.scores.heat??a.scores.momentum)},
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

/* ---------- temperature system ---------- */
const TEMP={
  hot:{label:"HOT",icon:"🔥",color:"var(--good)"},
  warming:{label:"WARMING",icon:"↗",color:"var(--up)"},
  stagnant:{label:"STAGNANT",icon:"→",color:"var(--muted)"},
  cooling:{label:"COOLING",icon:"↘",color:"var(--serious)"},
  cold:{label:"COLD",icon:"❄",color:"var(--crit)"}};
function tempChip(t,small){
  const cfg=TEMP[t]||TEMP.stagnant;
  const c=el("span","tempchip"+(small?" sm":""));
  c.style.color=cfg.color;c.style.borderColor=cfg.color;
  c.textContent=cfg.icon+" "+cfg.label;
  c.title=SCORE_HELP.temperature||"";
  return c;}

/* ---------- card artwork (TCGplayer public CDN, predictable by product id) ---------- */
function cardImgUrl(pid,size){return pid?`https://tcgplayer-cdn.tcgplayer.com/product/${pid}_in_${size||"200x200"}.jpg`:null;}
function cardImg(a,size,cls){
  const pid=a.pid||a;if(!pid)return null;
  const img=document.createElement("img");
  img.src=(a.img&&size==="200x200"?a.img:null)||cardImgUrl(pid,size);
  img.loading="lazy";img.alt="";img.className=cls||"cardthumb";
  img.onerror=()=>{img.style.display="none";};
  return img;}

/* ---------- growth-of-$100 framing ---------- */
function grow100(level){return "$100 → $"+Math.round(level).toLocaleString();}

/* ---------- squarified treemap layout ---------- */
function squarify(items,x,y,w,h){
  // items: [{v (value>0), ...}] sorted desc. Returns items with x,y,w,h set.
  const total=items.reduce((s,i)=>s+i.v,0);if(!total)return items;
  const scale=w*h/total;
  let row=[],rest=items.slice(),rx=x,ry=y,rw=w,rh=h;
  function worst(row,len){
    const s=row.reduce((a,i)=>a+i.v*scale,0);
    let mx=0;
    for(const i of row){const a=i.v*scale;
      mx=Math.max(mx,Math.max(len*len*a/(s*s),s*s/(len*len*a)));}
    return mx;}
  function layout(row,horiz){
    const s=row.reduce((a,i)=>a+i.v*scale,0);
    const len=horiz?rw:rh;const breadth=s/len;
    let off=0;
    for(const i of row){const frac=(i.v*scale)/s;
      if(horiz){i.x=rx+off*rw;i.y=ry;i.w=frac*rw;i.h=breadth;}
      else{i.x=rx;i.y=ry+off*rh;i.w=breadth;i.h=frac*rh;}
      off+=frac;}
    if(horiz){ry+=breadth;rh-=breadth;}else{rx+=breadth;rw-=breadth;}}
  while(rest.length){
    const horiz=rw>=rh;const len=horiz?rw:rh;
    const it=rest[0];
    if(!row.length||worst([...row,it],Math.min(rw,rh))<=worst(row,Math.min(rw,rh))){
      row.push(it);rest.shift();}
    else{layout(row,rw<rh);row=[];}
    if(!rest.length&&row.length)layout(row,rw<rh);}
  return items;}
function heatColor(pct,alphaBoost){
  // diverging: red (loss) -> neutral -> green (gain), magnitude-capped at ±15%
  const v=Math.max(-15,Math.min(15,pct||0))/15;
  const a=(0.12+0.55*Math.abs(v))*(alphaBoost||1);
  return v>=0?`rgba(12,163,12,${a})`:`rgba(208,59,59,${a})`;}

/* ================= plain-language layer: glossary, hints, page legends ================= */
const GLOSSARY={
 price:["Market price","What this actually sells for on TCGplayer right now, based on real sales — not the (often higher) asking prices."],
 ret:["Price change","Percent change vs that many days ago. Green = up, red = down."],
 ret30:["30-day change","Today's price vs 30 days ago."],
 ret180:["6-month change","Today's price vs 6 months ago."],
 mom:["Month-over-month","End of last month vs the month before — a clean calendar comparison that ignores mid-month noise."],
 window:["Since Jan 2025","Change since the very start of this database (January 2025)."],
 grow100:["Growth of $100","If you'd put $100 into this at the start, this is what it would be worth today."],
 level:["Index level","The raw index number. It started at 100 in Jan 2025 — so 230 means +130% since then."],
 index:["Index","A basket of many cards or products tracked as one number — like the S&P 500, but for Pokémon."],
 temp:["Temperature","A quick weather report: 🔥 HOT = rising fast and above trend · ↗ WARMING = gently rising · → STAGNANT = sideways · ↘ COOLING = drifting down · ❄ COLD = falling and below trend."],
 momentum:["Momentum","Is it moving up right now? A 0–100 speedometer: 50 = flat, 70+ = strong climb, under 30 = falling. Blends the last week, month and quarter."],
 heat:["Heat Score","Momentum plus proof. High heat means the week, month AND quarter all point up, the price sits above its trend lines and near its high — a confirmed run, not a one-day spike."],
 volatility:["Volatility","How bumpy the ride is. High = big swings both ways, so you can gain or lose quickly. Under 30 is calm; over 60 is rough seas."],
 stability:["Stability","The opposite of bumpy: high means the price stays in a steady lane. Comforting for holders, boring for flippers."],
 spreadPct:["Listed spread","The gap between the cheapest listing and a typical one. A small gap means the quoted price is solid; a big gap means it's fuzzy — expect haggling."],
 spread:["Spread tightness","100 = listings tightly packed around the market price (easy to buy/sell near the quote). Low = listings scattered, quote is soft."],
 confidence:["Confidence","How much to trust the quoted price: lots of daily data + calm trading + tight listings = high trust. Thin or wild markets score low."],
 quality:["Investment quality","The “could I comfortably hold this?” score — blends a steady upward trend, calm prices, trustworthy data and tight spreads."],
 breakout:["Breakout probability","The model's estimate of the chance this sets a new high soon. Treat it like a weather forecast, not a promise."],
 ma:["Trend lines (averages)","The average price over the last 50 or 200 days. Price above the line = uptrend; below = downtrend."],
 vsma:["vs trend line","How far today's price sits above (+) or below (−) its own average. Far above can mean overheated; far below can mean beaten down."],
 high:["Window high / low","The highest and lowest price since Jan 2025, and how far today's price is from each."],
 eligible:["Ranking rules","To appear in rankings an item needs a real price of $5+ ($25 for sealed), prices on most days, and 4+ months of history — this keeps junk data off the boards."],
 meaningful:["Meaningful moves","Rankings weigh percent AND dollars together, so a 1¢ card tripling can never outrank a $600 card gaining $200."],
 coverage:["Coverage","The share of days this item actually had a market price. Low coverage = a thin market that trades sporadically."],
 trophy:["Thin market","A rarely-traded item — a single sale can move its quoted price a lot, so it's kept off the momentum boards but still fully viewable."],
 sparkline:["Trend","The little line = last 90 days of price, green if up overall, red if down."],
 breadth:["Market breadth","What share of everything we track is above its own 50-day trend line. High = a broad rally; low = weakness almost everywhere."],
 scenario:["Scenarios","Bull / base / bear are model-projected 6-month paths from current trend and choppiness. Estimates to frame thinking — never guarantees."],
};
function tipFor(elm,key,extra){
  const g=GLOSSARY[key];if(!g)return elm;
  elm.classList.add("hint");
  const show=ev=>showTip(ev.clientX||innerWidth/2,ev.clientY||90,t=>{
    t.appendChild(el("div","tdate",g[0]));
    const p=el("div",null,g[1]);p.style.cssText="max-width:250px;line-height:1.45";t.appendChild(p);
    if(extra){const x=el("div","tdate");x.style.marginTop="5px";x.textContent=extra;t.appendChild(x);}});
  elm.addEventListener("pointerenter",show);
  elm.addEventListener("pointerdown",show);
  elm.addEventListener("pointerleave",hideTip);
  return elm;}
function hint(label,key){return tipFor(el("span",null,label),key);}
const TH_GLOSSARY={"Price":"price","7d":"ret","30d":"ret30","MoM":"mom","6m":"ret180","1y":"ret",
  "Spread":"spreadPct","Qual":"quality","Conf":"confidence","Mom.":"momentum","Volat.":"volatility",
  "Trend":"sparkline","P/L %":"ret","P/L $":"ret"};
const PAGE_HELP={
 overview:["Big number = what $100 invested in the whole market in Jan 2025 is worth today.",
  "The four panels are four SEPARATE markets — sealed boxes and single cards, modern and vintage, barely move together.",
  "Temperature chips (🔥→❄) are the fastest read: is this thing rising, sideways, or falling?",
  "The rotation strip shows which of the four markets led each quarter — leadership changes hands."],
 map:["Each rectangle is a set (or card, once you drill in). Bigger = more tracked money in it.",
  "Green = price rising, red = falling, over the period you pick above. The % is printed on every readable tile.",
  "Click a set to see its cards; click a card to open its full page."],
 singles:["Only individual cards here — sealed boxes live on their own desk because they behave differently.",
  "Boards are eligibility-gated: cheap or barely-traded items can't clutter them.",
  "Click any row to open the card's full page."],
 sealed:["Only factory-sealed products here — boxes, ETBs, bundles. Supply only shrinks over time, so this market has its own rhythm.",
  "Same rules as everywhere: real TCGplayer prices, temperature chips, click for detail."],
 rankings:["Every board answers one question, written under its title.",
  "Gainer/loser boards use Meaningful Moves: percent AND dollars must both matter, so penny cards can't top the charts.",
  "Use the price-band pills to see rankings within your budget."],
 indexes:["An index is a basket tracked as one number — shown as what $100 would have become since Jan 2025.",
  "The small 'level' number is the same thing in index form (started at 100).",
  "Temperature chips tell you each basket's current weather."],
 screener:["A filterable table of every asset with full analytics.",
  "Set minimum scores with the sliders; click any column header to sort.",
  "Hover any header for what the column means."],
 compare:["Pick up to four items; each is rebased to 100 at the start of the range so you compare journeys, not price tags.",
  "A $10 card and a $2,000 box can be compared fairly this way."],
 alerts:["'Triggered today' = conditions our screens detected in the latest data.",
  "'My alert rules' are yours — in this demo they reset on refresh; accounts would make them permanent."],
 watchlist:["Star anything (☆) anywhere to pin it here.","Resets on refresh in this version."],
 portfolio:["A demo collection marked to real market prices.",
  "Net proceeds assume you sell at market, minus ~13% fees — not at the highest asking price."],
 learn:[],methodology:[]};
function helpBar(viewKey){
  const items=PAGE_HELP[viewKey];
  if(!items||!items.length)return el("span");
  const wrap=el("div");wrap.style.marginBottom="14px";
  const btn=el("button","pill","ⓘ  What am I looking at?");
  const panel=el("div","callout");panel.style.cssText="display:none;margin-top:8px";
  const ul=el("ul","risklist");items.forEach(t=>ul.appendChild(el("li",null,t)));
  panel.appendChild(ul);
  const more=el("div","note");more.style.marginTop="6px";
  more.appendChild(document.createTextNode("New here? Read "));
  const lk=el("a",null,"Learn the basics");lk.href="#";lk.onclick=e=>{e.preventDefault();go("learn");};
  more.appendChild(lk);more.appendChild(document.createTextNode(" — 3 minutes, no finance background needed. Dotted-underlined words anywhere show a plain-English meaning on hover."));
  panel.appendChild(more);
  btn.onclick=()=>{const on=panel.style.display==="none";panel.style.display=on?"block":"none";btn.classList.toggle("on",on);};
  wrap.appendChild(btn);wrap.appendChild(panel);return wrap;}
