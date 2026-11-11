import { INDICATORS } from "../data/indicators";
import { facilitiesFor, networksFor } from "../data/facilities";
import { formatMoney, formatNumber } from "../lib/format";
import { METHODOLOGY } from "../score/earlyWarning";
import { asOf, formatPeriod } from "../score/series";
import type { Facility, IndicatorId, LayerId, NetworkTotal, ScoredCountry } from "../types";

type CountryBoardProps = {
  country: ScoredCountry;
  year: number;
  layer: LayerId;
  indicatorId: IndicatorId;
  facilities: Facility[];
  reerSource: string | null;
  onLayer: (layer: LayerId) => void;
  onIndicator: (id: IndicatorId) => void;
  onClose: () => void;
};

const LAYERS: { id: LayerId; label: string }[] = [
  { id: "indicators", label: "Economy" },
  { id: "cooperation", label: "Swap lines" },
  { id: "warning", label: "Early warning" },
];

export function CountryBoard(props: CountryBoardProps) {
  return (
    <div className="board-anchor">
      <article className="board" aria-label={`${props.country.name} detail`}>
        <header className="board-head">
          <div>
            <p className="eyebrow">
              {props.country.iso3} · {props.country.regionName}
            </p>
            <h2>{props.country.name}</h2>
            <p className="muted">Reading {formatPeriod(props.year)}</p>
          </div>
          <button type="button" className="board-close" onClick={props.onClose}>
            Close
          </button>
        </header>
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
        {props.layer === "indicators" && <Indicators {...props} />}
        {props.layer === "cooperation" && <Cooperation {...props} />}
        {props.layer === "warning" && <Warning {...props} />}
      </article>
    </div>
  );
}

function Indicators({ country, year, indicatorId, onIndicator, reerSource }: CountryBoardProps) {
  return (
    <div className="stack">
      <ul className="series">
        {INDICATORS.map((meta) => {
          const point = asOf(country.series[meta.id], year);
          return (
            <li key={meta.id}>
              <button type="button" className={indicatorId === meta.id ? "on" : ""} onClick={() => onIndicator(meta.id)}>
                <span>
                  <strong>{meta.label}</strong>
                  <small>{meta.detail}</small>
                </span>
                <span className="reading">
                  {point ? (
                    <>
                      <b>{formatIndicator(meta.id, point.value)}</b>
                      <small>
                        {formatPeriod(point.year)} · {meta.unit}
                      </small>
                    </>
                  ) : (
                    <small>No observation by {year}</small>
                  )}
                  {country.series[meta.id] && <Sparkline series={country.series[meta.id]!} year={year} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {indicatorId === "reerGap" && !reerSource && (
        <p className="muted">This refresh did not include a BIS real effective exchange rate file.</p>
      )}
    </div>
  );
}

function Cooperation({ country, facilities }: CountryBoardProps) {
  const totals = networksFor(country.iso3, null);
  const rows = facilitiesFor(country.iso3, facilities);
  return (
    <div className="stack">
      <p>
        Allocation is the published line size or, where no cap is published, left blank. Drawn is filled only when a
        source names the amount. A blank is not a zero. Swap lines are the current registry, not a historical series.
      </p>
      {totals.map((total) => (
        <NetworkCard key={total.id} total={total} />
      ))}
      {rows.length === 0 && <p>No swap line in this registry for {country.name}.</p>}
      <ul className="facilities">
        {rows.map((facility) => (
          <li key={facility.id}>
            <div className="facility-head">
              <strong>{facilityLabel(facility, country.iso3)}</strong>
              <span>{facility.kind === "imf" ? "IMF" : "Swap"}</span>
            </div>
            <p>
              Allocation {facility.allocation == null ? "not published" : formatMoney(facility.allocation, facility.currency)}
              {" · "}
              Drawn {facility.drawn == null ? "not published" : formatMoney(facility.drawn, facility.currency)}
            </p>
            <p className="muted">
              {facility.status} · as of {facility.asOf}
            </p>
            {facility.note && <p className="muted">{facility.note}</p>}
            <a href={facility.sourceUrl} target="_blank" rel="noreferrer">
              {facility.source}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NetworkCard({ total }: { total: NetworkTotal }) {
  return (
    <article className="callout">
      <h3>{total.title}</h3>
      <p className="reading-lg">
        {formatMoney(total.amount, total.currency)} <small>as of {total.asOf}</small>
      </p>
      <p className="muted">{total.note}</p>
      <a href={total.sourceUrl} target="_blank" rel="noreferrer">
        {total.source}
      </a>
    </article>
  );
}

function Warning({ country }: CountryBoardProps) {
  const score = country.score;
  return (
    <div className="stack">
      <p className={`band ${score.band}`}>
        {score.value ?? "—"} · {score.band}
      </p>
      {score.components.length === 0 ? (
        <p>No score inputs were published for this country in the selected year.</p>
      ) : (
        <ul className="components">
          {score.components.map((component) => (
            <li key={component.id}>
              <div>
                <strong>{component.label}</strong>
                <small>
                  {formatIndicator(component.id, component.raw)} · {formatPeriod(component.year)}
                </small>
              </div>
              <div className="bar">
                <span style={{ width: `${component.stress}%` }} />
              </div>
              <b>{Math.round(component.stress)}</b>
            </li>
          ))}
        </ul>
      )}
      {score.band === "insufficient" && <p>Fewer than four signals are available, so this country is left unscored.</p>}
      <details>
        <summary>How the score is built</summary>
        {METHODOLOGY.map((line) => (
          <p key={line} className="muted">
            {line}
          </p>
        ))}
      </details>
    </div>
  );
}

function Sparkline({ series, year }: { series: { year: number; value: number }[]; year: number }) {
  const points = [...series].sort((a, b) => a.year - b.year);
  if (points.length < 2) return null;
  const width = 88;
  const height = 28;
  const min = Math.min(...points.map((point) => point.value));
  const max = Math.max(...points.map((point) => point.value));
  const span = max - min || 1;
  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((point.value - min) / span) * (height - 4) - 2;
    return { x, y, marked: point.year === year || (point.year < year && points[index + 1]?.year > year) };
  });
  const active = [...coords].reverse().find((point) => point.marked) ?? coords[coords.length - 1];
  return (
    <svg className="spark" width={width} height={height} aria-hidden="true">
      <polyline points={coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")} />
      {active && <circle cx={active.x} cy={active.y} r="2.4" />}
    </svg>
  );
}

function formatIndicator(id: IndicatorId, value: number): string {
  if (id === "gdpUsd") return formatMoney(value, "USD");
  const digits = id === "shortTermDebtToReserves" ? 0 : 1;
  return formatNumber(value, digits);
}

function facilityLabel(facility: Facility, iso3: string): string {
  if (facility.partyA === iso3) return facility.partyBLabel;
  if (facility.partyB === iso3 || facility.alsoShowOn?.includes(iso3)) {
    return facility.partyA === "CHN" ? `People's Bank of China · ${facility.partyBLabel}` : `United States · ${facility.partyBLabel}`;
  }
  return facility.partyBLabel;
}
