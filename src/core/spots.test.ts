import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import catalogueJson from '../../config/spots.json' with { type: 'json' };
import schema from '../../config/spots.schema.json' with { type: 'json' };
import { COUNTRIES, DOG_RULES, SPOT_FIELDS, type Catalogue, type Spot, catalogueProblems } from './spots.ts';

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
const catalogue = catalogueJson as Catalogue;
const spot = (over: Partial<Spot> = {}): Spot => ({ ...(JSON.parse(JSON.stringify(catalogue.spots[0])) as Spot), ...over });

describe('config/spots.json', () => {
  it('matches the schema', () => {
    const ok = validate(catalogue);
    expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it('is consistent: unique ids, base below top, regions inside their feeds', () => {
    expect(catalogueProblems(catalogue)).toEqual([]);
  });

  it('marks spots without a bulletin as null, never as a guessed region', () => {
    const noBulletin = catalogue.spots.filter((s) => s.avalanche === null).map((s) => s.id);
    // ADR 0004: Polish Karkonosze, Śnieżnik and the Beskids have no bulletin; the Czech one
    // for the other side of the ridge is not borrowed.
    expect(noBulletin).toEqual(
      expect.arrayContaining(['szrenica', 'sniezka-lomniczka', 'czarna-gora', 'snieznik', 'pilsko', 'skrzyczne']),
    );
  });
});

describe('one source of truth: the TypeScript lists match the schema', () => {
  const spotSchema = schema.$defs.spot;
  it('has the same fields', () => {
    expect([...SPOT_FIELDS].sort()).toEqual(Object.keys(spotSchema.properties).sort());
  });
  it('has the same countries', () => {
    expect([...COUNTRIES]).toEqual(spotSchema.properties.country.enum);
  });
  it('has the same dog rules', () => {
    expect([...DOG_RULES]).toEqual(spotSchema.properties.dogs.enum);
  });
});

describe('the schema', () => {
  it('rejects a spot with a missing field', () => {
    const { topElevationM: _dropped, ...broken } = spot();
    expect(validate({ spots: [broken] })).toBe(false);
  });

  it('rejects an out-of-range elevation', () => {
    expect(validate({ spots: [spot({ topElevationM: 9000 })] })).toBe(false);
  });

  it('rejects an unknown dog rule', () => {
    expect(validate({ spots: [{ ...spot(), dogs: 'sometimes' }] })).toBe(false);
  });

  it('rejects webcam links that are not https', () => {
    expect(validate({ spots: [spot({ webcams: ['http://example.com/cam.jpg'] })] })).toBe(false);
  });

  it('rejects webcam links with spaces', () => {
    expect(validate({ spots: [spot({ webcams: ['https://example.com/my cam.jpg'] })] })).toBe(false);
  });
});

describe('catalogueProblems', () => {
  it('finds duplicate ids', () => {
    expect(catalogueProblems({ spots: [spot(), spot()] })).toContain(`${spot().id}: duplicate id`);
  });

  it('finds a base that is not below the top', () => {
    expect(catalogueProblems({ spots: [spot({ baseElevationM: 2000, topElevationM: 1500 })] })).toHaveLength(1);
  });

  it('finds a region outside its feed', () => {
    const problems = catalogueProblems({ spots: [spot({ avalanche: { feed: 'SK', region: 'CZ-04' } })] });
    expect(problems[0]).toMatch(/not in feed SK/);
  });

  it('finds verify entries that name no field', () => {
    expect(catalogueProblems({ spots: [spot({ verify: ['nonsense'] })] })).toHaveLength(1);
  });

  it('does not accept inherited names in verify', () => {
    expect(catalogueProblems({ spots: [spot({ verify: ['toString', 'constructor'] })] })).toHaveLength(2);
  });
});
