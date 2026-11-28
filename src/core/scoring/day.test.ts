import { describe, expect, it } from 'vitest';
import forecastFixture from '../fixtures/open-meteo-forecast.json' with { type: 'json' };
import { type ForecastQuery, parseForecast } from '../open-meteo.ts';
import { DEFAULT_SCORING, blend, daytimeHours, daytimeWeather, localTime } from './index.ts';

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
  it('takes 08:00–16:00 local time: eight hours', () => {
    const idx = daytimeHours(praded.times, '2026-11-27', DEFAULT_SCORING);
    expect(idx).toHaveLength(8);
    expect(praded.times[idx[0]!]).toBe('2026-11-27T07:00Z');
  });

  it('summarises the day, with the models’ spread on snowfall', () => {
    const w = daytimeWeather(praded, '2026-11-27', DEFAULT_SCORING);
    expect(w.cloudMeanPct).not.toBeNull();
    expect(w.windMaxKmh).toBeGreaterThan(0);
    expect(w.gustMaxKmh).toBeNull(); // gusts weren't in the recorded request: reported as unknown, not zero
    expect(w.snowSpreadCm).toBeGreaterThanOrEqual(0);
  });
});
