"""Shared helpers: tcgcsv access + universe resolution (asset -> TCGplayer productId)."""
import csv, json, os, sys, time, urllib.request

BASE = "https://tcgcsv.com/tcgplayer"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIVERSE = os.path.join(ROOT, "universe.csv")
RESOLVED = os.path.join(ROOT, "data", "resolved.csv")
PRICES_DIR = os.path.join(ROOT, "data", "prices")

def get_json(url, retries=3):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "PokeQuantCollector/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            if i == retries - 1:
                raise
            time.sleep(2 * (i + 1))

def load_universe():
    with open(UNIVERSE, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))

def find_categories():
    """Map 'pokemon'/'pokemon-japan' -> tcgplayer categoryId by name."""
    cats = get_json(f"{BASE}/categories")["results"]
    out = {}
    for c in cats:
        n = c["name"].strip().lower()
        if n == "pokemon":
            out["pokemon"] = c["categoryId"]
        elif "pokemon" in n and "japan" in n:
            out["pokemon-japan"] = c["categoryId"]
    return out

def find_group(groups, query):
    """Pick the group whose name contains query; prefer the shortest matching name."""
    q = query.lower()
    hits = [g for g in groups if q in g["name"].lower()]
    if not hits:
        return None
    return sorted(hits, key=lambda g: len(g["name"]))[0]

def product_number(p):
    for ed in p.get("extendedData") or []:
        if ed.get("name") in ("Number", "No.", "Card Number"):
            return str(ed.get("value", "")).strip()
    return ""

def resolve(verbose=True):
    """Resolve every universe row to (categoryId, groupId, productId). Caches to data/resolved.csv."""
    uni = load_universe()
    cats = find_categories()
    groups_by_cat, products_by_group = {}, {}
    resolved, problems = [], []
    for row in uni:
        cat_key = row["category"].strip()
        cat_id = cats.get(cat_key)
        if cat_id is None:
            problems.append((row["asset_id"], f"category '{cat_key}' not found on tcgcsv"))
            continue
        try:
            if cat_id not in groups_by_cat:
                groups_by_cat[cat_id] = get_json(f"{BASE}/{cat_id}/groups")["results"]
        except Exception as e:
            problems.append((row["asset_id"], f"groups fetch failed: {e}"))
            continue
        g = find_group(groups_by_cat[cat_id], row["set_query"])
        if g is None:
            problems.append((row["asset_id"], f"no group matching '{row['set_query']}'"))
            continue
        gid = g["groupId"]
        try:
            if gid not in products_by_group:
                products_by_group[gid] = get_json(f"{BASE}/{cat_id}/{gid}/products")["results"]
        except Exception as e:
            problems.append((row["asset_id"], f"products fetch failed for group {gid}: {e}"))
            continue
        prods = products_by_group[gid]
        match = None
        mv = row["match_value"].strip().lower()
        if row["match_kind"] == "number":
            cands = [p for p in prods if product_number(p).lower() == mv]
            # tolerate '085' vs '85' style promo numbers
            if not cands and "/" not in mv:
                cands = [p for p in prods if product_number(p).lstrip("0").lower() == mv.lstrip("0")]
            match = cands[0] if cands else None
        else:  # name substring; prefer shortest product name (avoids "Booster Box Case")
            cands = [p for p in prods if mv in p["name"].lower()]
            cands = [p for p in cands if "case" not in p["name"].lower()]
            match = sorted(cands, key=lambda p: len(p["name"]))[0] if cands else None
        if match is None:
            problems.append((row["asset_id"], f"no product match '{row['match_value']}' in group '{g['name']}'"))
            continue
        resolved.append({
            "asset_id": row["asset_id"], "type": row["type"],
            "category_id": cat_id, "group_id": gid, "group_name": g["name"],
            "product_id": match["productId"], "product_name": match["name"],
            "display_name": row["display_name"],
        })
    os.makedirs(os.path.dirname(RESOLVED), exist_ok=True)
    with open(RESOLVED, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(resolved[0].keys()))
        w.writeheader(); w.writerows(resolved)
    if verbose:
        print(f"resolved {len(resolved)}/{len(uni)} assets -> {RESOLVED}")
        for aid, why in problems:
            print(f"  UNRESOLVED {aid}: {why}", file=sys.stderr)
    return resolved, problems

def load_resolved(refresh=False):
    if refresh or not os.path.exists(RESOLVED):
        return resolve()[0]
    with open(RESOLVED, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))

PRICE_FIELDS = ["date", "asset_id", "product_id", "subtype", "market", "low", "mid", "high", "direct_low"]

def append_rows(rows):
    """Append price rows into monthly shard data/prices/YYYY-MM.csv (plain CSV; tiny)."""
    os.makedirs(PRICES_DIR, exist_ok=True)
    by_month = {}
    for r in rows:
        by_month.setdefault(r["date"][:7], []).append(r)
    for month, rs in sorted(by_month.items()):
        path = os.path.join(PRICES_DIR, f"{month}.csv")
        existing, seen = [], set()
        if os.path.exists(path):
            with open(path, newline="", encoding="utf-8") as f:
                existing = list(csv.DictReader(f))
            seen = {(r["date"], r["asset_id"], r["subtype"]) for r in existing}
        fresh = [r for r in rs if (r["date"], r["asset_id"], r["subtype"]) not in seen]
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=PRICE_FIELDS)
            w.writeheader()
            for r in sorted(existing + fresh, key=lambda x: (x["date"], x["asset_id"], x["subtype"])):
                w.writerow(r)
        print(f"  {month}: +{len(fresh)} rows (total {len(existing)+len(fresh)})")

def days_done():
    out = set()
    if not os.path.isdir(PRICES_DIR):
        return out
    for fn in os.listdir(PRICES_DIR):
        if fn.endswith(".csv"):
            with open(os.path.join(PRICES_DIR, fn), newline="", encoding="utf-8") as f:
                for r in csv.DictReader(f):
                    out.add(r["date"])
    return out
