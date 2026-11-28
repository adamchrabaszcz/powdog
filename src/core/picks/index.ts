// The local picks pipeline (#36): data in, ranked picks out. The command in src/cli/ does the fetch.

import type { SpotSeries } from '../open-meteo.ts';
import { DEFAULT_SCORING, MODES, type Mode, type Score, type ScoringSettings, localise, rank } from '../scoring/index.ts';
import type { Spot } from '../spots.ts';
import { forecastDates, spotDays } from './days.ts';
import type { PicksReport } from './report.ts';

export { PICKS_MODELS, PICKS_PAST_DAYS, PICKS_VARIABLES, avalancheFor, forecastDates, hoursSinceSnowfall, picksQuery, spotDays, weatherHours } from './days.ts';
export { formatPicks } from './report.ts';
export type { PicksReport } from './report.ts';

/** Scores every spot with data for each of the next `days` dates, ranked per mode. */
export function picks(
  spots: Spot[],
  series: SpotSeries[],
  opts: { now: string; days: number; top: number; problems: string[] },
  s: ScoringSettings = DEFAULT_SCORING,
): PicksReport {
  const byId = new Map(series.map((x) => [x.id, x]));
  const withData = spots.filter((spot) => byId.has(spot.id));
  const first = series[0];
  const dates = first ? forecastDates(localise(first.times, s), opts.now, opts.days, s) : [];
  const days = withData.flatMap((spot) => spotDays(spot, byId.get(spot.id)!, dates, s));

  const ranked = Object.fromEntries(
    MODES.map((mode) => [mode, Object.fromEntries(dates.map((date) => [date, rank(days.filter((d) => d.date === date), mode, s)]))]),
  ) as Record<Mode, Record<string, Score[]>>;

  const missing = spots.filter((spot) => !byId.has(spot.id)).map((spot) => `${spot.id}: no forecast data`);
  return {
    generatedAt: opts.now,
    spotNames: Object.fromEntries(spots.map((spot) => [spot.id, spot.name])),
    ranked,
    problems: [...opts.problems, ...missing],
    top: opts.top,
  };
}
