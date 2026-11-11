import type { ScoredCountry } from "../types";
import { asOf, latest } from "./series";

export type ScopeSummary = {
  score: number | null;
  covered: number;
  insufficient: number;
  contained: number;
  watch: number;
  severe: number;
  gdpShareSevere: number | null;
};

export function inScope(country: ScoredCountry, regionId: string | null): boolean {
  return regionId == null || country.regionId === regionId;
}

export function summarize(countries: ScoredCountry[], regionId: string | null, year?: number): ScopeSummary {
  const members = countries.filter((country) => inScope(country, regionId));
  const summary: ScopeSummary = {
    score: null,
    covered: 0,
    insufficient: 0,
    contained: 0,
    watch: 0,
    severe: 0,
    gdpShareSevere: null,
  };

  let weight = 0;
  let weighted = 0;
  let severeGdp = 0;

  for (const country of members) {
    if (country.score.value == null) {
      summary.insufficient += 1;
      continue;
    }
    summary.covered += 1;
    summary[country.score.band as "contained" | "watch" | "severe"] += 1;
    const gdp = (year == null ? latest(country.series.gdpUsd) : asOf(country.series.gdpUsd, year))?.value;
    if (gdp == null || gdp <= 0) continue;
    weight += gdp;
    weighted += gdp * country.score.value;
    if (country.score.band === "severe") severeGdp += gdp;
  }

  if (weight > 0) {
    summary.score = Math.round(weighted / weight);
    summary.gdpShareSevere = severeGdp / weight;
  }
  return summary;
}
