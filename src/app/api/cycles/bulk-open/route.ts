import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserFromRequest } from "@/lib/auth";
import { hasCapability } from "@/lib/serverPermissions";
import { eligibleForCycle } from "@/lib/cycle";
import type { Target } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX = 50;
type Result = { label: string; status: "opened" | "skipped" | "error"; message?: string };

// HR opens development cycles in bulk for everyone with a job role and no cycle yet —
// the same engine as /api/cycle/start, run once per eligible employee. Gated by the
// configurable `advance_year` capability; runs with the secret key.
export async function POST(req: Request) {
  const caller = await getUserFromRequest(req);
  if (!caller) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const db = getSupabaseAdmin();

  const { data: callerProfile } = await db.from("profiles").select("role").eq("id", caller.id).single();
  if (!(await hasCapability(db, callerProfile?.role ?? null, "advance_year"))) {
    return NextResponse.json({ error: "Not authorized to open cycles" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { orgUnitId?: string; dueDate?: string };
  const orgUnitId = body.orgUnitId?.trim() || null;
  const dueDate = body.dueDate?.trim() || null;

  const { data: profilesRaw } = await db.from("profiles").select("id, email, org_unit_id, job_role_id, role");
  let profiles = (profilesRaw ?? []) as { id: string; email: string | null; org_unit_id: string | null; job_role_id: string | null; role: string }[];
  if (orgUnitId) profiles = profiles.filter((p) => p.org_unit_id === orgUnitId);
  const { data: cyclesRaw } = await db.from("dev_cycle").select("user_id");
  const cycleUserIds = new Set(((cyclesRaw ?? []) as { user_id: string }[]).map((c) => c.user_id));
  const eligible = eligibleForCycle(profiles, cycleUserIds);

  if (eligible.length === 0) {
    return NextResponse.json({ results: [], message: "No eligible employees — everyone with a job role already has a cycle." });
  }
  if (eligible.length > MAX) {
    return NextResponse.json({ error: `${eligible.length} eligible — over the ${MAX}-at-once limit. Filter by department.` }, { status: 400 });
  }

  // Job-role targets (with rank), fetched once and grouped.
  const { data: targetsRaw } = await db
    .from("role_competency_target")
    .select("job_role_id, competency_id, weight, is_critical, level:target_level_id(rank)");
  type LevelRel = { rank: number };
  const byJobRole = new Map<string, Target[]>();
  for (const t of (targetsRaw ?? []) as Record<string, unknown>[]) {
    const level = t.level as unknown as LevelRel | LevelRel[] | null;
    const targetRank = Array.isArray(level) ? level[0]?.rank ?? 0 : level?.rank ?? 0;
    const jr = t.job_role_id as string;
    const list = byJobRole.get(jr) ?? [];
    list.push({ competencyId: t.competency_id as string, targetRank, weight: t.weight as number, isCritical: t.is_critical as boolean });
    byJobRole.set(jr, list);
  }

  const year = new Date().getFullYear();
  const results: Result[] = [];
  for (const p of eligible) {
    const label = p.email ?? p.id;
    try {
      const snapshot = byJobRole.get(p.job_role_id as string) ?? [];
      if (snapshot.length === 0) {
        results.push({ label, status: "skipped", message: "Job role has no competency targets" });
        continue;
      }
      const { data: cycle, error: cErr } = await db
        .from("dev_cycle")
        .insert({ user_id: p.id, baseline_year: year, current_year: 1, status: "active", snapshot_of_targets: snapshot })
        .select("id")
        .single();
      if (cErr || !cycle) {
        results.push({ label, status: "error", message: cErr?.message ?? "Could not create cycle" });
        continue;
      }
      const cycleId = (cycle as { id: string }).id;
      const { error: tErr } = await db
        .from("tna_assessment")
        .insert({ dev_cycle_id: cycleId, cycle_year: 1, type: "baseline", status: "in_progress", due_date: dueDate });
      if (tErr) {
        results.push({ label, status: "error", message: `Cycle created but TNA failed: ${tErr.message}` });
        continue;
      }
      await db.from("audit_log").insert({
        actor_id: caller.id,
        actor_email: caller.email,
        action: "create",
        entity_type: "dev_cycle",
        entity_id: cycleId,
        after: { baseline_year: year, due_date: dueDate },
      });
      results.push({ label, status: "opened", message: dueDate ? `TNA due ${dueDate}` : undefined });
    } catch (e) {
      results.push({ label, status: "error", message: e instanceof Error ? e.message : "Failed" });
    }
  }
  return NextResponse.json({ results });
}
