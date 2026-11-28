// Small helpers every mode uses: turning measurements into points, collecting reasons, confidence.

import type { ScoringSettings } from './settings.ts';
import type { Confidence, DaytimeWeather } from './types.ts';

/** value / full, clamped to 0–1. */
export const fraction = (value: number, full: number) => Math.max(0, Math.min(1, value / full));

/** One contribution to a score, with the reason a rider would read. */
export interface Part {
  points: number;
  reason: string;
}

export interface Tally {
  parts: Part[];
  /** Set when a hard rule fails: the score becomes 0 and this is the first reason. */
  excludedBecause: string | null;
}

export const tally = (): Tally => ({ parts: [], excludedBecause: null });
export const add = (t: Tally, points: number, reason: string) => void t.parts.push({ points, reason });
export const exclude = (t: Tally, reason: string) => {
  t.excludedBecause ??= reason;
};

/** 0–100, reasons ordered by how much they moved the score. */
export function result(t: Tally): { score: number; excluded: boolean; reasons: string[] } {
  if (t.excludedBecause) return { score: 0, excluded: true, reasons: [t.excludedBecause] };
  const total = t.parts.reduce((s, p) => s + p.points, 0);
  const reasons = [...t.parts].sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).map((p) => p.reason);
  return { score: Math.round(Math.max(0, Math.min(100, total))), excluded: false, reasons };
}

export function confidenceOf(d: DaytimeWeather, s: ScoringSettings): Confidence {
  if (d.snowSpreadCm === null) return 'low';
  if (d.snowSpreadCm < s.confidence.highBelowSpreadCm) return 'high';
  return d.snowSpreadCm >= s.confidence.lowFromSpreadCm ? 'low' : 'medium';
}

/** How sunny the day is, 0–1, from mean cloud; unknown counts as half. */
export const sunniness = (cloudPct: number | null) => (cloudPct === null ? 0.5 : 1 - fraction(cloudPct, 100));
