"""Backfill v4: real historical prices for EVERY Pokémon product from tcgcsv archives.

Downloads one archive per day (from 2024-02-08 onward), extracts the whole
Pokemon + Pokemon Japan categories, writes one immutable file per day:
  data/prices/YYYY/MM/YYYY-MM-DD.csv.gz

Idempotent: days whose file already exists are skipped. Safe to stop/re-run.
Usage: python scripts/backfill.py --from 2025-01-01 --to 2026-08-04
Requires `7z` (Ubuntu: apt-get install p7zip-full).
"""
import argparse, datetime, glob, json, os, shutil, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import download, find_categories, ROOT
from daily import write_day, day_path

ARCHIVE = "https://tcgcsv.com/archive/tcgplayer/prices-{d}.ppmd.7z"
TMP = os.path.join(ROOT, "_backfill_tmp")

def daterange(a, b):
    d = a
    while d <= b:
        yield d
        d += datetime.timedelta(days=1)

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)

def process_day(d, cat_ids):
    ds = d.isoformat()
    os.makedirs(TMP, exist_ok=True)
    arc = os.path.join(TMP, f"{ds}.7z")
    if not download(ARCHIVE.format(d=ds), arc):
        return None
    out = os.path.join(TMP, ds)
    # extract only the Pokemon category trees
    inc = []
    for cid in cat_ids.values():
        inc += [f"-ir!*/{cid}/*", f"-ir!*{os.sep}{cid}{os.sep}*"]
    r = run(["7z", "x", arc, f"-o{out}", "-y"] + inc)
    if r.returncode != 0 or not glob.glob(f"{out}/**/prices", recursive=True):
        run(["7z", "x", arc, f"-o{out}", "-y"])  # fallback: full extract
    rows = []
    cid2key = {str(v): k for k, v in cat_ids.items()}
    for path in glob.glob(f"{out}/**/prices", recursive=True):
        gid = os.path.basename(os.path.dirname(path))
        cid = os.path.basename(os.path.dirname(os.path.dirname(path)))
        cat_key = cid2key.get(cid)
        if cat_key is None:
            continue
        try:
            with open(path, encoding="utf-8") as f:
                res = json.load(f).get("results", [])
        except Exception:
            continue
        for p in res:
            rows.append([ds, cat_key, gid, p.get("productId"), p.get("subTypeName") or "Normal",
                         p.get("marketPrice"), p.get("lowPrice"), p.get("midPrice"),
                         p.get("highPrice"), p.get("directLowPrice")])
    write_day(ds, rows)
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
    cat_ids = find_categories()
    if not cat_ids:
        sys.exit("could not resolve Pokemon categories")
    print("categories:", cat_ids)
    a, b = datetime.date.fromisoformat(args.frm), datetime.date.fromisoformat(args.to)
    cur_month, n_days, n_fail, first_fail = None, 0, 0, None
    for d in daterange(a, b):
        if os.path.exists(day_path(d.isoformat())):
            continue
        if n_fail >= 15 and n_days == 0:
            sys.exit(f"aborting: first {n_fail} downloads all failed (e.g. {first_fail}) — "
                     "check connectivity/user-agent, do not hammer the server.")
        if cur_month and d.strftime("%Y-%m") != cur_month:
            git_checkpoint(f"backfill {cur_month} (full catalog)")
        cur_month = d.strftime("%Y-%m")
        n = process_day(d, cat_ids)
        if n is None:
            n_fail += 1
            first_fail = first_fail or d.isoformat()
            continue
        n_days += 1
        print(f"{d}: {n} rows")
    git_checkpoint(f"backfill final ({cur_month})")
    print(f"done: {n_days} days collected, {n_fail} downloads failed")
    if n_days == 0 and n_fail > 0:
        sys.exit("backfill produced no new data — failing so this is visible")

if __name__ == "__main__":
    main()
