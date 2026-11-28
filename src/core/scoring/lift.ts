// Lift-served powder (rule 5): fresh snow and its quality first, a base, lifts able to run.

import { add, avalancheNote, exclude, fraction, note, sunniness, type Tally, tally } from './parts.ts';
import type { ScoringSettings } from './settings.ts';
import type { SpotDay } from './types.ts';

export function scoreLift(d: SpotDay, s: ScoringSettings): Tally {
  const c = s.lift;
  const t = tally();
  note(t, avalancheNote(d.avalancheLevel));
  if (!d.spot.lifts) exclude(t, 'no lifts here');

  const p = d.snowpack;
  // Snow from the last 24 h counts fully; snow one to three days old half, as it's been ridden and settled.
  const fresh = p.newSnow24hCm + 0.5 * Math.max(0, p.newSnow72hCm - p.newSnow24hCm);
  add(t, c.weights.newSnow * fraction(fresh, c.newSnowFullCm), `${p.newSnow24hCm} cm new in 24 h, ${p.newSnow72hCm} cm in 72 h`);
  if (p.newSnowQuality) add(t, c.weights.quality * s.quality[p.newSnowQuality], `new snow is ${p.newSnowQuality}`);
  add(t, c.weights.base * fraction(p.depthCm, c.baseFullCm), `base ${p.depthCm} cm`);
  add(t, c.weights.visibility * sunniness(d.daytime.cloudMeanPct), visibilityReason(d.daytime.cloudMeanPct));
  if (d.weekday >= 1 && d.weekday <= 5) add(t, c.weights.weekday, 'a weekday: fewer people on the fresh snow');

  const gust = d.daytime.gustMaxKmh;
  if (gust !== null && gust > c.gustCloseKmh) add(t, -c.gustPenalty, `gusts ${Math.round(gust)} km/h: lifts may close`);
  if (d.avalancheLevel !== null && d.avalancheLevel >= c.avalanchePenaltyFromLevel) {
    add(t, -c.avalanchePenalty, 'high avalanche danger: stay on the pistes');
  }
  return t;
}

const visibilityReason = (cloud: number | null) =>
  cloud === null ? 'no cloud data' : cloud <= 30 ? 'clear' : cloud <= 70 ? 'some cloud' : 'overcast, flat light';
