import { describe, expect, it } from 'vitest';
import catalogueJson from '../../../config/spots.json' with { type: 'json' };
import fixture from '../fixtures/open-meteo-forecast-past.json' with { type: 'json' };
import { type ForecastQuery, parseForecast } from '../open-meteo.ts';
import { localise, DEFAULT_SCORING } from '../scoring/index.ts';
import type { Catalogue } from '../spots.ts';
import {
  PICKS_MODELS,
  PICKS_PAST_DAYS,
  PICKS_VARIABLES,
  avalancheFor,
  forecastDates,
  formatPicks,
  hoursSinceSnowfall,
  picks,
  picksQuery,
  spotDays,
} from './index.ts';
import { summariseProblems, whyNothing } from './summary.ts';

// The whole pipeline on a real response recorded on 2026-11-28 (5 past days, 3 forecast days)
// for Praděd and Kasprowy Wierch: no network in tests.
const { spots } = catalogueJson as Catalogue;
const two = spots.filter((s) => s.id === 'praded' || s.id === 'kasprowy-wierch');
const query: ForecastQuery = { ...picksQuery(two), pastDays: 5 };
const { series, problems } = parseForecast(fixture, query);
const NOW = '2026-11-28T11:00:00Z';

describe('picksQuery', () => {
  it('asks for every spot at its summit, with past days the confidence and snowpack need', () => {
    const q = picksQuery(spots);
    expect(q.locations).toHaveLength(spots.length);
    expect(q.locations[0]!.elevationM).toBe(spots[0]!.topElevationM);
    expect(q.pastDays).toBeGreaterThanOrEqual(3); // #37 review: the 72 h before 08:00 of day 1
    expect(q.models).toEqual(PICKS_MODELS);
    expect(q.variables).toEqual(PICKS_VARIABLES);
    expect(PICKS_PAST_DAYS).toBeLessThanOrEqual(92);
  });
});

describe('spotDays on real data', () => {
  const praded = series.find((s) => s.id === 'praded')!;
  const dates = forecastDates(localise(praded.times, DEFAULT_SCORING), NOW, 3);
  const days = spotDays(two.find((s) => s.id === 'praded')!, praded, dates);

  it('covers today and the next two days', () => {
    expect(dates).toEqual(['2026-11-28', '2026-11-29', '2026-11-30']);
    expect(days.map((d) => d.date)).toEqual(dates);
  });

  it('gives day 1 a real confidence spread, thanks to the past days (#37 review)', () => {
    expect(days[0]!.snowSpreadCm).not.toBeNull();
  });

  it('builds the snowpack and weather for each day', () => {
    for (const d of days) {
      expect(d.snowpack.depthCm).toBeGreaterThanOrEqual(0);
      expect(d.daytime.windMaxKmh).not.toBeNull();
      expect(d.weekday).toBeGreaterThanOrEqual(0);
    }
  });

  it('says a bulletin is not loaded yet, never that there is none, for a spot that has one', () => {
    expect(days[0]!.avalancheLevel).toBe('unknown');
    expect(avalancheFor(spots.find((s) => s.id === 'pilsko')!)).toBeNull();
  });
});

describe('hoursSinceSnowfall', () => {
  it('counts back from 08:00 to the last snowing hour', () => {
    expect(hoursSinceSnowfall([0, 1, 0.5, 0, 0], 5)).toBe(3);
  });
  it('ignores a trace below the threshold', () => {
    expect(hoursSinceSnowfall([1, 0.05, 0.05], 3)).toBe(3);
  });
  it('is null when it did not snow in the series', () => {
    expect(hoursSinceSnowfall([0, null, 0], 3)).toBeNull();
  });
});

describe('picks and the report', () => {
  const report = picks(two, series, { now: NOW, days: 3, top: 3, problems });
  const text = formatPicks(report);

  it('ranks every mode for every date', () => {
    expect(Object.keys(report.ranked.lift)).toEqual(['2026-11-28', '2026-11-29', '2026-11-30']);
    expect(report.ranked.dog['2026-11-28']).toHaveLength(2);
  });

  it('prints the source, the avalanche warning, and each mode', () => {
    expect(text).toMatch(/Open-Meteo/);
    expect(text).toMatch(/Avalanche levels are not read yet/);
    for (const title of ['LIFT POWDER', 'SPLITBOARD', 'SPLITBOARD WITH THE DOG']) expect(text).toContain(title);
  });

  it('puts the avalanche note first on every pick line', () => {
    const lines = text.split('\n').filter((l) => /^\s+\d\. /.test(l));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l).toMatch(/\s(avalanche|no avalanche bulletin)/);
  });

  it('reports a spot without data instead of skipping it silently', () => {
    const r = picks([...two, spots.find((s) => s.id === 'pilsko')!], series, { now: NOW, days: 1, top: 3, problems: [] });
    expect(r.problems).toContain('pilsko: no forecast data');
  });
});

describe('summaries', () => {
  it('folds the same problem at many spots into one line', () => {
    const lines = summariseProblems([
      'a: snowfall from icon_d2 has 45 of 1512 hours missing',
      'b: snowfall from icon_d2 has 45 of 1512 hours missing',
      'c: rain from gfs_seamless is empty',
    ]);
    expect(lines).toEqual(['snowfall from icon_d2 has 45 of 1512 hours missing (2 spots, e.g. a)', 'c: rain from gfs_seamless is empty']);
  });

  it('never drops the avalanche danger from the reason', () => {
    const why = whyNothing(['avalanche danger 4: not a touring day', 'avalanche danger 4: not a touring day']);
    expect(why).toEqual(['avalanche danger 4: not a touring day (2 spots)']);
    expect(whyNothing(['avalanche danger 3: too high for the dog'])[0]).toMatch(/avalanche danger 3/);
  });

  it('says why nothing was picked, most common reason first', () => {
    expect(whyNothing(['82% cloud: not sunny enough', '64% cloud: not sunny enough', 'dogs are not allowed here'])).toEqual([
      'not sunny enough (2 spots)',
      'dogs are not allowed here (1 spot)',
    ]);
  });
});
