import { describe, expect, it } from 'vitest';
import forecastFixture from '../fixtures/open-meteo-forecast.json' with { type: 'json' };
import { type ForecastQuery, type SpotSeries, parseForecast } from '../open-meteo.ts';
import { DEFAULT_SCORING, blend, daytimeHours, daytimeWeather, localTime, localise, snowSpreadCm } from './index.ts';

const query: ForecastQuery = {
  locations: [
    { id: 'praded', lat: 50.083, lon: 17.231, elevationM: 1491 },
    { id: 'kasprowy-wierch', lat: 49.232, lon: 19.982, elevationM: 1987 },
  ],
  variables: ['snowfall', 'temperature_2m', 'wind_speed_10m', 'freezing_level_height', 'cloud_cover'],
  models: ['ecmwf_ifs025', 'gfs_seamless', 'icon_d2'],
  forecastDays: 2,
};
const praded = parseForecast(forecastFixture, query).series[0]!;

describe('localTime', () => {
  it('converts UTC to Polish time in winter (UTC+1)', () => {
    expect(localTime('2026-11-27T07:00Z', 'Europe/Warsaw')).toEqual({ date: '2026-11-27', hour: 8, weekday: 5 });
  });

  it('and in summer (UTC+2)', () => {
    expect(localTime('2026-07-01T06:00Z', 'Europe/Warsaw').hour).toBe(8);
  });

  it('rolls the date over at local midnight', () => {
    expect(localTime('2026-11-27T23:30Z', 'Europe/Warsaw').date).toBe('2026-11-28');
  });
});

describe('blend', () => {
  it('averages the models that have a value, hour by hour', () => {
    // First hour on the recorded day: ECMWF 0.49, GFS 0.42, ICON-D2 0.28 cm.
    expect(blend(praded, 'snowfall')[0]).toBeCloseTo((0.49 + 0.42 + 0.28) / 3, 5);
  });

  it('skips a model without data instead of counting it as zero', () => {
    // ECMWF has no freezing level at all; the blend uses GFS (60 m) and ICON-D2 (720 m).
    expect(blend(praded, 'freezing_level_height')[0]).toBe((60 + 720) / 2);
  });
});

describe('daytime window', () => {
  const local = localise(praded.times, DEFAULT_SCORING);

  it('takes 08:00–16:00 local time: eight hours', () => {
    const idx = daytimeHours(local, '2026-11-27', DEFAULT_SCORING);
    expect(idx).toHaveLength(8);
    expect(praded.times[idx[0]!]).toBe('2026-11-27T07:00Z');
  });

  it('summarises the day', () => {
    const w = daytimeWeather(praded, local, '2026-11-27', DEFAULT_SCORING);
    expect(w.cloudMeanPct).not.toBeNull();
    expect(w.windMaxKmh).toBeGreaterThan(0);
    expect(w.gustMaxKmh).toBeNull(); // gusts weren't in the recorded request: reported as unknown, not zero
  });

  it('works out local times once for a long series, fast enough for a Worker', () => {
    const times = Array.from({ length: 16 * 24 }, (_, i) => new Date(Date.UTC(2026, 11, 1, i)).toISOString());
    const started = Date.now();
    for (let spot = 0; spot < 20; spot++) localise(times, DEFAULT_SCORING);
    expect(Date.now() - started).toBeLessThan(500); // 20 spots × 16 days; was ~30 ms per spot-day before caching
  });
});

describe('snowSpreadCm: confidence comes from the snow the score counts', () => {
  // Three models over 80 hours from midnight UTC, 2026-12-10; 08:00 local on 12-13 is hour 79.
  const times = Array.from({ length: 80 }, (_, i) => new Date(Date.UTC(2026, 11, 10, i)).toISOString());
  const local = localise(times, DEFAULT_SCORING);
  const series = (values: Record<string, (number | null)[]>): SpotSeries => ({
    id: 'x',
    times,
    values: Object.fromEntries(Object.entries(values).map(([m, v]) => [m, { snowfall: v }])),
  });
  const flat = (cmPerHour: number) => times.map(() => cmPerHour);

  it('compares each model’s total over the 72 h up to 08:00', () => {
    const s = series({ ecmwf_ifs025: flat(0.5), gfs_seamless: flat(0.1), icon_d2: flat(0.3) });
    expect(snowSpreadCm(s, local, '2026-12-13', DEFAULT_SCORING)).toBe(Math.round(72 * 0.4 * 10) / 10);
  });

  it('sees disagreement on an overnight dump even when the scored day itself is dry', () => {
    const dump = (cm: number) => times.map((_, i) => (i >= 70 && i < 79 ? cm : 0)); // night before, dry after 08:00
    const s = series({ ecmwf_ifs025: dump(4), gfs_seamless: dump(0.5) });
    expect(snowSpreadCm(s, local, '2026-12-13', DEFAULT_SCORING)).toBeGreaterThan(20);
  });

  it('leaves out a model that doesn’t cover the whole window', () => {
    const short = times.map((_, i) => (i < 48 ? 0.3 : null)); // horizon ends early, like ICON-D2
    const s = series({ ecmwf_ifs025: flat(0.2), gfs_seamless: flat(0.2), icon_d2: short });
    expect(snowSpreadCm(s, local, '2026-12-13', DEFAULT_SCORING)).toBe(0);
  });

  it('is null with fewer than two models covering the window', () => {
    expect(snowSpreadCm(series({ gfs_seamless: flat(0.2) }), local, '2026-12-13', DEFAULT_SCORING)).toBeNull();
  });
});
