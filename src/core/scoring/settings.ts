// Scoring weights and thresholds (ADR 0011). The values live in config/scoring.json; the type
// below is checked against that file at compile time, so the two can't drift apart.

import scoringJson from '../../../config/scoring.json' with { type: 'json' };
import type { Quality, Surface } from '../snowpack/index.ts';

export interface ScoringSettings {
  daytime: { fromHour: number; toHour: number; timeZone: string };
  /** How good each new-snow quality is, 0–1. */
  quality: Record<Quality, number>;
  /** Models' spread on the snow of the 72 h up to 08:00: below `highBelowSpreadCm` is high confidence, from `lowFromSpreadCm` low. */
  confidence: { highBelowSpreadCm: number; lowFromSpreadCm: number };
  lift: {
    weights: { newSnow: number; quality: number; base: number; visibility: number; weekday: number };
    newSnowFullCm: number;
    baseFullCm: number;
    gustCloseKmh: number;
    gustPenalty: number;
    avalanchePenaltyFromLevel: number;
    avalanchePenalty: number;
  };
  splitboard: {
    weights: { newSnow: number; quality: number; sun: number; base: number; calm: number };
    newSnowFullCm: number;
    baseFullCm: number;
    windPenaltyFromKmh: number;
    windPenalty: number;
    surfacePenalty: Partial<Record<Surface, number>>;
    newSnowOnCrustPenalty: number;
    avalanchePenaltyLevel: number;
    avalanchePenalty: number;
    avalancheExcludeFromLevel: number;
    noBulletinPenalty: number;
  };
  dog: {
    gates: {
      maxAvalancheLevel: number;
      maxCloudPct: number;
      maxWindKmh: number;
      minTempC: number;
      maxFreshCm: number;
      settledAfterHours: number;
      minBaseCm: number;
    };
    weights: { sun: number; calm: number; base: number; daysAfterStorm: number };
    baseFullCm: number;
    /** Days since the snowfall that score best: from `from` (inclusive) until `until` (exclusive), so 2–4 means days 2 and 3. */
    bestDaysAfterStorm: { from: number; until: number };
    noBulletinPenalty: number;
  };
}

export const DEFAULT_SCORING: ScoringSettings = scoringJson;

/** Settings with some values replaced, one level deep per section, for tuning and tests. */
export function withOverrides(overrides: { [K in keyof ScoringSettings]?: Partial<ScoringSettings[K]> } = {}): ScoringSettings {
  const out = { ...DEFAULT_SCORING };
  for (const key of Object.keys(overrides) as (keyof ScoringSettings)[]) {
    Object.assign(out, { [key]: { ...DEFAULT_SCORING[key], ...overrides[key] } });
  }
  return out;
}
