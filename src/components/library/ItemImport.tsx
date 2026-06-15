"use client";

import { getSupabase } from "@/lib/supabase";
import { loadLibrary } from "@/lib/queries";
import { mapItemRow } from "@/lib/import";
import { friendlyDbError } from "@/lib/library";
import { writeAudit } from "@/lib/useCrud";
import CsvImport, { type RowResult } from "../import/CsvImport";

const HEADERS = ["competency_code", "prompt_text", "level", "response_type"];
const SAMPLE = ["NICS-CYBERSEC", "Can I configure a basic firewall rule?", "Basic", "yes_no"];

export default function ItemImport() {
  async function importItems(rows: Record<string, string>[]): Promise<RowResult[]> {
    const sb = getSupabase();
    const [lib, existing] = await Promise.all([
      loadLibrary(),
      sb.from("assessment_item").select("competency_id, prompt_text"),
    ]);
    const competencyByCode = new Map(lib.competencies.map((c) => [c.code.toLowerCase(), { id: c.id, scale_id: c.scale_id }]));
    // assessment_item has no unique constraint → dedup on competency + prompt to keep re-import idempotent.
    const seen = new Set(
      ((existing.data ?? []) as { competency_id: string; prompt_text: string | null }[]).map((i) => `${i.competency_id}::${(i.prompt_text ?? "").toLowerCase()}`),
    );

    const results: RowResult[] = [];
    let line = 1; // header is line 1
    for (const row of rows) {
      line += 1;
      const label = (row.prompt_text ?? "").trim().slice(0, 40) || "(no prompt)";
      const mapped = mapItemRow(row, { competencyByCode, levels: lib.levels });
      if (!mapped.ok) {
        results.push({ line, label, status: "error", message: mapped.error });
        continue;
      }
      const key = `${mapped.payload.competency_id}::${mapped.payload.prompt_text.toLowerCase()}`;
      if (seen.has(key)) {
        results.push({ line, label, status: "skipped", message: "That item already exists for this competency" });
        continue;
      }
      const { data, error } = await sb.from("assessment_item").insert(mapped.payload as never).select("id").single();
      if (error) {
        results.push({ line, label, status: "error", message: friendlyDbError(error as { code?: string; message: string }) });
        continue;
      }
      seen.add(key);
      await writeAudit("create", "assessment_item", (data as { id: string } | null)?.id, null, mapped.payload);
      results.push({ line, label, status: "created" });
    }
    return results;
  }

  return (
    <CsvImport
      testId="item-import"
      title="Import assessment items"
      hint="Columns: competency_code, prompt_text (required), then level, response_type (yes_no / scale). Competency is matched by code, level by label. Duplicate prompts for a competency are skipped."
      templateHeaders={HEADERS}
      sampleRow={SAMPLE}
      onImport={importItems}
    />
  );
}
