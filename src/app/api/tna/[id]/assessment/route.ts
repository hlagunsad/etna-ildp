import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserFromRequest } from "@/lib/auth";
import { hasCapability } from "@/lib/serverPermissions";
import { computeAssessment } from "@/lib/assessment";
import type { Target } from "@/lib/types";

export const runtime = "nodejs";

// Read-only preview of a submitted TNA's CALCULATED assessment — the assessed vs target level
// per competency — for a supervisor to review and decide before validating. Returns no raw
// answers, only derived ranks. Gated exactly like the validate route (capability + manager/admin
// scope + separation of duties), so a peer or the employee can't preview someone else's.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tnaId } = await params;
  const caller = await getUserFromRequest(req);
  if (!caller) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const db = getSupabaseAdmin();

  const { data: tna } = await db.from("tna_assessment").select("id, status, cycle_year, dev_cycle_id").eq("id", tnaId).maybeSingle();
  if (!tna) return NextResponse.json({ error: "TNA not found" }, { status: 404 });

  const { data: cycle } = await db.from("dev_cycle").select("id, user_id, snapshot_of_targets").eq("id", tna.dev_cycle_id).single();
  const ownerId = cycle!.user_id as string;

  const { data: callerProfile } = await db.from("profiles").select("role").eq("id", caller.id).single();
  const { data: ownerProfile } = await db.from("profiles").select("manager_id").eq("id", ownerId).single();
  const role = callerProfile?.role ?? null;
  const isAdmin = role === "hr_admin" || role === "super_admin";
  const isManager = ownerProfile?.manager_id === caller.id;
  if (!(await hasCapability(db, role, "validate_tna")) || !(isAdmin || isManager)) {
    return NextResponse.json({ error: "Not authorized to review this TNA" }, { status: 403 });
  }
  if (ownerId === caller.id) {
    return NextResponse.json({ error: "You cannot review your own TNA (separation of duties)" }, { status: 403 });
  }

  const snapshot = (cycle!.snapshot_of_targets as Target[]) ?? [];
  const { assessedByComp } = await computeAssessment(db, tna, cycle!);

  const compIds = snapshot.map((t) => t.competencyId);
  const { data: comps } = await db.from("competency").select("id, name").in("id", compIds.length ? compIds : ["00000000-0000-0000-0000-000000000000"]);
  const nameById = new Map(((comps ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

  const lines = snapshot
    .map((t) => ({
      competency_id: t.competencyId,
      name: nameById.get(t.competencyId) ?? "—",
      assessed_rank: assessedByComp[t.competencyId] ?? 0,
      target_rank: t.targetRank,
      is_critical: t.isCritical,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ lines, status: tna.status });
}
