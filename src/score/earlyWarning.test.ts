import { describe, expect, it } from "vitest";
import { summarize } from "./aggregate";
import { bandFor, componentStress, scoreCountry } from "./earlyWarning";
import { fxDepreciationSeries, reerGapSeries } from "./series";
import type { ScoredCountry } from "../types";

describe("component thresholds", () => {
  it("holds reserve cover calm at six months and maxed at one", () => {
    expect(componentStress("reservesMonths", 6)).toBe(0);
    expect(componentStress("reservesMonths", 3.5)).toBe(50);
    expect(componentStress("reservesMonths", 1)).toBe(100);
    expect(componentStress("reservesMonths", 12)).toBe(0);
  });

  it("treats appreciation and a mild current-account gap as calm", () => {
    expect(componentStress("fxDepreciation", -8)).toBe(0);
    expect(componentStress("fxDepreciation", 5)).toBe(0);
    expect(componentStress("fxDepreciation", 40)).toBe(100);
    expect(componentStress("currentAccountGdp", -2)).toBe(0);
    expect(componentStress("currentAccountGdp", -8)).toBe(100);
    expect(componentStress("reerGap", 0)).toBe(0);
    expect(componentStress("reerGap", 10)).toBe(50);
  });
});

describe("country score", () => {
  it("returns an insufficient band below four signals", () => {
    const score = scoreCountry({
      reservesMonths: [{ year: 2024, value: 1 }],
      inflation: [{ year: 2024, value: 40 }],
      gdpGrowth: [{ year: 2024, value: -8 }],
    });
    expect(score.band).toBe("insufficient");
    expect(score.value).toBeNull();
  });

  it("uses the latest observation at or before the selected year", () => {
    const earlier = scoreCountry(
      {
        reservesMonths: [
          { year: 2018, value: 1 },
          { year: 2024, value: 8 },
        ],
        shortTermDebtToReserves: [
          { year: 2018, value: 150 },
          { year: 2024, value: 10 },
        ],
        currentAccountGdp: [
          { year: 2018, value: -8 },
          { year: 2024, value: 2 },
        ],
        inflation: [
          { year: 2018, value: 40 },
          { year: 2024, value: 2 },
        ],
      },
      2018,
    );
    expect(earlier.band).toBe("severe");
    expect(earlier.components.every((component) => component.year === 2018)).toBe(true);
  });

  it("averages available signals and rounds onto the band edges", () => {
    const severe = scoreCountry({
      reservesMonths: [{ year: 2024, value: 1 }],
      shortTermDebtToReserves: [{ year: 2024, value: 150 }],
      currentAccountGdp: [{ year: 2024, value: -8 }],
      fxDepreciation: [{ year: 2024, value: 40 }],
    });
    expect(severe.value).toBe(100);
    expect(severe.band).toBe("severe");

    const contained = scoreCountry({
      reservesMonths: [{ year: 2024, value: 6 }],
      shortTermDebtToReserves: [{ year: 2024, value: 40 }],
      currentAccountGdp: [{ year: 2024, value: -2 }],
      inflation: [{ year: 2024, value: 3 }],
    });
    expect(contained.value).toBe(0);
    expect(contained.band).toBe("contained");
  });

  it("places the rounded score on the published band cuts", () => {
    expect(bandFor(33)).toBe("contained");
    expect(bandFor(34)).toBe("watch");
    expect(bandFor(66)).toBe("watch");
    expect(bandFor(67)).toBe("severe");
  });
});

describe("transformations", () => {
  it("computes depreciation from the same quarter a year earlier", () => {
    expect(
      fxDepreciationSeries([
        { year: 20231, value: 2 },
        { year: 20241, value: 3 },
      ]),
    ).toEqual([{ year: 20241, value: 50 }]);
  });

  it("computes depreciation from the dollar rate", () => {
    expect(
      fxDepreciationSeries([
        { year: 2020, value: 2 },
        { year: 2019, value: 1 },
      ]),
    ).toEqual([{ year: 2020, value: 100 }]);
  });

  it("compares the REER with the previous five annual readings", () => {
    const index = [100, 100, 100, 100, 100, 120].map((value, offset) => ({
      year: 2015 + offset,
      value,
    }));
    const [gap] = reerGapSeries(index);
    expect(gap.year).toBe(2020);
    expect(gap.value).toBeCloseTo(20, 5);
  });
});

describe("regional and global summary", () => {
  it("weights scores by GDP and reports the severe share", () => {
    const countries = [
      fake("A", "EAS", 0, 100),
      fake("B", "EAS", 100, 100),
      fake("C", "EAS", null, 999),
      fake("D", "SSF", 80, 50),
    ];
    const region = summarize(countries, "EAS");
    expect(region.score).toBe(50);
    expect(region.severe).toBe(1);
    expect(region.insufficient).toBe(1);
    expect(region.gdpShareSevere).toBe(0.5);

    const global = summarize(countries, null);
    expect(global.covered).toBe(3);
    expect(global.score).toBe(56);
  });
});

function fake(
  iso3: string,
  regionId: string,
  score: number | null,
  gdp: number,
): ScoredCountry {
  return {
    iso3,
    name: iso3,
    regionId,
    regionName: regionId,
    longitude: null,
    latitude: null,
    series: { gdpUsd: [{ year: 2024, value: gdp }] },
    score: {
      value: score,
      band: score == null ? "insufficient" : score >= 67 ? "severe" : score >= 34 ? "watch" : "contained",
      components: [],
    },
  };
}
