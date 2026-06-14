import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserFromRequest } from "@/lib/auth";
import { hasCapability } from "@/lib/serverPermissions";
import { cycleOutcome } from "@/lib/cycle";
import type { GapStatus, Target } from "@/lib/types";

// Demo control (HR / Super Admin): roll the cycle to its next year and open an annual TNA,
// so the diff engine + 3-year trend can be shown without waiting a year. On Year 3 it closes
// the cycle and computes the outcome (passed / carry-over).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: cycleId } = await params;
  const caller = await getUserFromRequest(req);
  if (!caller) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const db = getSupabaseAdmin();

  const { data: profile } = await db.from("profiles").select("role").eq("id", caller.id).single();
  if (!(await hasCapability(db, profile?.role ?? null, "advance_year"))) {
    return NextResponse.json({ error: "Not authorized to advance the cycle" }, { status: 403 });
  }

  const { data: cycle } = await db
    .from("dev_cycle")
    .select("id, current_year, snapshot_of_targets")
    .eq("id", cycleId)
    .maybeSingle();
  if (!cycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });

  const now = new Date().toISOString();

  // Final year → close out and compute the outcome.
  if (cycle.current_year >= 3) {
    const critical = new Set(
      ((cycle.snapshot_of_targets as Target[]) ?? []).filter((t) => t.isCritical).map((t) => t.competencyId),
    );
    const { data: ildp } = await db.from("ildp").select("id").eq("dev_cycle_id", cycle.id).maybeSingle();
    let outcome: "passed" | "carry_over" = "passed";
    if (ildp) {
      const { data: ildpItems } = await db.from("ildp_item").select("competency_id, gap_status").eq("ildp_id", ildp.id);
      outcome = cycleOutcome(
        (ildpItems ?? []).map((it) => ({ isCritical: critical.has(it.competency_id), status: it.gap_status as GapStatus })),
      );
    }
    await db.from("dev_cycle").update({ status: outcome, end_date: now }).eq("id", cycle.id);
    await db.from("audit_log").insert({
      actor_id: caller.id, actor_email: caller.email, action: "advance_year",
      entity_type: "dev_cycle", entity_id: cycle.id, after: { status: outcome },
    });
    return NextResponse.json({ closed: true, outcome });
  }

  const newYear = cycle.current_year + 1;
  await db.from("dev_cycle").update({ current_year: newYear }).eq("id", cycle.id);
  await db.from("tna_assessment").upsert(
    { dev_cycle_id: cycle.id, cycle_year: newYear, type: "annual", status: "in_progress" },
    { onConflict: "dev_cycle_id,cycle_year", ignoreDuplicates: true },
  );
  const { data: tna } = await db
    .from("tna_assessment")
    .select("id")
    .eq("dev_cycle_id", cycle.id)
    .eq("cycle_year", newYear)
    .single();
  await db.from("audit_log").insert({
    actor_id: caller.id, actor_email: caller.email, action: "advance_year",
    entity_type: "dev_cycle", entity_id: cycle.id, after: { current_year: newYear },
  });
  return NextResponse.json({ newYear, tnaId: tna?.id ?? null });
}
