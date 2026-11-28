// Small helpers every mode uses: turning measurements into points, collecting reasons, confidence.

import type { Confidence } from './types.ts';
import type { ScoringSettings } from './settings.ts';

/** value / full, clamped to 0–1. */
export const fraction = (value: number, full: number) => Math.max(0, Math.min(1, value / full));

/** One contribution to a score, with the reason a rider would read. */
export interface Part {
  points: number;
  reason: string;
}

export interface Tally {
  parts: Part[];
  /** Safety notes (avalanche): always shown first, and kept even when the day is excluded. */
  notes: string[];
  /** Set when a hard rule fails: the score becomes 0 and this is the first reason. */
  excludedBecause: string | null;
}

export const tally = (): Tally => ({ parts: [], notes: [], excludedBecause: null });
export const add = (t: Tally, points: number, reason: string) => void t.parts.push({ points, reason });
export const note = (t: Tally, text: string) => void t.notes.push(text);
export const exclude = (t: Tally, reason: string) => {
  t.excludedBecause ??= reason;
};

/** 0–100. Reasons: the exclusion (if any), then safety notes, then parts by how much they moved the score. */
export function result(t: Tally): { score: number; excluded: boolean; reasons: string[] } {
  if (t.excludedBecause) return { score: 0, excluded: true, reasons: [t.excludedBecause, ...t.notes] };
  const total = t.parts.reduce((s, p) => s + p.points, 0);
  const parts = [...t.parts].sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).map((p) => p.reason);
  return { score: Math.round(Math.max(0, Math.min(100, total))), excluded: false, reasons: [...t.notes, ...parts] };
}

/** From the models' spread on the snow the score counts (see day.ts). */
export function confidenceOf(snowSpreadCm: number | null, s: ScoringSettings): Confidence {
  if (snowSpreadCm === null) return 'low';
  if (snowSpreadCm < s.confidence.highBelowSpreadCm) return 'high';
  return snowSpreadCm >= s.confidence.lowFromSpreadCm ? 'low' : 'medium';
}

/** How sunny the day is, 0–1, from mean cloud; unknown counts as half. */
export const sunniness = (cloudPct: number | null) => (cloudPct === null ? 0.5 : 1 - fraction(cloudPct, 100));

/** The avalanche line every mode shows, whatever the score. */
export const avalancheNote = (level: number | null) =>
  level === null ? 'no avalanche bulletin here: judge the snowpack yourself' : `avalanche danger ${level}`;
