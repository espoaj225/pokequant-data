"""Daily collector v4: fetch TODAY's TCGplayer prices for EVERY Pokémon product
(English + Japanese categories) from tcgcsv.

Output (immutable, one file per day — git-friendly):
  data/prices/YYYY/MM/YYYY-MM-DD.csv.gz
    category,group_id,product_id,subtype,market,low,mid,high,direct_low
  data/catalog.csv.gz  — product metadata for ALL products (regenerated daily)
    category,group_id,group_name,published,product_id,name,number,rarity,is_sealed

Idempotent: re-running a day rewrites the same file.
"""
import csv, datetime, gzip, io, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import BASE, get_json, find_categories, product_number, ROOT

PRICES_DIR = os.path.join(ROOT, "data", "prices")
CATALOG = os.path.join(ROOT, "data", "catalog.csv.gz")
SEALED_RE = re.compile(r"booster box|elite trainer|booster bundle|premium collection|collection box|"
                       r"booster pack|blister|tin\b|display|build & battle|battle deck|theme deck|"
                       r"deck box case|booster case|pokemon center", re.I)
# digital redemption codes are not collectibles — excluded from all tracking
CODE_RE = re.compile(r"code card|online code|tcg live code|ptcgo code|ptcgl", re.I)

PRICE_FIELDS = ["date", "category", "group_id", "product_id", "subtype",
                "market", "low", "mid", "high", "direct_low"]

def day_path(ds):
    return os.path.join(PRICES_DIR, ds[:4], ds[5:7], f"{ds}.csv.gz")

def write_day(ds, rows):
    path = day_path(ds)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with gzip.open(path, "wt", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(PRICE_FIELDS)
        w.writerows(rows)
    return path

def collect_today():
    ds = datetime.date.today().isoformat()
    cats = find_categories()
    if not cats:
        sys.exit("could not find Pokemon categories on tcgcsv")
    price_rows, cat_rows = [], []
    n_groups = 0
    for cat_key, cat_id in sorted(cats.items()):
        try:
            groups = get_json(f"{BASE}/{cat_id}/groups")["results"]
        except Exception as e:
            print(f"WARN groups fetch failed for {cat_key}: {e}", file=sys.stderr)
            continue
        for g in groups:
            gid = g["groupId"]
            n_groups += 1
            try:
                prices = get_json(f"{BASE}/{cat_id}/{gid}/prices")["results"]
                products = get_json(f"{BASE}/{cat_id}/{gid}/products")["results"]
            except Exception as e:
                print(f"  WARN group {gid} ({g.get('name','?')}): {e}", file=sys.stderr)
                continue
            code_pids = {pr["productId"] for pr in products if CODE_RE.search(pr.get("name", ""))}
            for p in prices:
                if p["productId"] in code_pids:
                    continue
                price_rows.append([ds, cat_key, gid, p["productId"], p.get("subTypeName") or "Normal",
                                   p.get("marketPrice"), p.get("lowPrice"), p.get("midPrice"),
                                   p.get("highPrice"), p.get("directLowPrice")])
            for pr in products:
                nm = pr.get("name", "")
                if CODE_RE.search(nm):
                    continue
                num = product_number(pr)
                rarity = next((ed.get("value") for ed in pr.get("extendedData") or []
                               if ed.get("name") == "Rarity"), "")
                cat_rows.append([cat_key, gid, g.get("name", ""), (g.get("publishedOn") or "")[:10],
                                 pr["productId"], nm, num, rarity,
                                 1 if (not num and SEALED_RE.search(nm)) else 0,
                                 pr.get("imageUrl") or ""])
    path = write_day(ds, price_rows)
    print(f"{ds}: {len(price_rows)} price rows across {n_groups} groups -> {path}")
    with gzip.open(CATALOG, "wt", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["category", "group_id", "group_name", "published", "product_id",
                    "name", "number", "rarity", "is_sealed", "image_url"])
        w.writerows(cat_rows)
    print(f"catalog: {len(cat_rows)} products -> {CATALOG}")
    if len(price_rows) < 1000:
        sys.exit("suspiciously few rows collected — failing so this is visible")

if __name__ == "__main__":
    collect_today()
