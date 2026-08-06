/* ================= product page + portfolio ================= */
"use strict";
const prodState={range:180,showMA:true};

function vProduct(box){
  const a=BYID[state.param];
  if(!a){
    if(/^p\d+$/.test(state.param||"")){vProductLazy(box,parseInt(state.param.slice(1)));return;}
    go("overview");return;}
  const m=a.metrics,s=a.scores,S=SER();
  const bk=el("button","iconbtn","← Back");
  bk.onclick=()=>goBack("overview");
  box.appendChild(bk);
  box.appendChild(el("div","crumb",(a.type==="sealed"?"Sealed":"Singles")+" · "+a.set+(a.num?" · #"+a.num:"")));
  // header
  const ph=el("div","phead");
  const lwrap=el("div");lwrap.style.cssText="display:flex;gap:16px;align-items:flex-start";
  const hero=cardImg(a,"400x400","cardhero");if(hero)lwrap.appendChild(hero);
  const left=el("div");
  const trow=el("div");trow.style.cssText="display:flex;align-items:center;gap:10px;flex-wrap:wrap";
  trow.appendChild(el("div","h1",a.name));
  if(s.temp)trow.appendChild(tempChip(s.temp));
  left.appendChild(trow);
  const bd=el("div");
  const badges=[[a.era==="vintage"?"VINTAGE":"MODERN",""],[a.subEra,""],[a.lang==="JP"?"JAPANESE":"ENGLISH",""],
    [a.type==="sealed"?"FACTORY SEALED":"RAW",""],
    a.rarity?[a.rarity.toUpperCase(),""]:null,a.kind?[a.kind.toUpperCase(),""]:null,
    a.printing&&a.printing!=="Standard"?[a.printing.toUpperCase(),"acc"]:null,
    a.nickname?['"'+a.nickname+'"',"acc"]:null,
    ["REAL TCGPLAYER HISTORY · "+m.realDays+" DAYS","acc"],
    a.trophy?["THIN MARKET — SPORADIC PRICING","wrn"]:null].filter(Boolean);
  badges.forEach(([t,cls])=>bd.appendChild(el("span","badge "+cls,t)));
  left.appendChild(bd);lwrap.appendChild(left);ph.appendChild(lwrap);
  const right=el("div");right.style.textAlign="right";
  const pw=el("div");pw.appendChild(el("span","pricebig",fm(a.price)));
  pw.appendChild(starBtn(a));right.appendChild(pw);
  right.appendChild(el("div","note","estimated market value · "+META.generated));
  const dl=el("div","deltas");dl.style.justifyContent="flex-end";
  [["7D","r7"],["30D","r30"],["MoM","mom"],["6M","r180"],["1Y","r1y"]].forEach(([lab,k])=>{
    const mm=m[k];const sp=el("span",pcls(mm?mm.pct:null));
    sp.appendChild(el("small",null,lab));sp.appendChild(document.createTextNode(mm?fp(mm.pct):"–"));dl.appendChild(sp);});
  right.appendChild(dl);ph.appendChild(right);box.appendChild(ph);
  if(!a.eligible.eligible){
    const c=el("div","callout");c.textContent="Excluded from major rankings: "+a.eligible.reasons.join("; ")+".";
    c.style.marginBottom="12px";box.appendChild(c);}
  // scores
  const sc=el("div","scores7");
  sc.appendChild(scoreChip("momentum","Momentum",s.momentum));
  sc.appendChild(scoreChip("volatility","Volatility",s.volatility,100,s.volatility>60?"crit":s.volatility>35?"warn":""));
  sc.appendChild(scoreChip("stability","Stability",s.stability));
  sc.appendChild(scoreChip("spread","Spread tightness",s.spread,100,s.spread<40?"warn":""));
  sc.appendChild(scoreChip("quality","Inv. quality",s.quality));
  sc.appendChild(scoreChip("breakout","Breakout",s.breakout,1));
  sc.appendChild(scoreChip("confidence","Confidence",s.confidence,100,s.confidence<55?"warn":"good"));
  box.appendChild(sc);
  // chart + right rail
  const cols=el("div","twocol");
  const leftcol=el("div");leftcol.style.display="grid";leftcol.style.gap="14px";leftcol.style.alignContent="start";
  const cc=el("div","card");
  const chead=el("div");chead.style.cssText="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px";
  chead.appendChild(el("h3",null,"Price history — real TCGplayer market ("+m.subtype+")"));
  const rb=el("div","rangebtns");
  [["1M",30],["3M",90],["6M",180],["1Y",365],["All",N_DAYS]].forEach(([lab,d])=>{
    const b=el("button",prodState.range===d?"on":"",lab);
    b.onclick=()=>{prodState.range=d;render();};rb.appendChild(b);});
  const maB=el("button","pill"+(prodState.showMA?" on":""),"MAs");
  maB.style.marginLeft="6px";maB.onclick=()=>{prodState.showMA=!prodState.showMA;render();};
  const rw=el("div","switchrow");rw.appendChild(rb);rw.appendChild(maB);chead.appendChild(rw);
  cc.appendChild(chead);
  const cb=el("div");cc.appendChild(cb);
  leftcol.appendChild(cc);
  const cm=el("div","card");cm.appendChild(el("h3",null,"Automated market commentary"));
  cm.appendChild(el("div","commentary",a.commentary));leftcol.appendChild(cm);
  cols.appendChild(leftcol);
  cb.appendChild(el("div","empty","Loading chart…"));
  loadSeries(a).then(()=>{
    const pts=sliceRange(a,prodState.range);
    const all=sliceRange(a,N_DAYS);
    const series=[{name:a.name,color:S[0],pts}];
    if(prodState.showMA&&all.length>=55){
      const ma50=ma(all,50).filter(p=>p[0]>=pts[0][0]);
      if(ma50.length>1)series.push({name:"50-day avg",color:S[2],pts:ma50,dash:true,thin:true});
      if(all.length>=205){const ma200=ma(all,200).filter(p=>p[0]>=pts[0][0]);
        if(ma200.length>1)series.push({name:"200-day avg",color:S[3],pts:ma200,dash:true,thin:true});}}
    const hlines=(a.supports&&a.supports.lines||[]).slice(0,2).map(s2=>({y:s2.level,label:"support "+fm(s2.level)+" ("+s2.touches+"× tested)"}));
    lineChart(cb,series,{h:300,area:true,yFmt:v=>fmc(v),hlines});});
  // right rail
  const rail=el("div");rail.style.display="grid";rail.style.gap="14px";
  // facts
  const fc=el("div","card");fc.appendChild(el("h3",null,"Key facts"));
  [["Set",a.set],["Number",a.num],["Rarity",a.rarity],["Type",a.kind],["Character",a.character],
   ["Era",a.era+" ("+a.subEra+")"],["Language",a.lang==="JP"?"Japanese":"English"],
   ["Printing tracked",m.subtype],["Released",a.release],
   ["MSRP",a.msrp?fm(a.msrp):null],
   ["TCGplayer listing",a.tcgProduct],["TCGplayer set",a.groupName]]
   .forEach(([k,v])=>{if(v==null)return;const kv=el("div","kv");kv.appendChild(el("span",null,k));
     const b=el("b");b.textContent=v;kv.appendChild(b);fc.appendChild(kv);});
  rail.appendChild(fc);
  // real listing structure
  const mp=el("div","card");mp.appendChild(el("h3",null,"Listing structure — real, latest day"));
  mp.appendChild(el("div","hint","How the live listings are priced around the market value"));
  [["Market price",fm(a.price)],["Lowest listing",m.listLow!=null?fm(m.listLow):"–"],
   ["Mid listing",m.listMid!=null?fm(m.listMid):"–"],["Highest listing",m.listHigh!=null?fm(m.listHigh):"–"],
   ["Direct low",m.directLow!=null?fm(m.directLow):"–"],
   ["Listed spread (low→mid)",m.spreadPct!=null?m.spreadPct+"%":"–"]].forEach(([k,v])=>{const kv=el("div","kv");
    kv.appendChild(el("span",null,k));const b=el("b");b.textContent=v;kv.appendChild(b);mp.appendChild(kv);});
  if((m.spreadPct||0)>20){const w=el("div","callout");w.textContent="⚠ Wide spread: the lowest listing sits far under mid. The quoted value is soft — expect negotiation room.";
    w.style.marginTop="8px";mp.appendChild(w);}
  rail.appendChild(mp);
  // data coverage
  const lq=el("div","card");lq.appendChild(el("h3",null,"Data coverage"));
  [["Real price days",m.realDays],["Coverage",m.coverage+"% of days"],
   ["Collected since",m.firstDate],["Last real price",m.lastReal],
   ["Sales-volume data","not yet collected"],["eBay comparison","not yet collected"]]
   .forEach(([k,v])=>{const kv=el("div","kv");kv.appendChild(el("span",null,k));
    const b=el("b");b.textContent=v;if(v==="not yet collected")b.style.color="var(--muted)";
    kv.appendChild(b);lq.appendChild(kv);});
  rail.appendChild(lq);
  // my notes (saved in this browser)
  const nc=el("div","card");nc.appendChild(el("h3",null,"My notes"));
  nc.appendChild(el("div","hint","Private research notes — saved automatically in this browser."));
  const ta=document.createElement("textarea");
  ta.value=(state.notes&&state.notes[a.id])||"";
  ta.placeholder="Why are you watching this? Target price, thesis, reminders…";
  ta.style.cssText="width:100%;min-height:84px;background:var(--surface2);color:var(--ink);border:1px solid var(--border);border-radius:9px;padding:9px 11px;font:inherit;font-size:12.8px;resize:vertical";
  let ntimer;ta.addEventListener("input",()=>{state.notes[a.id]=ta.value;clearTimeout(ntimer);ntimer=setTimeout(saveDesk,400);});
  nc.appendChild(ta);rail.appendChild(nc);
  // support lines
  if(a.supports&&a.supports.lines&&a.supports.lines.length){
    const sp2=el("div","card");const h3=el("h3",null,"Support lines");tipFor(h3,"support");sp2.appendChild(h3);
    a.supports.lines.forEach((s2,i)=>{const kv=el("div","kv");
      kv.appendChild(el("span",null,(i?"Secondary":"Strongest")+" floor"));
      const b=el("b");b.textContent=fm(s2.level)+" · "+s2.touches+"× ("+s2.from+"→"+s2.to+")";kv.appendChild(b);sp2.appendChild(kv);});
    const st2={on:"🛡 Sitting on its floor ("+fp(a.supports.dist)+" above) — historically a lower-risk zone.",
      broken:"⚠ Below its tested floor ("+fp(a.supports.dist)+") — the floor failed; caution.",
      above:"Currently "+fp(a.supports.dist)+" above its strongest floor."}[a.supports.state];
    if(st2){const w=el("div","callout");w.style.marginTop="8px";w.textContent=st2;sp2.appendChild(w);}
    rail.appendChild(sp2);}
  cols.appendChild(rail);box.appendChild(cols);
  // performance + scenario row
  const g2=el("div","grid g2");g2.style.marginTop="14px";
  // performance table
  const pf=el("div","card");pf.appendChild(el("h3",null,"Performance"));
  const t=el("table");const hr=el("tr");["Period","%","$"].forEach(h=>{const th=document.createElement("th");th.textContent=h;hr.appendChild(th);});t.appendChild(hr);
  [["7 days","r7"],["30 days","r30"],["Month-over-month","mom"],["90 days","r90"],["6 months","r180"],
   ["Year-to-date","ytd"],["1 year","r1y"],["Since Jan 2025","window"]].forEach(([lab,k])=>{
    const mm=m[k];const tr=el("tr");tr.appendChild(el("td",null,lab));
    const t1=document.createElement("td");t1.appendChild(deltaSpan(mm?mm.pct:null));tr.appendChild(t1);
    const t2=document.createElement("td");t2.textContent=mm?((mm.usd>=0?"+":"−")+fm(Math.abs(mm.usd))):"–";
    t2.className=mm?pcls(mm.usd):"flat2";tr.appendChild(t2);t.appendChild(tr);});
  [["Window high",m.ath],["Window low",m.atl]].forEach(([lab,x])=>{
    const tr=el("tr");tr.appendChild(el("td",null,lab+" ("+x.date.slice(0,7)+")"));
    const t1=document.createElement("td");t1.appendChild(deltaSpan(x.fromPct));tr.appendChild(t1);
    const t2=document.createElement("td");t2.textContent=fm(x.price);tr.appendChild(t2);t.appendChild(tr);});
  [["vs 50-day avg",m.vsMa50],["vs 200-day avg",m.vsMa200]].forEach(([lab,v])=>{
    const tr=el("tr");tr.appendChild(el("td",null,lab));
    const t1=document.createElement("td");t1.appendChild(deltaSpan(v));tr.appendChild(t1);
    tr.appendChild(document.createElement("td"));t.appendChild(tr);});
  pf.appendChild(t);g2.appendChild(pf);
  // scenario
  const sn=el("div","card");sn.appendChild(el("h3",null,"Scenario analysis — 6-month model estimates"));
  sn.appendChild(el("div","hint","Model-generated, not a prediction. Confidence: "+a.scenario.confidence+"."));
  const band=el("div","scenario-band");band.appendChild(el("div","track"));
  const lo=a.scenario.bear*0.94,hi=a.scenario.bull*1.06;
  [["Bear",a.scenario.bear,0],["Base",a.scenario.base,0],["Now",a.price,1],["Bull",a.scenario.bull,0]].forEach(([lab,v,below])=>{
    const x=Math.max(2,Math.min(98,(v-lo)/(hi-lo)*100));
    const pt=el("div","pt");pt.style.left=x+"%";band.appendChild(pt);
    const lb=el("div","lb");lb.style.left=x+"%";if(below)lb.style.top="34px";
    const bb=el("b",null,fm(v));
    lb.appendChild(bb);lb.appendChild(document.createTextNode(lab));band.appendChild(lb);});
  sn.appendChild(band);
  [["Likely 6-month range",fm(a.scenario.rangeLow)+" – "+fm(a.scenario.rangeHigh)],
   ["Trend-continuation probability",Math.round(a.scenario.trendContinuation*100)+"%"],
   ["Mean-reversion probability",Math.round(a.scenario.meanReversion*100)+"%"],
   ["90-day volatility (annualized)",m.vol90+"%"]].forEach(([k,v])=>{
    const kv=el("div","kv");kv.appendChild(el("span",null,k));const b=el("b");b.textContent=v;kv.appendChild(b);sn.appendChild(kv);});
  const meth=el("div","note");meth.style.marginTop="8px";meth.textContent=DATA.methodology.scenarios;
  sn.appendChild(meth);g2.appendChild(sn);box.appendChild(g2);
  // risks + recent sales
  const g3=el("div","grid g2");g3.style.marginTop="14px";
  const rk=el("div","card");rk.appendChild(el("h3",null,"Key risks"));
  const ul=el("ul","risklist");
  const risks=[];
  if(s.volatility>50)risks.push("High volatility: 90-day realized volatility of "+m.vol90+"% means wide short-term swings are normal.");
  if((m.spreadPct||0)>15)risks.push("Wide listed spread ("+m.spreadPct+"%): exiting near the quoted market price may take time or negotiation.");
  if(m.coverage<85)risks.push("Sporadic pricing: a real market price existed on only "+m.coverage+"% of days — thin, irregular trading.");
  if(m.vsMa200!=null&&m.vsMa200>25)risks.push("Overextension: price is "+fp(m.vsMa200,0)+" above its 200-day average — historically vulnerable to mean reversion.");
  if(a.era==="modern"&&a.type==="sealed")risks.push("Reprint risk: The Pokémon Company has reprinted hot modern sets aggressively since 2025; new supply caps upside.");
  if(a.era==="modern"&&a.type==="single")risks.push("Grading-supply risk: rising PSA 10 population can compress raw and graded premiums.");
  risks.push("No sales-volume data collected yet: price trends here are unconfirmed by transaction counts until that source is added.");
  risks.push("Collectibles risk: no cash flows — value depends entirely on future collector demand.");
  risks.forEach(r=>ul.appendChild(el("li",null,r)));rk.appendChild(ul);g3.appendChild(rk);
  const rs=el("div","card");rs.appendChild(el("h3",null,"Recent daily marks — real"));
  const st=el("table");const hr2=el("tr");["Date","Market","Low","Mid","High"].forEach(h=>{const th=document.createElement("th");th.textContent=h;hr2.appendChild(th);});st.appendChild(hr2);
  (a.recentMarks||[]).forEach(x=>{const tr=el("tr");tr.appendChild(el("td",null,x.date));
    [x.market,x.low,x.mid,x.high].forEach(v=>{const td=document.createElement("td");
      td.textContent=v!=null?fm(v):"–";tr.appendChild(td);});st.appendChild(tr);});
  rs.appendChild(st);g3.appendChild(rs);box.appendChild(g3);
  // comparables
  const comps=ASSETS.filter(x=>x.id!==a.id&&(x.character&&x.character===a.character||x.set===a.set)).slice(0,8);
  if(comps.length){box.appendChild(el("div","sec-title","Comparable assets ",));
    const tc=el("div","card");assetTable(tc,comps);box.appendChild(tc);}
}

/* ================= PORTFOLIO ================= */
function vPortfolio(box){
  box.appendChild(el("div","h1","Portfolio"));
  box.appendChild(el("div","sub","Your collection, marked to real market prices daily and saved automatically in this browser. Estimated net proceeds use realistic exit values (current market, not highest listing) minus ~13% marketplace fees and shipping."));
  const mine=state.myPortfolio&&state.myPortfolio.length;
  const src=mine?state.myPortfolio:DATA.portfolio;
  if(!mine){const c0=el("div","callout");
    c0.textContent="This is a SAMPLE portfolio. Add your first holding below and it becomes yours — saved automatically in this browser.";
    c0.style.marginBottom="12px";box.appendChild(c0);}
  // add-holding form
  const form=el("div","card");form.appendChild(el("h3",null,"Add a holding"));
  const fr=el("div","filters");
  const sel=document.createElement("select");sel.style.maxWidth="330px";
  ASSETS.slice().sort((x,y)=>x.name.localeCompare(y.name)).forEach(a2=>{
    const o=document.createElement("option");o.value=a2.id;o.textContent=a2.name+" — "+a2.set+" ("+fm(a2.price)+")";sel.appendChild(o);});
  const qty=el("input");qty.type="number";qty.min="1";qty.value="1";qty.style.width="70px";qty.title="Quantity";
  const buy=el("input");buy.type="number";buy.step="0.01";buy.placeholder="buy price $";buy.style.width="110px";
  const dt=el("input");dt.type="date";
  const addb=el("button","pill on","+ Add");
  addb.onclick=()=>{const b=parseFloat(buy.value);if(!b||b<=0){buy.focus();return;}
    state.myPortfolio.push({id:sel.value,qty:Math.max(1,parseInt(qty.value)||1),buy:b,date:dt.value||META.generated});
    saveDesk();render();};
  fr.append(sel,qty,buy,dt,addb);form.appendChild(fr);
  form.appendChild(el("div","note","Tracks assets with full analytics (every product ≥ $5 + all sealed)."));
  box.appendChild(form);
  const rows=src.map(h=>{const a=BYID[h.id];if(!a)return null;
    const cost=h.qty*h.buy,val=h.qty*a.price;
    return {...h,_h:h,a,cost,val,pl:val-cost,plPct:(val/cost-1)*100};}).filter(Boolean);
  if(!rows.length){box.appendChild(el("div","empty","No holdings yet — add one above."));return;}
  const totCost=rows.reduce((s,r)=>s+r.cost,0),totVal=rows.reduce((s,r)=>s+r.val,0);
  const fees=0.13,net=totVal*(1-fees);
  const g=el("div","grid g4");
  const tile=(lab,val,delta,cls)=>{const c=el("div","card tile");c.appendChild(el("div","lab",lab));
    c.appendChild(el("div","val",val));if(delta){const d=el("div","delta "+(cls||""));d.textContent=delta;c.appendChild(d);}return c;};
  g.appendChild(tile("Market value",fmc(totVal),fp((totVal/totCost-1)*100)+" unrealized","up"));
  g.appendChild(tile("Cost basis",fmc(totCost),rows.length+" positions","flat2"));
  g.appendChild(tile("Unrealized P/L",(totVal-totCost>=0?"+":"−")+fmc(Math.abs(totVal-totCost)),null,pcls(totVal-totCost)));
  g.appendChild(tile("Est. net proceeds",fmc(net),"after ~13% selling costs","flat2"));
  box.appendChild(g);
  // history chart (mark-to-market of current holdings)
  box.appendChild(el("div","sec-title","Portfolio value — current holdings, marked to market"));
  const c=el("div","card");const cb=el("div");c.appendChild(cb);box.appendChild(c);
  cb.appendChild(el("div","empty","Loading history…"));
  Promise.all(rows.map(r=>loadSeries(r.a))).then(()=>{
    const pts=[];for(let i=0;i<N_DAYS;i++){let v=0,ok=true;
      rows.forEach(r=>{const p2=assetSeries(r.a).at(i);if(p2==null)ok=false;else v+=r.qty*p2;});
      if(ok)pts.push([i,v]);}
    lineChart(cb,[{name:"Portfolio",color:SER()[0],pts}],{h:240,area:true,yFmt:v=>fmc(v)});});
  // allocation
  const g2=el("div","grid g3");g2.style.marginTop="14px";
  const alloc=(title,fn)=>{const c2=el("div","card");c2.appendChild(el("h3",null,title));
    const groups={};rows.forEach(r=>{const k=fn(r.a);groups[k]=(groups[k]||0)+r.val;});
    Object.entries(groups).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>{
      const kv=el("div");kv.style.padding="6px 0";
      const lab=el("div","kv");lab.style.border="none";lab.appendChild(el("span",null,k));
      lab.appendChild(el("b",null,Math.round(v/totVal*100)+"% · "+fmc(v)));kv.appendChild(lab);
      const mt=el("div","meter");const i=el("i");i.style.width=(v/totVal*100)+"%";mt.appendChild(i);kv.appendChild(mt);
      c2.appendChild(kv);});
    return c2;};
  g2.appendChild(alloc("Sealed vs singles",a=>a.type==="sealed"?"Sealed":"Singles"));
  g2.appendChild(alloc("Vintage vs modern",a=>a.era==="vintage"?"Vintage":"Modern"));
  g2.appendChild(alloc("Character concentration",a=>a.character||a.set));
  box.appendChild(g2);
  // holdings table
  box.appendChild(el("div","sec-title","Holdings"));
  const tc=el("div","card tablewrap");const t=el("table");
  const hr=el("tr");["Asset","Qty","Bought","Cost","Price","Value","P/L $","P/L %","MoM","Qual",""].forEach(h=>{const th=document.createElement("th");th.textContent=h;hr.appendChild(th);});
  t.appendChild(hr);
  rows.sort((a,b)=>b.val-a.val).forEach((r,ri)=>{const tr=el("tr","click");tr.onclick=()=>go("product",r.a.id);
    const td0=document.createElement("td");td0.appendChild(nameCell(r.a));tr.appendChild(td0);
    [String(r.qty),fm(r.buy),fm(r.cost),fm(r.a.price),fm(r.val)].forEach(v=>{tr.appendChild(el("td",null,v));});
    const pl=document.createElement("td");pl.className=pcls(r.pl);pl.textContent=(r.pl>=0?"+":"−")+fm(Math.abs(r.pl));tr.appendChild(pl);
    const plp=document.createElement("td");plp.appendChild(deltaSpan(r.plPct));tr.appendChild(plp);
    const mom=document.createElement("td");mom.appendChild(deltaSpan(MP(r.a,"mom")));tr.appendChild(mom);
    tr.appendChild(el("td",null,String(Math.round(r.a.scores.quality))));
    const tdx=document.createElement("td");
    if(mine){const x=el("button","iconbtn","✕");x.title="Remove holding";
      x.onclick=ev=>{ev.stopPropagation();
        state.myPortfolio=state.myPortfolio.filter(h=>h!==r._h);
        saveDesk();render();};
      tdx.appendChild(x);}
    tr.appendChild(tdx);
    t.appendChild(tr);});
  tc.appendChild(t);box.appendChild(tc);
  // liquidity exposure note
  const spW=rows.reduce((s,r)=>s+(r.a.metrics.spreadPct||10)*r.val,0)/totVal;
  const note=el("div","callout");note.style.marginTop="12px";
  note.textContent="Value-weighted listed spread: "+spW.toFixed(1)+"%. "+
    (spW>12?"A meaningful share of this portfolio sits in wide-spread assets — exits near quote may take patience or negotiation.":"Spreads are tight across most positions — exits near the quoted market value look realistic.")+
    " (True liquidity scoring activates once sales-volume data is collected.)";
  box.appendChild(note);
}

/* ================= lazy product page (full-catalog long tail) ================= */
function vProductLazy(box,pid){
  const bk=el("button","iconbtn","← Back");
  bk.onclick=()=>goBack("overview");
  box.appendChild(bk);
  const holder=el("div");box.appendChild(holder);
  holder.appendChild(el("div","empty","Loading price history…"));
  loadCatalog().then(()=>{
    const row=catalogFind(pid);
    if(!row){holder.textContent="";holder.appendChild(el("div","empty","Product not found in catalog."));return;}
    return loadShard(row[3],row[4]).then(shard=>{
      const e=shard&&shard[String(pid)];
      holder.textContent="";
      if(!e){holder.appendChild(el("div","empty","No price series available for this product."));return;}
      const m=liteMetrics(e.s,e.p),S=SER();
      holder.appendChild(el("div","crumb","Full catalog · "+row[2]));
      const ph=el("div","phead");
      const lz=el("div");lz.style.cssText="display:flex;gap:16px;align-items:flex-start";
      const him=cardImg(pid,"400x400","cardhero");if(him)lz.appendChild(him);
      const left=el("div");
      left.appendChild(el("div","h1",row[1]));
      const bd=el("div");
      [["FULL CATALOG",""],["REAL TCGPLAYER HISTORY · "+e.rd+" DAYS","acc"],
       e.cov<70?["THIN MARKET — SPORADIC PRICING","wrn"]:null].filter(Boolean)
        .forEach(([t,c])=>bd.appendChild(el("span","badge "+c,t)));
      left.appendChild(bd);lz.appendChild(left);ph.appendChild(lz);
      const right=el("div");right.style.textAlign="right";
      right.appendChild(el("span","pricebig",fm(m.price)));
      right.appendChild(el("div","note","TCGplayer market · "+META.generated));
      const dl=el("div","deltas");dl.style.justifyContent="flex-end";
      [["7D",m.r7],["30D",m.r30],["90D",m.r90],["6M",m.r180]].forEach(([lab,mm])=>{
        const sp=el("span",pcls(mm?mm.pct:null));sp.appendChild(el("small",null,lab));
        sp.appendChild(document.createTextNode(mm?fp(mm.pct):"–"));dl.appendChild(sp);});
      right.appendChild(dl);ph.appendChild(right);holder.appendChild(ph);
      const note=el("div","callout");
      note.textContent="This product is below the terminal tier (singles ≥ $5 get full pre-computed analytics, scores and rankings). Its real collected history is charted here on demand.";
      note.style.marginBottom="12px";holder.appendChild(note);
      const cc=el("div","card");const cb=el("div");cc.appendChild(cb);holder.appendChild(cc);
      const pts=e.p.map((v,j)=>[e.s+j,v]);
      setTimeout(()=>{
        const series=[{name:row[1],color:S[0],pts}];
        if(pts.length>=205){const m200=ma(pts,200);if(m200.length>1)series.push({name:"200-day avg",color:S[3],pts:m200,dash:true,thin:true});}
        else if(pts.length>=55){const m50=ma(pts,50);if(m50.length>1)series.push({name:"50-day avg",color:S[2],pts:m50,dash:true,thin:true});}
        lineChart(cb,series,{h:280,area:true,yFmt:v=>fmc(v)});},0);
      const g=el("div","grid g2");g.style.marginTop="14px";
      const pf=el("div","card");pf.appendChild(el("h3",null,"Performance — computed live from your repo data"));
      const t=el("table");
      [["7 days",m.r7],["30 days",m.r30],["90 days",m.r90],["6 months",m.r180],
       ["Since "+(META.windowLabel||"start"),m.window]].forEach(([lab,mm])=>{
        const tr=el("tr");tr.appendChild(el("td",null,lab));
        const t1=document.createElement("td");t1.appendChild(deltaSpan(mm?mm.pct:null));tr.appendChild(t1);
        const t2=document.createElement("td");t2.textContent=mm?((mm.usd>=0?"+":"−")+fm(Math.abs(mm.usd))):"–";
        t2.className=mm?pcls(mm.usd):"flat2";tr.appendChild(t2);t.appendChild(tr);});
      [["Window high",m.ath],["Window low",m.atl]].forEach(([lab,x])=>{
        const tr=el("tr");tr.appendChild(el("td",null,lab+" ("+dshort(DATES[x.idx])+")"));
        const t1=document.createElement("td");t1.appendChild(deltaSpan(x.fromPct));tr.appendChild(t1);
        const t2=document.createElement("td");t2.textContent=fm(x.price);tr.appendChild(t2);t.appendChild(tr);});
      pf.appendChild(t);g.appendChild(pf);
      const dc=el("div","card");dc.appendChild(el("h3",null,"Data coverage"));
      [["Real price days",e.rd],["Coverage",e.cov+"% of days"],
       ["90-day volatility",m.vol90?m.vol90.toFixed(1)+"% (ann.)":"–"],
       ["vs 200-day avg",m.ma200?fp((m.price/m.ma200-1)*100):"–"],
       ["Sales-volume data","not yet collected"]].forEach(([k,v])=>{
        const kv=el("div","kv");kv.appendChild(el("span",null,k));
        const b=el("b");b.textContent=v;if(v==="not yet collected")b.style.color="var(--muted)";
        kv.appendChild(b);dc.appendChild(kv);});
      g.appendChild(dc);holder.appendChild(g);
    });
  }).catch(e=>{holder.textContent="";holder.appendChild(el("div","empty","Could not load series ("+e.message+")."));});
}
