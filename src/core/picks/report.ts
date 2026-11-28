// The picks as text for a terminal: per mode, per day, the top spots with their reasons.
// Every number says where it comes from (AGENTS.md): the header names the source and what's missing.

import type { Mode, Score } from '../scoring/index.ts';
import { summariseProblems, whyNothing } from './summary.ts';

export interface PicksReport {
  /** When the data was fetched, ISO UTC. */
  generatedAt: string;
  spotNames: Record<string, string>;
  /** mode → date → ranked scores. */
  ranked: Record<Mode, Record<string, Score[]>>;
  problems: string[];
  top: number;
}

const MODE_TITLES: Record<Mode, string> = { lift: 'LIFT POWDER', splitboard: 'SPLITBOARD', dog: 'SPLITBOARD WITH THE DOG' };
const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayLabel = (date: string) => DAY.format(new Date(`${date}T12:00:00Z`));

/** How many reasons to show after the avalanche note. */
const REASONS = 3;

export function formatPicks(r: PicksReport): string {
  const out: string[] = [
    `powdog picks · ${r.generatedAt.slice(0, 16).replace('T', ' ')} UTC · Open-Meteo (ECMWF, GFS, ICON-D2) · ${Object.keys(r.spotNames).length} spots`,
    'Avalanche levels are not read yet (step 2): where a bulletin exists, check it yourself before going.',
  ];
  for (const mode of Object.keys(MODE_TITLES) as Mode[]) {
    out.push('', MODE_TITLES[mode]);
    for (const [date, scores] of Object.entries(r.ranked[mode] ?? {})) {
      out.push(`  ${dayLabel(date)}`);
      const best = scores.filter((s) => !s.excluded).slice(0, r.top);
      if (best.length === 0) {
        const why = whyNothing(scores.filter((s) => s.excluded).map((s) => s.reasons[0] ?? ''));
        out.push(`    nothing worth going for${why.length ? `: mostly ${why.join('; ')}` : ''}`);
      }
      best.forEach((s, i) => out.push(line(i + 1, s, r.spotNames)));
    }
  }
  if (r.problems.length) {
    out.push('', `DATA PROBLEMS (${r.problems.length})`, ...summariseProblems(r.problems).map((p) => `  ${p}`));
  }
  return out.join('\n');
}

function line(n: number, s: Score, names: Record<string, string>): string {
  const [note, ...rest] = s.reasons;
  const name = (names[s.spotId] ?? s.spotId).padEnd(26);
  return `    ${n}. ${name} ${String(s.score).padStart(3)}  ${s.confidence.padEnd(6)}  ${[note, ...rest.slice(0, REASONS)].join(' · ')}`;
}
