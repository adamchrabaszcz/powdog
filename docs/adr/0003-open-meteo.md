# 0003. Open-Meteo as the weather source

- Status: Accepted
- Date: 2026-11-27

## Context
Scoring needs snowfall, snow depth, temperature, freezing level, wind, cloud and sun at summit height, several models to show disagreement, past weather for the snowpack, ensembles for planning ahead and pressure-level data for fronts. Paid APIs are out (ADR 0008).

## Decision
Use Open-Meteo for all weather data: the forecast API with the `elevation` parameter set to each spot's top, `past_days` for the snowpack, the ensemble API for 4–15 day windows, and pressure-level variables for fronts. Requests are batched: all spots in one call per data type.

## Consequences
- Free for non-commercial use, about 10,000 calls a day; powdog needs a few dozen.
- Its limits are per IP, and Workers share outgoing IPs; batching keeps the risk low. If runs get throttled, the fallback is to collect from a scheduled GitHub Action.
- A public page (step 11) needs its terms checked first. Open-Meteo is open source and can be self-hosted if it ever has to be (ADR 0010).
