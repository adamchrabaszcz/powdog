// Splitboard with the dog (rule 7): hard rules first (dog allowed, low avalanche danger, sun,
// little wind, not too cold, snow the dog can move in), then the best of what's left:
// sunny, calm, a base, and two or three days after a storm. Missing data never passes a rule.

import { add, avalancheNote, exclude, fraction, note, sunniness, type Tally, tally } from './parts.ts';
import type { ScoringSettings } from './settings.ts';
import type { SpotDay } from './types.ts';

export function scoreDog(d: SpotDay, s: ScoringSettings): Tally {
  const c = s.dog;
  const g = c.gates;
  const t = tally();
  const p = d.snowpack;
  const w = d.daytime;
  note(t, avalancheNote(d.avalancheLevel));

  if (d.spot.dogs === 'banned') exclude(t, 'dogs are not allowed here');
  if (d.avalancheLevel !== null && d.avalancheLevel > g.maxAvalancheLevel) exclude(t, `avalanche danger ${d.avalancheLevel}: too high for the dog`);
  if (w.cloudMeanPct === null) exclude(t, 'no cloud data: can’t confirm a sunny day');
  else if (w.cloudMeanPct > g.maxCloudPct) exclude(t, `${Math.round(w.cloudMeanPct)}% cloud: not sunny enough`);
  if (w.windMaxKmh === null) exclude(t, 'no wind data: can’t confirm a calm day');
  else if (w.windMaxKmh > g.maxWindKmh) exclude(t, `wind ${Math.round(w.windMaxKmh)} km/h: too windy for the dog`);
  if (w.tempMinC === null) exclude(t, 'no temperature data: can’t confirm it’s warm enough');
  else if (w.tempMinC < g.minTempC) exclude(t, `${Math.round(w.tempMinC)} °C: too cold for the dog`);

  // Deep snow is fine once it has settled on a base; until then the whole storm counts, not just the last 24 h.
  const settled = d.hoursSinceSnowfall !== null && d.hoursSinceSnowfall >= g.settledAfterHours && p.depthCm >= g.minBaseCm;
  if (p.newSnow72hCm > g.maxFreshCm && !settled) exclude(t, `${p.newSnow72hCm} cm of new snow, not settled yet: too deep for the dog`);
  // Depth already includes any new snow, so a dusting on bare ground doesn't pass.
  if (p.depthCm < g.minBaseCm) exclude(t, `${p.depthCm} cm of snow: not enough to tour on`);

  add(t, c.weights.sun * sunniness(w.cloudMeanPct), w.cloudMeanPct === null ? 'no cloud data' : `${Math.round(100 - w.cloudMeanPct)}% sun`);
  add(t, c.weights.calm * (1 - fraction(w.windMaxKmh ?? g.maxWindKmh, g.maxWindKmh)), `wind ${Math.round(w.windMaxKmh ?? 0)} km/h`);
  add(t, c.weights.base * fraction(p.depthCm, c.baseFullCm), `base ${p.depthCm} cm`);

  const days = d.hoursSinceSnowfall === null ? null : d.hoursSinceSnowfall / 24;
  if (days !== null && days >= c.bestDaysAfterStorm.from && days < c.bestDaysAfterStorm.until) {
    add(t, c.weights.daysAfterStorm, `${Math.floor(days)} days after the snowfall: settled and firm enough`);
  } else if (days !== null && days < c.bestDaysAfterStorm.from) {
    add(t, c.weights.daysAfterStorm * fraction(days, c.bestDaysAfterStorm.from), 'snow still settling');
  }

  if (d.avalancheLevel === null) add(t, -c.noBulletinPenalty, 'no bulletin: keep to gentle terrain');
  if (d.spot.dogs === 'unknown') add(t, 0, 'dog rules here unknown: check before going');
  if (d.spot.dogs === 'leash') add(t, 0, 'dog on a leash here');
  return t;
}
