/* ================= PokeQuant views ================= */
"use strict";
const NAV=[["sec","Markets"],["home","⌂","Home"],["overview","◈","Market overview"],["news","◉","Market news"],["hotcold","♨","Hot & Cold"],["map","▩","Market map"],["eras","▣","Era dashboards"],
  ["singles","▤","Singles desk"],["sealed","▦","Sealed desk"],
  ["rankings","≡","Rankings"],["indexes","∿","Indexes"],
  ["sec","Research"],["screener","⌕","Screener"],["support","▁","Support lines"],["compare","⇄","Compare"],["alerts","◷","Alert center"],
  ["sec","My desk"],["watchlist","★","Watchlist"],["portfolio","▥","Portfolio"],
  ["sec","About"],["learn","✦","Learn the basics"],["methodology","ⓘ","Methodology (advanced)"]];

function render(){
  const root=$("#app");root.textContent="";
  const shell=el("div","shell");
  // sidebar
  const sb=el("aside","sidebar");
  const brand=el("div","brand");brand.appendChild(el("div","logo"));
  const bt=el("div");const b=el("b",null,"PMT");bt.appendChild(b);
  bt.appendChild(el("small",null,"Analytics & Tracking Tool"));brand.appendChild(bt);sb.appendChild(brand);
  const nav=el("nav","nav");
  NAV.forEach(item=>{if(item[0]==="sec"){nav.appendChild(el("div","sec",item[1]));return;}
    const [id,ic,label]=item;const btn=el("button",state.view===id?"on":"");
    btn.appendChild(el("span","ic",ic));btn.appendChild(el("span",null,label));
    btn.onclick=()=>go(id);nav.appendChild(btn);});
  sb.appendChild(nav);
  if(location.protocol.startsWith("http")){
    const dl=el("a",null,"⬇ Offline snapshot");dl.href="PMT-Snapshot.html";
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
  badge.innerHTML="<b style='color:var(--good)'>LIVE</b> · updated "+(META.builtAt||META.generated)+" · "+META.days+" days of real history";
  badge.title=META.disclaimer;tb.appendChild(badge);
  const th=el("button","iconbtn",state.theme==="dark"?"☀ Light":"☾ Dark");
  th.onclick=()=>setTheme(state.theme==="dark"?"light":"dark");tb.appendChild(th);
  main.appendChild(tb);
  const body=el("div");main.appendChild(body);
  shell.appendChild(main);root.appendChild(shell);
  const V={home:vHome,news:vNews,overview:vOverview,map:vMarketMap,hotcold:vHotCold,eras:vEras,era:vEraDetail,support:vSupport,
    singles:b=>vDesk(b,"single"),sealed:b=>vDesk(b,"sealed"),rankings:vRankings,
    indexes:vIndexes,screener:vScreener,compare:vCompare,watchlist:vWatchlist,portfolio:vPortfolio,
    alerts:vAlerts,learn:vLearn,methodology:vMethod,product:vProduct,index:vIndexDetail};
  (V[state.view]||vHome)(body);
  const subEl=body.querySelector(".sub");
  if(subEl&&PAGE_HELP[state.view]&&PAGE_HELP[state.view].length)subEl.after(helpBar(state.view));
  const foot=el("div","footer-note");foot.textContent=META.disclaimer;main.appendChild(foot);
}

/* ---------- shared: asset table ---------- */
function starBtn(a){const s=el("button","star"+(state.watch.has(a.id)?" on":""),state.watch.has(a.id)?"★":"☆");
  s.title="Toggle watchlist";s.setAttribute("aria-label","Toggle watchlist");
  s.onclick=ev=>{ev.stopPropagation();state.watch.has(a.id)?state.watch.delete(a.id):state.watch.add(a.id);saveDesk();render();};
  return s;}
function nameCell(a){const c=el("div","namecell");c.appendChild(starBtn(a));
  const w=el("div");const nm=el("div","nm",a.name);
  w.appendChild(nm);const sm=el("small",null,`${a.set} · ${a.subEra}${a.lang==="JP"?" · JP":""}${a.trophy?" · thin market":""}${state.notes&&state.notes[a.id]?" · 📝":""}`);
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
        else if(c[0]==="Trend")td.appendChild(sparkArr(a));
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
function pillsMulti(box,label,options,set,onchange){
  // multi-select: "All" pill clears; clicking an option toggles it
  if(label)box.appendChild(el("span","fl",label));
  const all=el("button","pill"+(set.size?"":" on"),"All");
  all.onclick=()=>{set.clear();onchange();};box.appendChild(all);
  options.forEach(id=>{const p=el("button","pill"+(set.has(id)?" on":""),id);
    p.title="Click to toggle — combine as many as you like";
    p.onclick=()=>{set.has(id)?set.delete(id):set.add(id);onchange();};box.appendChild(p);});}

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
  const items=boardItems(b,seg,cls,8,state.view==="rankings"?state.eras:null);
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
  // segmentation: one compact card, dimension picked by pills, signed bars
  box.appendChild(el("div","sec-title",isS?"Performance by segment":"Performance by product type"));
  const ds=deskState[type];
  const segC=el("div","card");
  const dims=isS
    ?[["Era",a=>a.subEra],["Character",a=>a.character],["Set",a=>a.set],["Language",a=>a.lang==="JP"?"Japanese":"English"]]
    :[["Product type",a=>a.kind],["Era",a=>a.subEra],["Language",a=>a.lang==="JP"?"Japanese":"English"]];
  const fseg=el("div","filters");
  pills(fseg,"Group by",dims.map((d,i)=>[String(i),d[0]]),String(ds.dim),v=>{ds.dim=+v;render();});
  fseg.appendChild(el("span","fl"," · median 6-month change per group"));
  segC.appendChild(fseg);
  const fn=dims[ds.dim][1];
  const groups={};pool.forEach(a=>{const k=fn(a);if(!k)return;(groups[k]=groups[k]||[]).push(a);});
  const rows=Object.entries(groups).filter(([,v])=>v.length>=2).map(([k,v])=>({k,n:v.length,
    r180:median(v.map(a=>MP(a,"r180")).filter(x=>x!=null))})).filter(r=>r.r180!=null)
    .sort((a,b)=>b.r180-a.r180).slice(0,12);
  if(rows.length){
    const mx=Math.max(...rows.map(r=>Math.abs(r.r180)))||1;
    rows.forEach(r=>{const row=el("div","segrow");
      row.appendChild(el("span","sl",r.k+" ("+r.n+")"));
      const track=el("span","st");
      const bar=el("i",r.r180>=0?"pos":"neg");
      bar.style.width=(Math.abs(r.r180)/mx*50)+"%";
      bar.style[r.r180>=0?"left":"right"]="50%";
      track.appendChild(bar);
      const mid=el("b");track.appendChild(mid);row.appendChild(track);
      const v=el("span","sv "+pcls(r.r180));v.textContent=fp(r.r180,0);row.appendChild(v);
      segC.appendChild(row);});
  }else segC.appendChild(el("div","empty","Not enough data for this grouping"));
  box.appendChild(segC);
  // full table with its own filters
  box.appendChild(el("div","sec-title","All tracked "+(isS?"singles":"sealed products"),));
  const ft=el("div","filters");
  const q=el("input");q.placeholder="Filter by name, set, character…";q.value=ds.q;q.style.minWidth="220px";
  q.oninput=()=>{ds.q=q.value;drawTbl();};ft.appendChild(q);
  pills(ft,"Price",SEGS.map(s=>[s[0],s[1]]),ds.seg,v=>{ds.seg=v;render();});
  box.appendChild(ft);
  const ft2=el("div","filters");
  pillsMulti(ft2,"Era",erasPresent(),ds.eras,()=>render());
  pills(ft2," · Language",[["all","All"],["EN","English"],["JP","Japanese"]],ds.lang,v=>{ds.lang=v;render();});
  box.appendChild(ft2);
  const count=el("div","hint");box.appendChild(count);
  const tc=el("div","card");box.appendChild(tc);
  function fpool(){const needle=ds.q.trim().toLowerCase();
    return pool.filter(a=>
      inSeg(a,ds.seg)&&
      (!ds.eras.size||ds.eras.has(a.subEra))&&
      (ds.lang==="all"||a.lang===ds.lang)&&
      (!needle||(a.name+" "+a.set+" "+(a.character||"")).toLowerCase().includes(needle)));}
  function drawTbl(){tc.textContent="";const p=fpool();
    count.textContent=p.length+" of "+pool.length+" shown";
    if(!p.length)tc.appendChild(el("div","empty","Nothing matches these filters"));
    else assetTable(tc,p);}
  drawTbl();
}
const deskState={single:{dim:0,q:"",eras:new Set(),lang:"all",seg:"all"},
                 sealed:{dim:0,q:"",eras:new Set(),lang:"all",seg:"all"}};
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
  const f2=el("div","filters");
  pillsMulti(f2,"Era (multi-select)",erasPresent(),state.eras,()=>render());
  box.appendChild(f2);
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
  pills(f,"Language",[["all","All"],["EN","English"],["JP","Japanese"]],scr.lang||"all",v=>{scr.lang=v;render();});
  box.appendChild(f);
  const fEra=el("div","filters");
  pillsMulti(fEra,"Era (multi-select)",erasPresent(),scr.subEras=scr.subEras||new Set(),()=>render());
  box.appendChild(fEra);
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
    ((scr.lang||"all")==="all"||a.lang===scr.lang)&&
    (!scr.subEras||!scr.subEras.size||scr.subEras.has(a.subEra))&&
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
  cb.appendChild(el("div","empty","Loading charts…"));
  Promise.all(state.compare.map(id=>loadSeries(BYID[id]))).then(()=>{
    const series=state.compare.map((id,i)=>{const a=BYID[id];
      return {name:a.name,color:S[i],pts:sliceRange(a,state.cmpRange)};});
    lineChart(cb,series,{h:300,normalized:true,yFmt:v=>v.toFixed(0)});});
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
  box.appendChild(el("div","sub","Starred assets — saved automatically in this browser, so your list is here every time you come back. Use the buttons below to back it up or move it to another device."));
  const list=[...state.watch].map(id=>BYID[id]).filter(Boolean);
  const c=el("div","card");
  if(!list.length)c.appendChild(el("div","empty","Nothing starred yet — click the ☆ next to any asset."));
  else assetTable(c,list);
  box.appendChild(c);
  // notes overview
  const noted=Object.keys(state.notes||{}).filter(id=>BYID[id]&&state.notes[id].trim());
  if(noted.length){
    box.appendChild(el("div","sec-title","My research notes"));
    const nc=el("div","card");
    noted.forEach(id=>{const a=BYID[id];
      const r=el("button","newsrow");r.onclick=()=>go("product",id);
      const im=cardImg(a,"200x200");if(im)r.appendChild(im);
      const tx=el("span");tx.style.cssText="flex:1;min-width:0";
      const l1=el("div");l1.appendChild(el("b",null,a.name));l1.appendChild(el("small",null," · "+a.set));tx.appendChild(l1);
      tx.appendChild(el("div","newstext",state.notes[id].slice(0,220)));
      r.appendChild(tx);nc.appendChild(r);});
    box.appendChild(nc);}
  // desk management
  const dm=el("div","card");dm.style.marginTop="14px";
  dm.appendChild(el("h3",null,"Your desk"));
  dm.appendChild(el("div","hint","Watchlist, alerts, portfolio, notes and settings save automatically in this browser. Back them up or move them to another device:"));
  const row=el("div","filters");
  const ex=el("button","pill on","⬇ Export desk backup");ex.onclick=exportDesk;row.appendChild(ex);
  const imp=el("button","pill","⬆ Import backup");
  const fi=document.createElement("input");fi.type="file";fi.accept=".json";fi.style.display="none";
  fi.onchange=()=>fi.files[0]&&importDesk(fi.files[0]);
  imp.onclick=()=>fi.click();row.appendChild(imp);row.appendChild(fi);
  dm.appendChild(row);box.appendChild(dm);
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
    const del=el("button","iconbtn","✕");del.onclick=()=>{state.alerts.splice(i,1);saveDesk();render();};r.appendChild(del);
    mine.appendChild(r);});
  const form=el("div","filters");form.style.marginTop="10px";
  const sel=document.createElement("select");ASSETS.forEach(a=>{const o=document.createElement("option");o.value=a.id;o.textContent=a.name+" — "+a.set;sel.appendChild(o);});
  const typ=document.createElement("select");["Price above","Price below","Volume spike","New high","MA50 cross"].forEach(t=>{const o=document.createElement("option");o.textContent=t;typ.appendChild(o);});
  const val=el("input");val.type="number";val.placeholder="value";val.style.width="90px";
  const addb=el("button","pill on","Add alert");
  addb.onclick=()=>{state.alerts.push({asset:sel.value,type:typ.value,value:+val.value||0,note:"custom"});saveDesk();render();};
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

/* ================= HOT & COLD (temperature transitions) ================= */
function moveRow(a,pathText){
  const btn=el("button","qmover");btn.style.width="100%";btn.onclick=()=>go("product",a.id);
  const im=cardImg(a,"200x200");if(im)btn.appendChild(im);
  const tx=el("span");tx.style.flex="1";tx.style.minWidth="0";
  const l1=el("div");l1.style.cssText="font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
  l1.textContent=a.name;tx.appendChild(l1);
  tx.appendChild(el("small",null,a.set+" · "+fm(a.price)+"  ·  "+pathText));
  btn.appendChild(tx);
  const v=deltaSpan(MP(a,"r30"));v.style.fontWeight="650";btn.appendChild(v);
  return btn;}
function vHotCold(box){
  box.appendChild(el("div","h1","Hot & Cold"));
  box.appendChild(el("div","sub","Temperature is the state; this page tracks the CHANGES — what's thawing, what's freezing, and what's been running hot or frozen for a month straight. Real prices, refreshed daily."));
  const elig=ASSETS.filter(a=>a.eligible.eligible&&a.scores.tempHist);
  const moves=elig.map(a=>({a,m:tempMove(a)}));
  // thermometer: distribution of temperatures
  const counts={hot:0,warming:0,stagnant:0,cooling:0,cold:0};
  elig.forEach(a=>counts[a.scores.temp]!=null&&counts[a.scores.temp]++);
  const tot=elig.length||1;
  const th=el("div","card");th.appendChild(el("h3",null,"Market thermometer — all "+tot+" eligible assets"));
  const bar=el("div");bar.style.cssText="display:flex;height:26px;border-radius:8px;overflow:hidden;margin:10px 0 6px";
  ["hot","warming","stagnant","cooling","cold"].forEach(k=>{
    const seg=el("div");seg.style.cssText="display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700;min-width:2px";
    seg.style.width=(counts[k]/tot*100)+"%";seg.style.background=TEMP[k].color;seg.style.color="#0d0d0d";
    if(counts[k]/tot>0.08)seg.textContent=Math.round(counts[k]/tot*100)+"%";
    seg.title=TEMP[k].label+": "+counts[k]+" assets";bar.appendChild(seg);});
  th.appendChild(bar);
  const lg=el("div","legend");
  ["hot","warming","stagnant","cooling","cold"].forEach(k=>{const li=el("span","li");
    const kk=el("i","key");kk.style.borderTopColor=TEMP[k].color;li.appendChild(kk);
    li.appendChild(document.createTextNode(TEMP[k].icon+" "+TEMP[k].label+" ("+counts[k]+")"));lg.appendChild(li);});
  th.appendChild(lg);box.appendChild(th);
  // sections
  const secs=[
   ["🔥 Turned HOT this week","Crossed into HOT within the last 7 days — fresh breakout candidates",
    moves.filter(x=>x.m.t==="hot"&&x.m.d7&&x.m.d7!=="hot").sort((x,y)=>(y.a.scores.heat||0)-(x.a.scores.heat||0))],
   ["🌡 Thawing","From COLD or COOLING a week ago to WARMING or better now — where stories start",
    moves.filter(x=>x.m.thawing).sort((x,y)=>MP(y.a,"r30")-MP(x.a,"r30"))],
   ["🧊 Freezing","From HOT or WARMING a week ago to COOLING or COLD now — momentum lost",
    moves.filter(x=>x.m.freezing).sort((x,y)=>MP(x.a,"r30")-MP(y.a,"r30"))],
   ["🔥🔥 Sustained heat","HOT today, a week ago, and a month ago — the marathon runners",
    moves.filter(x=>x.m.sustainedHot).sort((x,y)=>(y.a.scores.heat||0)-(x.a.scores.heat||0))],
   ["❄❄ Deep freeze","COLD for a month straight — falling knives or future bargains",
    moves.filter(x=>x.m.deepFreeze).sort((x,y)=>MP(x.a,"r30")-MP(y.a,"r30"))]];
  const g=el("div","grid g2");
  secs.forEach(([t,d,list])=>{
    const c=el("div","card");c.appendChild(el("h3",null,t));c.appendChild(el("div","hint",d));
    if(!list.length)c.appendChild(el("div","empty","Nothing in this state right now"));
    list.slice(0,7).forEach(({a,m})=>{
      const path=(m.d7?TEMP[m.d7].label:"–")+" → "+TEMP[m.t].label;
      c.appendChild(moveRow(a,path));});
    g.appendChild(c);});
  box.appendChild(g);
}

/* ================= ERA DASHBOARDS ================= */
function vEras(box){
  box.appendChild(el("div","h1","Era dashboards"));
  box.appendChild(el("div","sub","Every era of the Pokémon TCG as its own market — its index, temperature, and leaders. Click an era to open its dashboard."));
  const IX={};DATA.indexes.forEach(i=>IX[i.id]=i);
  const g=el("div","grid g3");
  erasPresent().forEach(e=>{
    const info=ERA_INFO[e]||[e,"",""];
    const pool=ASSETS.filter(a=>a.subEra===e);
    const ix=IX["idx_era_"+e.toLowerCase()];
    const c=el("div","card");c.style.cursor="pointer";c.onclick=()=>go("era",e);
    const hr=el("div");hr.style.cssText="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap";
    const nm=el("span");nm.style.cssText="font-size:15px;font-weight:750";nm.textContent=info[0];hr.appendChild(nm);
    if(ix&&ix.temp)hr.appendChild(tempChip(ix.temp,true));c.appendChild(hr);
    c.appendChild(el("div","hint",info[1]+" · "+pool.length+" tracked assets"));
    if(ix){c.appendChild(el("div","grow",grow100(ix.level)));
      const d=el("div","delta "+pcls(ix.r30));d.textContent=fp(ix.r30)+" · 30d";c.appendChild(d);
      const sp=el("div");sp.style.marginTop="6px";sp.appendChild(spark(ix.series.map((v,j)=>[j,v]),210,30,cssv("--s1")));c.appendChild(sp);}
    else c.appendChild(el("div","note","Not enough full-history assets for an index yet"));
    c.appendChild(el("div","note",info[2]));
    g.appendChild(c);});
  box.appendChild(g);
}
function vEraDetail(box){
  const e=state.param;const info=ERA_INFO[e]||[e,"",""];
  const pool=ASSETS.filter(a=>a.subEra===e);
  if(!pool.length){go("eras");return;}
  const bk=el("button","iconbtn","← All eras");bk.onclick=()=>go("eras");box.appendChild(bk);
  box.appendChild(el("div","h1",info[0]+" — era dashboard"));
  box.appendChild(el("div","sub",info[2]+" Covering "+info[1]+" · "+pool.length+" tracked assets ("+pool.filter(a=>a.type==="sealed").length+" sealed, "+pool.filter(a=>a.type==="single").length+" singles)."));
  const IX={};DATA.indexes.forEach(i=>IX[i.id]=i);
  const ix=IX["idx_era_"+e.toLowerCase()];
  if(ix){
    const hc=el("div","card heroX");
    const hh=el("div");hh.style.cssText="display:flex;align-items:center;gap:10px;flex-wrap:wrap";
    hh.appendChild(el("h3",null,info[0]+" Index"));if(ix.temp)hh.appendChild(tempChip(ix.temp));hc.appendChild(hh);
    hc.appendChild(el("div","grow",grow100(ix.level)));
    const d=el("div","delta "+pcls(ix.r30));d.textContent=fp(ix.r30)+" · 30d · "+fp(ix.window,0)+" since "+(META.windowLabel||"start")+" · "+ix.members.length+" members";
    hc.appendChild(d);
    const cb=el("div");hc.appendChild(cb);box.appendChild(hc);
    setTimeout(()=>lineChart(cb,[{name:info[0],color:SER()[0],pts:ix.series.map((v,j)=>[Math.min(j*7,N_DAYS-1),v])}],{h:200,area:true,yFmt:v=>v.toFixed(0)}),0);}
  box.appendChild(el("div","sec-title","This era's boards"));
  const g=el("div","grid g3");
  ["hot_singles","mom_gain","usd_gain"].forEach(id=>{
    const base=BOARDS.find(x=>x.id===id);const b={...base};
    const basePool=base.pool;b.pool=a=>a.subEra===e&&(basePool?basePool(a):true);
    g.appendChild(boardCard(b));});
  box.appendChild(g);
  box.appendChild(el("div","sec-title","Top sets in this era"));
  const sc2=el("div","card");
  const groups={};pool.forEach(a=>{(groups[a.set]=groups[a.set]||[]).push(a);});
  const rows=Object.entries(groups).map(([k,v])=>({k,n:v.length,val:v.reduce((s,x)=>s+x.price,0),
    r90:median(v.map(a=>MP(a,"r90")).filter(x=>x!=null))})).filter(r=>r.r90!=null)
    .sort((a,b)=>b.val-a.val).slice(0,10);
  const mx=Math.max(...rows.map(r=>Math.abs(r.r90)))||1;
  rows.forEach(r=>{const row=el("div","segrow");
    row.appendChild(el("span","sl",r.k+" ("+r.n+")"));
    const track=el("span","st");const barX=el("i",r.r90>=0?"pos":"neg");
    barX.style.width=(Math.abs(r.r90)/mx*50)+"%";barX.style[r.r90>=0?"left":"right"]="50%";
    track.appendChild(barX);track.appendChild(el("b"));row.appendChild(track);
    const v=el("span","sv "+pcls(r.r90));v.textContent=fp(r.r90,0);row.appendChild(v);
    sc2.appendChild(row);});
  sc2.appendChild(el("div","note","Bars = median 3-month change per set, sets ordered by tracked value."));
  box.appendChild(sc2);
  box.appendChild(el("div","sec-title","All tracked in this era"));
  const tc=el("div","card");assetTable(tc,pool);box.appendChild(tc);
}

/* ================= SUPPORT LINES ================= */
function vSupport(box){
  box.appendChild(el("div","h1","Support lines"));
  const sup=hint("support line","support");
  const sub=el("div","sub");
  sub.appendChild(document.createTextNode("A "));sub.appendChild(sup);
  sub.appendChild(document.createTextNode(" is a price floor the market has defended at least 3 times over 60+ days — detected automatically from your real price history. Sitting on a tested floor is historically a lower-risk entry; breaking one is a warning."));
  box.appendChild(sub);
  const withSup=ASSETS.filter(a=>a.supports&&a.supports.lines&&a.supports.lines.length&&a.eligible.eligible);
  const onFloor=withSup.filter(a=>a.supports.state==="on").sort((x,y)=>x.supports.dist-y.supports.dist);
  const broken=withSup.filter(a=>a.supports.state==="broken").sort((x,y)=>x.supports.dist-y.supports.dist);
  const g=el("div","grid g2");
  const mk=(title,d,list,tone)=>{
    const c=el("div","card");c.appendChild(el("h3",null,title));c.appendChild(el("div","hint",d));
    if(!list.length)c.appendChild(el("div","empty","None right now"));
    list.slice(0,10).forEach(a=>{
      const s0=a.supports.lines[0];
      const btn=el("button","qmover");btn.style.width="100%";btn.onclick=()=>go("product",a.id);
      const im=cardImg(a,"200x200");if(im)btn.appendChild(im);
      const tx=el("span");tx.style.flex="1";tx.style.minWidth="0";
      const l1=el("div");l1.style.cssText="font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
      l1.textContent=a.name;tx.appendChild(l1);
      tx.appendChild(el("small",null,a.set+" · floor "+fm(s0.level)+" · tested "+s0.touches+"× ("+s0.from+" → "+s0.to+")"));
      btn.appendChild(tx);
      const v=el("span","bv "+tone);v.textContent=fp(a.supports.dist)+" vs floor";btn.appendChild(v);
      c.appendChild(btn);});
    return c;};
  g.appendChild(mk("🛡 On the floor","Trading within 8% of a well-tested support — the accumulation-zone watchlist",onFloor,"up"));
  g.appendChild(mk("⚠ Broken floors","Fell more than 3% below a tested support — treat as a caution list",broken,"down"));
  box.appendChild(g);
  const rest=withSup.filter(a=>a.supports.state==="above").sort((x,y)=>y.supports.lines[0].touches-x.supports.lines[0].touches);
  box.appendChild(el("div","sec-title","Strongest tested floors (everything else)"));
  const tc=el("div","card tablewrap");const t=el("table");
  const hr=el("tr");["Asset","Price","Strongest floor","Tested","Span","Above floor","30d"].forEach(h=>{const th2=document.createElement("th");th2.textContent=h;hr.appendChild(th2);});
  t.appendChild(hr);
  rest.slice(0,25).forEach(a=>{const s0=a.supports.lines[0];
    const tr=el("tr","click");tr.onclick=()=>go("product",a.id);
    const td0=document.createElement("td");td0.appendChild(nameCell(a));tr.appendChild(td0);
    [fm(a.price),fm(s0.level),s0.touches+"×",s0.from+" → "+s0.to,fp(a.supports.dist)].forEach(v=>tr.appendChild(el("td",null,v)));
    const td=document.createElement("td");td.appendChild(deltaSpan(MP(a,"r30")));tr.appendChild(td);
    t.appendChild(tr);});
  tc.appendChild(t);box.appendChild(tc);
  box.appendChild(el("div","note","Supports are statistical observations about past behavior, not guarantees — floors break. Detection: clustered price lows within ±3%, ≥3 separate touch episodes, ≥60-day span."));
}

/* ================= HOME (landing) ================= */
function vHome(box){
  const hero=el("div","card homehero");
  const brand=el("div","hb");
  brand.appendChild(el("div","logo"));
  const bt=el("div");
  bt.appendChild(el("div","ht","PMT"));
  bt.appendChild(el("div","hs","Analytics and Tracking Tool"));
  brand.appendChild(bt);hero.appendChild(brand);
  hero.appendChild(el("p",null,"Real TCGplayer prices for "+(META.catalogCount||0).toLocaleString()+" cards and sealed products, collected every day since "+(META.windowLabel||"Jan 2025")+" — turned into indexes, rankings, temperatures and signals."));
  const meta=el("div","hmeta");
  meta.appendChild(el("span","badge acc","LAST REFRESHED · "+(META.builtAt||META.generated)));
  meta.appendChild(el("span","badge","REFRESHES DAILY ~21:30 UTC"));
  meta.appendChild(el("span","badge",META.days+" DAYS OF HISTORY"));
  hero.appendChild(meta);
  box.appendChild(hero);
  const slv=sinceLastVisit();
  if(slv){
    const sc2=el("div","card");sc2.style.borderColor="var(--accent)";
    sc2.appendChild(el("h3",null,"Since your last visit ("+slv.date+")"));
    slv.alertHits.slice(0,4).forEach(({a,al})=>{
      const r=el("button","newsrow");r.onclick=()=>go("product",a.id);
      const t2=el("span");t2.appendChild(el("span","badge wrn","◷ ALERT"));
      t2.appendChild(document.createTextNode(" "+a.name+" crossed your "+al.type.toLowerCase()+" "+fm(al.value)+" — now "+fm(a.price)));
      r.appendChild(t2);sc2.appendChild(r);});
    slv.tempChanges.slice(0,4).forEach(({a,from,to})=>{
      const r=el("button","newsrow");r.onclick=()=>go("product",a.id);
      const t2=el("span");t2.appendChild(tempChip(to,true));
      t2.appendChild(document.createTextNode(" "+a.name+" went "+(TEMP[from]?TEMP[from].label:from)+" → "+(TEMP[to]?TEMP[to].label:to)));
      r.appendChild(t2);sc2.appendChild(r);});
    slv.bigMoves.slice(0,4).forEach(({a,chg})=>{
      const r=el("button","newsrow");r.onclick=()=>go("product",a.id);
      const t2=el("span");t2.appendChild(deltaSpan(chg));
      t2.appendChild(document.createTextNode(" "+a.name+" since your last visit — now "+fm(a.price)));
      r.appendChild(t2);sc2.appendChild(r);});
    box.appendChild(sc2);}
  else if(!state.deskLoaded){
    const tip2=el("div","callout");
    tip2.textContent="Tip: star assets (☆), set alerts, and build your portfolio — everything saves automatically in this browser, and this page will greet you with what changed since your last visit.";
    box.appendChild(tip2);}
  const IX={};DATA.indexes.forEach(i=>IX[i.id]=i);
  const comp=IX.idx_overall;
  const CARDS=[
   ["overview","◈","Market overview","The whole market at a glance — the four markets, rotation, and today's signals.",
    c=>{if(!comp)return;c.appendChild(el("div","grow",grow100(comp.level)));
      const d=el("div","delta "+pcls(comp.r30));d.textContent=fp(comp.r30)+" · 30d";c.appendChild(d);
      const sp=el("div");sp.appendChild(spark(comp.series.map((v,j)=>[j,v]),200,30,cssv("--s1")));c.appendChild(sp);}],
   ["news","◉","Market news","The self-writing journal: what turned hot, hit a floor, or set a high — daily.",
    c=>{c.appendChild(el("div","note","Fresh headlines every day, written from the data itself."));}],
   ["hotcold","♨","Hot & Cold","What's thawing, freezing, or on a month-long run — temperature transitions.",
    c=>{const counts={hot:0,warming:0,stagnant:0,cooling:0,cold:0};
      const elig=ASSETS.filter(a=>a.eligible.eligible);elig.forEach(a=>counts[a.scores.temp]!=null&&counts[a.scores.temp]++);
      const bar=el("div");bar.style.cssText="display:flex;height:12px;border-radius:6px;overflow:hidden;margin-top:8px";
      ["hot","warming","stagnant","cooling","cold"].forEach(k=>{const seg=el("div");
        seg.style.cssText="min-width:1px";seg.style.width=(counts[k]/(elig.length||1)*100)+"%";seg.style.background=TEMP[k].color;bar.appendChild(seg);});
      c.appendChild(bar);}],
   ["map","▩","Market map","The whole market as one picture — tiles sized by money, colored by movement.",
    c=>{const mm=el("div");mm.style.cssText="display:grid;grid-template-columns:2fr 1fr 1fr;gap:3px;height:44px;margin-top:8px";
      [8,-4,12,-9,3,6].slice(0,6).forEach(v=>{const t2=el("div");t2.style.cssText="border-radius:3px";t2.style.background=heatColor(v,1.4);mm.appendChild(t2);});c.appendChild(mm);}],
   ["eras","▣","Era dashboards","Nine eras, nine markets — WOTC scarcity to Mega-era hype, each with its own index.",
    c=>{const row=el("div");row.style.marginTop="8px";erasPresent().slice(0,5).forEach(e=>row.appendChild(el("span","badge",e)));c.appendChild(row);}],
   ["rankings","≡","Rankings","Twenty boards, eligibility-gated — meaningful movers, quality, breakouts.",
    c=>{const b=BOARDS.find(x=>x.id==="mom_gain");const top=boardItems(b,null,null,1)[0];
      if(top){const r2=el("div","note");r2.textContent="Top meaningful gainer: "+top.name+" "+fp(MP(top,"mom"));c.appendChild(r2);}}],
   ["support","▁","Support lines","Tested price floors — who's sitting on one, who just fell through.",
    c=>{const n=ASSETS.filter(a=>a.supports&&a.supports.state==="on"&&a.eligible.eligible).length;
      c.appendChild(el("div","note",n+" assets currently on a tested floor"));}],
   ["screener","⌕","Screener","Filter everything by price, era, language and scores. Sort any column.",null],
   ["singles","▤","Singles desk","Individual cards only — boards, segments, the full table.",null],
   ["sealed","▦","Sealed desk","Boxes, ETBs and bundles — supply only shrinks.",null],
   ["indexes","∿","Indexes","Every basket as growth-of-$100 with its temperature.",null],
   ["compare","⇄","Compare","Up to four assets on one fair, rebased chart.",null],
   ["alerts","◷","Alert center","Today's triggered signals plus your own rules.",null],
   ["portfolio","▥","Portfolio","A collection marked to real market, with honest exit math.",null],
   ["learn","✦","Learn the basics","Every metric in plain English — 3 minutes, no finance background.",null],
  ];
  const g=el("div","homecards");
  CARDS.forEach(([view,icon,title,desc,vis])=>{
    const c=el("button","card hc");c.onclick=()=>go(view);
    const hr2=el("div","hchead");hr2.appendChild(el("span","hcicon",icon));hr2.appendChild(el("b",null,title));c.appendChild(hr2);
    c.appendChild(el("p",null,desc));
    if(vis)try{vis(c);}catch(e){}
    g.appendChild(c);});
  box.appendChild(g);
}

/* ================= NEWS ================= */
let NEWSDATA=null,NEWS_P=null;
function loadNews(){
  if(NEWSDATA)return Promise.resolve(NEWSDATA);
  if(typeof window!=="undefined"&&window.NEWS){NEWSDATA=window.NEWS;return Promise.resolve(NEWSDATA);}
  if(!location.protocol.startsWith("http"))return Promise.resolve(null);
  NEWS_P=NEWS_P||fetch("news.json?v="+Date.now()).then(r=>r.json()).then(d=>{NEWSDATA=d;return d;}).catch(()=>null);
  return NEWS_P;}
const NEWS_TYPES={hot:["🔥","Turned hot"],cold:["❄","Turned cold"],floor:["🛡","At support"],
  break:["⚠","Floor broken"],high:["⬆","New high"],cross:["↗","Trend reclaimed"],move:["⚡","Big move"]};
let newsFilter="all";
function vNews(box){
  box.appendChild(el("div","h1","Market news"));
  box.appendChild(el("div","sub","A self-writing journal: every night the data is scanned for stories — temperature changes, tested floors reached or broken, new highs, trend reclaims — and written up with analytical context. No hype, no humans, refreshed daily."));
  const f=el("div","filters");
  pills(f,"Show",[["all","All"],...Object.entries(NEWS_TYPES).map(([k,v])=>[k,v[0]+" "+v[1]])],newsFilter,v=>{newsFilter=v;render();});
  box.appendChild(f);
  const holder=el("div");box.appendChild(holder);
  holder.appendChild(el("div","empty","Loading the journal…"));
  loadNews().then(nd=>{
    holder.textContent="";
    if(!nd||!nd.days||!nd.days.length){holder.appendChild(el("div","empty","No news available — it generates with the next daily refresh."));return;}
    const today=META.windowEnd;
    // top story hero
    const latest=nd.days[0];
    if(newsFilter==="all"&&latest&&latest.items.length){
      const top=latest.items[0];
      const hero2=el("div","card");hero2.style.borderColor="var(--accent)";
      hero2.appendChild(el("div","hint","TOP STORY · "+latest.date));
      const hrow=el("button","newsrow");hrow.style.borderTop="none";hrow.onclick=()=>go("product",top.id);
      const im=cardImg({pid:top.pid},"400x400");
      if(im){im.className="cardthumb";im.style.cssText="width:74px;height:74px;object-fit:contain;border-radius:8px";hrow.appendChild(im);}
      const tx=el("span");tx.style.cssText="flex:1;min-width:0";
      const tmeta=NEWS_TYPES[top.type]||["◈",top.type];
      const l1=el("div");l1.appendChild(el("span","badge acc",tmeta[0]+" "+tmeta[1].toUpperCase()));
      l1.appendChild(el("small",null," "+top.set+" · "+fm(top.price)));tx.appendChild(l1);
      const bt2=el("div","newstext");bt2.style.cssText="font-size:15px;color:var(--ink);line-height:1.5;margin-top:5px";
      bt2.textContent=top.text;tx.appendChild(bt2);
      hrow.appendChild(tx);hero2.appendChild(hrow);holder.appendChild(hero2);}
    const rssRow=el("div","note");rssRow.style.margin="8px 2px 2px";
    rssRow.appendChild(document.createTextNode("Subscribe: "));
    const rl=el("a",null,"RSS feed");rl.href="feed.xml";rssRow.appendChild(rl);
    rssRow.appendChild(document.createTextNode(" — one digest per day, straight to your reader or Discord."));
    holder.appendChild(rssRow);
    let shown=0;
    const moreWrap=el("div");
    nd.days.forEach(day=>{
      const items=day.items.filter(it=>newsFilter==="all"||it.type===newsFilter);
      if(!items.length)return;
      shown++;
      const target=shown<=5?holder:moreWrap;
      const label=day.date===today?"Today · "+day.date:day.date;
      target.appendChild(el("div","sec-title",label));
      const c=el("div","card");c.style.padding="6px 16px";
      items.forEach(it=>{
        const row=el("button","newsrow");row.onclick=()=>go("product",it.id);
        const im=cardImg({pid:it.pid},"200x200");if(im)row.appendChild(im);
        const tx=el("span");tx.style.cssText="flex:1;min-width:0";
        const l1=el("div");l1.style.cssText="display:flex;align-items:center;gap:7px;flex-wrap:wrap";
        const tmeta=NEWS_TYPES[it.type]||["◈",it.type];
        l1.appendChild(el("span","badge acc",tmeta[0]+" "+tmeta[1].toUpperCase()));
        l1.appendChild(el("small",null,it.set+" · "+fm(it.price)));tx.appendChild(l1);
        const body=el("div","newstext");body.textContent=it.text;tx.appendChild(body);
        row.appendChild(tx);c.appendChild(row);});
      target.appendChild(c);});
    if(moreWrap.childNodes.length){
      moreWrap.style.display="none";
      const more=el("button","pill","Show "+(shown-5)+" earlier days");
      more.style.margin="14px 0";
      more.onclick=()=>{moreWrap.style.display="block";more.style.display="none";};
      holder.appendChild(more);holder.appendChild(moreWrap);}
    if(!shown)holder.appendChild(el("div","empty","Nothing matches this filter in the last 30 days."));
  });
}
