# 0005. Rebuild the snowpack each run; keep every forecast in D1

- Status: Accepted
- Date: 2026-11-27

## Context
Whether new snow is good depends on the base under it: cold or melted, crusted, wind-packed. Keeping a running snowpack state between runs would make every run depend on the last. Learning from forecasts later needs the forecasts as they were at the time.

## Decision
- The snowpack for each spot is rebuilt from scratch from Open-Meteo's past weather at summit height (degree-day melt, crust, rain-on-snow and wind-packing flags). No snowpack state is stored. Past weather barely changes within a day, so it's fetched **once a day**; the four forecast runs a day (ADR 0003) reuse it.
- Every forecast run is saved to D1 from the first version, append only, so later steps can compare forecast with what happened. **Shape: one row per spot per run**, holding that run's hourly series for all models as JSON, not one row per spot, hour and model.

## Consequences
- Runs are independent and easy to test with fixed weather.
- The past window is limited to what Open-Meteo returns (up to 92 days), which covers a season's base.
- **D1 writes:** about 20 spots × 4 runs ≈ 80 rows a day for forecast history, plus a few for results and alerts: far below the free 100,000 rows written per day. One row per spot, hour and model would have been about 92,000 a day, right at the limit. The wider catalogue (step 8) multiplies this by its size, so it stays capped.
- **D1 storage:** on the free plan one database is capped at **500 MB** (5 GB is the account total). Each row holds 16 days × 24 hours × a handful of variables and models, about 50 kB as plain JSON, so ~80 rows a day is about **4 MB a day**: the cap would be reached in about four months, one season. So history is thinned on a fixed rule:
  - the JSON is stored compressed (gzip, built into Workers), roughly a quarter of the size;
  - the full hourly series is kept for **30 days**, long enough for verification to compare it with what fell;
  - after that, each row is reduced to the daily values verification needs (snowfall, temperature and wind per forecast day), about 1 kB.

  That's roughly 30 MB for the rolling 30 days plus ~30 MB a year of daily values: years of history inside the cap. Step 1 measures the real row size and sets the thinning job to match.
