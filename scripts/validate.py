"""Data-quality report: coverage, gaps, and suspicious day-over-day jumps."""
import csv, glob, os, sys
from collections import defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import PRICES_DIR, load_resolved

def main():
    resolved = {r["asset_id"]: r for r in load_resolved()}
    series = defaultdict(dict)  # asset -> date -> market (first subtype seen w/ value)
    dates = set()
    for path in sorted(glob.glob(os.path.join(PRICES_DIR, "*.csv"))):
        with open(path, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                dates.add(r["date"])
                if r["market"]:
                    series[r["asset_id"]].setdefault(r["date"], float(r["market"]))
    if not dates:
        print("no data yet — run scripts/daily.py first"); return
    print(f"coverage: {len(dates)} days ({min(dates)} → {max(dates)}), "
          f"{len(series)}/{len(resolved)} assets have prices")
    missing = sorted(set(resolved) - set(series))
    if missing:
        print("assets with NO price rows:", ", ".join(missing))
    print("\nsuspicious day-over-day moves (>35%):")
    flagged = 0
    for aid, dd in series.items():
        ds = sorted(dd)
        for i in range(1, len(ds)):
            p0, p1 = dd[ds[i-1]], dd[ds[i]]
            if p0 and p1 and p0 > 0 and abs(p1/p0 - 1) > 0.35 and max(p0, p1) > 2:
                print(f"  {aid} {ds[i-1]}->{ds[i]}: {p0:.2f} -> {p1:.2f}")
                flagged += 1
    if not flagged:
        print("  none")

if __name__ == "__main__":
    main()
