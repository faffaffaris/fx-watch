import { asOf, latest } from "./series";
import type {
  CountryScore,
  IndicatorId,
  ScoreBand,
  ScoreComponent,
  Series,
} from "../types";

export const MIN_COMPONENTS = 4;

const SCORE_ORDER = [
  "reservesMonths",
  "shortTermDebtToReserves",
  "currentAccountGdp",
  "fxDepreciation",
  "reerGap",
  "inflation",
  "gdpGrowth",
] as const satisfies readonly IndicatorId[];

const LABELS: Record<(typeof SCORE_ORDER)[number], string> = {
  reservesMonths: "Reserve cover",
  shortTermDebtToReserves: "Short-term debt / reserves",
  currentAccountGdp: "Current account",
  fxDepreciation: "Depreciation vs USD",
  reerGap: "REER gap",
  inflation: "Inflation",
  gdpGrowth: "Real GDP growth",
};

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Maps a published observation onto a 0–100 stress contribution. */
export function componentStress(id: IndicatorId, value: number): number | null {
  switch (id) {
    case "reservesMonths":
      return clamp01((6 - value) / 5) * 100;
    case "shortTermDebtToReserves":
      return clamp01((value - 40) / 110) * 100;
    case "currentAccountGdp":
      return clamp01((-2 - value) / 6) * 100;
    case "fxDepreciation":
      return clamp01((value - 5) / 35) * 100;
    case "reerGap":
      return clamp01(value / 20) * 100;
    case "inflation":
      return clamp01((value - 3) / 22) * 100;
    case "gdpGrowth":
      return clamp01((2 - value) / 8) * 100;
    default:
      return null;
  }
}

export function bandFor(score: number): Exclude<ScoreBand, "insufficient"> {
  if (score <= 33) return "contained";
  if (score <= 66) return "watch";
  return "severe";
}

export function scoreCountry(series: Partial<Record<IndicatorId, Series>>, year?: number): CountryScore {
  const components: ScoreComponent[] = [];
  for (const id of SCORE_ORDER) {
    const point = year == null ? latest(series[id]) : asOf(series[id], year);
    if (!point || !Number.isFinite(point.value)) continue;
    const stress = componentStress(id, point.value);
    if (stress == null) continue;
    components.push({
      id,
      label: LABELS[id],
      year: point.year,
      raw: point.value,
      stress,
    });
  }

  if (components.length < MIN_COMPONENTS) {
    return { value: null, band: "insufficient", components };
  }

  const mean = components.reduce((sum, component) => sum + component.stress, 0) / components.length;
  const value = Math.round(mean);
  return { value, band: bandFor(value), components };
}

export const METHODOLOGY = [
  "The early-warning score is an equal-weight average of the available stress signals, rounded to the nearest point.",
  "A country needs at least four signals. Missing series are dropped and the remaining weights are split evenly.",
  "Contained is 0–33, watch is 34–66, and severe is 67–100.",
  "Reserve cover is calm at 6 months of imports or more and maxed at 1 month or less.",
  "Short-term external debt is calm at 40% of reserves or less and maxed at 150% or more.",
  "The current account is calm at a deficit of 2% of GDP or smaller and maxed at a deficit of 8% or larger.",
  "Depreciation against the dollar is the change from four quarters earlier. It is calm at 5% or less and maxed at 40% or more. Appreciation adds no stress.",
  "The REER gap is calm at or below the previous five-year average and maxed at 20% stronger than that average. On a quarterly series that average is the previous twenty quarters.",
  "Short-term debt to reserves is published annually and is held from the fourth quarter until the next reading.",
  "Inflation is calm at 3% or less and maxed at 25% or more. Real GDP growth is calm at 2% or more and maxed at a contraction of 6% or more.",
  "Reserve cover treats every country the same, including the United States, where a low import-cover ratio is a weaker signal because the dollar is the reserve currency.",
  "This is a transparent reading of published indicators. It is not a probability and it is not a forecast.",
];
