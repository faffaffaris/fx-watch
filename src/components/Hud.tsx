import { scoreHex } from "../lib/color";
import { formatPeriod } from "../score/series";
import type { ScopeSummary } from "../score/aggregate";
import type { Role } from "../auth/session";
import type { LayerId, ScoredCountry } from "../types";

const SHORT_REGION: Record<string, string> = {
  EAS: "East Asia & Pacific",
  ECS: "Europe & Central Asia",
  LCN: "Latin America",
  MEA: "Middle East & N. Africa",
  NAC: "North America",
  SAS: "South Asia",
  SSF: "Sub-Saharan Africa",
};

const LAYERS: { id: LayerId; label: string }[] = [
  { id: "warning", label: "Early warning" },
  { id: "indicators", label: "Indicators" },
  { id: "cooperation", label: "Swap lines" },
];

type RegionScore = { id: string; name: string; summary: ScopeSummary };

type HudProps = {
  role: Role;
  global: ScopeSummary;
  regions: RegionScore[];
  regionId: string | null;
  years: number[];
  year: number;
  layer: LayerId;
  query: string;
  results: ScoredCountry[];
  onQuery: (value: string) => void;
  onYear: (year: number) => void;
  onLayer: (layer: LayerId) => void;
  onRegion: (regionId: string | null) => void;
  onSelect: (iso3: string) => void;
  onSignOut: () => void;
  onUpload: () => void;
};

export function Hud(props: HudProps) {
  return (
    <header className="hud">
      <div className="hud-title">
        <p className="eyebrow">Macro spatial</p>
        <h1>FX Watch</h1>
        <label className="search">
          <span className="sr">Country</span>
          <input
            value={props.query}
            placeholder="Search a country"
            onChange={(event) => props.onQuery(event.target.value)}
          />
        </label>
        {props.results.length > 0 && (
          <ul className="results hud-results">
            {props.results.map((country) => (
              <li key={country.iso3}>
                <button type="button" onClick={() => props.onSelect(country.iso3)}>
                  <strong>{country.name}</strong>
                  <span>{country.iso3}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="hud-scores">
        <button
          type="button"
          className={props.regionId == null ? "global-score on" : "global-score"}
          onClick={() => props.onRegion(null)}
        >
          <span>G20 and ASEAN</span>
          <strong style={{ color: props.global.score == null ? undefined : scoreHex(props.global.score) }}>
            {props.global.score ?? "—"}
          </strong>
          <small>GDP-weighted</small>
        </button>
        <div className="region-row">
          {props.regions.map((region) => (
            <button
              key={region.id}
              type="button"
              className={props.regionId === region.id ? "on" : ""}
              onClick={() => props.onRegion(props.regionId === region.id ? null : region.id)}
            >
              <span>{SHORT_REGION[region.id] ?? region.name}</span>
              <b style={{ color: region.summary.score == null ? undefined : scoreHex(region.summary.score) }}>
                {region.summary.score ?? "—"}
              </b>
            </button>
          ))}
        </div>
      </div>
      <div className="hud-tools">
        <div className="tabs" role="tablist">
          {LAYERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={props.layer === item.id}
              className={props.layer === item.id ? "on" : ""}
              onClick={() => props.onLayer(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="year-slider">
          <span>
            Quarter <b>{formatPeriod(props.year)}</b>
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(props.years.length - 1, 0)}
            step={1}
            value={Math.max(props.years.indexOf(props.year), 0)}
            disabled={props.years.length < 2}
            onChange={(event) => props.onYear(props.years[Number(event.target.value)] ?? props.year)}
          />
        </label>
        <div className="hud-actions">
          {props.role === "admin" && (
            <button type="button" onClick={props.onUpload}>
              Update data
            </button>
          )}
          <button type="button" onClick={props.onSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
