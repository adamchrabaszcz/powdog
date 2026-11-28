// The shared spot catalogue (config/spots.json). The JSON Schema checks each entry's shape;
// these checks cover what a schema can't: relations between fields and across spots.
//
// One source of truth (ADR 0011): the allowed values and field names below are the lists the
// types are built from, and spots.test.ts checks they match the JSON Schema exactly.

export const COUNTRIES = ['PL', 'CZ', 'SK', 'AT', 'CH', 'IT', 'FR', 'DE'] as const;
export const DOG_RULES = ['allowed', 'leash', 'banned', 'unknown'] as const;
export type Country = (typeof COUNTRIES)[number];
export type DogRule = (typeof DOG_RULES)[number];

export interface AvalancheRegion {
  /** The EAWS feed file, e.g. "CZ", "PL-12", "AT-04". */
  feed: string;
  /** The micro-region inside that feed, e.g. "CZ-04", "AT-04-01". */
  region: string;
}

export interface Spot {
  id: string;
  name: string;
  country: Country;
  range: string;
  lat: number;
  lon: number;
  topElevationM: number;
  baseElevationM: number;
  lifts: boolean;
  /** null where no avalanche bulletin exists for the area (ADR 0004). */
  avalanche: AvalancheRegion | null;
  dogs: DogRule;
  webcams: string[];
  /** Fields still to be checked against a primary source. */
  verify?: string[];
}

export interface Catalogue {
  spots: Spot[];
}

/** Every field of a spot, checked against the schema's properties in the tests. */
export const SPOT_FIELDS = [
  'id', 'name', 'country', 'range', 'lat', 'lon', 'topElevationM', 'baseElevationM',
  'lifts', 'avalanche', 'dogs', 'webcams', 'verify',
] as const satisfies readonly (keyof Spot)[];

// Compile-time check the other way round: a field added to `Spot` but not to the list fails here.
type MissingFromList = Exclude<keyof Spot, (typeof SPOT_FIELDS)[number]>;
const _everyFieldListed: [MissingFromList] extends [never] ? true : MissingFromList = true;
void _everyFieldListed;

/** Problems the schema can't see. Returns an empty list when the catalogue is consistent. */
export function catalogueProblems(catalogue: Catalogue): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const spot of catalogue.spots) {
    if (seen.has(spot.id)) problems.push(`${spot.id}: duplicate id`);
    seen.add(spot.id);
    if (spot.baseElevationM >= spot.topElevationM) {
      problems.push(`${spot.id}: base elevation ${spot.baseElevationM} m is not below top ${spot.topElevationM} m`);
    }
    if (spot.avalanche && !spot.avalanche.region.startsWith(spot.avalanche.feed)) {
      problems.push(`${spot.id}: avalanche region ${spot.avalanche.region} is not in feed ${spot.avalanche.feed}`);
    }
    for (const field of spot.verify ?? []) {
      // Own fields only: `in` would also accept inherited names like "toString".
      if (!Object.hasOwn(spot, field)) problems.push(`${spot.id}: verify lists unknown field "${field}"`);
    }
  }
  return problems;
}
