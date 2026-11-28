// Snowpack model (ADR 0005): rebuilt from scratch from hourly weather at a spot's summit.
// Deliberately simple and explainable: snow in, melt out, and flags for the things that make
// new snow good or bad (a crust under it, rain on it, wind over it). Units: cm, °C, mm, km/h.

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

export interface Snowpack {
  /** Estimated total depth, cm. */
  depthCm: number;
  newSnow24hCm: number;
  newSnow72hCm: number;
  /** How light the new snow of the last 72 h is; null when there is none. */
  newSnowQuality: Quality | null;
  surface: Surface;
  flags: {
    /** A thaw followed by a freeze left a crust that is still near the surface. */
    crust: boolean;
    /** At least 5 cm fell on that crust: poor bonding, an avalanche warning sign. */
    newSnowOnCrust: boolean;
    /** Rain fell on the snow in the last 72 h. */
    rainOnSnow: boolean;
    /** Strong wind during or after the last 72 h of snowfall. */
    windPacked: boolean;
  };
  /** Hours with no temperature; they're skipped, not guessed. */
  missingHours: number;
  /** Hours with a temperature but no snowfall value. They add no snow, and are counted so a gap shows up instead of passing as a dry spell. */
  missingSnowfallHours: number;
}

// Rules of thumb, kept together so a change is visible in one place.
export const SNOWPACK = {
  /** Melt per degree above zero per hour, mm of water (about 4 mm/°C/day). */
  meltMmPerDegreeHour: 4 / 24,
  /** Hours above zero that make a crust once it freezes again. */
  thawHoursForCrust: 3,
  /** Below this the thawed surface counts as refrozen, °C. */
  refreezeC: -1,
  /** New snow on a crust that counts as "loaded", cm. */
  newSnowOnCrustCm: 5,
  /** Wind that packs fresh snow, km/h. */
  windPackingKmh: 30,
  /** Density old snow settles towards, kg/m³. */
  oldSnowDensity: 300,
  /** How fast a layer settles: its density closes about 63% of the gap to old snow in this many hours. */
  settlingHours: 240,
  /** New snow counts as fresh for this long, hours. */
  freshHours: 72,
} as const;

/** Density of new snow by air temperature, kg/m³: colder is lighter. */
export function freshDensity(temperatureC: number): number {
  if (temperatureC <= -10) return 60;
  if (temperatureC <= -5) return 80;
  if (temperatureC <= -2) return 120;
  if (temperatureC <= 0) return 180;
  return 250;
}

/** A layer's density after `ageHours`: it settles gradually from its fresh density towards old snow. */
export function settledDensity(fresh: number, ageHours: number): number {
  const gap = SNOWPACK.oldSnowDensity - fresh;
  return gap <= 0 ? fresh : SNOWPACK.oldSnowDensity - gap * Math.exp(-ageHours / SNOWPACK.settlingHours);
}

function qualityOf(density: number): Quality {
  return density <= 80 ? 'light' : density <= 120 ? 'medium' : 'heavy';
}

interface Layer {
  /** Water equivalent, mm. */
  swe: number;
  density: number;
  /** Index of the hour it fell. */
  hour: number;
}

/** Builds the snowpack at the end of `hours` (oldest first). */
export function buildSnowpack(hours: WeatherHour[]): Snowpack {
  const layers: Layer[] = [];
  let missingHours = 0;
  let missingSnowfallHours = 0;
  let thawRun = 0;
  let thawedSinceFreeze = false;
  let crustHour: number | null = null;
  let lastRainOnSnow: number | null = null;
  let lastThaw: number | null = null;

  const totalSwe = () => layers.reduce((s, l) => s + l.swe, 0);

  hours.forEach((h, i) => {
    const t = h.temperatureC;
    if (t === null) {
      missingHours++;
      return;
    }
    if (h.snowfallCm === null) missingSnowfallHours++;
    const snow = h.snowfallCm ?? 0;
    const rain = h.rainMm ?? 0;

    if (snow > 0) {
      const density = freshDensity(t);
      layers.push({ swe: (snow * density) / 100, density, hour: i });
    }
    if (rain > 0 && totalSwe() > 0) lastRainOnSnow = i;

    if (t > 0) {
      lastThaw = i;
      thawRun++;
      // A thaw only makes a crust where there's snow to thaw.
      if (thawRun >= SNOWPACK.thawHoursForCrust && totalSwe() > 0) thawedSinceFreeze = true;
      // Melt from the top down.
      let melt = SNOWPACK.meltMmPerDegreeHour * t;
      while (melt > 0 && layers.length > 0) {
        const top = layers[layers.length - 1]!;
        const take = Math.min(top.swe, melt);
        top.swe -= take;
        melt -= take;
        if (top.swe <= 1e-9) layers.pop();
      }
      // Melted out: any crust melted with it.
      if (layers.length === 0) {
        crustHour = null;
        thawedSinceFreeze = false;
      }
    } else {
      thawRun = 0;
      if (thawedSinceFreeze && t <= SNOWPACK.refreezeC && totalSwe() > 0) {
        crustHour = i;
        thawedSinceFreeze = false;
      }
    }
  });

  const end = hours.length;
  const within = (hour: number, span: number) => end - hour <= span;
  const fresh = layers.filter((l) => within(l.hour, SNOWPACK.freshHours));
  const cmOf = (l: Layer) => (l.swe * 100) / l.density;
  const sumCm = (ls: Layer[]) => ls.reduce((s, l) => s + cmOf(l), 0);

  const newSnow72hCm = round(sumCm(fresh));
  const newSnow24hCm = round(sumCm(fresh.filter((l) => within(l.hour, 24))));
  // New-snow amounts are as they fell; the depth uses each layer's settled density.
  const depthCm = round(layers.reduce((s, l) => s + (l.swe * 100) / settledDensity(l.density, end - l.hour), 0));

  const onCrust = crustHour === null ? [] : layers.filter((l) => l.hour > crustHour!);
  const newSnowOnCrust = sumCm(onCrust) >= SNOWPACK.newSnowOnCrustCm;
  // A crust stops mattering at the surface once it's buried under plenty of snow.
  const crust = crustHour !== null && sumCm(onCrust) < 30;

  const windPacked = fresh.length > 0 && hours.slice(fresh[0]!.hour).some((h) => (h.windKmh ?? 0) >= SNOWPACK.windPackingKmh);
  const rainOnSnow = lastRainOnSnow !== null && within(lastRainOnSnow, SNOWPACK.freshHours);

  const freshSwe = fresh.reduce((s, l) => s + l.swe, 0);
  const newSnowQuality = freshSwe > 0 ? qualityOf((freshSwe * 100) / sumCm(fresh)) : null;

  let surface: Surface;
  if (depthCm < 5) surface = 'none';
  else if (lastThaw !== null && within(lastThaw, 12)) surface = 'wet';
  else if (newSnow72hCm >= 5 && windPacked) surface = 'wind-packed';
  else if (newSnow72hCm >= 5 && !rainOnSnow) surface = 'powder';
  else if (crust) surface = 'crust';
  else surface = 'old';

  return {
    depthCm,
    newSnow24hCm,
    newSnow72hCm,
    newSnowQuality,
    surface,
    flags: { crust, newSnowOnCrust, rainOnSnow, windPacked },
    missingHours,
    missingSnowfallHours,
  };
}

function round(cm: number): number {
  return Math.round(cm * 10) / 10;
}
