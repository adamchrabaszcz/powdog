// Turning hourly, per-model Open-Meteo series into what scoring reads for one local day:
// models averaged (rule 3), daytime window in local time (rule 2), and the models' spread.

import type { Model, SpotSeries, Variable } from '../open-meteo.ts';
import type { ScoringSettings } from './settings.ts';
import type { DaytimeWeather } from './types.ts';

type Values = (number | null)[];

/** Local date (YYYY-MM-DD), hour and weekday of a UTC instant in the given time zone. */
export function localTime(isoUtc: string, timeZone: string): { date: string; hour: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(new Date(isoUtc));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')), weekday };
}

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
export function daytimeHours(times: string[], date: string, s: ScoringSettings): number[] {
  return times
    .map((t, i) => ({ i, ...localTime(t, s.daytime.timeZone) }))
    .filter((h) => h.date === date && h.hour >= s.daytime.fromHour && h.hour < s.daytime.toHour)
    .map((h) => h.i);
}

const pick = (v: Values, idx: number[]) => idx.map((i) => v[i]).filter((x): x is number => typeof x === 'number');
const max = (xs: number[]) => (xs.length ? Math.max(...xs) : null);
const min = (xs: number[]) => (xs.length ? Math.min(...xs) : null);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Daytime weather for one local day, models averaged; the spread compares each model's snowfall total for that day. */
export function daytimeWeather(series: SpotSeries, date: string, s: ScoringSettings): DaytimeWeather {
  const idx = daytimeHours(series.times, date, s);
  const dayIdx = series.times.map((t, i) => ({ i, d: localTime(t, s.daytime.timeZone).date })).filter((h) => h.d === date).map((h) => h.i);
  const totals = modelSeries(series, 'snowfall')
    .map((v) => pick(v, dayIdx))
    .filter((xs) => xs.length > 0)
    .map((xs) => xs.reduce((a, b) => a + b, 0));
  return {
    windMaxKmh: max(pick(blend(series, 'wind_speed_10m'), idx)),
    gustMaxKmh: max(pick(blend(series, 'wind_gusts_10m'), idx)),
    cloudMeanPct: mean(pick(blend(series, 'cloud_cover'), idx)),
    tempMinC: min(pick(blend(series, 'temperature_2m'), idx)),
    snowSpreadCm: totals.length ? Math.round((Math.max(...totals) - Math.min(...totals)) * 10) / 10 : null,
  };
}
