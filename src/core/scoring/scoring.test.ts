import { describe, expect, it } from 'vitest';
import type { Snowpack } from '../snowpack/index.ts';
import { type SpotDay, rank, scoreDay, withOverrides } from './index.ts';

// Fixed days, one rule at a time (AGENTS.md: scoring changes come with a ranking test).

const snowpack = (over: Partial<Snowpack> = {}): Snowpack => ({
  depthCm: 60,
  newSnow24hCm: 0,
  newSnow72hCm: 0,
  newSnowQuality: null,
  surface: 'old',
  flags: { crust: false, newSnowOnCrust: false, rainOnSnow: false, windPacked: false },
  gaps: { temperature: 0, snowfall: 0, rain: 0, wind: 0 },
  ...over,
});

const day = (id: string, over: Partial<Omit<SpotDay, 'spot'>> & { spot?: Partial<SpotDay['spot']> } = {}): SpotDay => ({
  date: '2026-12-12',
  weekday: 6,
  hoursSinceSnowfall: null,
  avalancheLevel: 2,
  ...over,
  spot: { id, name: id, lifts: true, dogs: 'leash', ...over.spot },
  snowpack: over.snowpack ?? snowpack(),
  daytime: { windMaxKmh: 10, gustMaxKmh: 20, cloudMeanPct: 20, tempMinC: -6, snowSpreadCm: 2, ...over.daytime },
});

const powder = snowpack({ newSnow24hCm: 30, newSnow72hCm: 30, newSnowQuality: 'light', surface: 'powder' });

describe('lift mode', () => {
  it('ranks a fresh light dump above an old base', () => {
    const ranked = rank([day('old-base'), day('dump', { snowpack: powder })], 'lift');
    expect(ranked.map((s) => s.spotId)).toEqual(['dump', 'old-base']);
  });

  it('excludes spots without lifts', () => {
    const s = scoreDay(day('touring-only', { spot: { lifts: false }, snowpack: powder }), 'lift');
    expect(s).toMatchObject({ excluded: true, score: 0, reasons: ['no lifts here'] });
  });

  it('marks strong gusts down: lifts may close', () => {
    const calm = scoreDay(day('a', { snowpack: powder }), 'lift');
    const gusty = scoreDay(day('a', { snowpack: powder, daytime: { gustMaxKmh: 70 } as SpotDay['daytime'] }), 'lift');
    expect(gusty.score).toBeLessThan(calm.score);
    expect(gusty.reasons.join(' ')).toMatch(/lifts may close/);
  });

  it('gives a weekday a small edge', () => {
    const sat = scoreDay(day('a', { snowpack: powder, weekday: 6 }), 'lift');
    const tue = scoreDay(day('a', { snowpack: powder, weekday: 2 }), 'lift');
    expect(tue.score).toBeGreaterThan(sat.score);
  });
});

describe('splitboard mode', () => {
  it('prefers deep light snow in the sun over the same snow in the clouds', () => {
    const ranked = rank(
      [day('cloudy', { snowpack: powder, daytime: { cloudMeanPct: 95 } as SpotDay['daytime'] }), day('sunny', { snowpack: powder })],
      'splitboard',
    );
    expect(ranked[0]!.spotId).toBe('sunny');
  });

  it('marks new snow on a crust down and says why', () => {
    const loaded = snowpack({ ...powder, flags: { crust: true, newSnowOnCrust: true, rainOnSnow: false, windPacked: false } });
    const s = scoreDay(day('a', { snowpack: loaded }), 'splitboard');
    expect(s.score).toBeLessThan(scoreDay(day('a', { snowpack: powder }), 'splitboard').score);
    expect(s.reasons.join(' ')).toMatch(/crust/);
  });

  it('excludes avalanche danger 4 and above', () => {
    expect(scoreDay(day('a', { snowpack: powder, avalancheLevel: 4 }), 'splitboard')).toMatchObject({ excluded: true });
  });

  it('marks level 3 down, and a missing bulletin too, with a reason', () => {
    const two = scoreDay(day('a', { snowpack: powder, avalancheLevel: 2 }), 'splitboard').score;
    expect(scoreDay(day('a', { snowpack: powder, avalancheLevel: 3 }), 'splitboard').score).toBeLessThan(two);
    const none = scoreDay(day('a', { snowpack: powder, avalancheLevel: null }), 'splitboard');
    expect(none.score).toBeLessThan(two);
    expect(none.reasons.join(' ')).toMatch(/no avalanche bulletin/);
  });
});

describe('dog mode', () => {
  const settled = snowpack({ depthCm: 50, newSnow24hCm: 0, newSnow72hCm: 25, surface: 'old' });
  const good = (id: string, over: Parameters<typeof day>[1] = {}) => day(id, { snowpack: settled, hoursSinceSnowfall: 60, ...over });

  it.each([
    ['dogs banned', { spot: { dogs: 'banned' as const } }, /not allowed/],
    ['avalanche 3', { avalancheLevel: 3 }, /too high for the dog/],
    ['cloudy', { daytime: { cloudMeanPct: 70 } as SpotDay['daytime'] }, /not sunny enough/],
    ['windy', { daytime: { windMaxKmh: 35 } as SpotDay['daytime'] }, /too windy/],
    ['very cold', { daytime: { tempMinC: -20 } as SpotDay['daytime'] }, /too cold/],
    ['deep fresh snow', { snowpack: powder, hoursSinceSnowfall: 2 }, /too deep for the dog/],
  ])('excludes a day that fails a hard rule: %s', (_label, over, reason) => {
    const s = scoreDay(good('a', over), 'dog');
    expect(s.excluded).toBe(true);
    expect(s.reasons[0]).toMatch(reason);
  });

  it('allows deep snow once it has settled for 48 hours on a base', () => {
    expect(scoreDay(good('a', { snowpack: snowpack({ depthCm: 60, newSnow24hCm: 20, newSnow72hCm: 30 }), hoursSinceSnowfall: 50 }), 'dog').excluded).toBe(false);
  });

  it('likes two to three days after a storm best', () => {
    const ranked = rank([good('next-day', { hoursSinceSnowfall: 20 }), good('two-days', { hoursSinceSnowfall: 55 })], 'dog');
    expect(ranked[0]!.spotId).toBe('two-days');
  });

  it('allows a spot without a bulletin, with a caution', () => {
    const s = scoreDay(good('a', { avalancheLevel: null }), 'dog');
    expect(s.excluded).toBe(false);
    expect(s.reasons.join(' ')).toMatch(/gentle terrain/);
  });

  it('refuses to guess the sun: no cloud data excludes', () => {
    expect(scoreDay(good('a', { daytime: { cloudMeanPct: null } as SpotDay['daytime'] }), 'dog').reasons[0]).toMatch(/can’t confirm/);
  });
});

describe('ranking and settings', () => {
  it('puts excluded spots last', () => {
    const ranked = rank([day('banned', { spot: { lifts: false } }), day('ok')], 'lift');
    expect(ranked.map((s) => [s.spotId, s.excluded])).toEqual([['ok', false], ['banned', true]]);
  });

  it('reports confidence from the model spread', () => {
    expect(scoreDay(day('a'), 'lift').confidence).toBe('high');
    expect(scoreDay(day('a', { daytime: { snowSpreadCm: 12 } as SpotDay['daytime'] }), 'lift').confidence).toBe('medium');
    expect(scoreDay(day('a', { daytime: { snowSpreadCm: 25 } as SpotDay['daytime'] }), 'lift').confidence).toBe('low');
  });

  it('takes settings, so weights can be tuned without editing code', () => {
    const windy = day('a', { daytime: { windMaxKmh: 30 } as SpotDay['daytime'] });
    expect(scoreDay(windy, 'dog').excluded).toBe(true);
    expect(scoreDay(windy, 'dog', withOverrides({ dog: { gates: { ...withOverrides().dog.gates, maxWindKmh: 40 } } })).excluded).toBe(false);
  });
});
