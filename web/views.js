/* ================= PokeQuant views ================= */
"use strict";
const NAV=[["sec","Markets"],["overview","◈","Market overview"],["map","▩","Market map"],["singles","▤","Singles desk"],["sealed","▦","Sealed desk"],
  ["rankings","≡","Rankings"],["indexes","∿","Indexes"],
  ["sec","Research"],["screener","⌕","Screener"],["compare","⇄","Compare"],["alerts","◷","Alert center"],
  ["sec","My desk"],["watchlist","★","Watchlist"],["portfolio","▥","Portfolio"],
  ["sec","About"],["learn","✦","Learn the basics"],["methodology","ⓘ","Methodology (advanced)"]];

function render(){
  const root=$("#app");root.textContent="";
  const shell=el("div","shell");
  // sidebar
  const sb=el("aside","sidebar");
  const brand=el("div","brand");brand.appendChild(el("div","logo"));
  const bt=el("div");const b=el("b",null,"PokéQuant");bt.appendChild(b);
  bt.appendChild(el("small",null,"market terminal"));brand.appendChild(bt);sb.appendChild(brand);
  const nav=el("nav","nav");
  NAV.forEach(item=>{if(item[0]==="sec"){nav.appendChild(el("div","sec",item[1]));return;}
    const [id,ic,label]=item;const btn=el("button",state.view===id?"on":"");
    btn.appendChild(el("span","ic",ic));btn.appendChild(el("span",null,label));
    btn.onclick=()=>go(id);nav.appendChild(btn);});
  sb.appendChild(nav);
  if(location.protocol.startsWith("http")){
    const dl=el("a",null,"⬇ Offline snapshot");dl.href="PokeQuant-Terminal-LIVE.html";
    dl.setAttribute("download","");dl.style.cssText="display:block;margin:14px 10px 4px;font-size:12px;color:var(--muted)";
    dl.title="Self-contained copy of this terminal with today's data baked in — works without internet";
    sb.appendChild(dl);}
  shell.appendChild(sb);
  // main
  const main=el("div","main");
  // mobile nav
  const mnav=el("div","mobile-nav");
  NAV.filter(i=>i[0]!=="sec").forEach(([id,ic,label])=>{
    const btn=el("button",state.view===id?"on":"",label);btn.onclick=()=>go(id);mnav.appendChild(btn);});
  main.appendChild(mnav);
  // topbar
  const tb=el("div","topbar");
  const sw=el("div","searchwrap");sw.appendChild(el("span","sic","⌕"));
  const inp=el("input");inp.placeholder="Search all "+(META.catalogCount||ASSETS.length).toLocaleString()+" tracked cards & products…";
  inp.setAttribute("aria-label","Search assets");
  const res=el("div","results");res.style.display="none";
  inp.addEventListener("focus",()=>loadCatalog().then(()=>{if(inp.value.trim().length>=2)inp.dispatchEvent(new Event("input"));}));
  inp.addEventListener("input",()=>{
    const q=inp.value.trim().toLowerCase();res.textContent="";
    if(q.length<2){res.style.display="none";return;}
    const hits=ASSETS.filter(a=>(a.name+" "+a.set+" "+(a.character||"")+" "+(a.nickname||"")).toLowerCase().includes(q)).slice(0,7);
    const addRow=(label,sub,price,onclick)=>{const r=el("button","row");
      const l=el("span");l.appendChild(document.createTextNode(label+" "));
      l.appendChild(el("small",null,sub));r.appendChild(l);
      r.appendChild(el("span","mono",fm(price)));
      r.onclick=()=>{res.style.display="none";inp.value="";onclick();};res.appendChild(r);};
    hits.forEach(a=>addRow(a.name,a.set,a.price,()=>go("product",a.id)));
    if(CATALOG&&hits.length<9){
      const extra=CATALOG.filter(r=>!r[7]&&(r[1]+" "+r[2]).toLowerCase().includes(q)).slice(0,9-hits.length);
      extra.forEach(r=>addRow(r[1],r[2]+" · full catalog",r[5],()=>go("product","p"+r[0])));}
    else if(!CATALOG&&location.protocol.startsWith("http"))
      res.appendChild(el("div","empty","Loading full catalog…"));
    if(!res.childNodes.length){res.style.display="none";return;}
    res.style.display="block";});
  inp.addEventListener("blur",()=>setTimeout(()=>res.style.display="none",180));
  sw.appendChild(inp);sw.appendChild(res);tb.appendChild(sw);
  const badge=el("span","demo-badge");
  badge.innerHTML="<b style='color:var(--good)'>LIVE DATA</b> · "+META.days+" days real TCGplayer history · your repo, updated daily";
  badge.title=META.disclaimer;tb.appendChild(badge);
  const th=el("button","iconbtn",state.theme==="dark"?"☀ Light":"☾ Dark");
  th.onclick=()=>setTheme(state.theme==="dark"?"light":"dark");tb.appendChild(th);
  main.appendChild(tb);
  const body=el("div");main.appendChild(body);
  shell.appendChild(main);root.appendChild(shell);
  const V={overview:vOverview,map:vMarketMap,singles:b=>vDesk(b,"single"),sealed:b=>vDesk(b,"sealed"),rankings:vRankings,
    indexes:vIndexes,screener:vScreener,compare:vCompare,watchlist:vWatchlist,portfolio:vPortfolio,
    alerts:vAlerts,learn:vLearn,methodology:vMethod,product:vProduct,index:vIndexDetail};
  (V[state.view]||vOverview)(body);
  const subEl=body.querySelector(".sub");
  if(subEl&&PAGE_HELP[state.view]&&PAGE_HELP[state.view].length)subEl.after(helpBar(state.view));
  const foot=el("div","footer-note");foot.textContent=META.disclaimer;main.appendChild(foot);
}

/* ---------- shared: asset table ---------- */
function starBtn(a){const s=el("button","star"+(state.watch.has(a.id)?" on":""),state.watch.has(a.id)?"★":"☆");
  s.title="Toggle watchlist";s.setAttribute("aria-label","Toggle watchlist");
  s.onclick=ev=>{ev.stopPropagation();state.watch.has(a.id)?state.watch.delete(a.id):state.watch.add(a.id);render();};
  return s;}
function nameCell(a){const c=el("div","namecell");c.appendChild(starBtn(a));
  const w=el("div");const nm=el("div","nm",a.name);
  w.appendChild(nm);const sm=el("small",null,`${a.set} · ${a.subEra}${a.lang==="JP"?" · JP":""}${a.trophy?" · thin market":""}`);
  w.appendChild(sm);c.appendChild(w);return c;}
function assetTable(box,list,opts={}){
  const wrap=el("div","tablewrap");const t=el("table");
  const cols=opts.cols||[
    ["Asset",null],["Price",a=>fm(a.price)],["7d",a=>MP(a,"r7")],["30d",a=>MP(a,"r30")],["MoM",a=>MP(a,"mom")],
    ["6m",a=>MP(a,"r180")],["Spread",a=>M(a,"spreadPct")!=null?M(a,"spreadPct")+"%":"–"],
    ["Qual",a=>Math.round(a.scores.quality)],
    ["Conf",a=>Math.round(a.scores.confidence)],["Trend",null]];
  let sortIdx=opts.sort??3,desc=true;
  const draw=()=>{t.textContent="";
    const tr=el("tr");cols.forEach((c,i)=>{const th=document.createElement("th");
      th.textContent=c[0];if(c[1]){th.className="sortable";th.onclick=()=>{if(sortIdx===i)desc=!desc;else{sortIdx=i;desc=true;}draw();};}
      if(sortIdx===i)th.textContent+=desc?" ↓":" ↑";
      if(TH_GLOSSARY[c[0]])tipFor(th,TH_GLOSSARY[c[0]]);
      tr.appendChild(th);});
    t.appendChild(tr);
    let rows=[...list];
    if(cols[sortIdx]&&cols[sortIdx][1]){rows.sort((x,y)=>{
      let a=cols[sortIdx][1](x),b=cols[sortIdx][1](y);
      a=(a==null||a==="–")?-1e18:(typeof a==="string"?parseFloat(a.replace(/[^0-9.-]/g,""))||0:a);
      b=(b==null||b==="–")?-1e18:(typeof b==="string"?parseFloat(b.replace(/[^0-9.-]/g,""))||0:b);
      return desc?b-a:a-b;});}
    rows.slice(0,opts.max||200).forEach(a=>{
      const r=el("tr","click");r.onclick=()=>go("product",a.id);
      cols.forEach((c,ci)=>{const td=document.createElement("td");
        if(c[0]==="Asset")td.appendChild(nameCell(a));
        else if(c[0]==="Trend")td.appendChild(spark(sliceRange(a,90)));
        else{const v=c[1](a);
          if(["7d","30d","MoM","6m","1y","YTD"].includes(c[0])){td.appendChild(deltaSpan(v));}
          else td.textContent=typeof v==="number"?v.toLocaleString():esc(v);}
        r.appendChild(td);});
      t.appendChild(r);});};
  draw();wrap.appendChild(t);box.appendChild(wrap);}

/* ---------- filter pills ---------- */
function pills(box,label,options,current,onpick){
  if(label)box.appendChild(el("span","fl",label));
  options.forEach(([id,lab])=>{const p=el("button","pill"+(current===id?" on":""),lab);
    p.onclick=()=>onpick(id);box.appendChild(p);});}

/* ================= OVERVIEW ================= */
function vOverview(box){
  box.appendChild(el("div","h1","Market overview"));
  box.appendChild(el("div","sub","Real TCGplayer market data — "+META.days+" consecutive days ("+META.windowStart+" → "+META.windowEnd+"), collected daily into your own repository. Sealed products and singles are tracked as separate asset classes throughout."));
  const IX={},S=SER();DATA.indexes.forEach(i=>IX[i.id]=i);
  const comp=IX.idx_overall;
  // hero: whole market in one sentence
  const g=el("div","grid g2");
  const hc=el("div","card heroX");
  const hh=el("div");hh.style.cssText="display:flex;align-items:center;gap:10px;flex-wrap:wrap";
  hh.appendChild(el("h3",null,"The whole market, since "+(META.windowLabel||"Jan 2025")));
  if(comp&&comp.temp)hh.appendChild(tempChip(comp.temp));hc.appendChild(hh);
  if(comp){hc.appendChild(el("div","grow",grow100(comp.level)));
    const d=el("div","delta "+pcls(comp.r30));d.textContent=fp(comp.r30)+" last 30 days · "+fp(comp.window,0)+" total · index level "+comp.level.toFixed(1);
    hc.appendChild(d);
    const sp=el("div");sp.style.marginTop="8px";
    sp.appendChild(spark(comp.series.map((v,j)=>[j,v]),320,42,cssv("--s1")));hc.appendChild(sp);}
  g.appendChild(hc);
  const br=breadth();const bc=el("div","card tile");
  bc.appendChild(el("div","lab","Market breadth"));
  bc.appendChild(el("div","val",br+"%"));
  bc.appendChild(el("div","delta flat2","of assets above their 50-day average"));
  const m=el("div","meter"+(br<40?" warn":br>65?" good":""));const mi=el("i");mi.style.width=br+"%";m.appendChild(mi);
  m.style.marginTop="12px";bc.appendChild(m);
  const q=DATA.quadrants;
  if(q&&q.correlations&&q.correlations.length){
    const cw=el("div","corrbox");cw.style.marginTop="14px";
    q.correlations.slice(0,2).forEach(p=>{const cp=el("div","cpair");
      cp.appendChild(el("b",null,"r = "+p.r.toFixed(2)));
      cp.appendChild(el("small",null,p.a+" vs "+p.b));cw.appendChild(cp);});
    bc.appendChild(cw);
    bc.appendChild(el("div","note","Near-zero correlation: these are separate markets — which is why they get separate panels below."));}
  g.appendChild(bc);box.appendChild(g);
  // FOUR MARKETS
  box.appendChild(el("div","sec-title","The four markets ",));
  const QNAMES={sm:["Sealed · Modern","idx_q_sm"],gv:["Singles · Vintage","idx_q_gv"],
                gm:["Singles · Modern","idx_q_gm"],sv:["Sealed · Vintage","idx_q_sv"]};
  const qg=el("div","quad-grid");
  [["sm"],["gm"],["sv"],["gv"]].forEach(([k])=>{
    const [label,iid]=QNAMES[k];const ix=IX[iid];
    const c=el("div","card quad");
    const qh=el("div","qhead");qh.appendChild(el("span","qname",label));
    if(ix&&ix.temp)qh.appendChild(tempChip(ix.temp));c.appendChild(qh);
    if(!ix){c.appendChild(el("div","empty","Not enough full-history assets yet"));qg.appendChild(c);return;}
    c.appendChild(el("div","grow",grow100(ix.level)));
    c.appendChild(el("div","qsub",fp(ix.r30)+" 30d · "+fp(ix.window,0)+" since "+(META.windowLabel||"start")+" · "+ix.members.length+" assets"));
    const cb2=el("div");c.appendChild(cb2);
    setTimeout(()=>lineChart(cb2,[{name:label,color:S[0],pts:ix.series.map((v,j)=>[Math.min(j*7,N_DAYS-1),v])}],
      {h:120,area:true,yFmt:v=>v.toFixed(0)}),0);
    // top mover in this quadrant (by 30d, eligible)
    const pool=ix.members.map(id=>BYID[id]).filter(x=>x&&x.eligible.eligible&&x.metrics.r30);
    pool.sort((a2,b2)=>Math.abs(MP(b2,"r30"))-Math.abs(MP(a2,"r30")));
    if(pool[0]){const mv=pool[0];const row=el("div","qmover");row.onclick=()=>go("product",mv.id);
      const im=cardImg(mv,"200x200");if(im)row.appendChild(im);
      const tx=el("span");tx.appendChild(el("b",null,mv.name));
      tx.appendChild(document.createTextNode(" is this market's big mover: "));
      tx.appendChild(deltaSpan(MP(mv,"r30")));
      tx.appendChild(document.createTextNode(" in 30 days ("+fm(mv.price)+")"));
      row.appendChild(tx);c.appendChild(row);}
    qg.appendChild(c);});
  box.appendChild(qg);
  // rotation ribbon
  if(q&&q.rotation&&q.rotation.length){
    box.appendChild(el("div","sec-title","Market rotation — who led each quarter ",));
    const rc=el("div","card");const rr=el("div","rotation");
    const QCOLOR={sm:S[0],gm:S[1],sv:S[2],gv:S[3]};
    q.rotation.forEach(rq=>{const b=el("div","rq");
      b.style.borderColor=QCOLOR[rq.leader];b.style.background="color-mix(in oklab,"+QCOLOR[rq.leader]+" 12%,var(--surface))";
      b.appendChild(el("div","ql",rq.q));
      b.appendChild(el("div","qn",QNAMES[rq.leader]?QNAMES[rq.leader][0].replace(" · ","·"):rq.leader));
      const v=el("div","qv "+pcls(rq.ret[rq.leader]));v.textContent=fp(rq.ret[rq.leader]);
      b.appendChild(v);
      b.title=Object.entries(rq.ret).map(([k2,v2])=>QNAMES[k2][0]+": "+fp(v2)).join("  ·  ");
      rr.appendChild(b);});
    rc.appendChild(rr);
    rc.appendChild(el("div","note","The leadership baton passes between the four markets — hover a quarter for all four returns. This rotation is why blended \"whole market\" charts mislead."));
    box.appendChild(rc);}
  // briefing
  box.appendChild(el("div","sec-title","Market briefing"));
  const bg=el("div","grid g2");
  const briefC=el("div","card");briefC.appendChild(el("h3","", "What's driving the market"));
  const ul=el("ul","risklist");DATA.marketContext.forEach(t=>ul.appendChild(el("li",null,t)));briefC.appendChild(ul);
  bg.appendChild(briefC);
  const sigC=el("div","card");sigC.appendChild(el("h3",null,"Signals detected today"));
  sigC.appendChild(el("div","hint","Automated screens across all "+ASSETS.length+" tracked assets — real price data"));
  const sigs=[];
  ASSETS.filter(a=>a.eligible.eligible&&a.metrics.ath.fromPct>-1.5).slice(0,3)
    .forEach(a=>sigs.push([a,"At or within 1.5% of its window high","acc"]));
  ASSETS.filter(a=>a.eligible.eligible&&a.metrics.vsMa50!=null&&Math.abs(a.metrics.vsMa50)<0.8).slice(0,3)
    .forEach(a=>sigs.push([a,"Testing its 50-day average — watch for direction","acc"]));
  ASSETS.filter(a=>a.eligible.eligible&&(a.metrics.vsMa200||0)>30).slice(0,2)
    .forEach(a=>sigs.push([a,`${fp(a.metrics.vsMa200,0)} above its 200-day average — historically stretched`,"wrn"]));
  ASSETS.filter(a=>a.eligible.eligible&&(a.metrics.spreadPct||0)>20).slice(0,2)
    .forEach(a=>sigs.push([a,`Listed spread ${a.metrics.spreadPct}% — quoted value is soft, negotiate`,"wrn"]));
  sigs.slice(0,7).forEach(([a,txt,tone])=>{
    const r=el("button","row");r.style.cssText="display:block;width:100%;text-align:left;padding:8px 2px;border-top:1px solid var(--grid)";
    const l1=el("div");l1.appendChild(el("span","badge "+tone,a.name));
    l1.appendChild(el("span","note",txt));r.appendChild(l1);
    r.onclick=()=>go("product",a.id);sigC.appendChild(r);});
  bg.appendChild(sigC);box.appendChild(bg);
  // movers
  box.appendChild(el("div","sec-title","Leaders & laggards ",));
  const mg=el("div","grid g2");
  mg.appendChild(boardCard(BOARDS.find(b=>b.id==="mom_gain")));
  mg.appendChild(boardCard(BOARDS.find(b=>b.id==="mom_lose")));
  box.appendChild(mg);
}

/* ---------- board card ---------- */
function boardCard(b,seg,cls){
  const c=el("div","card board");const h=el("header");h.appendChild(el("h3",null,b.t));
  h.appendChild(el("div","hint",b.d));c.appendChild(h);
  const ol=el("ol");
  const items=boardItems(b,seg,cls,8);
  if(!items.length){c.appendChild(el("div","empty","No qualifying assets in this filter"));return c;}
  items.forEach((a,i)=>{const li=el("li");const btn=el("button");
    btn.appendChild(el("span","rank",String(i+1)));
    const im=cardImg(a,"200x200");if(im)btn.appendChild(im);
    const n=el("span","bn");n.appendChild(document.createTextNode(a.name));
    n.appendChild(el("small",null,a.set+" · "+fm(a.price)));btn.appendChild(n);
    if(a.scores.temp)btn.appendChild(tempChip(a.scores.temp,true));
    const v=el("span","bv");const raw=b.val(a);v.textContent=raw;
    if(String(raw).startsWith("+"))v.classList.add("up");if(String(raw).startsWith("-")||String(raw).startsWith("−"))v.classList.add("down");
    btn.appendChild(v);btn.onclick=()=>go("product",a.id);li.appendChild(btn);ol.appendChild(li);});
  c.appendChild(ol);return c;}

/* ================= DESKS (singles / sealed) ================= */
function vDesk(box,type){
  const isS=type==="single";
  box.appendChild(el("div","h1",isS?"Singles desk":"Sealed desk"));
  box.appendChild(el("div","sub",isS
    ?"Individual cards — segmented by set, character, rarity, language, grading status and era. Graded copies trade as separate assets from raw copies."
    :"Factory-sealed products — booster boxes, elite trainer boxes, bundles and premium collections. Sealed behaves like a supply-driven asset class: supply only shrinks."));
  const ix=DATA.indexes.find(i=>i.id===(isS?"idx_singles":"idx_sealed"));
  const g=el("div","grid g4");
  const tile=(lab,val,delta,cls)=>{const c=el("div","card tile");c.appendChild(el("div","lab",lab));
    c.appendChild(el("div","val",val));if(delta!=null){const d=el("div","delta "+(cls||pcls(parseFloat(delta))));d.textContent=delta;c.appendChild(d);}return c;};
  const pool=ASSETS.filter(a=>a.type===type);
  const elig=pool.filter(a=>a.eligible.eligible);
  const medMoM=median(elig.map(a=>MP(a,"mom")).filter(v=>v!=null));
  const medWin=median(elig.map(a=>MP(a,"window")).filter(v=>v!=null));
  g.appendChild(tile((isS?"Singles":"Sealed")+" index",ix.level.toFixed(1),fp(ix.r30)+" · 30d"));
  g.appendChild(tile("Median MoM move",fp(medMoM),"July vs June month-end","flat2"));
  g.appendChild(tile("Median since Jan 2025",fp(medWin),"full collected window","flat2"));
  g.appendChild(tile("Tracked "+(isS?"singles":"sealed"),String(pool.length),elig.length+" ranking-eligible","flat2"));
  box.appendChild(g);
  // boards
  box.appendChild(el("div","sec-title","Top boards ",));
  const bg=el("div","grid g3");
  const ids=isS?["hot_singles","usd_gain","quality"]:["hot_sealed","usd_gain","quality"];
  ids.forEach(id=>{const b={...BOARDS.find(x=>x.id===id)};
    const basePool=b.pool;b.pool=a=>a.type===type&&(basePool?basePool(a):true);
    bg.appendChild(boardCard(b));});
  box.appendChild(bg);
  // segmentation strips
  box.appendChild(el("div","sec-title",isS?"Performance by segment":"Performance by product type"));
  const segC=el("div","card");
  const dims=isS
    ?[["By era",a=>a.subEra],["By character",a=>a.character],["By set",a=>a.set]]
    :[["By product type",a=>a.kind],["By era",a=>a.subEra],["By language",a=>a.lang==="JP"?"Japanese":"English"]];
  dims.forEach(([lab,fn])=>{
    const groups={};pool.forEach(a=>{const k=fn(a);if(!k)return;(groups[k]=groups[k]||[]).push(a);});
    const rows=Object.entries(groups).filter(([,v])=>v.length>=2).map(([k,v])=>({k,n:v.length,
      mom:median(v.map(a=>MP(a,"mom")).filter(x=>x!=null)),r180:median(v.map(a=>MP(a,"r180")).filter(x=>x!=null))}))
      .sort((a,b)=>b.r180-a.r180);
    if(!rows.length)return;
    segC.appendChild(el("div","sec-title",lab));
    const t=el("table");const tr=el("tr");["Segment","Assets","Median MoM","Median 6m"].forEach(h=>{const th=document.createElement("th");th.textContent=h;tr.appendChild(th);});t.appendChild(tr);
    rows.slice(0,8).forEach(r=>{const trr=el("tr");
      trr.appendChild(el("td",null,r.k));trr.appendChild(el("td",null,String(r.n)));
      const t1=document.createElement("td");t1.appendChild(deltaSpan(r.mom));trr.appendChild(t1);
      const t2=document.createElement("td");t2.appendChild(deltaSpan(r.r180));trr.appendChild(t2);
      t.appendChild(trr);});
    segC.appendChild(t);});
  box.appendChild(segC);
  // full table
  box.appendChild(el("div","sec-title","All tracked "+(isS?"singles":"sealed products"),));
  const tc=el("div","card");assetTable(tc,pool);box.appendChild(tc);
}
function median(arr){if(!arr.length)return null;const s=[...arr].sort((a,b)=>a-b);
  return s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2;}

/* ================= RANKINGS ================= */
function vRankings(box){
  box.appendChild(el("div","h1","Rankings"));
  box.appendChild(el("div","sub","All boards are computed from real TCGplayer history and eligibility-gated: minimum price, ≥120 days of real data, ≥70% coverage, minimum confidence. Monthly boards rank by the Meaningful Move Score — a blend of percentage AND dollar movement — so a $0.01 → $0.21 card never tops the list."));
  const f=el("div","filters");
  pills(f,"Price band",SEGS.map(s=>[s[0],s[1]]),state.seg,id=>{state.seg=id;render();});
  f.appendChild(el("span","fl"," · Class"));
  pills(f,null,[["all","All"],["single","Singles"],["sealed","Sealed"]],state.cls,id=>{state.cls=id;render();});
  box.appendChild(f);
  const g=el("div","grid g3");
  BOARDS.forEach(b=>g.appendChild(boardCard(b,state.seg,state.cls)));
  box.appendChild(g);
  // character/set/era aggregates
  box.appendChild(el("div","sec-title","Best performers by group ",));
  const ag=el("div","grid g3");
  [["Characters",DATA.aggregates.characters],["Sets",DATA.aggregates.sets],["Eras & product types",[...DATA.aggregates.eras,...DATA.aggregates.kinds]]].forEach(([t,rows])=>{
    const c=el("div","card");c.appendChild(el("h3",null,t));
    c.appendChild(el("div","hint","Median 3-month return across tracked assets"));
    const tb=el("table");const tr=el("tr");["Group","N","3m med."].forEach(h=>{const th=document.createElement("th");th.textContent=h;tr.appendChild(th);});tb.appendChild(tr);
    rows.slice(0,10).forEach(r=>{const trr=el("tr");
      trr.appendChild(el("td",null,r.name));trr.appendChild(el("td",null,String(r.count)));
      const td=document.createElement("td");td.appendChild(deltaSpan(r.medR90));trr.appendChild(td);tb.appendChild(trr);});
    c.appendChild(tb);ag.appendChild(c);});
  box.appendChild(ag);
}

/* ================= INDEXES ================= */
function vIndexes(box){
  box.appendChild(el("div","h1","Market indexes"));
  box.appendChild(el("div","sub","Transparent, rules-based baskets. Cap-weighted indexes cap any single asset at 10% so one trophy card can't distort the read; character and format indexes are equal-weighted. Trophy assets and mid-window releases are excluded."));
  const g=el("div","grid g2");
  DATA.indexes.forEach(ix=>{
    const c=el("div","card idxcard");const top=el("div");top.style.cssText="display:flex;justify-content:space-between;gap:10px";
    const l=el("div");
    const nrow=el("div");nrow.style.cssText="display:flex;align-items:center;gap:8px;flex-wrap:wrap";
    const nm=el("button");nm.style.cssText="font-size:14.5px;font-weight:700;padding:0";
    nm.textContent=ix.name;nm.onclick=()=>go("index",ix.id);nrow.appendChild(nm);
    if(ix.temp)nrow.appendChild(tempChip(ix.temp,true));l.appendChild(nrow);
    l.appendChild(el("div","grow",grow100(ix.level)));
    l.appendChild(el("div","hint","If you'd put $100 into this basket in "+(META.windowLabel||"Jan 2025")+" · "+ix.members.length+" members · "+ix.weighting));
    top.appendChild(l);
    const rv=el("div");rv.style.textAlign="right";
    const d=el("div","delta "+pcls(ix.r30));d.textContent=fp(ix.r30)+" · 30d";rv.appendChild(d);
    const d2=el("div","note");d2.textContent="level "+ix.level.toFixed(1);rv.appendChild(d2);
    top.appendChild(rv);c.appendChild(top);
    const sp=el("div");sp.style.marginTop="8px";sp.appendChild(spark(ix.series.map((v,j)=>[j,v]),260,36,cssv("--s1")));c.appendChild(sp);
    g.appendChild(c);});
  box.appendChild(g);
}
function vIndexDetail(box){
  const ix=DATA.indexes.find(i=>i.id===state.param);if(!ix)return vIndexes(box);
  const bk=el("button","iconbtn","← All indexes");bk.onclick=()=>go("indexes");box.appendChild(bk);
  box.appendChild(el("div","h1",ix.name));
  box.appendChild(el("div","sub",ix.desc+" — "+ix.weighting+", "+ix.members.length+" members. Level "+ix.level.toFixed(1)+" (Jan 2025 = 100)."));
  const c=el("div","card");const cb=el("div");c.appendChild(cb);box.appendChild(c);
  setTimeout(()=>lineChart(cb,[{name:ix.name,color:SER()[0],pts:ix.series.map((v,j)=>[Math.min(j*7,N_DAYS-1),v])}],{h:280,area:true,yFmt:v=>v.toFixed(0)}),0);
  box.appendChild(el("div","sec-title","Members"));
  const tc=el("div","card");assetTable(tc,ix.members.map(id=>BYID[id]).filter(Boolean));box.appendChild(tc);
}

/* ================= SCREENER ================= */
const scr={type:"all",era:"all",cond:"all",seg:"all",minQual:0,minConf:0,minMom:0,q:""};
function vScreener(box){
  box.appendChild(el("div","h1","Screener"));
  box.appendChild(el("div","sub","Filter the full universe by asset class, era, grading status, price band and minimum scores. Click any column to sort."));
  const f=el("div","filters");
  pills(f,"Class",[["all","All"],["single","Singles"],["sealed","Sealed"]],scr.type,v=>{scr.type=v;render();});
  pills(f,"Era",[["all","All"],["vintage","Vintage"],["modern","Modern"]],scr.era,v=>{scr.era=v;render();});
  pills(f,"Condition",[["all","All"],["raw","Raw"],["sealed","Sealed"]],scr.cond,v=>{scr.cond=v;render();});
  box.appendChild(f);
  const f2=el("div","filters");
  pills(f2,"Price",SEGS.map(s=>[s[0],s[1]]),scr.seg,v=>{scr.seg=v;render();});
  box.appendChild(f2);
  const f3=el("div","filters");
  [["Min quality","minQual"],["Min confidence","minConf"],["Min momentum","minMom"]].forEach(([lab,key])=>{
    f3.appendChild(el("span","fl",lab+" "+scr[key]));
    const r=el("input");r.type="range";r.min=0;r.max=90;r.step=5;r.value=scr[key];
    r.oninput=()=>{scr[key]=+r.value;draw();};f3.appendChild(r);});
  box.appendChild(f3);
  const tc=el("div","card");box.appendChild(tc);
  const count=el("div","hint");box.insertBefore(count,tc);
  function pool(){return ASSETS.filter(a=>
    (scr.type==="all"||a.type===scr.type)&&
    (scr.era==="all"||a.era===scr.era)&&
    (scr.cond==="all"||a.cond===scr.cond)&&
    inSeg(a,scr.seg)&&
    a.scores.quality>=scr.minQual&&a.scores.confidence>=scr.minConf&&a.scores.momentum>=scr.minMom);}
  function draw(){tc.textContent="";const p=pool();
    count.textContent=p.length+" of "+ASSETS.length+" assets match";
    assetTable(tc,p,{cols:[
      ["Asset",null],["Price",a=>fm(a.price)],["30d",a=>MP(a,"r30")],["MoM",a=>MP(a,"mom")],["6m",a=>MP(a,"r180")],
      ["Mom.",a=>Math.round(a.scores.momentum)],["Spread",a=>M(a,"spreadPct")!=null?M(a,"spreadPct")+"%":"–"],
      ["Volat.",a=>Math.round(a.scores.volatility)],["Qual",a=>Math.round(a.scores.quality)],
      ["Conf",a=>Math.round(a.scores.confidence)],["Trend",null]]});}
  draw();
}

/* ================= COMPARE ================= */
function vCompare(box){
  state.compare=state.compare.filter(id=>BYID[id]);
  for(const a of ASSETS){if(state.compare.length>=2)break;
    if(!state.compare.includes(a.id))state.compare.push(a.id);}
  box.appendChild(el("div","h1","Compare"));
  box.appendChild(el("div","sub","Up to four assets on one normalized chart (each = 100 at the start of the range). Comparing raw vs graded, a box vs its chase card, or vintage vs modern shows relative performance regardless of price level."));
  const f=el("div","filters");
  state.compare.forEach((id,i)=>{
    const sel=document.createElement("select");
    const opt0=document.createElement("option");opt0.value="";opt0.textContent="— remove —";sel.appendChild(opt0);
    ASSETS.forEach(a=>{const o=document.createElement("option");o.value=a.id;
      o.textContent=a.name+(a.cond==="graded"?` (${a.gradeCo} ${a.grade})`:"")+" — "+a.set;
      if(a.id===id)o.selected=true;sel.appendChild(o);});
    sel.onchange=()=>{if(sel.value)state.compare[i]=sel.value;else state.compare.splice(i,1);render();};
    f.appendChild(sel);});
  if(state.compare.length<4){const add=el("button","pill","+ Add asset");
    add.onclick=()=>{const pick=ASSETS.find(a=>!state.compare.includes(a.id));state.compare.push(pick.id);render();};
    f.appendChild(add);}
  const rb=el("div","rangebtns");
  [["3M",90],["6M",180],["1Y",365],["All",N_DAYS]].forEach(([lab,d])=>{
    const b=el("button",state.cmpRange===d?"on":"",lab);b.onclick=()=>{state.cmpRange=d;render();};rb.appendChild(b);});
  f.appendChild(rb);box.appendChild(f);
  const c=el("div","card");const cb=el("div");c.appendChild(cb);box.appendChild(c);
  const S=SER();
  const series=state.compare.map((id,i)=>{const a=BYID[id];
    return {name:a.name+(a.cond==="graded"?` ${a.gradeCo} ${a.grade}`:""),color:S[i],pts:sliceRange(a,state.cmpRange)};});
  setTimeout(()=>lineChart(cb,series,{h:300,normalized:true,yFmt:v=>v.toFixed(0)}),0);
  // side-by-side metrics
  box.appendChild(el("div","sec-title","Side by side"));
  const tc=el("div","card tablewrap");const t=el("table");
  const rows=[["Price",a=>fm(a.price)],["30d",a=>fp(MP(a,"r30"))],["MoM",a=>fp(MP(a,"mom"))],["6m",a=>fp(MP(a,"r180"))],
    ["Since Jan 2025",a=>fp(MP(a,"window"),0)],
    ["From high",a=>fp(a.metrics.ath.fromPct)],["Volatility (90d, ann.)",a=>(a.metrics.vol90??"–")+"%"],
    ["Listed spread",a=>a.metrics.spreadPct!=null?a.metrics.spreadPct+"%":"–"],
    ["Momentum",a=>Math.round(a.scores.momentum)],["Quality",a=>Math.round(a.scores.quality)],
    ["Confidence",a=>Math.round(a.scores.confidence)],["Real data days",a=>a.metrics.realDays]];
  const tr=el("tr");const th0=document.createElement("th");th0.textContent="Metric";tr.appendChild(th0);
  state.compare.forEach(id=>{const th=document.createElement("th");th.textContent=BYID[id].name;tr.appendChild(th);});
  t.appendChild(tr);
  rows.forEach(([lab,fn])=>{const trr=el("tr");trr.appendChild(el("td",null,lab));
    state.compare.forEach(id=>{const td=document.createElement("td");const v=fn(BYID[id]);
      td.textContent=v;if(String(v).startsWith("+"))td.className="up";if(String(v).startsWith("-"))td.className="down";
      trr.appendChild(td);});t.appendChild(trr);});
  tc.appendChild(t);box.appendChild(tc);
}

/* ================= WATCHLIST ================= */
function vWatchlist(box){
  box.appendChild(el("div","h1","Watchlist"));
  box.appendChild(el("div","sub","Starred assets. In this demo the list lives in memory for the session; the production build would persist it to your account."));
  const list=[...state.watch].map(id=>BYID[id]).filter(Boolean);
  const c=el("div","card");
  if(!list.length)c.appendChild(el("div","empty","Nothing starred yet — click the ☆ next to any asset."));
  else assetTable(c,list);
  box.appendChild(c);
}

/* ================= ALERTS ================= */
function vAlerts(box){
  box.appendChild(el("div","h1","Alert center"));
  box.appendChild(el("div","sub","Rule-based alerts on price, volume, moving averages, highs/lows and marketplace divergence. In production these fire by push or e-mail; here the engine runs against today's data."));
  const g=el("div","grid g2");
  // triggered signals
  const trig=el("div","card");trig.appendChild(el("h3",null,"Triggered today"));
  const fired=[];
  ASSETS.forEach(a=>{const m=a.metrics;
    if(m.ath.fromPct>-1.5&&a.eligible.eligible)fired.push([a,"New window-high territory"]);
    if(m.vsMa50!=null&&Math.abs(m.vsMa50)<1&&a.scores.momentum>55)fired.push([a,"Testing 50-day average from above"]);
    if((MP(a,"r7")||0)>8)fired.push([a,`Sharp week: ${fp(MP(a,"r7"))} in 7 days`]);
    if((m.vsMa200||0)>35&&a.eligible.eligible)fired.push([a,`Overextended: ${fp(m.vsMa200,0)} vs 200-day average`]);});
  fired.slice(0,12).forEach(([a,txt])=>{const r=el("button","row");
    r.style.cssText="display:flex;justify-content:space-between;gap:8px;width:100%;padding:8px 2px;border-top:1px solid var(--grid);text-align:left";
    const l=el("span");l.appendChild(el("b",null,a.name));l.appendChild(el("span","note"," · "+txt));
    r.appendChild(l);r.appendChild(el("span","mono",fm(a.price)));
    r.onclick=()=>go("product",a.id);trig.appendChild(r);});
  g.appendChild(trig);
  // my alerts
  const mine=el("div","card");mine.appendChild(el("h3",null,"My alert rules"));
  state.alerts.forEach((al,i)=>{const a=BYID[al.asset];
    const r=el("div");r.style.cssText="display:flex;justify-content:space-between;gap:8px;padding:8px 2px;border-top:1px solid var(--grid)";
    const l=el("span");l.appendChild(el("b",null,a.name));
    l.appendChild(el("span","note",` · ${al.type} ${fm(al.value)} — ${al.note}`));r.appendChild(l);
    const del=el("button","iconbtn","✕");del.onclick=()=>{state.alerts.splice(i,1);render();};r.appendChild(del);
    mine.appendChild(r);});
  const form=el("div","filters");form.style.marginTop="10px";
  const sel=document.createElement("select");ASSETS.forEach(a=>{const o=document.createElement("option");o.value=a.id;o.textContent=a.name+" — "+a.set;sel.appendChild(o);});
  const typ=document.createElement("select");["Price above","Price below","Volume spike","New high","MA50 cross"].forEach(t=>{const o=document.createElement("option");o.textContent=t;typ.appendChild(o);});
  const val=el("input");val.type="number";val.placeholder="value";val.style.width="90px";
  const addb=el("button","pill on","Add alert");
  addb.onclick=()=>{state.alerts.push({asset:sel.value,type:typ.value,value:+val.value||0,note:"custom"});render();};
  form.append(sel,typ,val,addb);mine.appendChild(form);
  g.appendChild(mine);box.appendChild(g);
}

/* ================= METHODOLOGY ================= */
function vMethod(box){
  box.appendChild(el("div","h1","Methodology & data quality"));
  box.appendChild(el("div","sub","Every score, threshold and index rule — in plain language. If a number can't be explained, it doesn't ship."));
  const order=["dataStatus","momentum","volatility","stability","spread","confidence","quality","breakout","meaningfulMove","eligibility","indexes","scenarios"];
  const g=el("div","grid g2");
  order.forEach(k=>{if(!DATA.methodology[k])return;
    const c=el("div","card");c.appendChild(el("h3",null,{dataStatus:"Data status — what's real, what's absent",momentum:"Market Momentum Score",volatility:"Volatility Score",stability:"Stability Score",spread:"Spread Tightness",confidence:"Price Confidence Rating",quality:"Investment Quality Score",breakout:"Breakout Probability",meaningfulMove:"Meaningful Move Score",eligibility:"Ranking eligibility",indexes:"Index construction",scenarios:"Scenario engine"}[k]));
    c.appendChild(el("div","note",DATA.methodology[k]));g.appendChild(c);});
  box.appendChild(g);
  box.appendChild(el("div","sec-title","Data sources & quality controls"));
  const c=el("div","card");
  const items=[
    ["Source","Daily TCGplayer prices (market, low, mid, high, direct-low per printing) mirrored by tcgcsv.com, collected by your own GitHub repository ("+META.repo+") every evening and backfilled from tcgcsv's archives to Jan 1, 2025."],
    ["Coverage","Every asset shows its real-data day count and coverage %. Thin markets (e.g. vintage sealed boxes with sporadic listings) are flagged as trophy assets and excluded from momentum boards rather than smoothed over."],
    ["Forward-fill","Days where a thin asset had no quoted market price carry the last real price forward on charts; volatility calculations skip those flat runs so they don't understate risk."],
    ["Not yet collected","Sales counts, listing depth, eBay sold prices, and graded-card values. Metrics that need them (liquidity, demand, marketplace divergence, graded premiums) are hidden — never estimated. They activate when those sources are added to the collector."],
    ["What this is not","Model scenarios are estimates, not predictions. Nothing in this terminal is financial advice."]];
  items.forEach(([t,d])=>{const kv=el("div");kv.style.padding="8px 0";
    kv.appendChild(el("b",null,t+" — "));kv.appendChild(el("span","note",d));c.appendChild(kv);});
  box.appendChild(c);
}

/* ================= MARKET MAP (treemap) ================= */
const mapState={drill:null,cls:"all",metric:"r30"};
function vMarketMap(box){
  box.appendChild(el("div","h1","Market map"));
  box.appendChild(el("div","sub","Every tile is sized by tracked market value and colored by price change — green rising, red falling, with the % printed on every readable tile. Click a set to drill into its cards; click a card for its full page."));
  const f=el("div","filters");
  pills(f,"Class",[["all","All"],["single","Singles"],["sealed","Sealed"]],mapState.cls,v=>{mapState.cls=v;mapState.drill=null;render();});
  pills(f,"Color by",[["r30","30-day change"],["mom","Month-over-month"],["r90","3-month change"]],mapState.metric,v=>{mapState.metric=v;render();});
  if(mapState.drill){const back=el("button","pill on","← All sets");back.onclick=()=>{mapState.drill=null;render();};f.appendChild(back);}
  box.appendChild(f);
  const card=el("div","card");const holder=el("div","treemap");card.appendChild(holder);box.appendChild(card);
  const leg=el("div","tm-legend");
  leg.appendChild(el("span",null,"falling"));
  [-12,-6,0,6,12].forEach(v=>{const sw=el("span","sw");sw.style.background=heatColor(v,1.4);leg.appendChild(sw);});
  leg.appendChild(el("span",null,"rising · tile size = tracked value ("+(mapState.drill?"price":"sum of set's tracked prices")+")"));
  card.appendChild(leg);
  const mval=a=>{const mm=a.metrics[mapState.metric];return mm?mm.pct:null;};
  const pool=ASSETS.filter(a=>(mapState.cls==="all"||a.type===mapState.cls)&&!a.trophy);
  setTimeout(()=>{
    const W=holder.clientWidth||900,H=Math.min(640,Math.max(430,W*0.52));
    holder.style.height=H+"px";
    let tiles;
    if(!mapState.drill){
      const groups={};
      pool.forEach(a=>{const g=groups[a.set]=groups[a.set]||{name:a.set,v:0,items:[],rs:[]};
        g.v+=a.price;g.items.push(a);const r=mval(a);if(r!=null)g.rs.push(r);});
      tiles=Object.values(groups).filter(g=>g.v>50&&g.items.length>=1)
        .map(g=>({name:g.name,v:g.v,pct:median(g.rs),n:g.items.length,drill:g.name}))
        .sort((x,y)=>y.v-x.v).slice(0,48);
    }else{
      tiles=pool.filter(a=>a.set===mapState.drill)
        .map(a=>({name:a.name,v:a.price,pct:mval(a),id:a.id,price:a.price,asset:a}))
        .sort((x,y)=>y.v-x.v).slice(0,80);
    }
    if(!tiles.length){holder.appendChild(el("div","empty","Nothing to map with these filters"));return;}
    squarify(tiles,0,0,W,H);
    tiles.forEach(t=>{
      const d=el("div","tmtile");
      d.style.left=t.x+"px";d.style.top=t.y+"px";d.style.width=t.w+"px";d.style.height=t.h+"px";
      d.style.background=heatColor(t.pct,1.4);
      const big=t.w>70&&t.h>44;
      if(big){d.appendChild(el("div","tn",t.name));
        const bot=el("div","tv",fp(t.pct));d.appendChild(bot);}
      d.addEventListener("pointermove",ev=>showTip(ev.clientX,ev.clientY,tp=>{
        if(t.asset){const im=cardImg(t.asset,"200x200");if(im){im.style.cssText="width:64px;height:64px;object-fit:contain;display:block;margin-bottom:5px";tp.appendChild(im);}}
        tp.appendChild(el("div","tdate",t.name));
        const r1=el("div","trow");r1.appendChild(el("span","tn",mapState.drill?"Price":"Tracked value"));
        r1.appendChild(el("span","tv",fmc(t.price!=null?t.price:t.v)));tp.appendChild(r1);
        const r2=el("div","trow");r2.appendChild(el("span","tn",{r30:"30-day",mom:"MoM",r90:"3-month"}[mapState.metric]));
        r2.appendChild(el("span","tv "+pcls(t.pct),fp(t.pct)));tp.appendChild(r2);
        if(t.n)tp.appendChild(el("div","tdate",t.n+" tracked assets — click to drill in"));}));
      d.addEventListener("pointerleave",hideTip);
      d.onclick=()=>{hideTip();if(t.drill){mapState.drill=t.drill;render();}else if(t.id)go("product",t.id);};
      holder.appendChild(d);});
  },0);
  box.appendChild(el("div","note","Accessibility note: change is encoded twice — color and the printed % on every readable tile; the same data lives in the Screener as a sortable table."));
}

/* ================= LEARN THE BASICS ================= */
function vLearn(box){
  box.appendChild(el("div","h1","Learn the basics"));
  box.appendChild(el("div","sub","Everything on this site, explained like you're smart but have never touched a stock chart. Three minutes. And remember: any dotted-underlined word anywhere on the site shows its meaning when you hover or tap it."));
  // 60-second version
  const c0=el("div","card");c0.appendChild(el("h3",null,"The 60-second version"));
  const sx=el("div","sixty");
  [["Every price here is real — what things actually sold for on TCGplayer, recorded every day since January 2025."],
   ["We track two different worlds: single cards, and factory-sealed products (boxes, ETBs). They rise and fall independently — so they're never mixed."],
   ["Big numbers are shown as growth of $100: \"$100 → $230\" means a $100 stake at the start would be $230 now. No finance degree required."],
   ["Temperature chips are the fastest read: 🔥 HOT means rising fast, ❄ COLD means falling hard, → STAGNANT means going sideways."],
   ["Scores run 0–100. Above ~65 is strong, below ~35 is weak, 50 is neutral. Hover any score for what it measures."],
   ["Anything the data can't support is hidden, not guessed — and model forecasts are always labeled as estimates."]]
   .forEach(([t])=>sx.appendChild(el("div",null,t)));
  c0.appendChild(sx);box.appendChild(c0);
  // concept groups
  const groups=[
   ["Prices & changes",[
    ["Market price","What this item actually sells for right now, based on completed TCGplayer sales — not the higher prices sellers *ask*.","Like a home's sale price vs its listing price."],
    ["30-day / 6-month change","Today's price versus 30 days or 6 months ago, as a percent. Green up, red down.","The 'how's it been going' number."],
    ["Month-over-month (MoM)","End of last month vs the month before. A clean calendar comparison that ignores mid-month wiggles.","Comparing photos taken on the 1st of each month."],
    ["Growth of $100","What $100 invested at the start (Jan 2025) would be worth today. It's our favorite way to show long-run performance.","$100 → $230 = it more than doubled."],
    ["Window high / low","The best and worst price since Jan 2025, and how far today sits from each.","'4% below its all-time best' tells you more than a raw price."]]],
   ["The weather system",[
    ["Temperature","One glance = one verdict. 🔥 HOT: rising fast, above trend. ↗ WARMING: gently rising. → STAGNANT: sideways. ↘ COOLING: drifting down. ❄ COLD: falling, below trend.","A weather report for a card."],
    ["Trend lines (50 & 200-day averages)","The price smoothed over the last 50 or 200 days. Price above its line = uptrend; below = downtrend. The dashed lines on every chart.","A moving 'usual price' the market keeps returning to."],
    ["Market breadth","What share of everything we track is above its own trend line. 70% = broad rally; 25% = weakness nearly everywhere.","Is the whole tide rising, or just a few boats?"]]],
   ["The scores (all 0–100)",[
    ["Momentum","Is it climbing right now? Blends the last week, month and quarter. 50 = flat.","A speedometer, not a destination."],
    ["Heat","Momentum plus proof: all horizons rising, above trend, near its high. Powers the 'Hottest' boards — hot means a confirmed run, not one lucky day.","The difference between a hot streak and a hot minute."],
    ["Volatility","How bumpy the ride is. High = big swings both ways — faster gains AND faster losses.","Rollercoaster rating."],
    ["Stability","The calm twin of volatility: high = steady lane, few surprises.","Good for sleeping at night."],
    ["Spread tightness","How closely listings hug the market price. Tight = you can actually buy or sell near the quote. Loose = the quote is soft; haggle.","A tight spread is a busy, honest marketplace stall."],
    ["Confidence","How much to trust the quoted price: daily data on most days + calm trading + tight listings = high trust.","Low confidence = squint at the number."],
    ["Investment quality","The 'could I comfortably hold this for a year?' blend: steady trend, calm price, trusted data, tight spread.","The buy-and-hold report card."],
    ["Breakout probability","The model's odds of a new high soon. A forecast — treat it like the weather app, not a promise.","70% chance of rain still means pack a jacket, not a guarantee."]]],
   ["Rankings, indexes & the map",[
    ["Eligibility rules","To appear in rankings an item needs: a $5+ price ($25 sealed), a real price most days, 4+ months of history. This keeps junk and flukes off the boards.","Bouncer at the leaderboard door."],
    ["Meaningful moves","Gainer/loser boards weigh percent AND dollars, so a 1¢ card tripling never outranks a $600 card gaining $200.","Percent alone lies; dollars keep it honest."],
    ["Index","Many items tracked as one basket-number, like the S&P 500. We show it as growth of $100; the raw 'level' started at 100 in Jan 2025.","The market's team score instead of one player's."],
    ["The four markets","Sealed vs singles, vintage vs modern — measured correlations are near zero, so we treat them as four separate markets with their own panels and leaders.","Four different games being played on one field."],
    ["Market map","Rectangles sized by tracked money, colored by change (green up, red down). Click a set to see its cards.","A satellite photo of the whole market."]]],
   ["Honesty labels",[
    ["Thin market","Rarely-traded items (like vintage booster boxes) get flagged: one sale can move their price a lot, so they're excluded from momentum boards.","Small pond, big splashes."],
    ["Coverage","The share of days an item actually had a price. Low coverage = sporadic, less trustworthy data.","Attendance record for the data."],
    ["Scenarios (bull / base / bear)","Three model-projected 6-month paths from current trend and choppiness. Estimates that frame thinking — never guarantees.","Optimist, realist, pessimist — all three shown."],
    ["What we don't know yet","Sales counts, listing depth, eBay prices and graded-card values aren't collected yet. Anything needing them is hidden — never faked.","If a number would be a guess, you won't see a number."]]],
  ];
  groups.forEach(([title,items])=>{
    box.appendChild(el("div","sec-title",title));
    const g=el("div","learn-grid");
    items.forEach(([term,body,analogy])=>{
      const lc=el("div","learn-card");lc.appendChild(el("b",null,term));
      lc.appendChild(el("p",null,body));
      lc.appendChild(el("div","good","💡 "+analogy));
      g.appendChild(lc);});
    box.appendChild(g);});
  // reading a product page
  box.appendChild(el("div","sec-title","How to read a card's page, top to bottom"));
  const rp=el("div","card");const ol=el("ul","risklist");
  ["Header: the card, its temperature, today's market price, and how it's moved (7 days → 1 year).",
   "Score chips: the 0–100 report card. Hover any chip for its meaning.",
   "The chart: real daily prices with its 50/200-day trend lines. Use the range buttons (1M → All).",
   "Listing structure: how today's listings are priced — a tight low-to-mid gap means the quote is solid.",
   "Data coverage: how many real price days back this up, and what isn't collected yet.",
   "Performance table: every time window, in % and dollars.",
   "Scenarios: the model's bull / base / bear 6-month sketch — estimates, clearly labeled.",
   "Key risks: what could go wrong, in plain words.",
   "Comparables: similar cards, one click away."].forEach(t=>ol.appendChild(el("li",null,t)));
  rp.appendChild(ol);box.appendChild(rp);
  const cta=el("div","callout");cta.style.marginTop="14px";
  cta.appendChild(document.createTextNode("Want the exact formulas behind every score? They're all published on the "));
  const lk=el("a",null,"Methodology page");lk.href="#";lk.onclick=e=>{e.preventDefault();go("methodology");};
  cta.appendChild(lk);cta.appendChild(document.createTextNode(". Nothing here is financial advice — it's a very well-organized telescope."));
  box.appendChild(cta);
}
