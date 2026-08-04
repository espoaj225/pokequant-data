"""Daily collector: fetch TODAY's TCGplayer prices from tcgcsv for every tracked asset.

Run once a day (the GitHub Action does this automatically at 21:30 UTC,
after tcgcsv's ~20:00 UTC refresh). Idempotent: re-running the same day
just re-writes the same rows.

Optional keyed sources (enabled automatically when the env var is set):
  PRICECHARTING_TOKEN  -> graded/sealed values from PriceCharting API (slot, see below)
  JUSTTCG_API_KEY      -> cross-check prices from JustTCG (slot, see below)
"""
import os, sys, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import BASE, get_json, load_resolved, append_rows

def collect_today():
    date = datetime.date.today().isoformat()
    resolved = load_resolved(refresh=("--refresh" in sys.argv))
    # group assets by (category, group) so each group's price file is fetched once
    by_group = {}
    for r in resolved:
        by_group.setdefault((r["category_id"], r["group_id"]), []).append(r)
    rows = []
    for (cat, gid), assets in sorted(by_group.items()):
        wanted = {int(a["product_id"]): a for a in assets}
        try:
            res = get_json(f"{BASE}/{cat}/{gid}/prices")["results"]
        except Exception as e:
            print(f"  WARN group {gid}: {e}", file=sys.stderr)
            continue
        for p in res:
            a = wanted.get(p["productId"])
            if not a:
                continue
            rows.append({
                "date": date, "asset_id": a["asset_id"], "product_id": p["productId"],
                "subtype": p.get("subTypeName") or "Normal",
                "market": p.get("marketPrice"), "low": p.get("lowPrice"),
                "mid": p.get("midPrice"), "high": p.get("highPrice"),
                "direct_low": p.get("directLowPrice"),
            })
    print(f"{date}: collected {len(rows)} price rows for {len({r['asset_id'] for r in rows})} assets")
    append_rows(rows)

    # ---- keyed-source slots (activate by setting env vars; extend freely) ----
    if os.environ.get("PRICECHARTING_TOKEN"):
        print("PriceCharting token detected — add product mappings in scripts/pricecharting.py (slot not yet wired).")
    if os.environ.get("JUSTTCG_API_KEY"):
        print("JustTCG key detected — add mappings in scripts/justtcg.py (slot not yet wired).")

if __name__ == "__main__":
    collect_today()
