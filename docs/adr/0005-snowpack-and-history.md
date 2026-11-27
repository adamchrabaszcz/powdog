# 0005. Rebuild the snowpack each run; keep every forecast in D1

- Status: Accepted
- Date: 2026-11-27

## Context
Whether new snow is good depends on the base under it: cold or melted, crusted, wind-packed. Keeping a running snowpack state between runs would make every run depend on the last. Learning from forecasts later needs the forecasts as they were at the time.

## Decision
- The snowpack for each spot is rebuilt from scratch on every run from Open-Meteo's past weather at summit height (degree-day melt, crust, rain-on-snow and wind-packing flags). No snowpack state is stored.
- Every forecast run is saved to D1 from the first version, append only, so later steps can compare forecast with what happened.

## Consequences
- Runs are independent and easy to test with fixed weather.
- The past window is limited to what Open-Meteo returns (up to 92 days), which covers a season's base.
- D1 grows by one row set per run; old raw forecasts can be thinned once verification has used them.
