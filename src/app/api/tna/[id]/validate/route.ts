import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserFromRequest } from "@/lib/auth";
import { buildIldpItem } from "@/lib/gap";
import type { Target } from "@/lib/types";

const SCALE_ID = "00000000-0000-0000-0000-0000000000aa";

// Validate a submitted TNA: confirm/adjust ratings, then run the roll-up → gap/diff →
// ILDP upsert → progress snapshot → audit, atomically with the secret key. Authorization
// (manager-of-owner or admin) and separation of duties (validator ≠ owner) are re-checked
// here in code — the UI only hides controls; this route is the real boundary.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tnaId } = await params;
  const caller = await getUserFromRequest(req);
  if (!caller) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const db = getSupabaseAdmin();

  const { data: tna } = await db
    .from("tna_assessment")
    .select("id, status, cycle_year, dev_cycle_id")
    .eq("id", tnaId)
    .maybeSingle();
  if (!tna) return NextResponse.json({ error: "TNA not found" }, { status: 404 });
  if (tna.status !== "submitted") {
    return NextResponse.json({ error: "This TNA is not awaiting validation" }, { status: 409 });
  }

  const { data: cycle } = await db
    .from("dev_cycle")
    .select("id, user_id, snapshot_of_targets")
    .eq("id", tna.dev_cycle_id)
    .single();
  const ownerId = cycle!.user_id as string;

  // ---- Authorization + separation of duties ----
  const { data: callerProfile } = await db.from("profiles").select("role").eq("id", caller.id).single();
  const { data: ownerProfile } = await db.from("profiles").select("manager_id").eq("id", ownerId).single();
  const role = callerProfile?.role;
  const isAdmin = role === "hr_admin" || role === "super_admin";
  const isManager = ownerProfile?.manager_id === caller.id;
  if (!(isAdmin || isManager)) {
    return NextResponse.json({ error: "Not authorized to validate this TNA" }, { status: 403 });
  }
  if (ownerId === caller.id) {
    return NextResponse.json({ error: "You cannot validate your own TNA (separation of duties)" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { ratings?: Record<string, number> };
  const overrides = body.ratings ?? {};
  const snapshot = (cycle!.snapshot_of_targets as Target[]) ?? [];

  // Rank ↔ level-id maps.
  const { data: levels } = await db.from("proficiency_level").select("id, rank").eq("scale_id", SCALE_ID);
  const idByRank: Record<number, string> = {};
  const rankById: Record<string, number> = {};
  for (const l of levels ?? []) { idByRank[l.rank] = l.id; rankById[l.id] = l.rank; }

  // Submitted responses → assessed rank per competency.
  const { data: items } = await db.from("assessment_item").select("id, competency_id");
  const compByItem: Record<string, string> = {};
  for (const it of items ?? []) compByItem[it.id] = it.competency_id;
  const { data: responses } = await db
    .from("tna_response")
    .select("item_id, raw_answer, derived_level_id")
    .eq("tna_assessment_id", tnaId);
  const assessedByComp: Record<string, number> = {};
  for (const r of responses ?? []) {
    const comp = compByItem[r.item_id];
    const rank = r.derived_level_id ? rankById[r.derived_level_id] : Number(r.raw_answer);
    if (comp && Number.isFinite(rank)) assessedByComp[comp] = rank;
  }
  for (const [comp, rank] of Object.entries(overrides)) assessedByComp[comp] = rank;

  // Previous year's assessed ranks (for the annual diff), if any.
  const previousByComp: Record<string, number> = {};
  if (tna.cycle_year > 1) {
    const { data: prevTna } = await db
      .from("tna_assessment")
      .select("id")
      .eq("dev_cycle_id", cycle!.id)
      .eq("cycle_year", tna.cycle_year - 1)
      .maybeSingle();
    if (prevTna) {
      const { data: prev } = await db
        .from("competency_result")
        .select("competency_id, assessed_rank")
        .eq("tna_assessment_id", prevTna.id);
      for (const p of prev ?? []) if (p.assessed_rank != null) previousByComp[p.competency_id] = p.assessed_rank;
    }
  }

  // Ensure an ILDP exists (draft on first generation; existing one is updated in place).
  let { data: ildp } = await db.from("ildp").select("id").eq("dev_cycle_id", cycle!.id).maybeSingle();
  if (!ildp) {
    const ins = await db.from("ildp").insert({ dev_cycle_id: cycle!.id, status: "draft" }).select("id").single();
    ildp = ins.data;
  }

  // Roll up + diff + write, per competency in the locked snapshot.
  for (const t of snapshot) {
    const assessed = assessedByComp[t.competencyId] ?? 0;
    const previous = previousByComp[t.competencyId] ?? null;
    const computed = buildIldpItem({
      competencyId: t.competencyId,
      targetRank: t.targetRank,
      assessedRank: assessed,
      previousRank: previous,
      baselineRank: assessed,
      weight: t.weight,
      isCritical: t.isCritical,
    });

    await db.from("competency_result").upsert(
      { tna_assessment_id: tnaId, competency_id: t.competencyId, assessed_level_id: idByRank[assessed] ?? null, assessed_rank: assessed, score: assessed },
      { onConflict: "tna_assessment_id,competency_id" },
    );

    const itemRow: Record<string, unknown> = {
      ildp_id: ildp!.id,
      competency_id: t.competencyId,
      target_level_id: idByRank[t.targetRank] ?? null,
      current_level_id: idByRank[assessed] ?? null,
      gap_size: computed.gapSize,
      priority: computed.priority,
      gap_status: computed.status,
      item_status: computed.status === "closed" ? "completed" : "open",
    };
    if (tna.cycle_year === 1) itemRow.baseline_level_id = idByRank[assessed] ?? null;
    await db.from("ildp_item").upsert(itemRow, { onConflict: "ildp_id,competency_id" });

    await db.from("progress_snapshot").upsert(
      { dev_cycle_id: cycle!.id, cycle_year: tna.cycle_year, competency_id: t.competencyId, assessed_rank: assessed, target_rank: t.targetRank, gap_size: computed.gapSize, gap_status: computed.status },
      { onConflict: "dev_cycle_id,cycle_year,competency_id" },
    );
  }

  const now = new Date().toISOString();
  await db.from("tna_assessment").update({ status: "validated", validated_by: caller.id, validated_at: now }).eq("id", tnaId);
  await db.from("audit_log").insert({
    actor_id: caller.id, actor_email: caller.email, action: "validate",
    entity_type: "tna_assessment", entity_id: tnaId, after: { status: "validated" },
  });

  return NextResponse.json({ ok: true });
}
