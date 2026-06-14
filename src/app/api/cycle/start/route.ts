import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserFromRequest } from "@/lib/auth";
import { hasCapability } from "@/lib/serverPermissions";
import type { Target } from "@/lib/types";

// Begin the caller's 3-year cycle: lock their job-role targets into the cycle snapshot
// and open a baseline TNA. Server-side so the locked targets can't be tampered with.
export async function POST(req: Request) {
  const caller = await getUserFromRequest(req);
  if (!caller) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const db = getSupabaseAdmin();

  const { data: callerProfile } = await db.from("profiles").select("role").eq("id", caller.id).single();
  if (!(await hasCapability(db, callerProfile?.role ?? null, "take_own_tna"))) {
    return NextResponse.json({ error: "Not authorized to start a development cycle" }, { status: 403 });
  }

  const { data: existing } = await db.from("dev_cycle").select("id").eq("user_id", caller.id).maybeSingle();
  if (existing) return NextResponse.json({ error: "You already have a development cycle" }, { status: 409 });

  const { data: profile } = await db.from("profiles").select("job_role_id").eq("id", caller.id).single();
  if (!profile?.job_role_id) {
    return NextResponse.json({ error: "No job role assigned yet — ask HR to set one." }, { status: 400 });
  }

  const { data: targets } = await db
    .from("role_competency_target")
    .select("competency_id, weight, is_critical, level:target_level_id(rank)")
    .eq("job_role_id", profile.job_role_id);

  // Supabase infers an embedded to-one relationship as an array in its types, though it
  // is an object at runtime — handle both shapes.
  type LevelRel = { rank: number };
  const snapshot: Target[] = (targets ?? []).map((t) => {
    const level = t.level as unknown as LevelRel | LevelRel[] | null;
    const targetRank = Array.isArray(level) ? (level[0]?.rank ?? 0) : (level?.rank ?? 0);
    return {
      competencyId: t.competency_id as string,
      targetRank,
      weight: t.weight as number,
      isCritical: t.is_critical as boolean,
    };
  });
  if (snapshot.length === 0) {
    return NextResponse.json({ error: "Your job role has no competency targets yet." }, { status: 400 });
  }

  const year = new Date().getFullYear();
  const { data: cycle, error: cErr } = await db
    .from("dev_cycle")
    .insert({ user_id: caller.id, baseline_year: year, current_year: 1, status: "active", snapshot_of_targets: snapshot })
    .select("id")
    .single();
  if (cErr || !cycle) return NextResponse.json({ error: cErr?.message ?? "Could not start cycle" }, { status: 500 });

  const { data: tna } = await db
    .from("tna_assessment")
    .insert({ dev_cycle_id: cycle.id, cycle_year: 1, type: "baseline", status: "in_progress" })
    .select("id")
    .single();

  await db.from("audit_log").insert({
    actor_id: caller.id, actor_email: caller.email, action: "create",
    entity_type: "dev_cycle", entity_id: cycle.id, after: { baseline_year: year },
  });

  return NextResponse.json({ cycleId: cycle.id, tnaId: tna?.id ?? null });
}
