import { describe, expect, it } from "vitest";
import { applyEdits, cellValue, parseRecords, yearsFor } from "./sheet";
import type { DashboardFile } from "../types";

function sample(): DashboardFile {
  return {
    generatedAt: "2020-01-01T00:00:00.000Z",
    indicatorSource: "test",
    reerSource: null,
    imf: { asOf: "2020-01-01", sourceUrl: "", rows: [{ iso3: "ARG", totalSdr: 1, graSdr: 1, prgtSdr: 0, rstSdr: 0 }] },
    countries: [
      {
        iso3: "ARG",
        name: "Argentina",
        regionId: "LCN",
        regionName: "Latin America",
        longitude: -64,
        latitude: -34,
        series: { inflation: [{ year: 2024, value: 200 }, { year: 2023, value: 100 }] },
      },
    ],
  };
}

describe("spreadsheet edits", () => {
  it("reads a wide sheet for the selected indicator and drops a blank cell", () => {
    const parsed = parseRecords(
      [
        { iso3: "ARG", name: "Argentina", "2024": "10", "2023": "" },
        { iso3: "ZZZ", "2024": "nope" },
      ],
      "inflation",
    );
    const next = applyEdits(sample(), parsed);
    expect(cellValue(next, "ARG", "inflation", 2024)).toBe("10");
    expect(cellValue(next, "ARG", "inflation", 2023)).toBe("");
    expect(yearsFor(next, "inflation")).toEqual([2024]);
    expect(parsed.issues.map((issue) => issue.message)).toEqual(["Row 3 year 2024 is not a number."]);
  });

  it("reads a long sheet and an IMF sheet", () => {
    const indicators = parseRecords(
      [{ iso3: "GHA", indicator: "Real GDP growth", year: 2019, value: -2, name: "Ghana", region_id: "SSF", region_name: "Africa" }],
      null,
    );
    const imf = parseRecords([{ iso3: "arg", gra_sdr: "5", prgt_sdr: "1", rst_sdr: "", total_sdr: "6" }], null, "imf");
    const next = applyEdits(applyEdits(sample(), indicators), imf);
    expect(next.countries.find((country) => country.iso3 === "GHA")?.series.gdpGrowth?.[0]).toEqual({ year: 2019, value: -2 });
    expect(next.imf?.rows.find((row) => row.iso3 === "ARG")?.graSdr).toBe(5);
    expect(next.imf?.rows.find((row) => row.iso3 === "ARG")?.totalSdr).toBe(6);
  });

  it("reports a long row that has no indicator", () => {
    const parsed = parseRecords([{ iso3: "ARG", year: 2020, value: 1 }], null);
    expect(parsed.indicatorEdits).toHaveLength(0);
    expect(parsed.issues[0]?.message).toMatch(/indicator/);
  });
});
