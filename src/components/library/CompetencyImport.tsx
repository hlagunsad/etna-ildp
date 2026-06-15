"use client";

import { getSupabase } from "@/lib/supabase";
import { loadLibrary } from "@/lib/queries";
import { mapCompetencyRow } from "@/lib/import";
import { friendlyDbError } from "@/lib/library";
import { writeAudit } from "@/lib/useCrud";
import CsvImport, { type RowResult } from "../import/CsvImport";

const HEADERS = ["code", "name", "description", "category", "comp_group", "scale"];
const SAMPLE = ["NICS-EXAMPLE", "Example Competency", "What this competency covers", "Core ICT", "technical", "DICT NICS 3-Tier"];

export default function CompetencyImport() {
  async function importCompetencies(rows: Record<string, string>[]): Promise<RowResult[]> {
    const sb = getSupabase();
    const lib = await loadLibrary();
    const scaleIdByName = new Map(lib.scales.map((s) => [s.name.toLowerCase(), s.id]));
    const seen = new Set(lib.competencies.map((c) => c.code.toLowerCase()));

    const results: RowResult[] = [];
    let line = 1; // header is line 1
    for (const row of rows) {
      line += 1;
      const label = (row.code ?? "").trim() || "(no code)";
      const mapped = mapCompetencyRow(row, { scaleIdByName });
      if (!mapped.ok) {
        results.push({ line, label, status: "error", message: mapped.error });
        continue;
      }
      const key = mapped.payload.code.toLowerCase();
      if (seen.has(key)) {
        results.push({ line, label, status: "skipped", message: "A competency with that code already exists" });
        continue;
      }
      const { data, error } = await sb.from("competency").insert(mapped.payload as never).select("id").single();
      if (error) {
        results.push({ line, label, status: "error", message: friendlyDbError(error as { code?: string; message: string }) });
        continue;
      }
      seen.add(key);
      await writeAudit("create", "competency", (data as { id: string } | null)?.id, null, mapped.payload);
      results.push({ line, label, status: "created" });
    }
    return results;
  }

  return (
    <CsvImport
      testId="competency-import"
      title="Import competencies"
      hint="Columns: code, name, scale (required), then description, category, comp_group (core / common / technical). Scale is matched by name. Existing codes are skipped."
      templateHeaders={HEADERS}
      sampleRow={SAMPLE}
      onImport={importCompetencies}
    />
  );
}
