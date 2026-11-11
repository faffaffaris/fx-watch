import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FOCUS } from "../src/data/coverage.ts";
import { fxDepreciationSeries, parsePeriodToken, yearOverYear } from "../src/score/series.ts";
import type { CountryRecord, DashboardFile, ImfCreditRow, Series } from "../src/types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const regions = new Set(["EAS", "ECS", "LCN", "MEA", "NAC", "SAS", "SSF"]);

const INDICATOR_CODES: Record<Exclude<IndicatorId, "fxDepreciation" | "reerGap">, string> = {
  gdpGrowth: "NY.GDP.MKTP.KD.ZG",
  inflation: "FP.CPI.TOTL.ZG",
  currentAccountGdp: "BN.CAB.XOKA.GD.ZS",
  reservesMonths: "FI.RES.TOTL.MO",
  shortTermDebtToReserves: "DT.DOD.DSTC.IR.ZS",
  fxPerUsd: "PA.NUS.FCRF",
  gdpUsd: "NY.GDP.MKTP.CD",
};

type RawCountry = {
  iso3: string;
  iso2: string;
  name: string;
  regionId: string;
  regionName: string;
  longitude: number | null;
  latitude: number | null;
};

const ALIAS: Record<string, string> = {
  congodemocraticrepublicof: "COD",
  democraticrepublicofthecongo: "COD",
  congodemrep: "COD",
  congorepublicof: "COG",
  republicofthecongo: "COG",
  egyptarabrep: "EGY",
  egypt: "EGY",
  russianfederation: "RUS",
  russia: "RUS",
  turkiye: "TUR",
  turkey: "TUR",
  iranislamicrep: "IRN",
  iranislamicrepublicof: "IRN",
  venezuelarb: "VEN",
  venezuelabolivarianrepublicof: "VEN",
  syrianarabrepublic: "SYR",
  yemenrep: "YEM",
  kyrgyzrepublic: "KGZ",
  slovakrepublic: "SVK",
  czechia: "CZE",
  czechrepublic: "CZE",
  cotedivoire: "CIV",
  saotomeandprincipe: "STP",
  saotomeprincipe: "STP",
  gambiathe: "GMB",
  thegambia: "GMB",
  bahamasthe: "BHS",
  thebahamas: "BHS",
  laopdr: "LAO",
  laopeoplesdemocraticrepublic: "LAO",
  korea: "KOR",
  republicofkorea: "KOR",
  korearep: "KOR",
  northmacedonia: "MKD",
  northmacedoniarepublicof: "MKD",
  bruneidarussalam: "BRN",
  micronesiafedsts: "FSM",
  stvincentandthegrenadines: "VCT",
  stkittsandnevis: "KNA",
  hongkongsar: "HKG",
  hongkongchina: "HKG",
  macaosar: "MAC",
  chinapeoplesrepublicof: "CHN",
  unitedstates: "USA",
  unitedkingdom: "GBR",
  tanzania: "TZA",
  unitedrepublicoftanzania: "TZA",
  kosovo: "XKX",
};

function norm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { "user-agent": "fx-watch" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return (await response.json()) as T;
}

async function loadCountries(): Promise<RawCountry[]> {
  const payload = await getJson<[unknown, WbCountry[]]>(
    "https://api.worldbank.org/v2/country?format=json&per_page=400",
  );
  return payload[1]
    .filter((row) => regions.has(row.region.id))
    .map((row) => ({
      iso3: row.id,
      iso2: row.iso2Code,
      name: row.name,
      regionId: row.region.id,
      regionName: row.region.value.trim(),
      longitude: row.longitude ? Number(row.longitude) : null,
      latitude: row.latitude ? Number(row.latitude) : null,
    }));
}

type WbCountry = {
  id: string;
  iso2Code: string;
  name: string;
  region: { id: string; value: string };
  longitude: string;
  latitude: string;
};

type WbPoint = { countryiso3code: string; date: string; value: number | null };

async function loadIndicator(code: string): Promise<WbPoint[]> {
  const rows: WbPoint[] = [];
  let page = 1;
  let pages = 1;
  while (page <= pages) {
    const url = `https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&per_page=2000&page=${page}&date=2014:2026`;
    const payload = await getJson<[{ pages: number }, WbPoint[] | null]>(url);
    pages = payload[0].pages;
    rows.push(...(payload[1] ?? []));
    page += 1;
  }
  return rows;
}

function seriesFrom(rows: WbPoint[], iso3: string): Series {
  const points = rows
    .filter((row) => row.countryiso3code === iso3 && row.value != null && Number.isFinite(row.value))
    .map((row) => ({ year: Number(row.date), value: row.value as number }))
    .filter((point) => Number.isFinite(point.year));
  const byYear = new Map<number, number>();
  for (const point of points) byYear.set(point.year, point.value);
  return [...byYear.entries()]
    .map(([year, value]) => ({ year, value }))
    .sort((a, b) => b.year - a.year)
    .slice(0, 12);
}

function isoLookup(countries: RawCountry[]) {
  const byName = new Map<string, string>();
  const prefix = new Map<string, string[]>();
  for (const country of countries) {
    byName.set(norm(country.name), country.iso3);
    const head = norm(country.name.split(",")[0] ?? country.name);
    const list = prefix.get(head) ?? [];
    list.push(country.iso3);
    prefix.set(head, list);
  }
  for (const [head, isos] of prefix) {
    if (isos.length === 1) byName.set(head, isos[0]);
  }
  for (const [alias, iso] of Object.entries(ALIAS)) byName.set(alias, iso);
  return (name: string) => byName.get(norm(name)) ?? byName.get(norm(name.split(",")[0] ?? name)) ?? null;
}

function parseSdr(cell: string): number | null {
  const cleaned = cell.replace(/<[^>]+>/g, "").replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function stripCell(cell: string): string {
  return cell
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseImf(html: string, lookup: (name: string) => string | null): { rows: ImfCreditRow[]; unmatched: string[] } {
  const rows: ImfCreditRow[] = [];
  const unmatched = new Set<string>();
  const trs = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const tr of trs) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => stripCell(match[1]));
    if (cells.length < 2) continue;
    const name = cells[0];
    if (!name || /total|member|date/i.test(name)) continue;
    const numbers = cells.slice(1).map(parseSdr).filter((value): value is number => value != null);
    if (numbers.length < 4) continue;
    const [graSdr, prgtSdr, rstSdr, totalSdr] = numbers.slice(-4);
    const iso3 = lookup(name);
    if (!iso3) {
      unmatched.add(name);
      continue;
    }
    if (totalSdr <= 0) continue;
    rows.push({ iso3, graSdr, prgtSdr, rstSdr, totalSdr });
  }
  return { rows, unmatched: [...unmatched] };
}

async function loadImf(lookup: (name: string) => string | null): Promise<DashboardFile["imf"]> {
  const dates = ["2026-09-30", "2026-08-31", "2026-07-31", "2026-06-30", "2026-03-31", "2026-01-31"];
  for (const date of dates) {
    const sourceUrl = `https://www.imf.org/external/np/fin/tad/extcred2.aspx?date1key=${date}&reportdate=${date}`;
    try {
      const response = await fetch(sourceUrl, {
        headers: { "user-agent": "fx-watch" },
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok) continue;
      const html = await response.text();
      if (!/credit outstanding/i.test(html) && !/<td/i.test(html)) continue;
      const parsed = parseImf(html, lookup);
      console.log(`IMF ${date}: ${parsed.rows.length} members, unmatched ${parsed.unmatched.slice(0, 12).join(" | ")}`);
      if (parsed.rows.length >= 8) return { asOf: date, sourceUrl, rows: parsed.rows };
    } catch (error) {
      console.log(`IMF ${date} failed`, error instanceof Error ? error.message : error);
    }
  }
  return null;
}

type IfsDoc = {
  dimensions: { REF_AREA: string };
  period?: string[];
  value?: (number | string | null)[];
};

async function loadIfs(indicator: string, areas: string[]): Promise<Map<string, Series>> {
  const dimensions = encodeURIComponent(JSON.stringify({ FREQ: ["Q"], REF_AREA: areas, INDICATOR: [indicator] }));
  const url = `https://api.db.nomics.world/v22/series/IMF/IFS?observations=1&limit=80&facets=0&metadata=0&dimensions=${dimensions}`;
  console.log(`Loading ${indicator}`);
  const payload = await getJson<{ series?: { docs?: IfsDoc[] } }>(url);
  const map = new Map<string, Series>();
  for (const doc of payload.series?.docs ?? []) {
    const points: Series = [];
    (doc.period ?? []).forEach((label, index) => {
      const period = parsePeriodToken(label);
      const raw = doc.value?.[index];
      const value = typeof raw === "number" ? raw : Number(raw);
      if (period == null || period < 19951 || !Number.isFinite(value)) return;
      points.push({ year: period, value });
    });
    map.set(doc.dimensions.REF_AREA, points);
  }
  console.log(`  ${indicator}: ${map.size} economies`);
  return map;
}

function valueAt(series: Series | undefined, period: number): number | null {
  return series?.find((point) => point.year === period)?.value ?? null;
}

async function loadShortTerm(iso3s: string[]): Promise<Map<string, Series>> {
  const map = new Map<string, Series>();
  const rows: WbPoint[] = [];
  let page = 1;
  let pages = 1;
  while (page <= pages) {
    const url = `https://api.worldbank.org/v2/country/${iso3s.join(";")}/indicator/DT.DOD.DSTC.IR.ZS?format=json&per_page=2000&page=${page}&date=1995:2026`;
    const payload = await getJson<[{ pages: number }, WbPoint[] | null]>(url);
    pages = payload[0].pages;
    rows.push(...(payload[1] ?? []));
    page += 1;
  }
  for (const row of rows) {
    if (row.value == null || !Number.isFinite(row.value)) continue;
    const year = Number(row.date);
    if (!Number.isFinite(year)) continue;
    const series = map.get(row.countryiso3code) ?? [];
    series.push({ year: year * 10 + 4, value: row.value });
    map.set(row.countryiso3code, series);
  }
  for (const series of map.values()) series.sort((a, b) => b.year - a.year);
  console.log(`Short-term debt: ${map.size} economies`);
  return map;
}

async function loadReer(countries: RawCountry[]): Promise<{ source: string | null; byIso: Map<string, Series> }> {
  const byIso = new Map<string, Series>();
  const iso2 = new Map(countries.map((country) => [country.iso2, country.iso3]));
  const url = "https://stats.bis.org/api/v2/data/dataflow/BIS/WS_EER/1.0/A.R.B.?startPeriod=2010&format=csv";
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "fx-watch" },
      signal: AbortSignal.timeout(40000),
    });
    if (!response.ok) {
      console.log(`BIS REER skipped: ${response.status}`);
      return { source: null, byIso };
    }
    const csv = await response.text();
    const lines = csv.trim().split(/\r?\n/);
    const header = lines[0]?.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")) ?? [];
    const ref = header.findIndex((cell) => /REF_AREA|Reference area/i.test(cell));
    const time = header.findIndex((cell) => /TIME_PERIOD|Time/i.test(cell));
    const obs = header.findIndex((cell) => /OBS_VALUE|Observation/i.test(cell));
    if (ref < 0 || time < 0 || obs < 0) {
      console.log(`BIS REER header not recognized: ${header.slice(0, 12).join(",")}`);
      return { source: null, byIso };
    }
    const annual = new Map<string, Series>();
    for (const line of lines.slice(1)) {
      const cells = line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
      const iso = iso2.get(cells[ref] ?? "");
      const year = Number((cells[time] ?? "").slice(0, 4));
      const value = Number(cells[obs]);
      if (!iso || !Number.isFinite(year) || !Number.isFinite(value)) continue;
      const series = annual.get(iso) ?? [];
      series.push({ year, value });
      annual.set(iso, series);
    }
    for (const [iso, series] of annual) byIso.set(iso, reerGapSeries(series));
    console.log(`BIS REER gaps for ${byIso.size} countries`);
    return { source: url, byIso };
  } catch (error) {
    console.log("BIS REER skipped", error instanceof Error ? error.message : error);
    return { source: null, byIso };
  }
}

async function loadBoundaries() {
  const urls = [
    "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/cultural/ne_110m_admin_0_countries.json",
    "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_110m_admin_0_countries.geojson",
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) continue;
      const text = await response.text();
      if (!text.includes("Feature") || text.includes("git-lfs")) continue;
      const destination = join(root, "public", "geo", "countries.geojson");
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, text);
      console.log(`Boundaries from ${url} (${text.length} bytes)`);
      return;
    } catch (error) {
      console.log("Boundary download failed", error instanceof Error ? error.message : error);
    }
  }
  throw new Error("Could not download country boundaries");
}

async function main() {
  console.log("Loading countries");
  const raw = (await loadCountries()).filter((country) => FOCUS.has(country.iso3));
  console.log(`${raw.length} G20 and ASEAN economies`);
  const areas = raw.map((country) => country.iso2);
  const cpi = await loadIfs("PCPI_IX", areas);
  const realGdp = await loadIfs("NGDP_R_SA_XDC", areas);
  const nominalGdp = await loadIfs("NGDP_SA_XDC", areas);
  const currentAccount = await loadIfs("BCAXF_BP6_USD", areas);
  const dollarRate = await loadIfs("ENDE_XDC_USD_RATE", areas);
  const reserves = await loadIfs("RAFA_USD", areas);
  const imports = await loadIfs("TMG_CIF_USD", areas);
  const shortTerm = await loadShortTerm(raw.map((country) => country.iso3));
  const lookup = isoLookup(raw);
  console.log("Loading IMF credit outstanding");
  const imf = await loadImf(lookup);
  if (imf) imf.rows = imf.rows.filter((row) => FOCUS.has(row.iso3));

  const countries: CountryRecord[] = raw.map((country) => {
    const series: CountryRecord["series"] = {};
    const inflation = yearOverYear(cpi.get(country.iso2) ?? []).filter((point) => point.year >= 19961);
    const growth = yearOverYear(realGdp.get(country.iso2) ?? []).filter((point) => point.year >= 19961);
    const fx = fxDepreciationSeries(dollarRate.get(country.iso2) ?? []).filter((point) => point.year >= 19961);
    if (inflation.length > 0) series.inflation = inflation;
    if (growth.length > 0) series.gdpGrowth = growth;
    if (fx.length > 0) series.fxDepreciation = fx;

    const gross = nominalGdp.get(country.iso2) ?? [];
    const rate = dollarRate.get(country.iso2) ?? [];
    const balance = currentAccount.get(country.iso2) ?? [];
    const gdpUsd: Series = [];
    const currentAccountGdp: Series = [];
    for (const point of gross) {
      if (point.year < 19961) continue;
      const local = point.value;
      const fxRate = valueAt(rate, point.year);
      if (fxRate == null || fxRate === 0) continue;
      gdpUsd.push({ year: point.year, value: (local / fxRate) * 1_000_000 });
      const external = valueAt(balance, point.year);
      if (external != null) currentAccountGdp.push({ year: point.year, value: (external / (local / fxRate)) * 100 });
    }
    if (gdpUsd.length > 0) series.gdpUsd = gdpUsd.sort((a, b) => b.year - a.year);
    if (currentAccountGdp.length > 0) series.currentAccountGdp = currentAccountGdp.sort((a, b) => b.year - a.year);

    const cover: Series = [];
    for (const point of reserves.get(country.iso2) ?? []) {
      if (point.year < 19961) continue;
      const goods = valueAt(imports.get(country.iso2), point.year);
      if (goods == null || goods <= 0) continue;
      cover.push({ year: point.year, value: (3 * point.value) / goods });
    }
    if (cover.length > 0) series.reservesMonths = cover.sort((a, b) => b.year - a.year);
    const debt = shortTerm.get(country.iso3);
    if (debt && debt.length > 0) series.shortTermDebtToReserves = debt;

    return {
      iso3: country.iso3,
      name: country.name,
      regionId: country.regionId,
      regionName: country.regionName,
      longitude: country.longitude,
      latitude: country.latitude,
      series,
    };
  });

  const dashboard: DashboardFile = {
    generatedAt: new Date().toISOString(),
    indicatorSource: "IMF IFS quarterly via https://api.db.nomics.world/v22/series/IMF/IFS; short-term debt https://api.worldbank.org/v2/",
    reerSource: null,
    imf,
    countries,
  };
  const destination = join(root, "public", "dashboard.json");
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, JSON.stringify(dashboard));
  await loadBoundaries();
  const scored = countries.filter((country) => Object.keys(country.series).length > 0).length;
  console.log(`Wrote ${destination} (${countries.length} countries, ${scored} with data, IMF ${imf?.rows.length ?? 0})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
