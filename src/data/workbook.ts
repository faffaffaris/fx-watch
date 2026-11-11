import * as XLSX from "xlsx";
import { INDICATORS } from "./indicators";
import { parseRecords, type ParsedSheet } from "./sheet";
import { formatPeriod } from "../score/series";
import type { DashboardFile, IndicatorId } from "../types";

export function parseUpload(file: ArrayBuffer, fallbackIndicator: IndicatorId | null): ParsedSheet {
  const book = XLSX.read(file, { type: "array" });
  const combined: ParsedSheet = { indicatorEdits: [], imfEdits: [], issues: [] };
  for (const name of book.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[name], { defval: "", raw: false });
    const parsed = parseRecords(rows, fallbackIndicator, name);
    combined.indicatorEdits.push(...parsed.indicatorEdits);
    combined.imfEdits.push(...parsed.imfEdits);
    combined.issues.push(...parsed.issues.map((issue) => ({ ...issue, message: `${name}: ${issue.message}` })));
  }
  return combined;
}

export function downloadWorkbook(file: DashboardFile): void {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(indicatorRecords(file)), "indicators");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(imfRecords(file)), "imf");
  XLSX.writeFile(book, "fx-watch.xlsx");
}

export function downloadIndicatorCsv(file: DashboardFile, indicator: IndicatorId): void {
  const years = new Set<number>();
  for (const country of file.countries) {
    for (const point of country.series[indicator] ?? []) years.add(point.year);
  }
  const columns = [...years].sort((a, b) => a - b);
  const rows = file.countries
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((country) => {
      const row: Record<string, string | number> = {
        iso3: country.iso3,
        name: country.name,
        region_id: country.regionId,
        region_name: country.regionName,
        longitude: country.longitude ?? "",
        latitude: country.latitude ?? "",
        indicator,
      };
      for (const year of columns) {
        const point = country.series[indicator]?.find((item) => item.year === year);
        row[formatPeriod(year)] = point ? point.value : "";
      }
      return row;
    });
  const sheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(sheet);
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `fx-watch-${indicator}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function indicatorRecords(file: DashboardFile): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = [];
  for (const country of file.countries) {
    for (const meta of INDICATORS) {
      for (const point of country.series[meta.id] ?? []) {
        rows.push({
          iso3: country.iso3,
          name: country.name,
          region_id: country.regionId,
          region_name: country.regionName,
          longitude: country.longitude ?? "",
          latitude: country.latitude ?? "",
          indicator: meta.id,
          year: formatPeriod(point.year),
          value: point.value,
        });
      }
    }
  }
  return rows;
}

function imfRecords(file: DashboardFile): Record<string, string | number>[] {
  return (file.imf?.rows ?? []).map((row) => ({
    iso3: row.iso3,
    gra_sdr: row.graSdr,
    prgt_sdr: row.prgtSdr,
    rst_sdr: row.rstSdr,
    total_sdr: row.totalSdr,
  }));
}
