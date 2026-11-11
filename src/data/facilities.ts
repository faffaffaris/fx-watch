import { ECB_ENDPOINT, EURO_AREA, IMF_ENDPOINT } from "./euroArea";
import type { DashboardFile, Facility, NetworkTotal } from "../types";

const YI = 100_000_000;
const PBOC_URL = "https://www.pbc.gov.cn/huobizhengceersi/214481/5546061/5738275/index.html";
const FED_URL = "https://www.federalreserve.gov/monetarypolicy/bst_liquidityswaps.htm";
const H41_URL = "https://www.federalreserve.gov/releases/h41/current/";

const euroMembers = [...EURO_AREA];

function pboc(
  iso: string,
  label: string,
  yi: number,
  extra: Partial<Facility> = {},
): Facility {
  return {
    id: `pboc-${iso.toLowerCase()}`,
    kind: "swap",
    partyA: "CHN",
    partyB: iso,
    partyBLabel: label,
    currency: "CNY",
    allocation: yi * YI,
    drawn: null,
    status: "In force at end-2025",
    asOf: "2025-12-31",
    source: "People's Bank of China, bilateral local-currency swap agreements",
    sourceUrl: PBOC_URL,
    note: "The end-2025 table publishes the agreed size. Drawings are not split by counterparty.",
    endpoint: iso === "EUR" ? ECB_ENDPOINT : undefined,
    alsoShowOn: iso === "EUR" ? euroMembers : undefined,
    ...extra,
  };
}

function fedStanding(iso: string, label: string, endpoint?: Facility["endpoint"]): Facility {
  return {
    id: `fed-${iso.toLowerCase()}`,
    kind: "swap",
    partyA: "USA",
    partyB: iso,
    partyBLabel: label,
    currency: "USD",
    allocation: null,
    drawn: null,
    status: "Standing since 31 Oct 2013",
    asOf: "2013-10-31",
    source: "Federal Reserve standing U.S. dollar liquidity swap lines",
    sourceUrl: FED_URL,
    note: "Standing arrangement with no published cap. The weekly H.4.1 release reports only the network total.",
    endpoint,
    alsoShowOn: iso === "EUR" ? euroMembers : undefined,
  };
}

export const SWAP_LINES: Facility[] = [
  fedStanding("EUR", "European Central Bank", ECB_ENDPOINT),
  fedStanding("GBR", "Bank of England"),
  fedStanding("JPN", "Bank of Japan"),
  fedStanding("CHE", "Swiss National Bank"),
  fedStanding("CAN", "Bank of Canada"),
  {
    id: "nafa-can",
    kind: "swap",
    partyA: "USA",
    partyB: "CAN",
    partyBLabel: "Bank of Canada (NAFA)",
    currency: "USD",
    allocation: 2_000_000_000,
    drawn: 0,
    status: "NAFA, renewed annually",
    asOf: "1994-01-01",
    source: "Federal Reserve, North American Framework Agreement",
    sourceUrl: FED_URL,
    note: "The Federal Reserve states that Canada has never drawn this line. It is separate from the standing dollar swap network.",
  },
  {
    id: "nafa-mex",
    kind: "swap",
    partyA: "USA",
    partyB: "MEX",
    partyBLabel: "Bank of Mexico (NAFA)",
    currency: "USD",
    allocation: 3_000_000_000,
    drawn: 0,
    status: "NAFA, renewed annually",
    asOf: "1995-01-01",
    source: "Federal Reserve, North American Framework Agreement",
    sourceUrl: FED_URL,
    note: "The Federal Reserve states that Mexico last used this line in 1995.",
  },
  {
    id: "esf-mex",
    kind: "swap",
    partyA: "USA",
    partyB: "MEX",
    partyBLabel: "Mexico (U.S. Treasury ESF)",
    currency: "USD",
    allocation: 9_000_000_000,
    drawn: null,
    status: "Treasury ESF line",
    asOf: "2018-01-01",
    source: "Federal Reserve description of the U.S. Treasury NAFA swap line",
    sourceUrl: FED_URL,
    note: "U.S. Treasury Exchange Stabilization Fund line, increased to $9 billion in 2018. Current drawings are not published on the Fed liquidity-swap page.",
  },
  pboc("HKG", "Hong Kong Monetary Authority", 8000),
  pboc("KOR", "Bank of Korea", 4000),
  pboc("IDN", "Bank Indonesia", 4000),
  pboc("EUR", "European Central Bank", 3500),
  pboc("GBR", "Bank of England", 3500),
  pboc("SGP", "Monetary Authority of Singapore", 3000),
  pboc("CAN", "Bank of Canada", 2000),
  pboc("AUS", "Reserve Bank of Australia", 2000),
  pboc("JPN", "Bank of Japan", 2000),
  pboc("BRA", "Central Bank of Brazil", 1900),
  pboc("MYS", "Bank Negara Malaysia", 2200, {
    status: "Renewed and expanded",
    asOf: "2026-08-07",
    source: "Bank Negara Malaysia announcement, reported by The Star",
    sourceUrl:
      "https://www.thestar.com.my/business/business-news/2026/08/07/bnm-pboc-renew-and-expand-bilateral-currency-swap-arrangement",
    note: "Expanded to RMB 220 billion from the RMB 180 billion shown in the PBoC end-2025 table. Drawing not disclosed.",
  }),
  pboc("CHE", "Swiss National Bank", 1500),
  pboc("RUS", "Central Bank of Russia", 1500),
  pboc("ARG", "Central Bank of Argentina", 1300, {
    drawn: 35_000_000_000,
    status: "In force, activated tranche reported",
    asOf: "2026-08-06",
    source: "Central Bank of Argentina renewal, reported by the Buenos Aires Herald",
    sourceUrl: "https://buenosairesherald.com/economics/argentinas-central-bank-renews-currency-swap-with-china",
    note: "Allocation remains RMB 130 billion. The BCRA said the activated RMB 35 billion tranche remains in effect.",
  }),
  pboc("THA", "Bank of Thailand", 700),
  pboc("MAC", "Monetary Authority of Macao", 500),
  pboc("CHL", "Central Bank of Chile", 500),
  pboc("SAU", "Saudi Central Bank", 500),
  pboc("HUN", "Central Bank of Hungary", 400),
  pboc("QAT", "Qatar Central Bank", 350),
  pboc("TUR", "Central Bank of Turkey", 350),
  pboc("ARE", "Central Bank of the UAE", 350),
  pboc("ZAF", "South African Reserve Bank", 300),
  pboc("PAK", "State Bank of Pakistan", 300),
  pboc("NZL", "Reserve Bank of New Zealand", 250),
  pboc("EGY", "Central Bank of Egypt", 180),
  pboc("MNG", "Bank of Mongolia", 150),
  pboc("NGA", "Central Bank of Nigeria", 150),
  pboc("LKA", "Central Bank of Sri Lanka", 100),
  pboc("LAO", "Bank of the Lao PDR", 60),
  pboc("ISL", "Central Bank of Iceland", 35),
  pboc("MUS", "Bank of Mauritius", 20),
];

const pbocParties = SWAP_LINES.filter((line) => line.id.startsWith("pboc-")).flatMap((line) => [
  line.partyB,
  ...(line.alsoShowOn ?? []),
]);

export const NETWORK_TOTALS: NetworkTotal[] = [
  {
    id: "fed-outstanding",
    title: "Federal Reserve dollar liquidity swaps, all counterparties",
    amount: 169_000_000,
    currency: "USD",
    asOf: "2026-11-04",
    source: "Federal Reserve H.4.1, Wednesday level",
    sourceUrl: H41_URL,
    note: "This is the network total. H.4.1 does not name the drawing counterparties, so those lines stay blank.",
    showOn: ["USA", "CAN", "GBR", "JPN", "CHE", ...euroMembers],
  },
  {
    id: "pboc-outstanding",
    title: "PBoC local-currency swaps drawn by overseas central banks",
    amount: 94_200_000_000,
    currency: "CNY",
    asOf: "2025-12-31",
    source: "People's Bank of China, outstanding RMB drawings",
    sourceUrl: PBOC_URL,
    note: "Aggregate undrawn-maturity balance of RMB 94.2 billion. It is not a full allocation of the network, and it is not split by counterparty except where a counterparty has published its own drawing.",
    showOn: ["CHN", ...new Set(pbocParties.filter((code) => code !== "EUR"))],
  },
];

export function imfFacilities(imf: DashboardFile["imf"]): Facility[] {
  if (!imf) return [];
  return imf.rows
    .filter((row) => row.totalSdr > 0)
    .map((row) => ({
      id: `imf-${row.iso3.toLowerCase()}`,
      kind: "imf" as const,
      partyA: row.iso3,
      partyB: "IMF",
      partyBLabel: "International Monetary Fund",
      currency: "SDR",
      allocation: null,
      drawn: row.totalSdr,
      status: "Credit outstanding",
      asOf: imf.asOf,
      source: "IMF credit outstanding by member",
      sourceUrl: imf.sourceUrl,
      note: `GRA ${row.graSdr.toLocaleString("en-US")} SDR, PRGT ${row.prgtSdr.toLocaleString("en-US")} SDR, RST ${row.rstSdr.toLocaleString("en-US")} SDR. The outstanding-credit table does not publish the undrawn access limit.`,
      endpoint: IMF_ENDPOINT,
    }));
}

export function allFacilities(imf: DashboardFile["imf"]): Facility[] {
  return [...SWAP_LINES, ...imfFacilities(imf)];
}

export function facilitiesFor(iso3: string, facilities: Facility[]): Facility[] {
  return facilities.filter(
    (facility) =>
      facility.partyA === iso3 || facility.partyB === iso3 || facility.alsoShowOn?.includes(iso3),
  );
}

export function networksFor(iso3: string | null, regionMembers: string[] | null): NetworkTotal[] {
  return NETWORK_TOTALS.filter((total) => {
    if (iso3) return total.showOn.includes(iso3);
    if (regionMembers) return total.showOn.some((code) => regionMembers.includes(code));
    return true;
  });
}
