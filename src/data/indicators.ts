import type { IndicatorId } from "../types";

export type IndicatorMeta = {
  id: IndicatorId;
  label: string;
  unit: string;
  detail: string;
  /** Warmer choropleth colors mark the stressed end of the distribution. */
  warmWhen: "high" | "low";
  inScore: boolean;
};

export const INDICATORS: IndicatorMeta[] = [
  {
    id: "reservesMonths",
    label: "Reserve cover",
    unit: "months of goods imports",
    detail: "Reserve assets divided by average monthly goods imports. Goods-only imports make the cover look higher than a goods-and-services measure.",
    warmWhen: "low",
    inScore: true,
  },
  {
    id: "shortTermDebtToReserves",
    label: "Short-term debt / reserves",
    unit: "% of reserves",
    detail: "Short-term external debt as a percent of total reserves. Published annually and held from the fourth quarter.",
    warmWhen: "high",
    inScore: true,
  },
  {
    id: "currentAccountGdp",
    label: "Current account",
    unit: "% of GDP",
    detail: "Current account balance as a percent of GDP.",
    warmWhen: "low",
    inScore: true,
  },
  {
    id: "fxDepreciation",
    label: "Depreciation vs USD",
    unit: "% over four quarters",
    detail: "Rise in local currency units per US dollar from four quarters earlier. Positive means depreciation.",
    warmWhen: "high",
    inScore: true,
  },
  {
    id: "reerGap",
    label: "REER gap",
    unit: "% vs prior 5 years",
    detail: "Real broad effective exchange rate relative to the previous five annual averages.",
    warmWhen: "high",
    inScore: true,
  },
  {
    id: "inflation",
    label: "Inflation",
    unit: "% over four quarters",
    detail: "Consumer price index compared with four quarters earlier.",
    warmWhen: "high",
    inScore: true,
  },
  {
    id: "gdpGrowth",
    label: "Real GDP growth",
    unit: "% over four quarters",
    detail: "Real GDP compared with four quarters earlier.",
    warmWhen: "low",
    inScore: true,
  },
  {
    id: "gdpUsd",
    label: "GDP",
    unit: "US dollars",
    detail: "Nominal GDP. Used as the weight for regional and global scores.",
    warmWhen: "high",
    inScore: false,
  },
];

export const INDICATOR_MAP = Object.fromEntries(INDICATORS.map((item) => [item.id, item])) as Record<
  IndicatorId,
  IndicatorMeta
>;
