"use client";

import { getSupabase } from "@/lib/supabase";
import { loadLibrary } from "@/lib/queries";
import { mapTrainingRow } from "@/lib/import";
import { friendlyDbError } from "@/lib/library";
import { writeAudit } from "@/lib/useCrud";
import CsvImport, { type RowResult } from "../import/CsvImport";

const HEADERS = ["title", "provider", "url", "competency_code", "target_level", "mode", "cost"];
const SAMPLE = ["Intro to Firewalls", "internal", "https://example.com/fw", "NICS-CYBERSEC", "Basic", "online", "0"];

export default function TrainingImport() {
  async function importTraining(rows: Record<string, string>[]): Promise<RowResult[]> {
    const sb = getSupabase();
    const [lib, existing] = await Promise.all([
      loadLibrary(),
      sb.from("training_resource").select("title"),
    ]);
    const competencyByCode = new Map(lib.competencies.map((c) => [c.code.toLowerCase(), { id: c.id, scale_id: c.scale_id }]));
    // title isn't a unique column, so make re-import idempotent with a title pre-check.
    const seen = new Set(((existing.data ?? []) as { title: string | null }[]).map((t) => (t.title ?? "").toLowerCase()));

    const results: RowResult[] = [];
    let line = 1; // header is line 1
    for (const row of rows) {
      line += 1;
      const label = (row.title ?? "").trim() || "(untitled)";
      const mapped = mapTrainingRow(row, { competencyByCode, levels: lib.levels });
      if (!mapped.ok) {
        results.push({ line, label, status: "error", message: mapped.error });
        continue;
      }
      const key = mapped.payload.title.toLowerCase();
      if (seen.has(key)) {
        results.push({ line, label, status: "skipped", message: "A training with that title already exists" });
        continue;
      }
      const { data, error } = await sb.from("training_resource").insert(mapped.payload as never).select("id").single();
      if (error) {
        results.push({ line, label, status: "error", message: friendlyDbError(error as { code?: string; message: string }) });
        continue;
      }
      seen.add(key);
      await writeAudit("create", "training_resource", (data as { id: string } | null)?.id, null, mapped.payload);
      results.push({ line, label, status: "created" });
    }
    return results;
  }

  return (
    <CsvImport
      testId="training-import"
      title="Import training resources"
      hint="Columns: title (required), provider, url, competency_code, target_level, mode, cost. Competency is matched by its code and level by its label. Existing titles are skipped."
      templateHeaders={HEADERS}
      sampleRow={SAMPLE}
      onImport={importTraining}
    />
  );
}
