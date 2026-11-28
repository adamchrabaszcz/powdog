# 0003. Open-Meteo as the weather source

- Status: Accepted
- Date: 2026-11-27

## Context
Scoring needs snowfall, snow depth, temperature, freezing level, wind, cloud and sun at summit height, several models to show disagreement, past weather for the snowpack, ensembles for planning ahead and pressure-level data for fronts. Paid APIs are out (ADR 0008).

## Decision
Use Open-Meteo for all weather data: the forecast API with the `elevation` parameter set to each spot's top, `past_days` for the snowpack, the ensemble API for 4–15 day windows, and pressure-level variables for fronts. Requests are batched: all spots in one call per data type.

Forecasts are fetched **4 times a day**, shortly after new model runs are published (ECMWF and GFS run every 6 hours): at about 05:00, 11:00, 17:00 and 23:00 Polish time. The 05:00 run feeds the "go today?" notification.

Cloudflare cron triggers run on UTC, and times are stored in UTC (`AGENTS.md`), so the schedule is `0 4,10,16,22 * * *`. That's 05:00 local in winter (CET) and 06:00 in summer (CEST); the shift doesn't matter for a winter app. Open-Meteo publishes ECMWF runs a few hours later than GFS, so the 04:00 UTC run may still carry the previous evening's ECMWF run rather than the overnight one; the "go today?" text says which model run it uses, and step 1 measures the real publishing times. Pressure levels come with these runs; past weather and the ensemble are fetched once a day.

## Consequences
- Free for non-commercial use, about 10,000 calls a day. Batching saves round trips, not quota: each location counts as a call, and a request with more than 10 variables or more than two weeks of data counts as several. A rough budget for ~20 spots:
  - forecast with 3 models and ~15 variables, 4 runs: ~20 × 3–4 weighted calls × 4 ≈ 240–320 a day;
  - past weather (`past_days=60`, about what the forecast API keeps, ADR 0005) and the ensemble, once a day: ~20 × 10–20 weighted calls ≈ 200–400 a day;
  - pressure levels for fronts, with the 4 runs: ~20 × 2 × 4 ≈ 160 a day.

  About 600–900 a day, well under the limit. Fetching more often would mostly download the same model run again. Step 1 measures the real weighting, and the wider catalogue in step 8 has to fit the remaining budget.
- Its limits are per IP, and Workers share outgoing IPs; staying far below the limit keeps the risk low. If runs get throttled, the fallback is to collect from a scheduled GitHub Action.
- A public page (step 11) needs its terms checked first. Open-Meteo is open source and can be self-hosted if it ever has to be (ADR 0010).
