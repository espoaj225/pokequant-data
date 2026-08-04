"""OPTIONAL backfill: real historical prices from tcgcsv daily archives.

tcgcsv archives every day's full TCGplayer price data (from 2024-02-08 onward) at
  https://tcgcsv.com/archive/tcgplayer/prices-YYYY-MM-DD.ppmd.7z

This script downloads one archive per day, extracts ONLY the groups we track,
appends rows to the same monthly CSV shards the daily collector uses, then
deletes the archive. Idempotent: days already present in the shards are skipped,
so you can stop and re-run any time.

Usage:
  python scripts/backfill.py --from 2025-01-01 --to 2025-06-30
Requires the `7z` binary (Ubuntu: apt-get install p7zip-full).
"""
import argparse, csv, datetime, glob, json, os, shutil, subprocess, sys, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import load_resolved, append_rows, days_done, ROOT

ARCHIVE = "https://tcgcsv.com/archive/tcgplayer/prices-{d}.ppmd.7z"
TMP = os.path.join(ROOT, "_backfill_tmp")

def daterange(a, b):
    d = a
    while d <= b:
        yield d
        d += datetime.timedelta(days=1)

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)

def process_day(d, resolved, wanted_groups, wanted_products):
    ds = d.isoformat()
    os.makedirs(TMP, exist_ok=True)
    arc = os.path.join(TMP, f"{ds}.7z")
    try:
        urllib.request.urlretrieve(ARCHIVE.format(d=ds), arc)
    except Exception as e:
        print(f"  {ds}: archive unavailable ({e})", file=sys.stderr)
        return 0
    out = os.path.join(TMP, ds)
    # extract only the price files for groups we track (include patterns)
    inc = []
    for gid in wanted_groups:
        inc += [f"-ir!*{os.sep}{gid}{os.sep}prices", f"-ir!*/{gid}/prices"]
    r = run(["7z", "x", arc, f"-o{out}", "-y"] + inc[:120])
    if r.returncode != 0 or not glob.glob(f"{out}/**/prices", recursive=True):
        run(["7z", "x", arc, f"-o{out}", "-y"])  # fallback: full extract
    rows = []
    for path in glob.glob(f"{out}/**/prices", recursive=True):
        gid = os.path.basename(os.path.dirname(path))
        if gid not in wanted_groups:
            continue
        try:
            with open(path, encoding="utf-8") as f:
                res = json.load(f).get("results", [])
        except Exception:
            continue
        for p in res:
            a = wanted_products.get(p.get("productId"))
            if not a:
                continue
            rows.append({
                "date": ds, "asset_id": a["asset_id"], "product_id": p["productId"],
                "subtype": p.get("subTypeName") or "Normal",
                "market": p.get("marketPrice"), "low": p.get("lowPrice"),
                "mid": p.get("midPrice"), "high": p.get("highPrice"),
                "direct_low": p.get("directLowPrice"),
            })
    append_rows(rows)
    shutil.rmtree(out, ignore_errors=True)
    os.remove(arc)
    return len(rows)

def git_checkpoint(msg):
    if os.environ.get("GITHUB_ACTIONS"):
        run(["git", "config", "user.name", "pokequant-bot"])
        run(["git", "config", "user.email", "bot@users.noreply.github.com"])
        run(["git", "add", "data"])
        if run(["git", "diff", "--cached", "--quiet"]).returncode != 0:
            run(["git", "commit", "-m", msg])
            run(["git", "push"])
            print(f"  pushed checkpoint: {msg}")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="frm", default="2025-01-01")
    ap.add_argument("--to", dest="to", default=(datetime.date.today() - datetime.timedelta(days=1)).isoformat())
    args = ap.parse_args()
    resolved = load_resolved()
    wanted_groups = {str(r["group_id"]) for r in resolved}
    wanted_products = {int(r["product_id"]): r for r in resolved}
    done = days_done()
    a, b = datetime.date.fromisoformat(args.frm), datetime.date.fromisoformat(args.to)
    cur_month, n_days = None, 0
    for d in daterange(a, b):
        if d.isoformat() in done:
            continue
        if cur_month and d.strftime("%Y-%m") != cur_month:
            git_checkpoint(f"backfill {cur_month}")
        cur_month = d.strftime("%Y-%m")
        n = process_day(d, resolved, wanted_groups, wanted_products)
        n_days += 1
        print(f"{d}: {n} rows")
    git_checkpoint(f"backfill final ({cur_month})")
    print(f"done: processed {n_days} days")

if __name__ == "__main__":
    main()
