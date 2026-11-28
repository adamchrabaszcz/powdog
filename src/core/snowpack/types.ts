// Shapes shared by the snowpack steps. Units: cm, °C, mm, km/h.

export interface WeatherHour {
  /** Hour start, ISO 8601 UTC. */
  time: string;
  temperatureC: number | null;
  /** New snow in this hour, cm. */
  snowfallCm: number | null;
  /** Liquid rain in this hour, mm. */
  rainMm: number | null;
  windKmh: number | null;
}

export type Surface = 'none' | 'powder' | 'wind-packed' | 'crust' | 'wet' | 'old';
export type Quality = 'light' | 'medium' | 'heavy';

/**
 * Hours without a value, per input; each hour is counted at most once, so the counts add up.
 * Never guessed: a gap is reported, not read as a dry or calm hour.
 */
export interface Gaps {
  /** Hours with no temperature: skipped entirely, and counted only here even if other values are missing too. */
  temperature: number;
  /** Hours that do have a temperature but miss this value: they add no snow, rain or wind. */
  snowfall: number;
  rain: number;
  wind: number;
}

export interface Snowpack {
  /**
   * Estimated total depth now, cm, **settled**: every layer at its density for its age.
   * It can be less than the new snow below, because fresh snow settles within days.
   */
  depthCm: number;
  /** New snow in the last 24 h, cm, **as it fell** (before settling), the way snowfall is usually reported. */
  newSnow24hCm: number;
  /** New snow in the last 72 h, cm, **as it fell** (before settling). */
  newSnow72hCm: number;
  /** How light the new snow of the last 72 h is; null when there is none. */
  newSnowQuality: Quality | null;
  surface: Surface;
  flags: {
    /** A thaw followed by a freeze left a crust that is still near the surface. */
    crust: boolean;
    /** Enough snow fell on that crust to load it: poor bonding, an avalanche warning sign. */
    newSnowOnCrust: boolean;
    /** Rain fell on the snow in the fresh window. */
    rainOnSnow: boolean;
    /** Strong wind during or after the fresh snowfall. */
    windPacked: boolean;
  };
  gaps: Gaps;
}

/** One snowfall, kept as water so melt and settling are simple. */
export interface Layer {
  /** Water equivalent, mm. */
  swe: number;
  /** Density as it fell, kg/m³. */
  density: number;
  /** Index of the hour it fell. */
  hour: number;
}
