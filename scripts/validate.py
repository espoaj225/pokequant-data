"""Data-quality report for the full-catalog collection (v4 day files)."""
import csv, glob, gzip, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = sorted(glob.glob(os.path.join(ROOT, "data", "prices", "*", "*", "*.csv.gz")))
if not files:
    print("no data yet — run the collector first"); sys.exit(0)
def day_of(p): return os.path.basename(p)[:-7]
first, last = day_of(files[0]), day_of(files[-1])
# gaps
from datetime import date, timedelta
d0, d1 = date.fromisoformat(first), date.fromisoformat(last)
have = {day_of(p) for p in files}
missing = [(d0 + timedelta(days=i)).isoformat() for i in range((d1 - d0).days + 1)
           if (d0 + timedelta(days=i)).isoformat() not in have]
# sample the latest file
n_rows = n_mkt = 0
pids = set()
with gzip.open(files[-1], "rt", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        n_rows += 1
        pids.add(r["product_id"])
        if r["market"]: n_mkt += 1
sz = sum(os.path.getsize(p) for p in files) / 1e6
print(f"coverage: {len(files)} day files ({first} -> {last}), {len(missing)} missing days"
      + (f": {missing[:6]}..." if missing else ""))
print(f"latest day: {n_rows:,} rows, {len(pids):,} products, {n_mkt:,} with market price")
print(f"total price storage: {sz:.0f} MB across {len(files)} files")
if n_rows < 1000:
    sys.exit("latest day looks truncated — investigate")
