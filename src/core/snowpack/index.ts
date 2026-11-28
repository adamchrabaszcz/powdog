// Snowpack model (ADR 0005): rebuilt from scratch from hourly weather at a spot's summit.
// Deliberately simple and explainable: snow in, melt out, and flags for the things that make
// new snow good or bad (a crust under it, rain on it, wind over it).
//
// A short pipeline (ADR 0011): walk the hours (walk.ts), then summarise (summary.ts), with the
// tunable rules in settings.ts.

import { DEFAULT_SNOWPACK, type SnowpackSettings } from './settings.ts';
import { summarise } from './summary.ts';
import type { Snowpack, WeatherHour } from './types.ts';
import { walk } from './walk.ts';

export { DEFAULT_SNOWPACK, freshDensity, qualityOf, settledDensity } from './settings.ts';
export type { SnowpackSettings } from './settings.ts';
export { SURFACES } from './types.ts';
export type { Gaps, Quality, Snowpack, Surface, WeatherHour } from './types.ts';

/** Builds the snowpack at the end of `hours` (oldest first). Override any setting to tune or test. */
export function buildSnowpack(hours: WeatherHour[], overrides: Partial<SnowpackSettings> = {}): Snowpack {
  const s = { ...DEFAULT_SNOWPACK, ...overrides };
  return summarise(walk(hours, s), hours, s);
}
