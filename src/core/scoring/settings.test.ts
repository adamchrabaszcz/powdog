import { describe, expect, it } from 'vitest';
import scoringJson from '../../../config/scoring.json' with { type: 'json' };
import { SURFACES } from '../snowpack/index.ts';

// The settings type catches a missing key at compile time; these catch the other direction,
// a misspelt key that would be silently ignored.

describe('config/scoring.json', () => {
  it('names only real surfaces in the surface penalties', () => {
    for (const key of Object.keys(scoringJson.splitboard.surfacePenalty)) {
      expect(SURFACES).toContain(key);
    }
  });

  it('has the best days after a storm as a real range', () => {
    const { from, until } = scoringJson.dog.bestDaysAfterStorm;
    expect(until).toBeGreaterThan(from);
  });
});
