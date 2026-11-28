// The hour-by-hour pass: snow in, melt out, and the events the summary needs later
// (when a crust formed, when it last rained on snow, when it last thawed, which values were missing).

import { type SnowpackSettings, freshDensity } from './settings.ts';
import type { Gaps, Layer, WeatherHour } from './types.ts';

export interface Walk {
  /** Layers still on the ground, oldest first. */
  layers: Layer[];
  /** Hour the latest crust formed, or null (also cleared when the snow melts out). */
  crustHour: number | null;
  lastRainOnSnowHour: number | null;
  lastThawHour: number | null;
  gaps: Gaps;
}

interface State extends Walk {
  thawRun: number;
  thawedSinceFreeze: boolean;
}

const totalSwe = (layers: Layer[]) => layers.reduce((sum, l) => sum + l.swe, 0);

export function walk(hours: WeatherHour[], s: SnowpackSettings): Walk {
  const state: State = {
    layers: [],
    crustHour: null,
    lastRainOnSnowHour: null,
    lastThawHour: null,
    gaps: { temperature: 0, snowfall: 0, rain: 0, wind: 0 },
    thawRun: 0,
    thawedSinceFreeze: false,
  };
  hours.forEach((h, i) => step(state, h, i, s));
  const { thawRun: _r, thawedSinceFreeze: _t, ...result } = state;
  return result;
}

function step(state: State, h: WeatherHour, i: number, s: SnowpackSettings): void {
  countGaps(state.gaps, h);
  const t = h.temperatureC;
  if (t === null) return; // skipped, never guessed
  addSnow(state, h.snowfallCm ?? 0, t, i, s);
  if ((h.rainMm ?? 0) > 0 && totalSwe(state.layers) > 0) state.lastRainOnSnowHour = i;
  if (t > 0) thaw(state, t, i, s);
  else freeze(state, t, i, s);
}

/** Counts each missing hour once: an hour without a temperature is skipped and counted only there. */
export function countGaps(gaps: Gaps, h: WeatherHour): void {
  if (h.temperatureC === null) {
    gaps.temperature++;
    return;
  }
  if (h.snowfallCm === null) gaps.snowfall++;
  if (h.rainMm === null) gaps.rain++;
  if (h.windKmh === null) gaps.wind++;
}

export function addSnow(state: Pick<Walk, 'layers'>, snowCm: number, t: number, i: number, s: SnowpackSettings): void {
  if (snowCm <= 0) return;
  const density = freshDensity(t, s);
  state.layers.push({ swe: (snowCm * density) / 100, density, hour: i });
}

/** Melts from the top down. */
export function melt(layers: Layer[], t: number, s: SnowpackSettings): void {
  let left = s.meltMmPerDegreeHour * t;
  while (left > 0 && layers.length > 0) {
    const top = layers[layers.length - 1]!;
    const take = Math.min(top.swe, left);
    top.swe -= take;
    left -= take;
    if (top.swe <= 1e-9) layers.pop();
  }
}

function thaw(state: State, t: number, i: number, s: SnowpackSettings): void {
  state.lastThawHour = i;
  state.thawRun++;
  // A thaw only makes a crust where there's snow to thaw.
  if (state.thawRun >= s.thawHoursForCrust && totalSwe(state.layers) > 0) state.thawedSinceFreeze = true;
  melt(state.layers, t, s);
  if (state.layers.length === 0) {
    // Melted out: any crust melted with it.
    state.crustHour = null;
    state.thawedSinceFreeze = false;
  }
}

function freeze(state: State, t: number, i: number, s: SnowpackSettings): void {
  state.thawRun = 0;
  if (state.thawedSinceFreeze && t <= s.refreezeC && totalSwe(state.layers) > 0) {
    state.crustHour = i;
    state.thawedSinceFreeze = false;
  }
}
