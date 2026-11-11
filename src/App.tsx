import { useEffect, useMemo, useState } from "react";
import { readSession, signOut, type Session } from "./auth/session";
import { CountryBoard } from "./components/CountryBoard";
import { DataUpdate } from "./components/DataUpdate";
import { Globe } from "./components/Globe";
import { Hud } from "./components/Hud";
import { Login } from "./components/Login";
import { FOCUS } from "./data/coverage";
import { allFacilities } from "./data/facilities";
import { scoreHex } from "./lib/color";
import { summarize } from "./score/aggregate";
import { scoreCountry } from "./score/earlyWarning";
import { availableYears } from "./score/series";
import type { DashboardFile, IndicatorId, LayerId } from "./types";

export function App() {
  const [session, setSession] = useState<Session | null>(() => readSession());
  if (!session) return <Login onLogin={setSession} />;
  return (
    <Dashboard
      session={session}
      onSignOut={() => {
        signOut();
        setSession(null);
      }}
    />
  );
}

function Dashboard({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const [dashboard, setDashboard] = useState<DashboardFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [layer, setLayer] = useState<LayerId>("warning");
  const [indicatorId, setIndicatorId] = useState<IndicatorId>("reservesMonths");
  const [regionId, setRegionId] = useState<string | null>(null);
  const [iso3, setIso3] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    fetch("/dashboard.json", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`dashboard.json returned ${response.status}`);
        return response.json() as Promise<DashboardFile>;
      })
      .then(setDashboard)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Could not load dashboard.json");
      });
  }, []);

  const years = useMemo(() => availableYears(dashboard?.countries ?? []), [dashboard]);
  const readingYear = year ?? years[years.length - 1] ?? 2024;

  const countries = useMemo(() => {
    return (dashboard?.countries ?? [])
      .filter((country) => FOCUS.has(country.iso3))
      .map((country) => ({
        ...country,
        score: scoreCountry(country.series, readingYear),
      }));
  }, [dashboard, readingYear]);

  const facilities = useMemo(() => allFacilities(dashboard?.imf ?? null), [dashboard]);
  const regions = useMemo(() => {
    const names = new Map<string, string>();
    for (const country of countries) names.set(country.regionId, country.regionName);
    return [...names.entries()]
      .map(([id, name]) => ({ id, name, summary: summarize(countries, id, readingYear) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [countries, readingYear]);

  const globalSummary = useMemo(() => summarize(countries, null, readingYear), [countries, readingYear]);
  const selected = countries.find((country) => country.iso3 === iso3) ?? null;

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return countries
      .filter((country) => country.name.toLowerCase().includes(needle) || country.iso3.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [countries, query]);

  const camera = useMemo(() => {
    if (selected?.longitude != null && selected.latitude != null) {
      return { kind: "country" as const, longitude: selected.longitude, latitude: selected.latitude };
    }
    if (regionId) {
      const placed = countries.filter(
        (country) => country.regionId === regionId && country.longitude != null && country.latitude != null,
      );
      if (placed.length > 0) {
        const longitude = placed.reduce((sum, country) => sum + (country.longitude ?? 0), 0) / placed.length;
        const latitude = placed.reduce((sum, country) => sum + (country.latitude ?? 0), 0) / placed.length;
        return { kind: "region" as const, longitude, latitude };
      }
    }
    return { kind: "world" as const };
  }, [selected, regionId, countries]);

  function openCountry(next: string) {
    const country = countries.find((item) => item.iso3 === next);
    if (regionId && country && country.regionId !== regionId) setRegionId(null);
    setIso3(next);
    setQuery("");
  }

  if (error) {
    return (
      <main className="boot">
        <h1>FX Watch</h1>
        <p>The dashboard snapshot is not available ({error}).</p>
        <p>From the project folder, run `npm run fetch-data` and then `npm run dev`.</p>
      </main>
    );
  }

  if (!dashboard) {
    return (
      <main className="boot">
        <h1>FX Watch</h1>
        <p>Loading the indicator snapshot…</p>
      </main>
    );
  }

  return (
    <main className="stage">
      <Globe
        countries={countries}
        facilities={facilities}
        layer={layer}
        indicatorId={indicatorId}
        regionId={regionId}
        selectedIso={iso3}
        year={readingYear}
        camera={camera}
        onPick={openCountry}
      />
      <Hud
        role={session.role}
        global={globalSummary}
        regions={regions}
        regionId={regionId}
        years={years}
        year={readingYear}
        layer={layer}
        query={query}
        results={results}
        onQuery={setQuery}
        onYear={setYear}
        onLayer={setLayer}
        onRegion={(next) => {
          setRegionId(next);
          setIso3(null);
        }}
        onSelect={openCountry}
        onSignOut={onSignOut}
        onUpload={() => setUploadOpen(true)}
      />
      {selected && (
        <CountryBoard
          country={selected}
          year={readingYear}
          layer={layer}
          indicatorId={indicatorId}
          facilities={facilities}
          reerSource={dashboard.reerSource}
          onLayer={setLayer}
          onIndicator={(id) => {
            setIndicatorId(id);
            setLayer("indicators");
          }}
          onClose={() => setIso3(null)}
        />
      )}
      <footer className="foot">
        <Legend layer={layer} summaryScore={globalSummary.score} />
        <div className="method">
          <p>Scale: contained is 0–33, watch is 34–66, and severe is 67–100. The figure is an equal-weight average of the signals available that quarter, and a country needs four of them.</p>
          <p>
            Reserve cover is calm at 6 months of goods imports and maxed at 1. Short-term debt is calm at 40% of reserves and maxed at 150%; it is an annual number held from the fourth quarter. The current account is calm at a deficit of 2% of GDP and maxed at 8%. Depreciation over four quarters is calm at 5% and maxed at 40%. Inflation is calm at 3% and maxed at 25%. Real GDP growth is calm at 2% and maxed at a contraction of 6%. This is not a forecast.
          </p>
        </div>
      </footer>
      {uploadOpen && session.role === "admin" && (
        <DataUpdate
          dashboard={{ ...dashboard, countries: dashboard.countries.filter((country) => FOCUS.has(country.iso3)) }}
          onClose={() => setUploadOpen(false)}
          onApplied={(file) => {
            setDashboard(file);
            setYear(null);
          }}
        />
      )}
    </main>
  );
}

function Legend({ layer, summaryScore }: { layer: LayerId; summaryScore: number | null }) {
  if (layer === "warning") {
    return (
      <div>
        <p>Early warning</p>
        <p className="swatch">
          <i style={{ background: scoreHex(10) }} /> contained
          <i style={{ background: scoreHex(50) }} /> watch
          <i style={{ background: scoreHex(85) }} /> severe
        </p>
        <p>Global score {summaryScore ?? "—"}</p>
      </div>
    );
  }
  if (layer === "cooperation") {
    return (
      <div>
        <p>Cooperation</p>
        <p className="swatch">
          <i style={{ background: "#e0a106" }} /> disclosed drawing
          <i style={{ background: "#3d7ea6" }} /> line, drawing unpublished
        </p>
        <p>Dashed arcs have no published cap. Thickness is a rough scale, not a market rate.</p>
      </div>
    );
  }
  return (
    <div>
      <p>Indicator percentile</p>
      <p className="swatch">
        <i style={{ background: "#1d4e89" }} /> calmer
        <i style={{ background: "#e0a106" }} />
        <i style={{ background: "#c4473a" }} /> more stressed
      </p>
    </div>
  );
}
