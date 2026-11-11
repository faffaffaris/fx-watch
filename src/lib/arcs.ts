import { facilitiesFor } from "../data/facilities";
import type { Facility, ScoredCountry } from "../types";

const ROUGH_USD_PER_UNIT: Record<string, number> = {
  USD: 1,
  CNY: 0.14,
  SDR: 1.33,
};

export type GlobeArc = {
  id: string;
  from: { longitude: number; latitude: number };
  to: { longitude: number; latitude: number };
  kind: Facility["kind"];
  active: boolean;
  uncapped: boolean;
  width: number;
};

function pointFor(
  code: string,
  facility: Facility,
  countries: Map<string, ScoredCountry>,
): { longitude: number; latitude: number } | null {
  if ((code === "EUR" || code === "IMF") && facility.endpoint) {
    return { longitude: facility.endpoint.longitude, latitude: facility.endpoint.latitude };
  }
  const country = countries.get(code);
  if (country?.longitude == null || country.latitude == null) return null;
  return { longitude: country.longitude, latitude: country.latitude };
}

function widthFor(facility: Facility): number {
  if (facility.allocation == null) return 2.4;
  const rate = ROUGH_USD_PER_UNIT[facility.currency] ?? 1;
  const usd = facility.allocation * rate;
  return Math.min(7, Math.max(1.4, Math.log10(Math.max(usd, 1e8)) - 6.2));
}

export function visibleFacilities(
  facilities: Facility[],
  selectedIso: string | null,
  regionMembers: string[] | null,
): Facility[] {
  if (selectedIso) return facilitiesFor(selectedIso, facilities);
  if (!regionMembers) return facilities;
  const members = new Set(regionMembers);
  return facilities.filter(
    (facility) =>
      members.has(facility.partyA) ||
      members.has(facility.partyB) ||
      facility.alsoShowOn?.some((code) => members.has(code)),
  );
}

export function buildArcs(
  facilities: Facility[],
  countries: ScoredCountry[],
  selectedIso: string | null,
  regionMembers: string[] | null,
): GlobeArc[] {
  const byIso = new Map(countries.map((country) => [country.iso3, country]));
  const arcs: GlobeArc[] = [];
  for (const facility of visibleFacilities(facilities, selectedIso, regionMembers)) {
    const from = pointFor(facility.partyA, facility, byIso);
    const to = pointFor(facility.partyB, facility, byIso);
    if (!from || !to) continue;
    arcs.push({
      id: facility.id,
      from,
      to,
      kind: facility.kind,
      active: facility.drawn != null && facility.drawn > 0,
      uncapped: facility.allocation == null,
      width: widthFor(facility),
    });
  }
  return arcs;
}
