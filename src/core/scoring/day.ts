// Turning hourly, per-model Open-Meteo series into what scoring reads for one local day:
// models averaged (rule 3), daytime window in local time (rule 2), and the models' spread on
// the snow the score counts. Local times are worked out once per series and reused for every day.

import type { Model, SpotSeries, Variable } from '../open-meteo.ts';
import type { ScoringSettings } from './settings.ts';
import type { DaytimeWeather } from './types.ts';

type Values = (number | null)[];

export interface LocalHour {
  date: string;
  hour: number;
  weekday: number;
}

// Building an Intl.DateTimeFormat is slow (tens of µs); one per time zone is plenty.
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Local date (YYYY-MM-DD), hour and weekday of a UTC instant in the given time zone. */
export function localTime(isoUtc: string, timeZone: string): LocalHour {
  const parts = formatter(timeZone).formatToParts(new Date(isoUtc));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')), weekday: WEEKDAYS.indexOf(get('weekday')) };
}

/** Local times for a whole series, once; pass the result to the other functions here. */
export const localise = (times: string[], s: ScoringSettings): LocalHour[] => times.map((t) => localTime(t, s.daytime.timeZone));

/** The variable's series from every model that has it. */
function modelSeries(series: SpotSeries, variable: Variable): Values[] {
  return (Object.keys(series.values) as Model[]).map((m) => series.values[m]?.[variable]).filter((v): v is Values => !!v);
}

/** Per hour: the mean of the models that have a value; null where none do. */
export function blend(series: SpotSeries, variable: Variable): Values {
  const all = modelSeries(series, variable);
  return series.times.map((_, i) => {
    const vals = all.map((v) => v[i]).filter((v): v is number => typeof v === 'number');
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });
}

/** Indices of the hours in the daytime window of `date`. */
export function daytimeHours(local: LocalHour[], date: string, s: ScoringSettings): number[] {
  const idx: number[] = [];
  local.forEach((h, i) => {
    if (h.date === date && h.hour >= s.daytime.fromHour && h.hour < s.daytime.toHour) idx.push(i);
  });
  return idx;
}

const pick = (v: Values, idx: number[]) => idx.map((i) => v[i]).filter((x): x is number => typeof x === 'number');
const max = (xs: number[]) => (xs.length ? Math.max(...xs) : null);
const min = (xs: number[]) => (xs.length ? Math.min(...xs) : null);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Daytime weather for one local day, models averaged. */
export function daytimeWeather(series: SpotSeries, local: LocalHour[], date: string, s: ScoringSettings): DaytimeWeather {
  const idx = daytimeHours(local, date, s);
  return {
    windMaxKmh: max(pick(blend(series, 'wind_speed_10m'), idx)),
    gustMaxKmh: max(pick(blend(series, 'wind_gusts_10m'), idx)),
    cloudMeanPct: mean(pick(blend(series, 'cloud_cover'), idx)),
    tempMinC: min(pick(blend(series, 'temperature_2m'), idx)),
  };
}

/** Hours of new snow the confidence looks at: the same 72 h the snowpack counts as fresh. */
export const SPREAD_WINDOW_HOURS = 72;

/**
 * How far apart the models are on the snow the score counts: each model's total over the 72 h up to
 * the start of the daytime window (08:00), max − min. Only models with a value for every hour of that
 * window count, so a model whose horizon ends early can't inflate the spread; null with fewer than two.
 */
export function snowSpreadCm(series: SpotSeries, local: LocalHour[], date: string, s: ScoringSettings): number | null {
  const morning = local.findIndex((h) => h.date === date && h.hour === s.daytime.fromHour);
  if (morning < 0) return null;
  const from = Math.max(0, morning - SPREAD_WINDOW_HOURS);
  const totals = modelSeries(series, 'snowfall')
    .map((v) => v.slice(from, morning))
    .filter((w) => w.length > 0 && w.every((x) => typeof x === 'number'))
    .map((w) => (w as number[]).reduce((a, b) => a + b, 0));
  if (totals.length < 2) return null;
  return Math.round((Math.max(...totals) - Math.min(...totals)) * 10) / 10;
}
