# PokéQuant Data Repository

Your own long-term Pokémon TCG price database. Every day this repo automatically
collects real TCGplayer prices (via the free [tcgcsv.com](https://tcgcsv.com) mirror)
for every asset in `universe.csv`, stores them as tiny monthly CSVs, and compiles
them into a SQLite database.

**No API keys, no server, no cost.** GitHub Actions does the collecting.

## One-time setup (about 3 minutes)

1. Create a new **private** GitHub repository (e.g. `pokequant-data`).
2. Put the contents of this folder in it and push:
   ```bash
   cd pokequant-data-kit
   git init -b main
   git add -A
   git commit -m "PokeQuant collector"
   git remote add origin https://github.com/YOUR_USER/pokequant-data.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Actions → General → Workflow permissions →**
   select **"Read and write permissions"** → Save.
4. Go to the **Actions** tab → enable workflows → open **"Daily price collection"**
   → **Run workflow** (this seeds today's data immediately; after that it runs
   itself every day at 21:30 UTC).

That's it. From now on `data/prices/` grows by one day of real prices daily.

## Optional: real history back to Jan 2025

tcgcsv archives every past day (from 2024-02-08). To backfill:
Actions tab → **"Historical backfill (optional)"** → Run workflow
(defaults: 2025-01-01 → yesterday). It downloads one archive per day, keeps only
the tracked assets, and commits monthly checkpoints — safe to re-run if it ever
times out; already-collected days are skipped.

## What's inside

| Path | What it is |
|---|---|
| `universe.csv` | The tracked assets. **Add a row to track anything** (see below). |
| `data/resolved.csv` | Universe rows resolved to TCGplayer product IDs (auto-generated). |
| `data/prices/YYYY-MM.csv` | One month of daily prices, long format — the source of truth. |
| `data/pokequant.db` | SQLite database rebuilt after each collection (assets, prices, `v_daily` view). |
| `scripts/daily.py` | Collects today's prices. |
| `scripts/backfill.py` | Optional archive backfill. |
| `scripts/build_db.py` | CSV → SQLite compiler. |
| `scripts/validate.py` | Coverage + anomaly report (runs in every workflow). |

## Adding assets

Append a row to `universe.csv`:

- **A single card** — `match_kind=number`, `match_value` = the card number as printed
  (e.g. `215/203`). `set_query` is any distinctive part of the set name on TCGplayer.
- **A sealed product** — `match_kind=name`, `match_value` = a substring of the product
  name (e.g. `Booster Box`, `Elite Trainer Box`, `Booster Bundle`).

Then run the daily workflow once with "refresh" (or just wait — resolution re-runs
automatically when `data/resolved.csv` is missing; delete it to force a full re-resolve).
Backfill can be re-run any time to fetch history for newly added assets.

## Querying the database

```bash
sqlite3 data/pokequant.db "SELECT date, market FROM v_daily WHERE asset_id='sl-evs-box' ORDER BY date DESC LIMIT 14;"
```

## Rebuilding the PokéQuant terminal on this data

Once the repo has data (a day of live collection, or the backfill), bring it back
to Claude and say:

> Rebuild the PokéQuant terminal from my repo `https://github.com/YOUR_USER/pokequant-data`

If the repo is private, either make it public, or attach the `data/` files to the chat.
The terminal's modeled history is then replaced with your real collected history,
and volume-dependent metrics are re-labeled to reflect what the free data can and
cannot support.

## Notes & limits (honest ones)

- tcgcsv mirrors TCGplayer **prices** (market/low/mid/high per printing). It does
  **not** include sales counts, listing depth, or graded-card values.
- Graded assets (PSA/CGC) and true sales-volume data need other sources —
  the collector has env-var slots ready (`PRICECHARTING_TOKEN`, `JUSTTCG_API_KEY`)
  for when you want to add them.
- Data lands once per day. Intraday moves don't exist in this feed.
- Be a good citizen: the daily workflow makes ~60 small requests; the backfill
  downloads one archive per day of history. Both are well within tcgcsv's intended use
  (it exists precisely so people don't hammer TCGplayer directly).
