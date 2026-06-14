import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserFromRequest } from "@/lib/auth";
import { hasCapability } from "@/lib/serverPermissions";
import { cycleOutcome } from "@/lib/cycle";
import type { GapStatus, Target } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX = 50;
type Result = { label: string; status: "advanced" | "closed" | "error"; message?: string };

// HR advances every active cycle a year (open the annual TNA), or on Year 3 closes it and
// computes the outcome — the same engine as /api/cycle/[id]/advance-year, run in bulk.
export async function POST(req: Request) {
  const caller = await getUserFromRequest(req);
  if (!caller) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const db = getSupabaseAdmin();

  const { data: callerProfile } = await db.from("profiles").select("role").eq("id", caller.id).single();
  if (!(await hasCapability(db, callerProfile?.role ?? null, "advance_year"))) {
    return NextResponse.json({ error: "Not authorized to advance cycles" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { dueDate?: string };
  const dueDate = body.dueDate?.trim() || null;

  const { data: cyclesRaw } = await db
    .from("dev_cycle")
    .select("id, user_id, current_year, snapshot_of_targets")
    .eq("status", "active");
  const cycles = (cyclesRaw ?? []) as { id: string; user_id: string; current_year: number; snapshot_of_targets: Target[] }[];
  if (cycles.length === 0) return NextResponse.json({ results: [], message: "No active cycles to advance." });
  if (cycles.length > MAX) {
    return NextResponse.json({ error: `${cycles.length} active cycles — over the ${MAX}-at-once limit.` }, { status: 400 });
  }

  const { data: profs } = await db.from("profiles").select("id, email");
  const emailById = new Map(((profs ?? []) as { id: string; email: string | null }[]).map((p) => [p.id, p.email]));
  const now = new Date().toISOString();
  const results: Result[] = [];

  for (const cycle of cycles) {
    const label = emailById.get(cycle.user_id) ?? cycle.user_id;
    try {
      if (cycle.current_year >= 3) {
        const critical = new Set((cycle.snapshot_of_targets ?? []).filter((t) => t.isCritical).map((t) => t.competencyId));
        const { data: ildp } = await db.from("ildp").select("id").eq("dev_cycle_id", cycle.id).maybeSingle();
        let outcome: "passed" | "carry_over" = "passed";
        if (ildp) {
          const { data: items } = await db.from("ildp_item").select("competency_id, gap_status").eq("ildp_id", (ildp as { id: string }).id);
          outcome = cycleOutcome(
            ((items ?? []) as { competency_id: string; gap_status: string }[]).map((it) => ({ isCritical: critical.has(it.competency_id), status: it.gap_status as GapStatus })),
          );
        }
        await db.from("dev_cycle").update({ status: outcome, end_date: now }).eq("id", cycle.id);
        await db.from("audit_log").insert({ actor_id: caller.id, actor_email: caller.email, action: "advance_year", entity_type: "dev_cycle", entity_id: cycle.id, after: { status: outcome } });
        results.push({ label, status: "closed", message: outcome });
      } else {
        const newYear = cycle.current_year + 1;
        await db.from("dev_cycle").update({ current_year: newYear }).eq("id", cycle.id);
        await db.from("tna_assessment").upsert(
          { dev_cycle_id: cycle.id, cycle_year: newYear, type: "annual", status: "in_progress", due_date: dueDate },
          { onConflict: "dev_cycle_id,cycle_year", ignoreDuplicates: true },
        );
        await db.from("audit_log").insert({ actor_id: caller.id, actor_email: caller.email, action: "advance_year", entity_type: "dev_cycle", entity_id: cycle.id, after: { current_year: newYear } });
        results.push({ label, status: "advanced", message: `Year ${newYear}` });
      }
    } catch (e) {
      results.push({ label, status: "error", message: e instanceof Error ? e.message : "Failed" });
    }
  }
  return NextResponse.json({ results });
}
