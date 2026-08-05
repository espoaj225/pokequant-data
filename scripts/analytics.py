"""PokeQuant analytics v4 — full-catalog edition.

Input : data/prices/YYYY/MM/*.csv.gz  (EVERY Pokémon product, daily)
        data/catalog.csv.gz           (product metadata, refreshed daily)
        universe.csv + scripts/assets_meta.json (curated tags for featured assets)
Output: docs/data.json      — full metrics + daily series for the TERMINAL TIER
                              (every product ≥ $5 + all sealed, capped at ~4,500)
        docs/catalog.json   — search catalog for ALL products (lazy-loaded)
        docs/series/*.json  — per-set price series for everything else (lazy product pages)

Everything is computed from REAL collected TCGplayer prices. All products are
COLLECTED and stored in the repo; the tier only limits what ships pre-computed
to the browser.
"""
import csv, glob, gzip, json, math, os, re, sys
import numpy as np
import pandas as pd
from datetime import date, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")
DAY_FILES = sorted(glob.glob(os.path.join(ROOT, "data", "prices", "*", "*", "*.csv.gz")))
CATALOG_PATH = os.path.join(ROOT, "data", "catalog.csv.gz")
if not DAY_FILES:
    sys.exit("no day files found — run the collector/backfill first")

TIER_MIN_SINGLE = 5.0
TIER_CAP = 4500
TOP_MARKS_DAYS = 60

# ---------------- load price history (market only; aux for recent days) ----------------
dtypes = {"category": "category", "group_id": "int32", "product_id": "int32",
          "subtype": "category", "market": "float32"}
frames = []
for f in DAY_FILES:
    df = pd.read_csv(f, usecols=["date", "category", "group_id", "product_id", "subtype", "market"],
                     dtype=dtypes)
    frames.append(df)
H = pd.concat(frames, ignore_index=True)
del frames
DATES_S = sorted(H["date"].unique())
START, END = date.fromisoformat(DATES_S[0]), date.fromisoformat(DATES_S[-1])
N = (END - START).days + 1
DATES = [START + timedelta(days=i) for i in range(N)]
DIDX = {d.isoformat(): i for i, d in enumerate(DATES)}
H["di"] = H["date"].map(DIDX).astype("int32")
WINDOW_LABEL = START.strftime("%b %Y")
print(f"history: {len(H):,} rows, {len(DATES_S)} days, {START} -> {END}")

# aux (low/mid/high/direct) for the recent window only
aux_frames = []
for f in DAY_FILES[-TOP_MARKS_DAYS:]:
    aux_frames.append(pd.read_csv(f, usecols=["date", "product_id", "subtype", "market",
                                              "low", "mid", "high", "direct_low"]))
AUX = pd.concat(aux_frames, ignore_index=True)
del aux_frames

# ---------------- catalog ----------------
CAT = pd.read_csv(CATALOG_PATH, dtype={"group_id": "int32", "product_id": "int32"})
CAT["number"] = CAT["number"].fillna("").astype(str)
CAT["rarity"] = CAT["rarity"].fillna("").astype(str)
if "image_url" not in CAT.columns:  # catalogs collected before v5 lack images
    CAT["image_url"] = ""
CAT["image_url"] = CAT["image_url"].fillna("").astype(str)
CAT = CAT.drop_duplicates("product_id").set_index("product_id")
# exclude digital code cards from everything (covers history collected before the collector-side filter)
CODE_RE = re.compile(r"code card|online code|tcg live code|ptcgo code|ptcgl", re.I)
CODE_PIDS = set(CAT.index[CAT["name"].astype(str).str.contains(CODE_RE, na=False)])
print(f"catalog: {len(CAT):,} products ({len(CODE_PIDS):,} code cards excluded)")

# ---------------- pick primary subtype per product ----------------
PRIORITY = ["Unlimited Holofoil", "Holofoil", "Normal", "Unlimited",
            "Reverse Holofoil", "1st Edition Holofoil", "1st Edition Normal"]
prio = {s: i for i, s in enumerate(PRIORITY)}
counts = (H.dropna(subset=["market"]).groupby(["product_id", "subtype"], observed=True)
          .size().reset_index(name="n"))
counts["pr"] = counts["subtype"].map(lambda s: prio.get(s, 99))
counts = counts.sort_values(["product_id", "pr"]).drop_duplicates("product_id")
PRIMARY = dict(zip(counts["product_id"], counts["subtype"]))
Hp = H.merge(counts[["product_id", "subtype"]], on=["product_id", "subtype"], how="inner")
del H
print(f"primary series: {Hp['product_id'].nunique():,} products")

# ---------------- build per-product series ----------------
piv = Hp.pivot_table(index="product_id", columns="di", values="market", aggfunc="last")
piv = piv.reindex(columns=range(N))
MAT = piv.to_numpy(dtype="float32")
PIDS = piv.index.to_numpy()
PID_POS = {int(p): i for i, p in enumerate(PIDS)}
GROUP_OF = dict(zip(Hp.drop_duplicates("product_id")["product_id"],
                    zip(Hp.drop_duplicates("product_id")["category"],
                        Hp.drop_duplicates("product_id")["group_id"])))
del piv, Hp

def ffill_row(row):
    idx = np.where(~np.isnan(row))[0]
    if len(idx) == 0: return None, None, 0
    first = int(idx[0])
    seg = row[first:].copy()
    mask = np.isnan(seg)
    if mask.any():
        vals = np.where(mask, 0, seg)
        # forward fill
        last = np.maximum.accumulate(np.where(mask, -1, np.arange(len(seg))))
        seg = seg[last]
    return first, seg, int((~mask).sum()) if 'mask' in dir() else len(seg)

SERIES = {}
for i, pid in enumerate(PIDS):
    row = MAT[i]
    idx = np.where(~np.isnan(row))[0]
    if len(idx) == 0: continue
    first = int(idx[0])
    seg = row[first:]
    mask = np.isnan(seg)
    if mask.any():
        pos = np.where(~mask, np.arange(len(seg)), -1)
        pos = np.maximum.accumulate(pos)
        seg = seg[pos]
    if int(pid) in CODE_PIDS:
        continue
    SERIES[int(pid)] = {"startIdx": first, "p": seg.astype("float64"),
                        "realDays": int((~mask).sum()),
                        "coverage": float((~mask).sum()) / len(seg),
                        "lastReal": DATES[int(idx[-1])].isoformat()}
del MAT
print(f"series built: {len(SERIES):,}")

# ---------------- featured (curated) metadata ----------------
FEAT_META = json.load(open(os.path.join(ROOT, "scripts", "assets_meta.json"), encoding="utf-8"))
def match_featured():
    """Map curated universe rows -> product_id using the catalog (offline)."""
    out = {}
    cat = CAT.reset_index()
    for row in csv.DictReader(open(os.path.join(ROOT, "universe.csv"), encoding="utf-8")):
        kid = row["asset_id"]; q = row["set_query"].lower(); mv = row["match_value"].lower()
        sub = cat[(cat["category"] == row["category"]) &
                  cat["group_name"].str.lower().str.contains(re.escape(q), na=False)]
        if sub.empty: continue
        if row["match_kind"] == "number":
            def norm(s):
                return "/".join((seg.lstrip("0") or "0") for seg in str(s).lower().split("/"))
            hit = sub[sub["number"].map(norm) == norm(mv)]
            if hit.empty and "/" in mv:
                hit = sub[sub["number"].map(norm) == norm(mv.split("/")[0])]
        else:
            hit = sub[sub["name"].str.lower().str.contains(re.escape(mv), na=False) &
                      ~sub["name"].str.lower().str.contains("case", na=False)]
            hit = hit.assign(L=hit["name"].str.len()).sort_values("L")
        if not hit.empty:
            out[int(hit.iloc[0]["product_id"])] = kid
    return out
PID2KIT = match_featured()
KIT2PID = {v: k for k, v in PID2KIT.items()}
print(f"featured matched: {len(PID2KIT)}/80")

# ---------------- auto metadata ----------------
ERAS = [("1998-01-01", "2003-09-30", "WOTC"), ("2003-10-01", "2007-08-31", "EX"),
        ("2007-09-01", "2011-04-30", "DPPt"), ("2011-05-01", "2013-12-31", "BW"),
        ("2014-01-01", "2016-12-31", "XY"), ("2017-01-01", "2020-01-31", "SM"),
        ("2020-02-01", "2023-02-28", "SWSH"), ("2023-03-01", "2025-08-31", "SV"),
        ("2025-09-01", "2099-01-01", "Mega")]
def sub_era(published):
    if not published: return "SV"
    for a, b, name in ERAS:
        if a <= published <= b: return name
    return "SV"
SUFFIX = re.compile(r"\s+(V|VMAX|VSTAR|ex|EX|GX|BREAK|Prime|LEGEND|Radiant|Dark|Light|LV\.X)\b.*$")
def char_guess(name, is_sealed):
    if is_sealed: return None
    n = re.sub(r"\s*[\(\[-].*$", "", str(name)).strip()
    n = SUFFIX.sub("", n).strip()
    n = re.sub(r"^.*'s\s+", "", n)  # Blaine's Charizard -> Charizard
    return n or None
def kind_guess(name):
    n = str(name).lower()
    for pat, kind in [("booster box", "Booster Box"), ("elite trainer", "Elite Trainer Box"),
                      ("booster bundle", "Booster Bundle"), ("premium collection", "Premium Collection"),
                      ("collection box", "Collection Box"), ("booster pack", "Booster Pack"),
                      ("tin", "Tin"), ("build & battle", "Build & Battle"), ("deck", "Deck")]:
        if pat in n: return kind
    return "Sealed Product"

def meta_for(pid):
    c = CAT.loc[pid] if pid in CAT.index else None
    kit = PID2KIT.get(pid)
    fm = FEAT_META.get(kit, {}) if kit else {}
    if c is None and not fm:
        return None
    name = fm.get("name") or (str(c["name"]) if c is not None else f"Product {pid}")
    is_sealed = bool(fm.get("kind")) or (c is not None and bool(c["is_sealed"]))
    published = str(c["published"]) if c is not None and isinstance(c["published"], str) else ""
    se = fm.get("subEra") or sub_era(published)
    return {
        "kitId": kit, "name": name,
        "set": fm.get("set") or (str(c["group_name"]) if c is not None else "?"),
        "num": fm.get("num") or (str(c["number"]) if c is not None and c["number"] else None),
        "rarity": fm.get("rarity") or (str(c["rarity"]) if c is not None and c["rarity"] else None),
        "kind": fm.get("kind") or (kind_guess(name) if is_sealed else None),
        "character": fm.get("character") or char_guess(name, is_sealed),
        "era": "vintage" if se == "WOTC" else "modern", "subEra": se,
        "lang": "JP" if (c is not None and c["category"] == "pokemon-japan") else "EN",
        "release": fm.get("release") or (published or None),
        "nickname": fm.get("nickname"), "msrp": fm.get("msrp"),
        "trophyTag": bool(fm.get("trophy")), "sealed": is_sealed,
    }

# ---------------- metrics / scores (same math as before) ----------------
def pct(a, b): return (a / b - 1) * 100 if (a is not None and b) else None
def logistic(x): return 1 / (1 + math.exp(-x))
EOM_PREV = END.replace(day=1) - timedelta(days=1)
EOM_PREV2 = EOM_PREV.replace(day=1) - timedelta(days=1)
YTD_BASE = date(END.year - 1, 12, 31)

AUX_LAST = AUX.sort_values("date").groupby("product_id").last()

def compute(pid, s):
    p = s["p"]; now = float(p[-1]); m = {}
    def ret(days, key):
        m[key] = ({"pct": round(pct(now, float(p[-days-1])), 2),
                   "usd": round(now - float(p[-days-1]), 2)} if len(p) > days else None)
    ret(7, "r7"); ret(30, "r30"); ret(90, "r90"); ret(180, "r180"); ret(365, "r1y")
    def at(d):
        i = DIDX.get(d.isoformat())
        if i is None or i < s["startIdx"]: return None
        return float(p[i - s["startIdx"]])
    a1, a0 = at(EOM_PREV), at(EOM_PREV2)
    m["mom"] = ({"pct": round(pct(a1, a0), 2), "usd": round(a1 - a0, 2)} if a1 and a0 else None)
    y0 = at(YTD_BASE)
    m["ytd"] = ({"pct": round(pct(now, y0), 2), "usd": round(now - y0, 2)} if y0 else None)
    m["window"] = {"pct": round(pct(now, float(p[0])), 2), "usd": round(now - float(p[0]), 2)}
    i_ath, i_atl = int(p.argmax()), int(p.argmin())
    m["ath"] = {"price": round(float(p.max()), 2), "date": DATES[s["startIdx"] + i_ath].isoformat(),
                "fromPct": round(pct(now, float(p.max())), 2), "fromUsd": round(now - float(p.max()), 2)}
    m["atl"] = {"price": round(float(p.min()), 2), "date": DATES[s["startIdx"] + i_atl].isoformat(),
                "fromPct": round(pct(now, float(p.min())), 2), "fromUsd": round(now - float(p.min()), 2)}
    def av(days):
        seg = p[-days-1:]
        if len(seg) < 15: return None
        r = np.diff(np.log(np.maximum(seg, 1e-9)))
        r = r[np.abs(r) > 1e-12]
        if len(r) < 8: return None
        return round(float(np.std(r) * math.sqrt(365) * 100), 1)
    m["vol30"], m["vol90"] = av(30), av(90)
    ma50 = float(np.mean(p[-50:])) if len(p) >= 50 else None
    ma200 = float(np.mean(p[-200:])) if len(p) >= 200 else None
    m["ma50"], m["ma200"] = (round(ma50, 2) if ma50 else None), (round(ma200, 2) if ma200 else None)
    m["vsMa50"] = round(pct(now, ma50), 2) if ma50 else None
    m["vsMa200"] = round(pct(now, ma200), 2) if ma200 else None
    if pid in AUX_LAST.index:
        r = AUX_LAST.loc[pid]
        lo, mid, hi, dl = (None if pd.isna(r[k]) else round(float(r[k]), 2)
                           for k in ("low", "mid", "high", "direct_low"))
    else:
        lo = mid = hi = dl = None
    m["listLow"], m["listMid"], m["listHigh"], m["directLow"] = lo, mid, hi, dl
    m["spreadPct"] = round((mid - lo) / mid * 100, 1) if (lo is not None and mid) else None
    m["realDays"] = s["realDays"]; m["coverage"] = round(s["coverage"] * 100, 1)
    m["firstDate"] = DATES[s["startIdx"]].isoformat(); m["lastReal"] = s["lastReal"]
    m["subtype"] = PRIMARY.get(pid, "Normal")
    return m, now

def scores_for(m):
    s = {}
    vol90 = m["vol90"] or 30
    vol_pct = min(1.0, vol90 / 80)
    s["volatility"] = round(vol_pct * 100, 1)
    rng = 1 - min(1, (m["ath"]["price"] - m["atl"]["price"]) / max(m["ath"]["price"], 1e-9))
    s["stability"] = round(100 * (0.65 * (1 - vol_pct) + 0.35 * rng), 1)
    r7 = m["r7"]["pct"] if m["r7"] else 0; r30 = m["r30"]["pct"] if m["r30"] else 0
    r90 = m["r90"]["pct"] if m["r90"] else 0
    core = 0.25*np.clip(r7,-15,15)/15 + 0.45*np.clip(r30,-30,30)/30 + 0.30*np.clip(r90,-60,60)/60
    ma_term = 0.12 if (m["vsMa50"] or 0) > 0 else -0.12
    s["momentum"] = round(float(np.clip(50 + 55*core + 100*ma_term*0.1, 0, 100)), 1)
    sp = m["spreadPct"]
    s["spread"] = round(max(0.0, 1 - (sp or 30) / 30) * 100, 1)
    conf = 92 - 14*vol_pct - (100 - m["coverage"]) * 0.45
    if sp is not None and sp > 25: conf -= 12
    if m["realDays"] < 60: conf -= 15
    s["confidence"] = round(float(np.clip(conf, 5, 99)), 1)
    long_tr = np.clip((m["r180"]["pct"] if m["r180"] else m["window"]["pct"]) or 0, -60, 120)
    s["quality"] = round(float(np.clip(
        0.24*s["stability"] + 0.28*(50 + long_tr/120*50) + 0.25*s["confidence"] +
        0.13*s["spread"] + 0.10*(100 + np.clip(m["ath"]["fromPct"], -50, 0)*2)*0.5, 0, 100)), 1)
    near_ath = max(0.0, 1 + m["ath"]["fromPct"] / 12)
    s["breakout"] = round(float(logistic(-2.4 + 2.8*near_ath + 1.7*(s["momentum"]-50)/50)), 3)
    # Heat Score: momentum + multi-horizon agreement + trend position + near-high, spread-penalized
    r7v = m["r7"]["pct"] if m["r7"] else 0
    agree = sum(1 for v in (r7v, r30, r90) if v > 1) - sum(1 for v in (r7v, r30, r90) if v < -1)
    heat = (0.55 * s["momentum"] + 7 * agree
            + (8 if (m["vsMa50"] or 0) > 0 else -8) + (5 if (m["vsMa200"] or 0) > 0 else -5)
            + 12 * max(0.0, 1 + (m["ath"]["fromPct"] or -99) / 15)
            - 0.35 * max(0.0, (m["spreadPct"] or 10) - 10))
    s["heat"] = round(float(np.clip(heat, 0, 100)), 1)
    return s

def temperature(m, s):
    """Plain-language market climate. Order matters: strongest signals first."""
    r30 = m["r30"]["pct"] if m["r30"] else 0
    above50 = (m["vsMa50"] or 0) > 0
    if r30 >= 8 and above50 and s["momentum"] >= 62: return "hot"
    if r30 <= -8 and not above50 and s["momentum"] <= 38: return "cold"
    if r30 >= 3 and s["momentum"] >= 53: return "warming"
    if r30 <= -3 or (not above50 and s["momentum"] < 45): return "cooling"
    return "stagnant"

def temp_at(p):
    """Temperature evaluated on a truncated price series (for transition detection)."""
    if len(p) < 35: return None
    now = float(p[-1])
    r30 = pct(now, float(p[-31]))
    r7 = pct(now, float(p[-8])) if len(p) > 8 else 0
    r90 = pct(now, float(p[-91])) if len(p) > 91 else r30
    ma50 = float(np.mean(p[-50:])) if len(p) >= 50 else now
    above50 = now > ma50
    core = 0.25*np.clip(r7 or 0,-15,15)/15 + 0.45*np.clip(r30 or 0,-30,30)/30 + 0.30*np.clip(r90 or 0,-60,60)/60
    mom = float(np.clip(50 + 55*core + (1.2 if above50 else -1.2), 0, 100))
    if (r30 or 0) >= 8 and above50 and mom >= 62: return "hot"
    if (r30 or 0) <= -8 and not above50 and mom <= 38: return "cold"
    if (r30 or 0) >= 3 and mom >= 53: return "warming"
    if (r30 or 0) <= -3 or (not above50 and mom < 45): return "cooling"
    return "stagnant"

def find_supports(p, start_idx):
    """Detect long-tested price floors: clustered local minima with >=3 touches over >=60 days."""
    n = len(p)
    if n < 90: return {"lines": [], "state": "none", "dist": None}
    piv = []
    for i in range(5, n - 2):
        w = p[max(0, i-5):i+6]
        if p[i] <= w.min() * 1.001:
            piv.append((i, float(p[i])))
    clusters = []
    for i, v in piv:
        placed = False
        for c in clusters:
            if abs(v / c["level"] - 1) <= 0.03:
                c["touch"].append(i)
                c["level"] = float(np.median([p[j] for j in c["touch"]]))
                placed = True
                break
        if not placed:
            clusters.append({"level": v, "touch": [i]})
    now = float(p[-1])
    lines = []
    for c in clusters:
        t = sorted(set(c["touch"]))
        # count touch episodes at least 10 days apart, spanning >= 60 days
        eps, last = [], -99
        for i in t:
            if i - last >= 10: eps.append(i)
            last = i
        if len(eps) >= 3 and (t[-1] - t[0]) >= 60 and c["level"] <= now * 1.10:
            lines.append({"level": round(c["level"], 2), "touches": len(eps),
                          "from": DATES[start_idx + t[0]].isoformat()[:7],
                          "to": DATES[start_idx + t[-1]].isoformat()[:7]})
    lines.sort(key=lambda l: (-l["touches"], -l["level"]))
    lines = lines[:2]
    state, dist = "none", None
    if lines:
        lv = lines[0]["level"]
        dist = round((now / lv - 1) * 100, 1)
        if dist < -3: state = "broken"
        elif dist <= 8: state = "on"
        else: state = "above"
    return {"lines": lines, "state": state, "dist": dist}

def eligibility(price, m, s, is_sealed):
    reasons = []
    minp = 25 if is_sealed else 5
    if price < minp: reasons.append(f"price below ${minp} floor")
    if m["realDays"] < 120: reasons.append(f"only {m['realDays']} days of real price data")
    if m["coverage"] < 70: reasons.append(f"price present on only {m['coverage']:.0f}% of days (thin market)")
    if s["confidence"] < 40: reasons.append("confidence below 40")
    return {"eligible": not reasons, "reasons": reasons}

def scenario(price, m, s):
    vol90 = (m["vol90"] or 30) / 100
    drift = float(np.clip((m["r90"]["pct"] if m["r90"] else 0) / 100, -0.25, 0.35))
    band = vol90 * math.sqrt(0.5)
    base = price * (1 + drift * 0.5)
    return {"horizonMonths": 6, "base": round(base, 2),
            "bull": round(base*(1+1.15*band), 2), "bear": round(base*(1-1.05*band), 2),
            "rangeLow": round(price*(1-0.8*band), 2), "rangeHigh": round(price*(1+0.8*band), 2),
            "trendContinuation": round(float(logistic(0.9*(s["momentum"]-50)/15)), 2),
            "meanReversion": round(float(logistic(-((m["vsMa200"] or 0)) / 18)) if m["vsMa200"] is not None else 0.5, 2),
            "confidence": "high" if s["confidence"] > 75 else ("medium" if s["confidence"] > 55 else "low")}

def commentary(name, m, s):
    bits = []
    if m["mom"]:
        d = "rose" if m["mom"]["pct"] >= 0 else "declined"
        bits.append(f"{name} {d} {abs(m['mom']['pct']):.1f}% (${abs(m['mom']['usd']):,.2f}) month-over-month on real TCGplayer pricing.")
    if m["ath"]["fromPct"] is not None and m["ath"]["fromPct"] > -4:
        bits.append(f"Trading within {abs(m['ath']['fromPct']):.1f}% of its high since {WINDOW_LABEL} — breakout probability {s['breakout']*100:.0f}%.")
    elif m["ath"]["fromPct"] is not None and m["ath"]["fromPct"] < -30:
        bits.append(f"Still {abs(m['ath']['fromPct']):.0f}% below the {m['ath']['date'][:7]} high of ${m['ath']['price']:,.0f}.")
    if m["vsMa200"] is not None and m["vsMa200"] > 25:
        bits.append(f"Price is {m['vsMa200']:.0f}% above its 200-day average — historically stretched.")
    if m["spreadPct"] is not None:
        if m["spreadPct"] > 20:
            bits.append(f"The listed spread is wide ({m['spreadPct']:.0f}%), so the quoted value is soft — negotiate.")
        elif m["spreadPct"] < 6:
            bits.append(f"Listings are tightly priced (spread {m['spreadPct']:.1f}%), supporting the quoted value.")
    if m["coverage"] < 80:
        bits.append(f"Caution: real prices exist on only {m['coverage']:.0f}% of days — thin, sporadic trading.")
    bits.append("Sales-volume and eBay metrics are not yet collected; price-based indicators only.")
    return " ".join(bits[:4])

def recent_marks(pid, n=7):
    sub = AUX[AUX["product_id"] == pid].sort_values("date", ascending=False)
    out = []
    for _, r in sub.iterrows():
        if pd.isna(r["market"]) and pd.isna(r["low"]): continue
        out.append({"date": r["date"],
                    "market": None if pd.isna(r["market"]) else round(float(r["market"]), 2),
                    "low": None if pd.isna(r["low"]) else round(float(r["low"]), 2),
                    "mid": None if pd.isna(r["mid"]) else round(float(r["mid"]), 2),
                    "high": None if pd.isna(r["high"]) else round(float(r["high"]), 2)})
        if len(out) >= n: break
    return out

# ---------------- tier selection ----------------
latest = {pid: float(s["p"][-1]) for pid, s in SERIES.items()}
sealed_flag = {}
for pid in SERIES:
    mm = meta_for(pid)
    sealed_flag[pid] = bool(mm and mm["sealed"])
tier = [pid for pid in SERIES
        if sealed_flag[pid] or latest[pid] >= TIER_MIN_SINGLE or pid in PID2KIT]
tier.sort(key=lambda p: latest[p], reverse=True)
if len(tier) > TIER_CAP:
    keep = set(p for p in tier if sealed_flag[p] or p in PID2KIT)
    for p in tier:
        if len(keep) >= TIER_CAP: break
        keep.add(p)
    tier = [p for p in tier if p in keep]
print(f"terminal tier: {len(tier):,} of {len(SERIES):,} tracked products")

assets = []
for pid in tier:
    meta = meta_for(pid)
    if meta is None: continue
    s = SERIES[pid]
    m, now = compute(pid, s)
    sc = scores_for(m)
    sc["temp"] = temperature(m, sc)
    p = s["p"]
    sc["tempHist"] = {"d1": temp_at(p[:-1]), "d7": temp_at(p[:-7]) if len(p) > 41 else None,
                      "d30": temp_at(p[:-30]) if len(p) > 64 else None}
    is_sealed = meta["sealed"]
    aid = meta["kitId"] or f"p{pid}"
    img = str(CAT.loc[pid, "image_url"]) if pid in CAT.index else ""
    rnd = 3 if now < 2 else 2
    assets.append({
        "img": img or None,
        "id": aid, "pid": pid, "name": meta["name"], "type": "sealed" if is_sealed else "single",
        "set": meta["set"], "num": meta["num"], "rarity": meta["rarity"], "kind": meta["kind"],
        "character": meta["character"], "era": meta["era"], "subEra": meta["subEra"], "lang": meta["lang"],
        "release": meta["release"], "printing": "Unlimited" if "Unlimited" in m["subtype"] else None,
        "cond": "sealed" if is_sealed else "raw", "nickname": meta["nickname"], "msrp": meta["msrp"],
        "trophy": meta["trophyTag"] or m["coverage"] < 40,
        "price": round(now, 2), "anchor": "real-tcgcsv",
        "metrics": m, "scores": sc, "eligible": eligibility(now, m, sc, is_sealed),
        "scenario": scenario(now, m, sc), "commentary": commentary(meta["name"], m, sc),
        "supports": find_supports(s["p"], s["startIdx"]),
        "recentMarks": recent_marks(pid),
        "series": {"startIdx": s["startIdx"], "p": [round(float(x), rnd) for x in s["p"]]},
    })

# ---------------- indexes (same rules; auto-membership from full tier) ----------------
def build_indexes():
    full = [a for a in assets if a["series"]["startIdx"] <= 7 and not a["trophy"]
            and a["metrics"]["coverage"] >= 85]
    ee = ("Umbreon","Sylveon","Glaceon","Leafeon","Espeon","Vaporeon","Jolteon","Flareon","Eevee")
    DEFS = [
        ("idx_overall", "PokéQuant Composite", "All full-history eligible assets, price-weighted, 10% cap.", lambda a: True, "cap"),
        ("idx_sealed", "Sealed Product Index", "Full-history sealed products.", lambda a: a["type"] == "sealed", "cap"),
        ("idx_singles", "Singles Index", "Full-history single cards ≥ $5.", lambda a: a["type"] == "single", "cap"),
        ("idx_q_sm", "Sealed · Modern", "Modern-era factory-sealed products.", lambda a: a["type"] == "sealed" and a["era"] == "modern", "cap"),
        ("idx_q_sv", "Sealed · Vintage", "WOTC-era factory-sealed products.", lambda a: a["type"] == "sealed" and a["era"] == "vintage", "eq"),
        ("idx_q_gm", "Singles · Modern", "Modern-era single cards.", lambda a: a["type"] == "single" and a["era"] == "modern", "cap"),
        ("idx_q_gv", "Singles · Vintage", "WOTC-era single cards.", lambda a: a["type"] == "single" and a["era"] == "vintage", "eq"),
    ] + [
        (f"idx_era_{e.lower()}", f"{e} Era Index", f"All full-history {e}-era assets.",
         (lambda ee: lambda a: a["subEra"] == ee)(e), "cap")
        for e in ("WOTC", "EX", "DPPt", "BW", "XY", "SM", "SWSH", "SV", "Mega")
    ] + [
        ("idx_vintage", "Vintage Index", "WOTC-era assets.", lambda a: a["era"] == "vintage", "eq"),
        ("idx_modern", "Modern Index", "Post-WOTC assets.", lambda a: a["era"] == "modern", "cap"),
        ("idx_bb", "Booster Box Index", "Factory-sealed booster boxes.", lambda a: a.get("kind") == "Booster Box", "eq"),
        ("idx_etb", "Elite Trainer Box Index", "Elite trainer boxes.", lambda a: a.get("kind") == "Elite Trainer Box", "eq"),
        ("idx_highend", "High-End Index", "Assets priced ≥ $500.", lambda a: a["price"] >= 500, "eq"),
        ("idx_entry", "Entry-Level Index", "Assets priced $5–$100.", lambda a: 5 <= a["price"] <= 100, "eq"),
        ("idx_pikachu", "Pikachu Index", "Cards whose name contains Pikachu.", lambda a: "pikachu" in a["name"].lower(), "eq"),
        ("idx_charizard", "Charizard Index", "Cards whose name contains Charizard.", lambda a: "charizard" in a["name"].lower(), "eq"),
        ("idx_eevee", "Eeveelution Index", "Eevee-family cards.", lambda a: any(e.lower() in a["name"].lower() for e in ee), "eq"),
        ("idx_jp", "Japanese Product Index", "Japanese-language assets.", lambda a: a["lang"] == "JP", "eq"),
        ("idx_en", "English Product Index", "English full-history assets.", lambda a: a["lang"] == "EN", "cap"),
    ]
    out = []
    daily_store = {}
    def idx_temp(series):
        now = float(series[-1])
        r30 = pct(now, float(series[-31])) if len(series) > 31 else 0
        r90 = pct(now, float(series[-91])) if len(series) > 91 else 0
        ma50 = float(np.mean(series[-50:])) if len(series) >= 50 else now
        above = now > ma50
        if r30 >= 6 and above and r90 >= 10: return "hot"
        if r30 <= -6 and not above: return "cold"
        if r30 >= 2.5: return "warming"
        if r30 <= -2.5 or not above: return "cooling"
        return "stagnant"
    for iid, name, desc, pred, wmode in DEFS:
        members = [a for a in full if pred(a)]
        if len(members) < 2: continue
        members = sorted(members, key=lambda a: -a["price"])[:150]  # bound index size
        mats = np.array([np.concatenate([np.full(a["series"]["startIdx"], np.nan),
                                         np.array(a["series"]["p"])])[:N] for a in members])
        base_col = max(a["series"]["startIdx"] for a in members)
        rel = mats[:, base_col:] / mats[:, base_col:base_col + 1]
        if wmode == "cap":
            w = np.array([a["price"] for a in members], float); w /= w.sum()
            cap = 0.10 if len(members) >= 10 else 0.30
            for _ in range(10):
                over = w > cap
                if not over.any(): break
                ex = (w[over] - cap).sum(); w[over] = cap
                under = ~over
                if w[under].sum() > 0: w[under] += ex * w[under] / w[under].sum()
            w /= w.sum()
        else:
            w = np.full(len(members), 1 / len(members))
        series = np.nansum(rel * w[:, None], axis=0) * 100
        series = np.concatenate([np.full(base_col, series[0]), series])
        daily_store[iid] = series
        wk = [round(float(x), 2) for x in series[::7]] + [round(float(series[-1]), 2)]
        def r(days): return round(pct(float(series[-1]), float(series[-days-1])), 2) if len(series) > days else None
        out.append({"id": iid, "name": name, "desc": desc,
                    "weighting": "price-weighted (10% cap)" if wmode == "cap" else "equal-weighted",
                    "members": [a["id"] for a in members], "level": round(float(series[-1]), 2),
                    "r30": r(30), "r90": r(90), "r180": r(180), "temp": idx_temp(series),
                    "window": round(pct(float(series[-1]), 100), 2), "series": wk})
    return out, daily_store

indexes, IDX_DAILY = build_indexes()

# ---------------- quadrant rotation + cross-market correlations ----------------
def quadrant_story():
    QK = {"sm": "idx_q_sm", "sv": "idx_q_sv", "gm": "idx_q_gm", "gv": "idx_q_gv"}
    # quarterly returns per quadrant
    qstarts = []
    d = date(START.year, ((START.month - 1) // 3) * 3 + 1, 1)
    while d <= END:
        qstarts.append(d)
        d = date(d.year + (1 if d.month > 9 else 0), (d.month + 3 - 1) % 12 + 1, 1)
    rotation = []
    for i, qs in enumerate(qstarts):
        qe = min(qstarts[i + 1] - timedelta(days=1) if i + 1 < len(qstarts) else END, END)
        i0 = max(0, (qs - START).days); i1 = min(N - 1, (qe - START).days)
        if i1 - i0 < 20: continue
        rets = {}
        for k, iid in QK.items():
            s = IDX_DAILY.get(iid)
            if s is None or i1 >= len(s): continue
            rets[k] = round(pct(float(s[i1]), float(s[i0])), 1)
        if not rets: continue
        leader = max(rets, key=lambda k: rets[k])
        rotation.append({"q": f"Q{(qs.month - 1) // 3 + 1} '{qs.strftime('%y')}",
                         "ret": rets, "leader": leader})
    # weekly-return correlations between the classic splits
    def corr(a, b):
        sa, sb = IDX_DAILY.get(a), IDX_DAILY.get(b)
        if sa is None or sb is None: return None
        ra = np.diff(np.log(sa[::7])); rb = np.diff(np.log(sb[::7]))
        n = min(len(ra), len(rb))
        return round(float(np.corrcoef(ra[-n:], rb[-n:])[0, 1]), 2)
    correlations = [p for p in [
        {"a": "Sealed", "b": "Singles", "r": corr("idx_sealed", "idx_singles")},
        {"a": "Vintage", "b": "Modern", "r": corr("idx_vintage", "idx_modern")},
        {"a": "Sealed·Modern", "b": "Singles·Vintage", "r": corr("idx_q_sm", "idx_q_gv")},
    ] if p["r"] is not None]
    return {"rotation": rotation, "correlations": correlations}

QUADRANTS = quadrant_story()

def aggregates():
    def group(keyfn, minn=3):
        g = {}
        for a in assets:
            k = keyfn(a)
            if k: g.setdefault(k, []).append(a)
        rows = []
        for k, items in g.items():
            if len(items) < minn: continue
            r90 = [x["metrics"]["r90"]["pct"] for x in items if x["metrics"]["r90"]]
            mom = [x["metrics"]["mom"]["pct"] for x in items if x["metrics"]["mom"]]
            if not r90: continue
            rows.append({"name": k, "count": len(items), "medR90": round(float(np.median(r90)), 2),
                         "medMoM": round(float(np.median(mom)), 2) if mom else None})
        rows.sort(key=lambda r: r["medR90"], reverse=True)
        return rows[:24]
    return {"characters": group(lambda a: a.get("character") if a["type"] == "single" else None, minn=4),
            "sets": group(lambda a: a.get("set")),
            "eras": group(lambda a: a.get("subEra"), minn=5),
            "kinds": group(lambda a: a.get("kind"), minn=3)}

def ctx():
    A = {a["id"]: a for a in assets}
    lines = []
    def w(aid, label):
        a = A.get(aid)
        if a and a["metrics"]["window"]:
            mom = a["metrics"]["mom"]
            lines.append(f"{label}: {a['metrics']['window']['pct']:+.0f}% since {WINDOW_LABEL} "
                         f"(now ${a['price']:,.0f})" + (f", {mom['pct']:+.1f}% MoM." if mom else "."))
    w("sl-evs-box", "Evolving Skies booster box")
    w("swsh7-215", "Umbreon VMAX alt art (Moonbreon)")
    w("sv8pt5-161", "Prismatic Umbreon ex SIR")
    w("base1-4", "Base Set Charizard (raw)")
    ix = {i["id"]: i for i in indexes}
    if "idx_sealed" in ix and "idx_singles" in ix:
        lines.append(f"Sealed index {ix['idx_sealed']['window']:+.0f}% vs singles {ix['idx_singles']['window']:+.0f}% since {WINDOW_LABEL}; "
                     f"last 30 days: sealed {ix['idx_sealed']['r30']:+.1f}%, singles {ix['idx_singles']['r30']:+.1f}%.")
    return lines

METHODOLOGY = {
    "momentum": "Market Momentum Score (0–100). 25% one-week, 45% one-month, 30% three-month real returns (winsorized), plus position vs the 50-day average. Volume confirmation will be added when sales data is collected. 50 = neutral.",
    "volatility": "Volatility Score (0–100). Annualized standard deviation of real daily returns over 90 days (flat forward-filled days excluded), scaled so 80%+ annualized = 100.",
    "stability": f"Stability Score (0–100). 65% inverse volatility + 35% tightness of the trading range since {WINDOW_LABEL}.",
    "spread": "Spread Tightness (0–100). From the real listing structure: (mid − lowest listing) ÷ mid. 100 = razor-thin; 0 = ≥30% gap. A practical liquidity proxy until sales counts are collected.",
    "confidence": "Price Confidence (0–99). Starts at 92 (exchange-collected data), minus volatility noise, minus coverage penalty, minus wide-spread and short-history penalties.",
    "quality": "Investment Quality Score (0–100). 28% six-month trend, 24% stability, 25% confidence, 13% spread tightness, 10% drawdown resilience.",
    "breakout": "Breakout Probability (0–1). Logistic model of proximity to the window high and momentum. Model estimate, not a prediction.",
    "meaningfulMove": "Meaningful Move Score: sign × |%Δ|^0.6 × log10(1+|$Δ|)^1.2 — requires dollar relevance, so penny-card percentage spikes never top the boards.",
    "eligibility": "Ranking eligibility: singles ≥ $5, sealed ≥ $25; ≥ 120 days of real data; a real price on ≥ 70% of days; Confidence ≥ 40. Thin/trophy assets stay visible on product pages but off momentum boards.",
    "indexes": f"Indexes contain full-history (from {WINDOW_LABEL}), non-trophy assets with ≥85% coverage, bounded to the 150 largest members. Price-weighted with a 10% cap, or equal-weighted for character/format baskets.",
    "scenarios": "Scenario engine: base case extends damped 90-day real drift over 6 months; bull/bear bands ±~1.1× realized 90-day volatility scaled to horizon. Estimates, not predictions.",
    "heat": "Heat Score (0–100). Momentum (55%) plus multi-horizon trend agreement (1-week, 1-month, 3-month all pointing the same way), position above the 50- and 200-day averages, proximity to the window high, minus a wide-spread penalty. Powers the Hottest boards; 'hot' means confirmed strength, not just a spike.",
    "temperature": "Market temperature. Plain-language climate per asset and index: HOT (≥+8% 30d, above trend, strong momentum) · WARMING (≥+3%, positive momentum) · STAGNANT (range-bound) · COOLING (≤−3% or below trend) · COLD (≤−8%, below trend, weak momentum). Always shown as icon + label, never color alone.",
    "quadrantsNote": "Four-markets view. Sealed/singles and vintage/modern returns barely correlate (measured weekly correlations shown on the overview), so the terminal treats Sealed·Modern, Sealed·Vintage, Singles·Modern and Singles·Vintage as four separate markets with their own indexes, temperatures and leaders.",
    "dataStatus": (f"COLLECTED (real): daily TCGplayer prices for EVERY Pokémon product (EN + JP), {WINDOW_LABEL} → present. "
                   "The terminal pre-computes full analytics for every product ≥ $5 plus all sealed items; every other product "
                   "is searchable and charts on demand from the same real data. NOT YET COLLECTED: sales counts, listing depth, "
                   "eBay sold prices, graded values — metrics needing them are hidden, not estimated."),
}

PORT_KIT = [("swsh7-215",1,1450,"2025-03-12"),("sl-evs-box",2,1180,"2025-04-02"),
            ("sv8pt5-161",1,820,"2025-06-20"),("base1-4",1,640,"2025-02-10"),
            ("sl-151-upc",1,560,"2025-08-05"),("sl-151-etb",3,320,"2025-05-14"),
            ("sv3pt5-199",2,260,"2025-09-01"),("sl-pe-etb",4,95,"2025-02-21"),
            ("sl-dr-box",1,420,"2025-06-05"),("swsh7-212",1,250,"2025-03-30")]
have = {a["id"] for a in assets}
PORTFOLIO = [{"id": k, "qty": q, "buy": b, "date": d} for k, q, b, d in PORT_KIT if k in have]

data = {
    "meta": {"real": True, "generated": END.isoformat(), "windowStart": START.isoformat(),
             "windowEnd": END.isoformat(), "days": N, "windowLabel": WINDOW_LABEL,
             "tierCount": len(assets), "catalogCount": len(SERIES),
             "repo": "github.com/espoaj225/pokequant-data",
             "disclaimer": (f"All price history is REAL TCGplayer pricing collected daily from tcgcsv.com into this "
                            f"repository: {N} days, {START.isoformat()} → {END.isoformat()}. {len(SERIES):,} products "
                            f"tracked; {len(assets):,} carry full pre-computed analytics (every product ≥ $5 + all sealed); "
                            "the rest are searchable and chart on demand. Sales counts, listing depth, eBay and graded data "
                            "are NOT yet collected — dependent metrics are disabled, not estimated. Not financial advice.")},
    "assets": assets, "indexes": indexes, "aggregates": aggregates(),
    "quadrants": QUADRANTS,
    "portfolio": PORTFOLIO, "methodology": METHODOLOGY, "marketContext": ctx(),
}
os.makedirs(DOCS, exist_ok=True)
with open(os.path.join(DOCS, "data.json"), "w", encoding="utf-8") as f:
    json.dump(data, f, separators=(",", ":"))

# ---------------- search catalog for ALL products ----------------
tier_pids = {a["pid"] for a in assets}
cat_out = []
for pid, s in SERIES.items():
    c = CAT.loc[pid] if pid in CAT.index else None
    name = str(c["name"]) if c is not None else f"Product {pid}"
    gset = str(c["group_name"]) if c is not None else "?"
    catkey, gid = GROUP_OF.get(pid, ("pokemon", 0))
    p = s["p"]
    r30 = round(pct(float(p[-1]), float(p[-31])), 1) if len(p) > 31 else None
    cat_out.append([pid, name, gset, str(catkey), int(gid), round(float(p[-1]), 3), r30,
                    1 if pid in tier_pids else 0])
with open(os.path.join(DOCS, "catalog.json"), "w", encoding="utf-8") as f:
    json.dump({"cols": ["pid", "name", "set", "cat", "gid", "price", "r30", "tier"],
               "rows": cat_out}, f, separators=(",", ":"))

# ---------------- lazy series shards for non-tier products (per set) ----------------
shard_dir = os.path.join(DOCS, "series")
os.makedirs(shard_dir, exist_ok=True)
for old in glob.glob(os.path.join(shard_dir, "*.json")):
    os.remove(old)
shards = {}
for pid, s in SERIES.items():
    if pid in tier_pids: continue
    catkey, gid = GROUP_OF.get(pid, ("pokemon", 0))
    key = f"{catkey}-{gid}"
    rnd = 3 if float(s["p"][-1]) < 2 else 2
    shards.setdefault(key, {})[str(pid)] = {
        "s": s["startIdx"], "p": [round(float(x), rnd) for x in s["p"]],
        "rd": s["realDays"], "cov": round(s["coverage"] * 100, 1)}
tot = 0
for key, obj in shards.items():
    path = os.path.join(shard_dir, f"{key}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"))
    tot += os.path.getsize(path)
print(f"data.json {os.path.getsize(os.path.join(DOCS,'data.json'))/1e6:.1f}MB · "
      f"catalog.json {os.path.getsize(os.path.join(DOCS,'catalog.json'))/1e6:.1f}MB · "
      f"{len(shards)} series shards {tot/1e6:.0f}MB")
