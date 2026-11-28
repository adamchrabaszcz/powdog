import { describe, expect, it } from 'vitest';
import { DEFAULT_SNOWPACK as s, freshDensity, qualityOf, settledDensity } from './settings.ts';
import { type SurfaceInput, crustFlags, settledDepthCm, surfaceOf } from './summary.ts';
import type { Layer } from './types.ts';
import { addSnow, melt } from './walk.ts';

// Each step on its own, with fixed inputs (ADR 0011).

describe('settings', () => {
  it('reads fresh density from the table, colder is lighter', () => {
    expect(freshDensity(-12)).toBe(60);
    expect(freshDensity(-6)).toBe(80);
    expect(freshDensity(1)).toBe(s.wetSnowDensity);
  });

  it('settles towards old-snow density and never past it', () => {
    expect(settledDensity(60, 0)).toBe(60);
    expect(settledDensity(60, 10_000)).toBeCloseTo(s.oldSnowDensity, 0);
    expect(settledDensity(350, 100)).toBe(350);
  });

  it('grades quality by density', () => {
    expect(qualityOf(60)).toBe('light');
    expect(qualityOf(120)).toBe('medium');
    expect(qualityOf(180)).toBe('heavy');
  });
});

describe('walk steps', () => {
  it('adds a layer as water, with its density', () => {
    const state = { layers: [] as Layer[] };
    addSnow(state, 10, -12, 3, s);
    expect(state.layers).toEqual([{ swe: 6, density: 60, hour: 3 }]);
  });

  it('melts from the top layer down and removes empty layers', () => {
    const layers: Layer[] = [
      { swe: 5, density: 80, hour: 0 },
      { swe: 1, density: 60, hour: 1 },
    ];
    melt(layers, 12, s); // 12 °C × 1/6 mm = 2 mm
    expect(layers).toEqual([{ swe: 4, density: 80, hour: 0 }]);
  });
});

describe('summary steps', () => {
  it('sums settled depth', () => {
    expect(settledDepthCm([{ swe: 6, density: 60, hour: 0 }], 0, s)).toBe(10);
  });

  it('flags a crust and new snow on it from the layers above it', () => {
    const layers: Layer[] = [
      { swe: 20, density: 300, hour: 0 },
      { swe: 6, density: 60, hour: 10 },
    ];
    expect(crustFlags({ crustHour: 5, layers }, s)).toEqual({ crust: true, newSnowOnCrust: true });
    expect(crustFlags({ crustHour: null, layers }, s)).toEqual({ crust: false, newSnowOnCrust: false });
  });

  it('picks the surface by the first matching rule', () => {
    const base: SurfaceInput = { depthCm: 50, newSnow72hCm: 0, recentThaw: false, windPacked: false, rainOnSnow: false, crust: false };
    expect(surfaceOf({ ...base, depthCm: 2 }, s)).toBe('none');
    expect(surfaceOf({ ...base, recentThaw: true, newSnow72hCm: 20 }, s)).toBe('wet');
    expect(surfaceOf({ ...base, newSnow72hCm: 20, windPacked: true }, s)).toBe('wind-packed');
    expect(surfaceOf({ ...base, newSnow72hCm: 20 }, s)).toBe('powder');
    expect(surfaceOf({ ...base, crust: true }, s)).toBe('crust');
    expect(surfaceOf(base, s)).toBe('old');
  });
});
