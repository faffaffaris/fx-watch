import { INDICATORS } from "./indicators";
import { parsePeriodToken } from "../score/series";
import type { DashboardFile, IndicatorId, ImfCreditRow } from "../types";

export type SheetIssue = { row: number; message: string };

export type IndicatorEdit = {
  iso3: string;
  indicator: IndicatorId;
  year: number;
  value: number | null;
  name?: string;
  regionId?: string;
  regionName?: string;
  longitude?: number | null;
  latitude?: number | null;
};

export type ParsedSheet = {
  indicatorEdits: IndicatorEdit[];
  imfEdits: ImfCreditRow[];
  issues: SheetIssue[];
};

const ALIAS = new Map<string, IndicatorId>();
for (const item of INDICATORS) {
  ALIAS.set(keyOf(item.id), item.id);
  ALIAS.set(keyOf(item.label), item.id);
}

export function indicatorFromLabel(value: string): IndicatorId | null {
  return ALIAS.get(keyOf(value)) ?? null;
}

export function yearsFor(file: DashboardFile, indicator: IndicatorId): number[] {
  const years = new Set<number>();
  for (const country of file.countries) {
    for (const point of country.series[indicator] ?? []) years.add(point.year);
  }
  return [...years].sort((a, b) => a - b);
}

export function cellValue(file: DashboardFile, iso3: string, indicator: IndicatorId, year: number): string {
  const point = file.countries.find((country) => country.iso3 === iso3)?.series[indicator]?.find((item) => item.year === year);
  return point == null ? "" : String(point.value);
}

export function writeCell(file: DashboardFile, iso3: string, indicator: IndicatorId, year: number, raw: string): void {
  const country = file.countries.find((item) => item.iso3 === iso3);
  if (!country) return;
  const series = (country.series[indicator] ?? []).filter((point) => point.year !== year);
  const trimmed = raw.trim().replace(/,/g, "");
  if (trimmed !== "") {
    const value = Number(trimmed);
    if (!Number.isFinite(value)) throw new Error(`${iso3} ${year} is not a number.`);
    series.push({ year, value });
  }
  series.sort((a, b) => b.year - a.year);
  if (series.length > 0) country.series[indicator] = series;
  else delete country.series[indicator];
}

export function writeCountryField(
  file: DashboardFile,
  iso3: string,
  field: "name" | "regionId" | "regionName" | "longitude" | "latitude",
  raw: string,
): void {
  const country = file.countries.find((item) => item.iso3 === iso3);
  if (!country) return;
  if (field === "longitude" || field === "latitude") {
    const trimmed = raw.trim();
    country[field] = trimmed === "" ? null : Number(trimmed);
    if (country[field] != null && !Number.isFinite(country[field])) throw new Error(`${iso3} ${field} is not a number.`);
    return;
  }
  country[field] = raw.trim();
}

export function applyEdits(file: DashboardFile, parsed: ParsedSheet): DashboardFile {
  const next = structuredClone(file);
  for (const edit of parsed.indicatorEdits) {
    let country = next.countries.find((item) => item.iso3 === edit.iso3);
    if (!country) {
      country = {
        iso3: edit.iso3,
        name: edit.name || edit.iso3,
        regionId: edit.regionId || "",
        regionName: edit.regionName || edit.regionId || "",
        longitude: edit.longitude ?? null,
        latitude: edit.latitude ?? null,
        series: {},
      };
      next.countries.push(country);
    }
    if (edit.name) country.name = edit.name;
    if (edit.regionId) country.regionId = edit.regionId;
    if (edit.regionName) country.regionName = edit.regionName;
    if (edit.longitude !== undefined) country.longitude = edit.longitude;
    if (edit.latitude !== undefined) country.latitude = edit.latitude;
    writeCell(next, edit.iso3, edit.indicator, edit.year, edit.value == null ? "" : String(edit.value));
  }
  if (parsed.imfEdits.length > 0) {
    const rows = new Map((next.imf?.rows ?? []).map((row) => [row.iso3, row]));
    for (const edit of parsed.imfEdits) rows.set(edit.iso3, edit);
    next.imf = {
      asOf: next.imf?.asOf ?? new Date().toISOString().slice(0, 10),
      sourceUrl: next.imf?.sourceUrl ?? "",
      rows: [...rows.values()].sort((a, b) => a.iso3.localeCompare(b.iso3)),
    };
  }
  next.generatedAt = new Date().toISOString();
  return next;
}

export function parseRecords(rows: Record<string, unknown>[], fallbackIndicator: IndicatorId | null, sheetName = "sheet"): ParsedSheet {
  const parsed: ParsedSheet = { indicatorEdits: [], imfEdits: [], issues: [] };
  if (rows.length === 0) return parsed;
  const sample = normalizeRecord(rows[0]);
  if (isImfRecord(sample) || keyOf(sheetName) === "imf") {
    rows.forEach((row, index) => readImf(normalizeRecord(row), index + 2, parsed));
    return parsed;
  }
  const yearColumns = Object.keys(sample).filter((key) => parsePeriodToken(key.replace(/_/g, "")) != null);
  rows.forEach((row, index) => {
    const record = normalizeRecord(row);
    if (yearColumns.length > 0) readWide(record, yearColumns, index + 2, fallbackIndicator, parsed);
    else readLong(record, index + 2, parsed);
  });
  return parsed;
}

function readLong(record: Record<string, string>, row: number, parsed: ParsedSheet): void {
  const iso3 = code(record.iso3 || record.iso || record.code);
  const indicator = indicatorFromLabel(record.indicator || record.series || "");
  const year = parsePeriodToken(String(record.year).replace(/_/g, ""));
  if (!iso3 || !indicator || year == null) {
    if (Object.values(record).some((value) => value !== "")) {
      parsed.issues.push({ row, message: `Row ${row} needs an ISO code, an indicator, and a year.` });
    }
    return;
  }
  const value = readNumber(record.value);
    if (!value.ok) {
      parsed.issues.push({ row, message: `Row ${row} value is not a number.` });
      return;
    }
    parsed.indicatorEdits.push({ ...identity(record, iso3), indicator, year, value: value.value });
}

function readWide(
  record: Record<string, string>,
  yearColumns: string[],
  row: number,
  fallbackIndicator: IndicatorId | null,
  parsed: ParsedSheet,
): void {
  const iso3 = code(record.iso3 || record.iso || record.code);
  const indicator = indicatorFromLabel(record.indicator || record.series || "") ?? fallbackIndicator;
  if (!iso3 || !indicator) {
    parsed.issues.push({ row, message: `Row ${row} needs an ISO code and an indicator.` });
    return;
  }
  for (const year of yearColumns) {
    if (!(year in record)) continue;
    const value = readNumber(record[year]);
    if (!value.ok) {
      parsed.issues.push({ row, message: `Row ${row} year ${year} is not a number.` });
      continue;
    }
    parsed.indicatorEdits.push({
      ...identity(record, iso3),
      indicator,
      year: parsePeriodToken(year.replace(/_/g, "")) ?? Number(year),
      value: value.value,
    });
  }
}

function readImf(record: Record<string, string>, row: number, parsed: ParsedSheet): void {
  const iso3 = code(record.iso3 || record.iso || record.code);
  if (!iso3) {
    parsed.issues.push({ row, message: `Row ${row} needs an ISO code.` });
    return;
  }
  const gra = numberOrNull(record.gra_sdr || record.grasdr || record.gra) ?? 0;
  const prgt = numberOrNull(record.prgt_sdr || record.prgtsdr || record.prgt) ?? 0;
  const rst = numberOrNull(record.rst_sdr || record.rstsdr || record.rst) ?? 0;
  const total = numberOrNull(record.total_sdr || record.totalsdr || record.total) ?? gra + prgt + rst;
  parsed.imfEdits.push({ iso3, graSdr: gra, prgtSdr: prgt, rstSdr: rst, totalSdr: total });
}

function identity(record: Record<string, string>, iso3: string): Pick<IndicatorEdit, "iso3" | "name" | "regionId" | "regionName" | "longitude" | "latitude"> {
  return {
    iso3,
    name: record.name || record.country || undefined,
    regionId: record.region_id || record.regionid || undefined,
    regionName: record.region_name || record.region || undefined,
    longitude: record.longitude || record.lon ? numberOrNull(record.longitude || record.lon) : undefined,
    latitude: record.latitude || record.lat ? numberOrNull(record.latitude || record.lat) : undefined,
  };
}

function isImfRecord(record: Record<string, string>): boolean {
  return "gra_sdr" in record || "grasdr" in record || "gra" in record;
}

function normalizeRecord(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    out[keyOf(key)] = value == null ? "" : String(value).trim();
  }
  return out;
}

function code(value: string | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function readNumber(value: string | undefined): { ok: true; value: number | null } | { ok: false } {
  const trimmed = (value ?? "").trim().replace(/,/g, "");
  if (trimmed === "") return { ok: true, value: null };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return { ok: false };
  return { ok: true, value: parsed };
}

function numberOrNull(value: string | undefined): number | null {
  const parsed = readNumber(value);
  return parsed.ok ? parsed.value : null;
}

function keyOf(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
