// Tunable rules of thumb for the snowpack, in one place (ADR 0011). Callers can pass their own
// values; DEFAULT_SNOWPACK is what runs unless someone says otherwise.

import type { Quality } from './types.ts';

export interface SnowpackSettings {
  /** Melt per degree above zero per hour, mm of water. */
  meltMmPerDegreeHour: number;
  /** Hours above zero, with snow on the ground, that make a crust once it freezes again. */
  thawHoursForCrust: number;
  /** Below this the thawed surface counts as refrozen, °C. */
  refreezeC: number;
  /** New snow on a crust that counts as loading it, cm. */
  newSnowOnCrustCm: number;
  /** Under this much snow a crust no longer counts as near the surface, cm. */
  crustBuriedCm: number;
  /** Wind that packs fresh snow, km/h. */
  windPackingKmh: number;
  /** Density old snow settles towards, kg/m³. */
  oldSnowDensity: number;
  /** A layer's density closes about 63% of the gap to old snow in this many hours. */
  settlingHours: number;
  /** New snow counts as fresh for this long, hours. */
  freshHours: number;
  /** A thaw this recent makes the surface wet, hours. */
  wetWithinHours: number;
  /** Fresh snow needed to call the surface powder (or wind-packed), cm. */
  powderMinCm: number;
  /** Less than this is no usable snow, cm. */
  bareBelowCm: number;
  /** New-snow density by air temperature: the first row whose limit the temperature is at or below, kg/m³. */
  freshDensity: readonly { readonly atOrBelowC: number; readonly density: number }[];
  /** New-snow density above the last limit (wet snow), kg/m³. */
  wetSnowDensity: number;
  /** Quality of new snow by its density: at or below `light` is light, at or below `medium` is medium, else heavy. */
  quality: { readonly light: number; readonly medium: number };
}

export const DEFAULT_SNOWPACK: SnowpackSettings = {
  meltMmPerDegreeHour: 4 / 24, // about 4 mm/°C/day
  thawHoursForCrust: 3,
  refreezeC: -1,
  newSnowOnCrustCm: 5,
  crustBuriedCm: 30,
  windPackingKmh: 30,
  oldSnowDensity: 300,
  settlingHours: 240,
  freshHours: 72,
  wetWithinHours: 12,
  powderMinCm: 5,
  bareBelowCm: 5,
  freshDensity: [
    { atOrBelowC: -10, density: 60 },
    { atOrBelowC: -5, density: 80 },
    { atOrBelowC: -2, density: 120 },
    { atOrBelowC: 0, density: 180 },
  ],
  wetSnowDensity: 250,
  quality: { light: 80, medium: 120 },
};

/** Density of new snow by air temperature, kg/m³: colder is lighter. */
export function freshDensity(temperatureC: number, s: SnowpackSettings = DEFAULT_SNOWPACK): number {
  return s.freshDensity.find((row) => temperatureC <= row.atOrBelowC)?.density ?? s.wetSnowDensity;
}

/** A layer's density after `ageHours`: it settles gradually from its fresh density towards old snow. */
export function settledDensity(fresh: number, ageHours: number, s: SnowpackSettings = DEFAULT_SNOWPACK): number {
  const gap = s.oldSnowDensity - fresh;
  return gap <= 0 ? fresh : s.oldSnowDensity - gap * Math.exp(-ageHours / s.settlingHours);
}

export function qualityOf(density: number, s: SnowpackSettings = DEFAULT_SNOWPACK): Quality {
  return density <= s.quality.light ? 'light' : density <= s.quality.medium ? 'medium' : 'heavy';
}
