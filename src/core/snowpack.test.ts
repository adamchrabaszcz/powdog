import { describe, expect, it } from 'vitest';
import { type WeatherHour, buildSnowpack, freshDensity } from './snowpack.ts';

/** Fixed-weather builder: `n` hours of the same weather. */
function hours(n: number, w: Partial<Omit<WeatherHour, 'time'>>): WeatherHour[] {
  return Array.from({ length: n }, () => ({ time: '', temperatureC: -5, snowfallCm: 0, rainMm: 0, windKmh: 5, ...w }));
}
const timed = (hs: WeatherHour[]) => hs.map((h, i) => ({ ...h, time: new Date(Date.UTC(2026, 0, 1, i)).toISOString() }));
// An old base laid a week earlier, so the scenarios below happen on top of real snow.
const base = () => [...hours(24, { temperatureC: -6, snowfallCm: 2 }), ...hours(24 * 5, { temperatureC: -6 })];

describe('freshDensity', () => {
  it('makes colder snow lighter', () => {
    expect(freshDensity(-12)).toBeLessThan(freshDensity(-3));
    expect(freshDensity(-3)).toBeLessThan(freshDensity(1));
  });
});

describe('buildSnowpack', () => {
  it('a cold dump with little wind is light powder', () => {
    const p = buildSnowpack(timed([...base(), ...hours(24, { temperatureC: -8, snowfallCm: 1.25, windKmh: 10 })]));
    expect(p.newSnow24hCm).toBe(30);
    expect(p.newSnowQuality).toBe('light');
    expect(p.surface).toBe('powder');
    expect(p.flags).toEqual({ crust: false, newSnowOnCrust: false, rainOnSnow: false, windPacked: false });
  });

  it('a thaw then a freeze leaves a crust, and new snow on it is flagged', () => {
    const p = buildSnowpack(
      timed([
        ...base(),
        ...hours(12, { temperatureC: 3 }),
        ...hours(12, { temperatureC: -5 }),
        ...hours(10, { temperatureC: -6, snowfallCm: 1 }),
        ...hours(14, { temperatureC: -6 }),
      ]),
    );
    expect(p.flags.crust).toBe(true);
    expect(p.flags.newSnowOnCrust).toBe(true);
    expect(p.newSnow72hCm).toBe(10);
  });

  it('a thaw without new snow leaves a crust at the surface', () => {
    const p = buildSnowpack(timed([...base(), ...hours(10, { temperatureC: 4 }), ...hours(24, { temperatureC: -4 })]));
    expect(p.surface).toBe('crust');
    expect(p.flags.newSnowOnCrust).toBe(false);
  });

  it('a thaw on bare ground makes no crust, so the first snowfall is not flagged', () => {
    const p = buildSnowpack(timed([...hours(24, { temperatureC: 6 }), ...hours(20, { temperatureC: -6, snowfallCm: 1 })]));
    expect(p.flags.crust).toBe(false);
    expect(p.flags.newSnowOnCrust).toBe(false);
  });

  it('a crust that melted out with the snow is gone when new snow falls', () => {
    const p = buildSnowpack(
      timed([
        ...hours(10, { temperatureC: -5, snowfallCm: 1 }),
        ...hours(6, { temperatureC: 3 }),
        ...hours(6, { temperatureC: -4 }), // crust forms
        ...hours(72, { temperatureC: 8 }), // and melts out with everything else
        ...hours(20, { temperatureC: -6, snowfallCm: 1 }),
      ]),
    );
    expect(p.flags.crust).toBe(false);
    expect(p.flags.newSnowOnCrust).toBe(false);
  });

  it('a cold dump settles gradually and still makes a base four days later', () => {
    const p = buildSnowpack(timed([...hours(20, { temperatureC: -12, snowfallCm: 1 }), ...hours(96, { temperatureC: -12 })]));
    expect(p.depthCm).toBeGreaterThan(8);
    expect(p.surface).toBe('old');
  });

  it('reports new snow as it fell and depth as settled, so depth can be the smaller number', () => {
    const p = buildSnowpack(timed([...hours(24, { temperatureC: -12, snowfallCm: 1.25 }), ...hours(40, { temperatureC: -12 })]));
    expect(p.newSnow72hCm).toBe(30); // as fallen
    expect(p.depthCm).toBeLessThan(p.newSnow72hCm); // settled
    expect(p.depthCm).toBeGreaterThan(10);
  });

  it('settling has no jump at 72 hours', () => {
    const at = (h: number) =>
      buildSnowpack(timed([...hours(10, { temperatureC: -8, snowfallCm: 2 }), ...hours(h, { temperatureC: -8 })])).depthCm;
    expect(at(61) - at(63)).toBeLessThan(0.5);
  });

  it('rain on the snow is flagged and the surface is wet', () => {
    const p = buildSnowpack(timed([...base(), ...hours(6, { temperatureC: 2, rainMm: 1 })]));
    expect(p.flags.rainOnSnow).toBe(true);
    expect(p.surface).toBe('wet');
  });

  it('a windy storm packs the new snow', () => {
    const p = buildSnowpack(timed([...base(), ...hours(20, { temperatureC: -7, snowfallCm: 1.25, windKmh: 45 })]));
    expect(p.newSnow24hCm).toBe(25);
    expect(p.flags.windPacked).toBe(true);
    expect(p.surface).toBe('wind-packed');
  });

  it('warm days melt the snow away', () => {
    const p = buildSnowpack(timed([...hours(10, { temperatureC: -5, snowfallCm: 1 }), ...hours(72, { temperatureC: 8 })]));
    expect(p.depthCm).toBe(0);
    expect(p.surface).toBe('none');
  });

  it('wet snow near zero is heavy', () => {
    const p = buildSnowpack(timed([...base(), ...hours(10, { temperatureC: -0.5, snowfallCm: 2 })]));
    expect(p.newSnowQuality).toBe('heavy');
  });

  it('skips hours without a temperature and counts them, instead of guessing', () => {
    const p = buildSnowpack(timed([...base(), ...hours(5, { temperatureC: null, snowfallCm: 10 })]));
    expect(p.missingHours).toBe(5);
    expect(p.newSnow72hCm).toBe(0);
  });

  it('counts hours without a snowfall value, so a gap is not read as a dry spell', () => {
    const p = buildSnowpack(timed([...base(), ...hours(6, { temperatureC: -5, snowfallCm: null })]));
    expect(p.missingSnowfallHours).toBe(6);
    expect(p.missingHours).toBe(0);
  });

  it('snow older than 72 hours counts as base, not new snow', () => {
    const p = buildSnowpack(timed([...hours(10, { temperatureC: -8, snowfallCm: 2 }), ...hours(80, { temperatureC: -8 })]));
    expect(p.newSnow72hCm).toBe(0);
    expect(p.depthCm).toBeGreaterThan(0);
    expect(p.depthCm).toBeLessThan(20); // 20 cm of light snow settles to well under 20 cm
    expect(p.surface).toBe('old');
  });
});
