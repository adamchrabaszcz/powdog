# 0005. Rebuild the snowpack each run; keep every forecast in D1

- Status: Accepted
- Date: 2026-11-27

## Context
Whether new snow is good depends on the base under it: cold or melted, crusted, wind-packed. Keeping a running snowpack state between runs would make every run depend on the last. Learning from forecasts later needs the forecasts as they were at the time.

## Decision
- The snowpack for each spot is rebuilt from scratch from Open-Meteo's past weather at summit height (degree-day melt, crust, rain-on-snow and wind-packing flags). No snowpack state is stored. Past weather barely changes within a day, so it's fetched **once a day**; the four forecast runs a day (ADR 0003) reuse it.
- Every forecast run is saved to D1 from the first version, append only, so later steps can compare forecast with what happened. **Shape: one row per spot per run**, not one row per spot, hour and model. The row is **lean**: it keeps only what checking forecasts against reality needs, not the raw response. Scoring still uses the full fresh forecast on every run.
  - 5 variables: snowfall, temperature, wind, freezing level and cloud;
  - hourly values for the first 3 days, daily values for days 4–16 (beyond 3 days hourly detail is noise);
  - per model, as far as each model reaches (ICON-D2 covers 2 days; ECMWF and GFS the rest);
  - stored as gzip-compressed JSON (compression is built into Workers).

## Consequences
- Runs are independent and easy to test with fixed weather.
- The past window is limited to what Open-Meteo returns. `past_days` accepts up to 92, but the forecast API only keeps about two months of past model runs (measured 2026-11-28), so powdog asks for 60. That covers a season's base from late September; for a base built over a longer season, step 7's verification job can store daily snowpack summaries in D1.
- **D1 writes:** about 20 spots × 4 runs ≈ 80 rows a day for forecast history, plus a few for results and alerts: far below the free 100,000 rows written per day. One row per spot, hour and model would have been about 92,000 a day, right at the limit. The wider catalogue (step 8) multiplies this by its size, so it stays capped.
- **D1 storage:** on the free plan one database is capped at **500 MB** (5 GB is the account total). A lean row is about 1,200 numbers, ~6 kB as JSON and ~1.5–2 kB compressed, so ~80 rows a day is about **150 kB a day, ~55 MB a year**: about nine years inside the cap. Storing the raw response instead (16 days × 24 hours × ~15 variables × 3 models, ~50 kB a row) would have been ~4 MB a day and filled the cap in one season. Thinning old rows is optional; step 1 measures the real row size.
