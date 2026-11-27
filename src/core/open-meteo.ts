// Open-Meteo client: builds batched requests and turns responses into per-spot series (ADR 0003).
// Plain TypeScript with no fetch and no Cloudflare APIs (ADR 0010): the caller does the HTTP.
//
// Gaps are reported, never filled: a missing or empty variable stays null and is listed in
// `problems`, so scoring can say "no data" instead of reading it as zero.

export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const ENSEMBLE_URL = 'https://ensemble-api.open-meteo.com/v1/ensemble';

export type Model = 'ecmwf_ifs025' | 'gfs_seamless' | 'icon_d2';

/** Hourly variables powdog uses. Units as Open-Meteo returns them: cm, °C, km/h, m, %, mm, s. */
export type Variable =
  | 'snowfall'
  | 'rain'
  | 'temperature_2m'
  | 'wind_speed_10m'
  | 'wind_gusts_10m'
  | 'freezing_level_height'
  | 'cloud_cover'
  | 'snow_depth'
  | 'sunshine_duration';

export interface Location {
  id: string;
  lat: number;
  lon: number;
  /** Forecasts are downscaled to this height (the spot's top), metres above sea level. */
  elevationM: number;
}

export interface ForecastQuery {
  locations: Location[];
  variables: Variable[];
  models: Model[];
  forecastDays: number;
  /** Past days of weather before today, for the snowpack (up to 92). */
  pastDays?: number;
}

export interface EnsembleQuery {
  locations: Location[];
  variables: Variable[];
  model: Model;
  forecastDays: number;
}

type Values = (number | null)[];

export interface SpotSeries {
  id: string;
  /** Hour starts in UTC, ISO 8601 with a trailing Z. */
  times: string[];
  /** values[model][variable][hour]; null where the model has no value. */
  values: Partial<Record<Model, Partial<Record<Variable, Values>>>>;
}

export interface EnsembleSeries {
  id: string;
  times: string[];
  /** members[variable][member][hour]; member 0 is the control run. */
  members: Partial<Record<Variable, Values[]>>;
}

export interface Parsed<T> {
  series: T[];
  /** Human-readable gaps and mismatches, e.g. "praded: freezing_level_height from ecmwf_ifs025 is empty". */
  problems: string[];
}

function locationParams(locations: Location[]): Record<string, string> {
  return {
    latitude: locations.map((l) => l.lat).join(','),
    longitude: locations.map((l) => l.lon).join(','),
    elevation: locations.map((l) => l.elevationM).join(','),
  };
}

function url(base: string, params: Record<string, string>): string {
  // Commas stay readable; Open-Meteo accepts them unencoded.
  return `${base}?${Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v).replaceAll('%2C', ',')}`).join('&')}`;
}

/** One request for all locations; times come back in UTC. */
export function forecastUrl(q: ForecastQuery): string {
  return url(FORECAST_URL, {
    ...locationParams(q.locations),
    hourly: q.variables.join(','),
    models: q.models.join(','),
    forecast_days: String(q.forecastDays),
    ...(q.pastDays ? { past_days: String(q.pastDays) } : {}),
    timezone: 'GMT',
  });
}

export function ensembleUrl(q: EnsembleQuery): string {
  return url(ENSEMBLE_URL, {
    ...locationParams(q.locations),
    hourly: q.variables.join(','),
    models: q.model,
    forecast_days: String(q.forecastDays),
    timezone: 'GMT',
  });
}

interface RawLocation {
  elevation?: number;
  hourly?: Record<string, Values | string[]>;
}

/** Open-Meteo returns an array for several locations and a single object for one; errors come as {error, reason}. */
function rawLocations(json: unknown, expected: number, problems: string[]): RawLocation[] | null {
  if (json && typeof json === 'object' && 'error' in json) {
    problems.push(`Open-Meteo error: ${String((json as { reason?: unknown }).reason ?? 'unknown')}`);
    return null;
  }
  const list = Array.isArray(json) ? json : [json];
  if (list.length !== expected) {
    problems.push(`expected ${expected} locations, got ${list.length}`);
    return null;
  }
  return list as RawLocation[];
}

function hoursOf(raw: RawLocation, id: string, problems: string[]): string[] | null {
  const time = raw.hourly?.time;
  if (!Array.isArray(time) || time.length === 0) {
    problems.push(`${id}: no hourly times`);
    return null;
  }
  return (time as string[]).map((t) => (t.endsWith('Z') ? t : `${t}Z`));
}

function checkElevation(raw: RawLocation, loc: Location, problems: string[]): void {
  if (raw.elevation !== undefined && Math.abs(raw.elevation - loc.elevationM) > 1) {
    problems.push(`${loc.id}: forecast is for ${raw.elevation} m, not the requested ${loc.elevationM} m`);
  }
}

/** Reads one series; reports a missing key, an empty series and partial gaps. */
function column(raw: RawLocation, key: string, hours: number, label: string, problems: string[]): Values {
  const col = raw.hourly?.[key];
  if (!Array.isArray(col)) {
    problems.push(`${label} is missing`);
    return Array<number | null>(hours).fill(null);
  }
  const values = (col as unknown[]).map((v) => (typeof v === 'number' ? v : null));
  const gaps = values.filter((v) => v === null).length;
  if (gaps === values.length) problems.push(`${label} is empty`);
  else if (gaps > 0) problems.push(`${label} has ${gaps} of ${values.length} hours missing`);
  return values;
}

export function parseForecast(json: unknown, q: ForecastQuery): Parsed<SpotSeries> {
  const problems: string[] = [];
  const raws = rawLocations(json, q.locations.length, problems);
  if (!raws) return { series: [], problems };
  const series: SpotSeries[] = [];
  q.locations.forEach((loc, i) => {
    const raw = raws[i]!;
    const times = hoursOf(raw, loc.id, problems);
    if (!times) return;
    checkElevation(raw, loc, problems);
    const values: SpotSeries['values'] = {};
    for (const model of q.models) {
      const byVar: Partial<Record<Variable, Values>> = {};
      for (const variable of q.variables) {
        // With one model Open-Meteo drops the model suffix from the key.
        const key = q.models.length === 1 ? variable : `${variable}_${model}`;
        byVar[variable] = column(raw, key, times.length, `${loc.id}: ${variable} from ${model}`, problems);
      }
      values[model] = byVar;
    }
    series.push({ id: loc.id, times, values });
  });
  return { series, problems };
}

export function parseEnsemble(json: unknown, q: EnsembleQuery): Parsed<EnsembleSeries> {
  const problems: string[] = [];
  const raws = rawLocations(json, q.locations.length, problems);
  if (!raws) return { series: [], problems };
  const series: EnsembleSeries[] = [];
  q.locations.forEach((loc, i) => {
    const raw = raws[i]!;
    const times = hoursOf(raw, loc.id, problems);
    if (!times) return;
    checkElevation(raw, loc, problems);
    const members: EnsembleSeries['members'] = {};
    for (const variable of q.variables) {
      const keys = Object.keys(raw.hourly ?? {})
        .filter((k) => k.startsWith(`${variable}_member`))
        .sort();
      const label = `${loc.id}: ${variable} ensemble`;
      members[variable] = [
        column(raw, variable, times.length, `${label} control`, problems),
        ...keys.map((k) => column(raw, k, times.length, `${label} ${k.slice(variable.length + 1)}`, problems)),
      ];
      if (keys.length === 0) problems.push(`${label} has no members`);
    }
    series.push({ id: loc.id, times, members });
  });
  return { series, problems };
}
