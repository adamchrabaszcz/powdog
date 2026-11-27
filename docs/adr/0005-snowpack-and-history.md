# 0005. Rebuild the snowpack each run; keep every forecast in D1

- Status: Accepted
- Date: 2026-11-27

## Context
Whether new snow is good depends on the base under it: cold or melted, crusted, wind-packed. Keeping a running snowpack state between runs would make every run depend on the last. Learning from forecasts later needs the forecasts as they were at the time.

## Decision
- The snowpack for each spot is rebuilt from scratch from Open-Meteo's past weather at summit height (degree-day melt, crust, rain-on-snow and wind-packing flags). No snowpack state is stored. Past weather barely changes within a day, so it's fetched **once a day**; the two-hourly runs reuse it.
- Every forecast run is saved to D1 from the first version, append only, so later steps can compare forecast with what happened. **Shape: one row per spot per run**, holding that run's hourly series for all models as JSON, not one row per spot, hour and model.

## Consequences
- Runs are independent and easy to test with fixed weather.
- The past window is limited to what Open-Meteo returns (up to 92 days), which covers a season's base.
- **D1 writes:** about 20 spots × 12 runs ≈ 240 rows a day for forecast history, plus a few for results and alerts: far below the free 100,000 rows written per day. One row per spot, hour and model would have been about 276,000 a day. The wider catalogue (step 8) multiplies this by its size, so it stays capped.
- **D1 storage:** each row holds 16 days × 24 hours × a handful of variables and models, a few tens of kB; old rows are thinned once verification has used them, keeping the database well under the free 5 GB.
