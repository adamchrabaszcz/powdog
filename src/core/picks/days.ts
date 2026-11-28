// From real data to what scoring reads: one SpotDay per spot and date (#36).
// Plain TypeScript: no fetch, no clock (the caller passes `now`), no Cloudflare (ADR 0010, 0011).

import type { ForecastQuery, Model, SpotSeries, Variable } from '../open-meteo.ts';
import {
  type AvalancheLevel,
  DEFAULT_SCORING,
  type LocalHour,
  type ScoringSettings,
  type SpotDay,
  blend,
  daytimeWeather,
  localise,
  localTime,
  snowSpreadCm,
} from '../scoring/index.ts';
import { buildSnowpack, type WeatherHour } from '../snowpack/index.ts';
import type { Spot } from '../spots.ts';

export const PICKS_VARIABLES: Variable[] = ['snowfall', 'rain', 'temperature_2m', 'wind_speed_10m', 'wind_gusts_10m', 'cloud_cover'];
export const PICKS_MODELS: Model[] = ['ecmwf_ifs025', 'gfs_seamless', 'icon_d2'];
/**
 * Past days of weather in the request. Confidence needs at least 3 (the 72 h before 08:00 of day 1,
 * #37 review); the snowpack needs as many as there are for a real base. Open-Meteo's forecast API
 * keeps about two months of past model runs, so asking for more only returns empty hours (seen on
 * 2026-11-28: data from 26–30 September onwards).
 */
export const PICKS_PAST_DAYS = 60;
/** An hour with at least this much snow counts as snowing, for "hours since the snowfall", cm. */
export const SNOWING_CM_PER_HOUR = 0.2;

/** One request for every spot, at its summit, with the past days the snowpack and confidence need. */
export function picksQuery(spots: Spot[], forecastDays = 3): ForecastQuery {
  return {
    locations: spots.map((s) => ({ id: s.id, lat: s.lat, lon: s.lon, elevationM: s.topElevationM })),
    variables: PICKS_VARIABLES,
    models: PICKS_MODELS,
    forecastDays,
    pastDays: PICKS_PAST_DAYS,
  };
}

/** Until avalanche bulletins are read (step 2): no bulletin stays null, an existing one is 'unknown'. */
export const avalancheFor = (spot: Spot): AvalancheLevel => (spot.avalanche === null ? null : 'unknown');

/** The models averaged into the hourly input the snowpack takes. */
export function weatherHours(series: SpotSeries): WeatherHour[] {
  const [temp, snow, rain, wind] = (['temperature_2m', 'snowfall', 'rain', 'wind_speed_10m'] as const).map((v) => blend(series, v));
  return series.times.map((time, i) => ({
    time,
    temperatureC: temp![i] ?? null,
    snowfallCm: snow![i] ?? null,
    rainMm: rain![i] ?? null,
    windKmh: wind![i] ?? null,
  }));
}

/** Hours from the last snowing hour before `morning` to `morning`; null if it didn't snow in the series. */
export function hoursSinceSnowfall(snowCm: (number | null)[], morning: number): number | null {
  for (let i = morning - 1; i >= 0; i--) if ((snowCm[i] ?? 0) >= SNOWING_CM_PER_HOUR) return morning - i;
  return null;
}

/** The local dates to score: today and the next days, as far as the series reaches 08:00. */
export function forecastDates(local: LocalHour[], nowIso: string, count: number, s: ScoringSettings = DEFAULT_SCORING): string[] {
  const today = localTime(nowIso, s.daytime.timeZone).date;
  const dates = [...new Set(local.filter((h) => h.hour === s.daytime.fromHour).map((h) => h.date))];
  return dates.filter((d) => d >= today).slice(0, count);
}

/** One SpotDay per date: snowpack and snowfall up to 08:00, daytime weather, the models' spread. */
export function spotDays(spot: Spot, series: SpotSeries, dates: string[], s: ScoringSettings = DEFAULT_SCORING): SpotDay[] {
  const local = localise(series.times, s);
  const hours = weatherHours(series);
  const snow = hours.map((h) => h.snowfallCm);
  return dates.flatMap((date) => {
    const morning = local.findIndex((h) => h.date === date && h.hour === s.daytime.fromHour);
    if (morning < 0) return [];
    return [{
      spot: { id: spot.id, name: spot.name, lifts: spot.lifts, dogs: spot.dogs },
      date,
      weekday: local[morning]!.weekday,
      snowpack: buildSnowpack(hours.slice(0, morning)),
      hoursSinceSnowfall: hoursSinceSnowfall(snow, morning),
      daytime: daytimeWeather(series, local, date, s),
      snowSpreadCm: snowSpreadCm(series, local, date, s),
      avalancheLevel: avalancheFor(spot),
    }];
  });
}
