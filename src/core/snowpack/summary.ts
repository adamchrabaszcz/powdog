// From the walk to what a rider wants to know: how much new snow, how deep, what's under it,
// and what the surface is like.

import { type SnowpackSettings, qualityOf, settledDensity } from './settings.ts';
import type { Layer, Quality, Snowpack, Surface, WeatherHour } from './types.ts';
import type { Walk } from './walk.ts';

const round = (cm: number) => Math.round(cm * 10) / 10;
/** Height of a layer as it fell, cm. */
const fallenCm = (l: Layer) => (l.swe * 100) / l.density;
const sumFallen = (ls: Layer[]) => ls.reduce((s, l) => s + fallenCm(l), 0);

export function summarise(w: Walk, hours: WeatherHour[], s: SnowpackSettings): Snowpack {
  const end = hours.length;
  const within = (hour: number, span: number) => end - hour <= span;
  const fresh = w.layers.filter((l) => within(l.hour, s.freshHours));

  const newSnow72hCm = round(sumFallen(fresh));
  const newSnow24hCm = round(sumFallen(fresh.filter((l) => within(l.hour, 24))));
  const depthCm = settledDepthCm(w.layers, end, s);
  const flags = {
    ...crustFlags(w, s),
    rainOnSnow: w.lastRainOnSnowHour !== null && within(w.lastRainOnSnowHour, s.freshHours),
    windPacked: windPacked(fresh, hours, s),
  };
  const recentThaw = w.lastThawHour !== null && within(w.lastThawHour, s.wetWithinHours);
  return {
    depthCm,
    newSnow24hCm,
    newSnow72hCm,
    newSnowQuality: newSnowQuality(fresh, s),
    surface: surfaceOf({ depthCm, newSnow72hCm, recentThaw, ...flags }, s),
    flags,
    gaps: w.gaps,
  };
}

/** Depth now, with every layer at its settled density for its age, cm. */
export function settledDepthCm(layers: Layer[], end: number, s: SnowpackSettings): number {
  return round(layers.reduce((sum, l) => sum + (l.swe * 100) / settledDensity(l.density, end - l.hour, s), 0));
}

export function crustFlags(w: Pick<Walk, 'crustHour' | 'layers'>, s: SnowpackSettings): { crust: boolean; newSnowOnCrust: boolean } {
  if (w.crustHour === null) return { crust: false, newSnowOnCrust: false };
  const onCrust = sumFallen(w.layers.filter((l) => l.hour > w.crustHour!));
  return { crust: onCrust < s.crustBuriedCm, newSnowOnCrust: onCrust >= s.newSnowOnCrustCm };
}

/** Wind strong enough to pack snow during or after the fresh snowfall. A missing wind value can't set the flag; it's counted in `gaps.wind`. */
export function windPacked(fresh: Layer[], hours: WeatherHour[], s: SnowpackSettings): boolean {
  const first = fresh[0];
  return first !== undefined && hours.slice(first.hour).some((h) => (h.windKmh ?? 0) >= s.windPackingKmh);
}

export function newSnowQuality(fresh: Layer[], s: SnowpackSettings): Quality | null {
  const swe = fresh.reduce((sum, l) => sum + l.swe, 0);
  return swe > 0 ? qualityOf((swe * 100) / sumFallen(fresh), s) : null;
}

export interface SurfaceInput {
  depthCm: number;
  newSnow72hCm: number;
  recentThaw: boolean;
  windPacked: boolean;
  rainOnSnow: boolean;
  crust: boolean;
}

/** The surface, first matching rule wins. */
export function surfaceOf(x: SurfaceInput, s: SnowpackSettings): Surface {
  if (x.depthCm < s.bareBelowCm) return 'none';
  if (x.recentThaw) return 'wet';
  const enoughNew = x.newSnow72hCm >= s.powderMinCm;
  if (enoughNew && x.windPacked) return 'wind-packed';
  if (enoughNew && !x.rainOnSnow) return 'powder';
  if (x.crust) return 'crust';
  return 'old';
}
