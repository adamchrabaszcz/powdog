import { describe, expect, it } from 'vitest';
import { metresToCm } from './units.ts';

describe('metresToCm', () => {
  it('converts Open-Meteo snow depth in metres to centimetres', () => {
    expect(metresToCm(1.23)).toBe(123);
  });

  it('keeps one decimal place', () => {
    expect(metresToCm(0.0456)).toBe(4.6);
  });

  it('handles no snow', () => {
    expect(metresToCm(0)).toBe(0);
  });
});
