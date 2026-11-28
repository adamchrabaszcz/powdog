// Scoring (#23): a spot on a day, per riding mode, 0–100 with reasons; the rules are on the issue.
// Each mode is its own file; the numbers are in config/scoring.json (ADR 0011).

import { scoreDog } from './dog.ts';
import { scoreLift } from './lift.ts';
import { type Tally, confidenceOf, result } from './parts.ts';
import { DEFAULT_SCORING, type ScoringSettings } from './settings.ts';
import { scoreSplitboard } from './splitboard.ts';
import type { Mode, Score, SpotDay } from './types.ts';

export { blend, daytimeHours, daytimeWeather, localTime } from './day.ts';
export { DEFAULT_SCORING, withOverrides } from './settings.ts';
export type { ScoringSettings } from './settings.ts';
export { MODES } from './types.ts';
export type { Confidence, DaytimeWeather, Mode, Score, SpotDay } from './types.ts';

const byMode: Record<Mode, (d: SpotDay, s: ScoringSettings) => Tally> = {
  lift: scoreLift,
  splitboard: scoreSplitboard,
  dog: scoreDog,
};

export function scoreDay(d: SpotDay, mode: Mode, s: ScoringSettings = DEFAULT_SCORING): Score {
  return { spotId: d.spot.id, date: d.date, mode, confidence: confidenceOf(d.daytime, s), ...result(byMode[mode](d, s)) };
}

/** The best spots for a mode, highest score first; excluded spots last, with their reasons. */
export function rank(days: SpotDay[], mode: Mode, s: ScoringSettings = DEFAULT_SCORING): Score[] {
  return days
    .map((d) => scoreDay(d, mode, s))
    .sort((a, b) => Number(a.excluded) - Number(b.excluded) || b.score - a.score);
}
