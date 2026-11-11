import type { Observation, Series } from "../types";

export function latest(series: Series | undefined): Observation | null {
  if (!series || series.length === 0) return null;
  return series.reduce((best, point) => (point.year > best.year ? point : best));
}

export function isQuarter(period: number): boolean {
  const quarter = period % 10;
  return period >= 10000 && quarter >= 1 && quarter <= 4;
}

export function formatPeriod(period: number): string {
  if (!isQuarter(period)) return String(period);
  return `${Math.floor(period / 10)} Q${period % 10}`;
}

export function parsePeriodToken(value: string): number | null {
  const text = value.trim().toUpperCase().replace(/[\s_-]/g, "");
  const quarter = text.match(/^(\d{4})Q([1-4])$/);
  if (quarter) return Number(quarter[1]) * 10 + Number(quarter[2]);
  if (/^\d{4}$/.test(text)) return Number(text);
  return null;
}

/** Move back by `count` quarters. Annual periods move back by the same count in years. */
export function shiftPeriod(period: number, count: number): number {
  if (!isQuarter(period)) return period - count;
  let year = Math.floor(period / 10);
  let quarter = period % 10;
  let left = count;
  while (left > 0) {
    quarter -= 1;
    if (quarter === 0) {
      quarter = 4;
      year -= 1;
    }
    left -= 1;
  }
  return year * 10 + quarter;
}

/** Latest observation published in `year` or earlier. */
export function asOf(series: Series | undefined, year: number): Observation | null {
  if (!series || series.length === 0) return null;
  let best: Observation | null = null;
  for (const point of series) {
    if (point.year > year) continue;
    if (!best || point.year > best.year) best = point;
  }
  return best;
}

export function availableYears(countries: { series: Partial<Record<string, Series>> }[]): number[] {
  const years = new Set<number>();
  for (const country of countries) {
    for (const series of Object.values(country.series)) {
      if (!series) continue;
      for (const point of series) years.add(point.year);
    }
  }
  return [...years].sort((a, b) => a - b);
}

/** Percent change versus the observation one year earlier. Positive means an increase. */
export function yearOverYear(series: Series): Series {
  const byPeriod = new Map(series.map((point) => [point.year, point.value]));
  const out: Series = [];
  for (const point of series) {
    const previous = byPeriod.get(shiftPeriod(point.year, isQuarter(point.year) ? 4 : 1));
    if (previous == null || previous === 0 || !Number.isFinite(point.value)) continue;
    const change = (point.value / previous - 1) * 100;
    if (Number.isFinite(change)) out.push({ year: point.year, value: change });
  }
  return out.sort((a, b) => b.year - a.year);
}

/** Percent change in local currency per USD. Positive means the currency depreciated. */
export function fxDepreciationSeries(fxPerUsd: Series): Series {
  return yearOverYear(fxPerUsd);
}

/**
 * Percent gap between the real effective exchange rate and the average of the
 * previous five annual observations. Positive means a stronger REER than that average.
 */
export function reerGapSeries(annualIndex: Series): Series {
  const sorted = [...annualIndex].sort((a, b) => a.year - b.year);
  const out: Series = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const window = isQuarter(sorted[index]?.year ?? 0) ? 20 : 5;
    const prior = sorted.slice(0, index).slice(-window);
    if (prior.length < window) continue;
    const average = prior.reduce((sum, point) => sum + point.value, 0) / prior.length;
    if (average === 0 || !Number.isFinite(sorted[index].value)) continue;
    out.push({
      year: sorted[index].year,
      value: (sorted[index].value / average - 1) * 100,
    });
  }
  return out.sort((a, b) => b.year - a.year);
}
