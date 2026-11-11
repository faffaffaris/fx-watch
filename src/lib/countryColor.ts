import { facilitiesFor } from "../data/facilities";
import { INDICATOR_MAP } from "../data/indicators";
import { heatHex, percentile, scoreHex } from "./color";
import { asOf } from "../score/series";
import type { Facility, IndicatorId, LayerId, ScoredCountry } from "../types";

const MISSING = "#334155";

export function countryFill(
  country: ScoredCountry,
  layer: LayerId,
  indicatorId: IndicatorId,
  regionId: string | null,
  facilities: Facility[],
  peerValues: number[],
  year: number,
): { hex: string; alpha: number } {
  const outside = regionId != null && country.regionId !== regionId;
  const alpha = outside ? 0.14 : 0.72;

  if (layer === "warning") {
    if (country.score.value == null) return { hex: MISSING, alpha: outside ? 0.1 : 0.38 };
    return { hex: scoreHex(country.score.value), alpha };
  }

  if (layer === "cooperation") {
    const rows = facilitiesFor(country.iso3, facilities);
    const active =
      rows.some((row) => row.drawn != null && row.drawn > 0) ||
      (country.iso3 === "USA" && rows.some((row) => row.id.startsWith("fed-")));
    if (active) return { hex: "#e0a106", alpha };
    if (rows.length > 0) return { hex: "#3d7ea6", alpha };
    return { hex: MISSING, alpha: outside ? 0.1 : 0.34 };
  }

  const point = asOf(country.series[indicatorId], year);
  if (!point || peerValues.length === 0) return { hex: MISSING, alpha: outside ? 0.1 : 0.38 };
  const rank = percentile(point.value, peerValues);
  const heat = INDICATOR_MAP[indicatorId].warmWhen === "high" ? rank : 1 - rank;
  return { hex: heatHex(heat), alpha };
}
