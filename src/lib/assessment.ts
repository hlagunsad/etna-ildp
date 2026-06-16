import type { SupabaseClient } from "@supabase/supabase-js";
import { rollUpCompetency } from "./rollup";

const SCALE_ID = "00000000-0000-0000-0000-0000000000aa";

/**
 * Roll a submitted TNA's raw yes/no "Can I…?" responses up to an assessed rank per competency,
 * with each competency's previous-year rank (for the annual diff) and the rank↔level-id maps.
 *
 * Returns ONLY calculated ranks — never the raw answers. The raw responses are read here with
 * the secret key (so RLS keeping them private to the employee doesn't block the roll-up), but
 * they never leave this function. Shared by the validate route (which then applies supervisor
 * overrides and writes) and the read-only assessment preview route.
 */
export async function computeAssessment(
  db: SupabaseClient,
  tna: { id: string; cycle_year: number },
  cycle: { id: string },
): Promise<{ assessedByComp: Record<string, number>; previousByComp: Record<string, number>; idByRank: Record<number, string> }> {
  // Rank ↔ level-id maps.
  const { data: levels } = await db.from("proficiency_level").select("id, rank").eq("scale_id", SCALE_ID);
  const idByRank: Record<number, string> = {};
  const rankById: Record<string, number> = {};
  for (const l of levels ?? []) {
    idByRank[l.rank] = l.id;
    rankById[l.id] = l.rank;
  }

  // Map each yes/no item to its competency + level rank.
  const { data: items } = await db.from("assessment_item").select("id, competency_id, level_id").eq("response_type", "yes_no");
  const compByItem: Record<string, string> = {};
  const levelRankByItem: Record<string, number> = {};
  for (const it of items ?? []) {
    compByItem[it.id] = it.competency_id;
    if (it.level_id) levelRankByItem[it.id] = rankById[it.level_id];
  }

  // Raw responses → grouped by competency → assessed rank via the threshold roll-up.
  const { data: responses } = await db.from("tna_response").select("item_id, raw_answer").eq("tna_assessment_id", tna.id);
  const itemsByComp: Record<string, { levelRank: number; yes: boolean }[]> = {};
  for (const r of responses ?? []) {
    const comp = compByItem[r.item_id];
    const levelRank = levelRankByItem[r.item_id];
    if (!comp || !levelRank) continue;
    (itemsByComp[comp] ??= []).push({ levelRank, yes: r.raw_answer === "yes" });
  }
  const assessedByComp: Record<string, number> = {};
  for (const comp of Object.keys(itemsByComp)) assessedByComp[comp] = rollUpCompetency(itemsByComp[comp]);

  // Previous year's assessed ranks (for the annual diff), if any.
  const previousByComp: Record<string, number> = {};
  if (tna.cycle_year > 1) {
    const { data: prevTna } = await db
      .from("tna_assessment")
      .select("id")
      .eq("dev_cycle_id", cycle.id)
      .eq("cycle_year", tna.cycle_year - 1)
      .maybeSingle();
    if (prevTna) {
      const { data: prev } = await db.from("competency_result").select("competency_id, assessed_rank").eq("tna_assessment_id", prevTna.id);
      for (const p of prev ?? []) if (p.assessed_rank != null) previousByComp[p.competency_id] = p.assessed_rank;
    }
  }

  return { assessedByComp, previousByComp, idByRank };
}
