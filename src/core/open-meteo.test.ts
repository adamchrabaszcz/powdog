import { describe, expect, it } from 'vitest';
import ensembleFixture from './fixtures/open-meteo-ensemble.json' with { type: 'json' };
import forecastFixture from './fixtures/open-meteo-forecast.json' with { type: 'json' };
import {
  type EnsembleQuery,
  type ForecastQuery,
  ensembleUrl,
  forecastUrl,
  parseEnsemble,
  parseForecast,
} from './open-meteo.ts';

// The fixtures are real responses recorded on 2026-11-27 for Praděd and Kasprowy Wierch.
const locations = [
  { id: 'praded', lat: 50.083, lon: 17.231, elevationM: 1491 },
  { id: 'kasprowy-wierch', lat: 49.232, lon: 19.982, elevationM: 1987 },
];
const forecastQuery: ForecastQuery = {
  locations,
  variables: ['snowfall', 'temperature_2m', 'wind_speed_10m', 'freezing_level_height', 'cloud_cover'],
  models: ['ecmwf_ifs025', 'gfs_seamless', 'icon_d2'],
  forecastDays: 2,
};
const ensembleQuery: EnsembleQuery = { locations, variables: ['snowfall'], model: 'ecmwf_ifs025', forecastDays: 2 };

/** Splits a URL into its base and decoded query parameters (core code has no URL global). */
function parse(u: string): { base: string; params: Map<string, string> } {
  const [base = '', query = ''] = u.split('?');
  const params = new Map(query.split('&').map((p) => p.split('=').map(decodeURIComponent) as [string, string]));
  return { base, params };
}

describe('forecastUrl', () => {
  it('asks for all spots in one request, at their summit elevation, in UTC', () => {
    const { base, params } = parse(forecastUrl({ ...forecastQuery, pastDays: 92 }));
    expect(base).toBe('https://api.open-meteo.com/v1/forecast');
    expect(params.get('latitude')).toBe('50.083,49.232');
    expect(params.get('longitude')).toBe('17.231,19.982');
    expect(params.get('elevation')).toBe('1491,1987');
    expect(params.get('models')).toBe('ecmwf_ifs025,gfs_seamless,icon_d2');
    expect(params.get('past_days')).toBe('92');
    expect(params.get('timezone')).toBe('GMT');
  });

  it('leaves out past_days when not asked for', () => {
    expect(parse(forecastUrl(forecastQuery)).params.has('past_days')).toBe(false);
  });
});

describe('ensembleUrl', () => {
  it('uses the ensemble API with one model', () => {
    const { base, params } = parse(ensembleUrl(ensembleQuery));
    expect(base).toBe('https://ensemble-api.open-meteo.com/v1/ensemble');
    expect(params.get('models')).toBe('ecmwf_ifs025');
  });
});

describe('parseForecast', () => {
  const { series, problems } = parseForecast(forecastFixture, forecastQuery);

  it('returns one series per spot, in request order', () => {
    expect(series.map((s) => s.id)).toEqual(['praded', 'kasprowy-wierch']);
  });

  it('returns hourly UTC times', () => {
    expect(series[0]!.times).toHaveLength(48);
    expect(series[0]!.times[0]).toBe('2026-11-27T00:00Z');
  });

  it('reads each model separately', () => {
    const praded = series[0]!.values;
    expect(praded.ecmwf_ifs025?.snowfall?.[0]).toBe(0.49);
    expect(praded.gfs_seamless?.snowfall?.[0]).toBe(0.42);
    expect(praded.icon_d2?.temperature_2m?.[0]).toBe(-9.9);
  });

  it('keeps a model with no data as nulls and reports it, never as zero', () => {
    expect(series[0]!.values.ecmwf_ifs025?.freezing_level_height?.every((v) => v === null)).toBe(true);
    expect(problems).toContain('praded: freezing_level_height from ecmwf_ifs025 is empty');
  });

  it('reports a variable the response does not have', () => {
    const r = parseForecast(forecastFixture, { ...forecastQuery, variables: ['snowfall', 'rain'] });
    expect(r.problems).toContain('praded: rain from gfs_seamless is missing');
    expect(r.series[0]!.values.gfs_seamless?.rain).toHaveLength(48);
  });

  it('reads a single-location response, which is an object without model suffixes', () => {
    const single = {
      elevation: 1491,
      hourly: { time: ['2026-11-27T00:00', '2026-11-27T01:00'], snowfall: [1.5, 0] },
    };
    const r = parseForecast(single, { locations: [locations[0]!], variables: ['snowfall'], models: ['gfs_seamless'], forecastDays: 1 });
    expect(r.problems).toEqual([]);
    expect(r.series[0]!.values.gfs_seamless?.snowfall).toEqual([1.5, 0]);
  });

  it('reports partial gaps with a count', () => {
    const gappy = { hourly: { time: ['2026-11-27T00:00', '2026-11-27T01:00'], snowfall: [1, null] } };
    const r = parseForecast(gappy, { locations: [locations[0]!], variables: ['snowfall'], models: ['gfs_seamless'], forecastDays: 1 });
    expect(r.problems).toEqual(['praded: snowfall from gfs_seamless has 1 of 2 hours missing']);
  });

  it('reports an Open-Meteo error and returns no series', () => {
    const r = parseForecast({ error: true, reason: 'Parameter elevation is out of range' }, forecastQuery);
    expect(r.series).toEqual([]);
    expect(r.problems).toEqual(['Open-Meteo error: Parameter elevation is out of range']);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'Bad Gateway'],
    ['nulls in the list', [null, null]],
    ['one null in the list', [forecastFixture[0], null]],
  ])('reports %s as no usable data instead of crashing', (_label, body) => {
    const r = parseForecast(body, forecastQuery);
    expect(r.series).toEqual([]);
    expect(r.problems).toEqual(['Open-Meteo returned no usable data']);
    expect(parseEnsemble(body, ensembleQuery).problems).toEqual(['Open-Meteo returned no usable data']);
  });

  it('reports a single null for a one-spot query instead of crashing', () => {
    const r = parseForecast(null, { ...forecastQuery, locations: [locations[0]!] });
    expect(r.problems).toEqual(['Open-Meteo returned no usable data']);
  });

  it('reports a response for the wrong number of spots', () => {
    const r = parseForecast([forecastFixture[0]], forecastQuery);
    expect(r.series).toEqual([]);
    expect(r.problems).toEqual(['expected 2 locations, got 1']);
  });

  it('reports a forecast taken at a different height than asked', () => {
    const r = parseForecast(forecastFixture, { ...forecastQuery, locations: [{ ...locations[0]!, elevationM: 1200 }, locations[1]!] });
    expect(r.problems).toContain('praded: forecast is for 1491 m, not the requested 1200 m');
  });
});

describe('parseEnsemble', () => {
  const { series, problems } = parseEnsemble(ensembleFixture, ensembleQuery);

  it('returns the control run and 50 members per variable', () => {
    expect(series[0]!.members.snowfall).toHaveLength(51);
    expect(series[0]!.members.snowfall?.[0]).toHaveLength(48);
    expect(problems).toEqual([]);
  });

  it('reports a variable without members', () => {
    const r = parseEnsemble(ensembleFixture, { ...ensembleQuery, variables: ['rain'] });
    expect(r.problems).toContain('praded: rain ensemble has no members');
  });
});
