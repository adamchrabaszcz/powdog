// `npm run picks`: today's and the next days' best spots per riding mode, on real data (#36).
// The only part with I/O: one fetch to Open-Meteo and printing. Everything else is src/core.

import catalogue from '../../config/spots.json' with { type: 'json' };
import { forecastUrl, parseForecast } from '../core/open-meteo.ts';
import { formatPicks, picks, picksQuery } from '../core/picks/index.ts';
import type { Catalogue } from '../core/spots.ts';

const DAYS = 3;
const TOP = 3;

async function fetchJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url);
    if (!res.ok) return { error: true, reason: `HTTP ${res.status} ${res.statusText}` };
    return await res.json();
  } catch (e) {
    return { error: true, reason: `request failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

const { spots } = catalogue as Catalogue;
const query = picksQuery(spots, DAYS);
const { series, problems } = parseForecast(await fetchJson(forecastUrl(query)), query);
console.log(formatPicks(picks(spots, series, { now: new Date().toISOString(), days: DAYS, top: TOP, problems }, undefined)));
