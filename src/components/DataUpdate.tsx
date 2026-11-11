import { useMemo, useState } from "react";
import { INDICATORS } from "../data/indicators";
import { applyEdits, cellValue, writeCell, writeCountryField, yearsFor } from "../data/sheet";
import { formatPeriod } from "../score/series";
import { downloadIndicatorCsv, downloadWorkbook, parseUpload } from "../data/workbook";
import type { DashboardFile, IndicatorId } from "../types";

export function DataUpdate({
  dashboard,
  onClose,
  onApplied,
}: {
  dashboard: DashboardFile;
  onClose: () => void;
  onApplied: (file: DashboardFile) => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(dashboard));
  const [indicator, setIndicator] = useState<IndicatorId>("inflation");
  const [sheet, setSheet] = useState<"indicators" | "imf">("indicators");
  const [query, setQuery] = useState("");
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<{ key: string; raw: string } | null>(null);
  const years = useMemo(() => yearsFor(draft, indicator), [draft, indicator]);
  const meta = INDICATORS.find((item) => item.id === indicator)!;
  const needle = query.trim().toLowerCase();
  const countries = draft.countries
    .filter((country) => !needle || country.name.toLowerCase().includes(needle) || country.iso3.toLowerCase().includes(needle))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const imfRows = (draft.imf?.rows ?? []).filter((row) => !needle || row.iso3.toLowerCase().includes(needle));

  function editCell(iso3: string, year: number, raw: string) {
    setDraft((current) => {
      const next = structuredClone(current);
      try {
        writeCell(next, iso3, indicator, year, raw);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "That cell is not a number.");
        return current;
      }
      return next;
    });
    setDirty(true);
    setMessage(null);
  }

  function editImf(iso3: string, field: "graSdr" | "prgtSdr" | "rstSdr" | "totalSdr", raw: string) {
    const value = Number(raw.trim().replace(/,/g, ""));
    if (!Number.isFinite(value)) {
      setMessage(`${iso3} ${field} is not a number.`);
      return;
    }
    setDraft((current) => {
      const next = structuredClone(current);
      const row = next.imf?.rows.find((item) => item.iso3 === iso3);
      if (!row) return current;
      row[field] = value;
      if (field !== "totalSdr") row.totalSdr = row.graSdr + row.prgtSdr + row.rstSdr;
      return next;
    });
    setDirty(true);
    setMessage(null);
  }

  function editField(iso3: string, field: "name" | "regionId" | "regionName", raw: string) {
    setDraft((current) => {
      const next = structuredClone(current);
      writeCountryField(next, iso3, field, raw);
      return next;
    });
    setDirty(true);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    try {
      const parsed = parseUpload(await file.arrayBuffer(), indicator);
      if (parsed.indicatorEdits.length === 0 && parsed.imfEdits.length === 0) {
        throw new Error(parsed.issues[0]?.message ?? "No rows matched the sheet layout.");
      }
      setDraft((current) => applyEdits(current, parsed));
      setDirty(true);
      const skipped = parsed.issues.length > 0 ? ` ${parsed.issues.length} row${parsed.issues.length === 1 ? "" : "s"} skipped.` : "";
      setMessage(
        `Loaded ${parsed.indicatorEdits.length} indicator cells and ${parsed.imfEdits.length} IMF rows.${skipped} Publish to save them.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not read that file.");
    }
  }

  async function publish() {
    setPending(true);
    setMessage(null);
    const payload = { ...draft, generatedAt: new Date().toISOString() };
    try {
      const response = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "content-type": "application/json", "x-fx-role": "admin" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error((await response.text()) || `Save failed (${response.status})`);
      onApplied(payload);
      setDirty(false);
      setMessage(`Published ${payload.countries.length} countries.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not publish the sheet.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="desk">
      <header className="desk-bar">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Indicator sheet</h2>
        </div>
        <label>
          <span className="sr">Sheet</span>
          <select value={sheet} onChange={(event) => setSheet(event.target.value as "indicators" | "imf")}>
            <option value="indicators">Indicators</option>
            <option value="imf">IMF credit</option>
          </select>
        </label>
        {sheet === "indicators" && (
          <label>
            <span className="sr">Indicator</span>
            <select value={indicator} onChange={(event) => setIndicator(event.target.value as IndicatorId)}>
              {INDICATORS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className="sr">Find a country</span>
          <input value={query} placeholder="Find a country" onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="desk-actions">
          <button type="button" onClick={() => downloadIndicatorCsv(draft, indicator)}>
            Download CSV
          </button>
          <button type="button" onClick={() => downloadWorkbook(draft)}>
            Download Excel
          </button>
          <label className="upload-inline">
            Upload CSV or Excel
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
          </label>
          <button type="button" disabled={!dirty || pending} onClick={() => void publish()}>
            {pending ? "Publishing…" : "Publish"}
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </header>
      <p className="desk-note">
        {sheet === "indicators"
          ? `${meta.label} (${meta.unit}). A blank cell removes that year. An upload updates matching countries and leaves every other cell as it is.`
          : "IMF credit outstanding, in SDR. Upload a sheet named imf with iso3, gra_sdr, prgt_sdr, rst_sdr, and total_sdr."}
        {message ? ` ${message}` : ""}
      </p>
      <div className="sheet-scroll">
        {sheet === "indicators" ? (
          <table className="sheet">
            <thead>
              <tr>
                <th>ISO</th>
                <th>Country</th>
                <th>Region</th>
                {years.map((year) => (
                  <th key={year}>{formatPeriod(year)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {countries.map((country) => (
                <tr key={country.iso3}>
                  <td className="iso">{country.iso3}</td>
                  <td>
                    <input value={country.name} onChange={(event) => editField(country.iso3, "name", event.target.value)} />
                  </td>
                  <td>
                    <input
                      value={country.regionName}
                      onChange={(event) => editField(country.iso3, "regionName", event.target.value)}
                    />
                  </td>
                  {years.map((year) => {
                    const key = `${country.iso3}:${year}`;
                    const stored = cellValue(draft, country.iso3, indicator, year);
                    return (
                      <td key={year}>
                        <input
                          inputMode="decimal"
                          value={editing?.key === key ? editing.raw : displayNumber(stored)}
                          onFocus={() => setEditing({ key, raw: stored })}
                          onChange={(event) => setEditing({ key, raw: event.target.value })}
                          onBlur={() => {
                            if (editing?.key === key) editCell(country.iso3, year, editing.raw);
                            setEditing(null);
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="sheet">
            <thead>
              <tr>
                <th>ISO</th>
                <th>GRA</th>
                <th>PRGT</th>
                <th>RST</th>
                <th>Total SDR</th>
              </tr>
            </thead>
            <tbody>
              {imfRows.map((row) => (
                <tr key={row.iso3}>
                  <td className="iso">{row.iso3}</td>
                  {(["graSdr", "prgtSdr", "rstSdr", "totalSdr"] as const).map((field) => (
                    <td key={field}>
                      <input inputMode="decimal" value={String(row[field])} onChange={(event) => editImf(row.iso3, field, event.target.value)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function displayNumber(raw: string): string {
  if (raw === "") return "";
  const value = Number(raw);
  if (!Number.isFinite(value)) return raw;
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 1 : abs >= 100 ? 2 : 3;
  return String(Number(value.toFixed(digits)));
}
