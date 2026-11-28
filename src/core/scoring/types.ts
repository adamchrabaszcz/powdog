// Shapes for scoring a spot on a day for one riding mode (#23, rules on the issue).

import type { Snowpack } from '../snowpack/index.ts';
import type { DogRule } from '../spots.ts';

export type Mode = 'lift' | 'splitboard' | 'dog';
export const MODES: readonly Mode[] = ['lift', 'splitboard', 'dog'];

export type Confidence = 'high' | 'medium' | 'low';

/** Weather in the daytime window (08:00–16:00 local), models averaged. null where no model had a value. */
export interface DaytimeWeather {
  windMaxKmh: number | null;
  gustMaxKmh: number | null;
  cloudMeanPct: number | null;
  tempMinC: number | null;
}

/** Everything scoring needs about one spot on one day. Built by the pipeline; scoring only reads it. */
export interface SpotDay {
  spot: { id: string; name: string; lifts: boolean; dogs: DogRule };
  /** Local date, YYYY-MM-DD. */
  date: string;
  /** 0 = Sunday … 6 = Saturday, local. */
  weekday: number;
  /** The snowpack at the start of the day (08:00 local). */
  snowpack: Snowpack;
  /** Hours since the last snowfall worth counting at 08:00, or null if none in the window. */
  hoursSinceSnowfall: number | null;
  daytime: DaytimeWeather;
  /**
   * How far apart the models are on the snow the score counts: the 72 h up to 08:00 that morning,
   * max − min of their totals, cm. null when fewer than two models cover that window.
   */
  snowSpreadCm: number | null;
  /** EAWS danger level 1–5 for the day, or null where the spot has no bulletin. */
  avalancheLevel: number | null;
}

export interface Score {
  spotId: string;
  date: string;
  mode: Mode;
  /** 0–100; 0 when excluded. */
  score: number;
  /** A hard rule failed; `reasons` says which. */
  excluded: boolean;
  confidence: Confidence;
  /** The day's avalanche danger (null: no bulletin), on every score, excluded or not, so no view can drop it. */
  avalancheLevel: number | null;
  /** Plain words: the exclusion if any, then the avalanche note, then the rest by weight. */
  reasons: string[];
}
