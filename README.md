# PMT — Pokémon Market Tracker (pmt.today)

Your own Pokémon TCG market database **and** a self-updating market terminal website.

Every day, GitHub's servers automatically:
1. Collect real TCGplayer prices for **every Pokémon product** (English + Japanese,
   ~50,000+ cards and sealed items) via the free [tcgcsv.com](https://tcgcsv.com) mirror
2. Store them as one immutable compressed file per day in `data/prices/`
3. Recompute all analytics (momentum, volatility, spreads, indexes, rankings, scenarios)
4. Republish the terminal at **`https://YOUR_USER.github.io/REPO_NAME/`**

Share that link with anyone — they always see the latest data. No server, no cost,
no manual input, ever.

## One-time setup (~5 minutes)

1. Put the contents of this folder in a **public** GitHub repository and push.
2. **Settings → Actions → General → Workflow permissions** → "Read and write permissions" → Save.
3. **Settings → Pages → Build and deployment → Source** → select **"GitHub Actions"**.
4. **Actions tab → "Historical backfill (optional)" → Run workflow** (defaults: 2025-01-01 → yesterday).
   This downloads tcgcsv's daily archives and keeps *every* Pokémon product — expect
   30–90 minutes and roughly 0.5–1 GB of history in the repo. Re-run if it ever times
   out; completed days are skipped.
5. **Actions tab → "Daily price collection" → Run workflow** once. This collects today,
   builds the site, and publishes it. From then on it runs itself daily at 21:30 UTC.

Your live terminal: `https://YOUR_USER.github.io/REPO_NAME/`
(An offline snapshot is downloadable from the terminal's sidebar.)

## What's inside

| Path | What it is |
|---|---|
| `data/prices/YYYY/MM/*.csv.gz` | One file per day: every product's market/low/mid/high per printing. Immutable. |
| `data/catalog.csv.gz` | Product metadata for the full catalog (names, numbers, rarities, sets). Refreshed daily. |
| `universe.csv` + `scripts/assets_meta.json` | Curated tags (character, era, nicknames, MSRP) for featured assets — cosmetic only; **collection covers everything regardless**. |
| `scripts/daily.py` | Collects today's full catalog (~400 small requests). |
| `scripts/backfill.py` | Archive backfill (full catalog per day). |
| `scripts/analytics.py` | Computes metrics/scores/indexes → `docs/data.json`, search catalog, lazy series shards. |
| `scripts/build_site.py` | Assembles the terminal site into `docs/`. |
| `scripts/build_db.py` | Optional: compile day files into a local SQLite DB (run locally; too large to commit). |
| `scripts/validate.py` | Coverage report, runs in every workflow. |

## How the terminal handles 50,000+ products

Everything is **collected and stored**. For the browser:
- Every product **≥ $5**, plus **all sealed items** (capped at the ~4,500 largest),
  ships with full pre-computed analytics, scores, rankings and index membership.
- **Everything else** is in the search box too — its page loads the real price series
  on demand and computes performance in your browser from the same repo data.
- Rankings stay eligibility-gated (price floors, ≥120 real days, coverage, confidence),
  so penny-card noise never tops a board.

## Honest limits

- tcgcsv mirrors TCGplayer **prices** only: no sales counts, listing depth, eBay solds,
  or graded values. Metrics that need those are hidden until the sources are added
  (the collector has env-var slots ready: `PRICECHARTING_TOKEN`, `JUSTTCG_API_KEY`).
- Data lands once per day; there is no intraday feed.
- GitHub may pause schedules in inactive repos (~60 days); the daily commits keep it
  active, and re-enabling is one click if it ever happens.
- Be a good citizen: the daily job makes a few hundred small requests; the backfill
  downloads one archive per day of history, once. Consider supporting tcgcsv's Patreon.
