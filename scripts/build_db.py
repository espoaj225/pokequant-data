"""Compile the CSV shards into a queryable SQLite database (data/pokequant.db).

Tables:
  assets(asset_id PK, type, display_name, group_name, product_id, product_name)
  prices(date, asset_id, subtype, market, low, mid, high, direct_low)
  v_daily (view): one market price per asset per day (prefers Holofoil > Normal
                  > Reverse Holofoil when a card has multiple printings)

Run:  python scripts/build_db.py
Then: sqlite3 data/pokequant.db "SELECT * FROM v_daily WHERE asset_id='sl-evs-box' ORDER BY date DESC LIMIT 10;"
"""
import csv, glob, os, sqlite3, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ROOT, PRICES_DIR, load_resolved

DB = os.path.join(ROOT, "data", "pokequant.db")

def main():
    resolved = load_resolved()
    con = sqlite3.connect(DB)
    c = con.cursor()
    c.executescript("""
    DROP TABLE IF EXISTS assets; DROP TABLE IF EXISTS prices; DROP VIEW IF EXISTS v_daily;
    CREATE TABLE assets(asset_id TEXT PRIMARY KEY, type TEXT, display_name TEXT,
                        group_name TEXT, product_id INTEGER, product_name TEXT);
    CREATE TABLE prices(date TEXT, asset_id TEXT, subtype TEXT,
                        market REAL, low REAL, mid REAL, high REAL, direct_low REAL,
                        PRIMARY KEY(date, asset_id, subtype));
    """)
    c.executemany("INSERT INTO assets VALUES (?,?,?,?,?,?)",
        [(r["asset_id"], r["type"], r["display_name"], r["group_name"],
          int(r["product_id"]), r["product_name"]) for r in resolved])
    n = 0
    for path in sorted(glob.glob(os.path.join(PRICES_DIR, "*.csv"))):
        with open(path, newline="", encoding="utf-8") as f:
            rows = [(r["date"], r["asset_id"], r["subtype"],
                     r["market"] or None, r["low"] or None, r["mid"] or None,
                     r["high"] or None, r["direct_low"] or None)
                    for r in csv.DictReader(f)]
        c.executemany("INSERT OR REPLACE INTO prices VALUES (?,?,?,?,?,?,?,?)", rows)
        n += len(rows)
    c.executescript("""
    CREATE INDEX idx_prices_asset ON prices(asset_id, date);
    CREATE VIEW v_daily AS
      SELECT date, asset_id,
             COALESCE(MAX(CASE WHEN subtype='Holofoil' THEN market END),
                      MAX(CASE WHEN subtype='Normal' THEN market END),
                      MAX(CASE WHEN subtype='Reverse Holofoil' THEN market END),
                      MAX(market)) AS market
      FROM prices GROUP BY date, asset_id;
    """)
    con.commit()
    days = c.execute("SELECT COUNT(DISTINCT date) FROM prices").fetchone()[0]
    print(f"built {DB}: {len(resolved)} assets, {n} price rows, {days} distinct days")

if __name__ == "__main__":
    main()
