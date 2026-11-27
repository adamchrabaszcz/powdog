// Unit conversions for weather data. Open-Meteo reports snow depth in metres and
// snowfall in centimetres; powdog works in centimetres throughout (AGENTS.md).

/** Metres to centimetres, rounded to one decimal place. */
export function metresToCm(metres: number): number {
  return Math.round(metres * 1000) / 10;
}
