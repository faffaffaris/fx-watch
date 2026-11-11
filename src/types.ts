export type IndicatorId =
  | "gdpGrowth"
  | "inflation"
  | "currentAccountGdp"
  | "reservesMonths"
  | "shortTermDebtToReserves"
  | "fxDepreciation"
  | "reerGap"
  | "gdpUsd";

export type Observation = {
  year: number;
  value: number;
};

export type Series = Observation[];

export type CountryRecord = {
  iso3: string;
  name: string;
  regionId: string;
  regionName: string;
  longitude: number | null;
  latitude: number | null;
  series: Partial<Record<IndicatorId, Series>>;
};

export type ImfCreditRow = {
  iso3: string;
  totalSdr: number;
  graSdr: number;
  prgtSdr: number;
  rstSdr: number;
};

export type DashboardFile = {
  generatedAt: string;
  indicatorSource: string;
  reerSource: string | null;
  imf: {
    asOf: string;
    sourceUrl: string;
    rows: ImfCreditRow[];
  } | null;
  countries: CountryRecord[];
};

export type ScoreBand = "contained" | "watch" | "severe" | "insufficient";

export type ScoreComponent = {
  id: IndicatorId;
  label: string;
  year: number;
  raw: number;
  stress: number;
};

export type CountryScore = {
  value: number | null;
  band: ScoreBand;
  components: ScoreComponent[];
};

export type ScoredCountry = CountryRecord & {
  score: CountryScore;
};

export type FacilityKind = "swap" | "imf";

export type Facility = {
  id: string;
  kind: FacilityKind;
  partyA: string;
  partyB: string;
  partyBLabel: string;
  currency: string;
  allocation: number | null;
  drawn: number | null;
  status: string;
  asOf: string;
  source: string;
  sourceUrl: string;
  note?: string;
  alsoShowOn?: string[];
  endpoint?: { longitude: number; latitude: number; label: string };
};

export type NetworkTotal = {
  id: string;
  title: string;
  amount: number;
  currency: string;
  asOf: string;
  source: string;
  sourceUrl: string;
  note: string;
  showOn: string[];
};

export type LayerId = "indicators" | "cooperation" | "warning";

export type Scope =
  | { level: "global" }
  | { level: "region"; regionId: string }
  | { level: "country"; iso3: string };
