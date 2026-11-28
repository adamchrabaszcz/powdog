// Splitboard touring (rule 6): deep light snow, sun, little ridge wind, a sound snowpack;
// avalanche danger weighs heavily.

import { add, avalancheNote, exclude, fraction, knownLevel, missingLevelReason, note, sunniness, type Tally, tally } from './parts.ts';
import type { ScoringSettings } from './settings.ts';
import type { SpotDay } from './types.ts';

export function scoreSplitboard(d: SpotDay, s: ScoringSettings): Tally {
  const c = s.splitboard;
  const t = tally();
  const p = d.snowpack;
  note(t, avalancheNote(d.avalancheLevel));

  const level = knownLevel(d.avalancheLevel);
  if (level !== null && level >= c.avalancheExcludeFromLevel) {
    exclude(t, `avalanche danger ${level}: not a touring day`);
  }

  add(t, c.weights.newSnow * fraction(p.newSnow72hCm, c.newSnowFullCm), `${p.newSnow72hCm} cm new in 72 h`);
  if (p.newSnowQuality) add(t, c.weights.quality * s.quality[p.newSnowQuality], `new snow is ${p.newSnowQuality}`);
  add(t, c.weights.sun * sunniness(d.daytime.cloudMeanPct), d.daytime.cloudMeanPct === null ? 'no cloud data' : `${Math.round(100 - d.daytime.cloudMeanPct)}% sun`);
  add(t, c.weights.base * fraction(p.depthCm, c.baseFullCm), `base ${p.depthCm} cm`);

  const wind = d.daytime.windMaxKmh;
  if (wind === null) add(t, c.weights.calm / 2, 'no wind data');
  else if (wind >= c.windPenaltyFromKmh) add(t, -c.windPenalty, `wind ${Math.round(wind)} km/h on the ridges`);
  else add(t, c.weights.calm * (1 - fraction(wind, c.windPenaltyFromKmh)), `wind ${Math.round(wind)} km/h`);

  const surfacePenalty = c.surfacePenalty[p.surface];
  if (surfacePenalty) add(t, -surfacePenalty, `surface: ${p.surface}`);
  if (p.flags.newSnowOnCrust) add(t, -c.newSnowOnCrustPenalty, 'new snow on a crust: poor bonding, avalanche warning sign');

  if (level === null) add(t, -c.noBulletinPenalty, `${missingLevelReason(d.avalancheLevel)}: less certain`);
  else if (level >= c.avalanchePenaltyLevel) add(t, -c.avalanchePenalty, 'considerable danger: choose low-angle terrain');
  return t;
}
