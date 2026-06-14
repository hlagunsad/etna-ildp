"use client";

import { useState } from "react";
import { parseCsv } from "@/lib/csv";
import { toCsv } from "@/lib/reporting";
import { Button, Card, Pill, inputClass } from "../ui";

export type RowResult = {
  line: number;
  label: string;
  status: "created" | "updated" | "skipped" | "error";
  message?: string;
};

const STATUS_TONE: Record<RowResult["status"], "success" | "warn" | "danger"> = {
  created: "success",
  updated: "success",
  skipped: "warn",
  error: "danger",
};

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Entity-agnostic CSV import: download a template, upload or paste a CSV, preview
 * the parsed rows, then run `onImport` and render a per-row result table. Knows
 * nothing about the entity — all validation lives in the caller's `onImport`.
 */
export default function CsvImport({
  title,
  hint,
  templateHeaders,
  sampleRow,
  onImport,
  testId,
}: {
  title: string;
  hint: string;
  templateHeaders: string[];
  sampleRow: string[];
  onImport: (rows: Record<string, string>[]) => Promise<RowResult[]>;
  testId: string;
}) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeText(value: string) {
    setText(value);
    setParsed(null);
    setResults(null);
    setError(null);
  }

  function preview() {
    setError(null);
    setResults(null);
    const p = parseCsv(text);
    setParsed(p);
    if (p.rows.length === 0) setError("No data rows found — include a header row and at least one row.");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    changeText(await file.text());
  }

  async function runImport() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      setResults(await onImport(parsed.rows));
    } catch (err) {
      setResults([{ line: 0, label: "—", status: "error", message: err instanceof Error ? err.message : "Import failed" }]);
    }
    setBusy(false);
  }

  const missingHeaders = parsed ? templateHeaders.filter((h) => !parsed.headers.includes(h)) : [];
  const summary = results
    ? (["created", "updated", "skipped", "error"] as const)
        .map((s) => ({ s, n: results.filter((r) => r.status === s).length }))
        .filter((x) => x.n > 0)
    : [];

  return (
    <Card className="p-5 sm:p-6" data-testid={testId}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <p className="mt-1 max-w-prose text-xs text-muted">{hint}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => downloadCsv(`${testId}-template.csv`, toCsv(templateHeaders, [sampleRow]))}>
          Download template
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor={`${testId}-file`} className="mb-1 block text-sm font-medium text-ink">Upload a .csv</label>
          <input
            id={`${testId}-file`}
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-chip file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-brand-50"
          />
        </div>
        <div>
          <label htmlFor={`${testId}-text`} className="mb-1 block text-sm font-medium text-ink">…or paste CSV</label>
          <textarea
            id={`${testId}-text`}
            rows={5}
            className={`${inputClass} font-mono text-xs`}
            value={text}
            onChange={(e) => changeText(e.target.value)}
            placeholder={templateHeaders.join(",")}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={preview} disabled={!text.trim()}>Preview</Button>
          <Button type="button" onClick={runImport} disabled={!parsed || parsed.rows.length === 0 || busy} data-testid={`${testId}-import-btn`}>
            {busy ? "Importing…" : parsed && parsed.rows.length > 0 ? `Import ${parsed.rows.length} row${parsed.rows.length === 1 ? "" : "s"}` : "Import"}
          </Button>
          {error && <span role="alert" className="text-sm text-danger">{error}</span>}
        </div>

        {parsed && parsed.rows.length > 0 && (
          <div className="rounded-xl border border-line p-3 text-xs text-muted">
            <p>{parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"} ready · columns: {parsed.headers.join(", ")}</p>
            {missingHeaders.length > 0 && (
              <p className="mt-1.5"><Pill tone="warn">Missing columns: {missingHeaders.join(", ")}</Pill></p>
            )}
          </div>
        )}

        {results && (
          <div>
            <p role="status" className="mb-2 text-sm font-medium text-ink">{summary.map((x) => `${x.n} ${x.s}`).join(" · ") || "No rows"}</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-faint">
                    <th scope="col" className="pb-2 font-medium">Row</th>
                    <th scope="col" className="pb-2 font-medium">Item</th>
                    <th scope="col" className="pb-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-t border-line align-top">
                      <td className="py-2 tabular-nums text-muted">{r.line || "—"}</td>
                      <td className="py-2 text-ink">{r.label}</td>
                      <td className="py-2">
                        <span className="flex flex-wrap items-center gap-2">
                          <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill>
                          {r.message && <span className="text-xs text-muted">{r.message}</span>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
