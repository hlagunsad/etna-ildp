// Seed demo accounts + a completed baseline for the demo employee.
// Run after the migration: `npm run seed` (needs SUPABASE_SECRET_KEY in .env.local).
// Idempotent: safe to re-run. Uses the admin API (bypasses RLS).
//
// The Year-1 gap math below mirrors src/lib/gap.ts (no "previous" at baseline):
//   gap = max(0, target - assessed); status = assessed >= target ? 'closed' : 'open'.

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SCALE_ID = "00000000-0000-0000-0000-0000000000aa";
const JR_ANALYST = "00000000-0000-0000-0000-0000000000b1";
const ADMIN_OFFICER = "00000000-0000-0000-0000-0000000000b2";
const IT_SUPERVISOR = "00000000-0000-0000-0000-0000000000b3";

const USERS = [
  { email: "super@demo.test", password: "lolom0panot000", role: "super_admin", full_name: "Sam Superadmin", orgUnit: "IT", jobRole: null, manager: null },
  { email: "hr@demo.test", password: "lolom0panot111", role: "hr_admin", full_name: "Hana HR", orgUnit: "HR", jobRole: null, manager: null },
  { email: "supervisor@demo.test", password: "lolom0panot222", role: "supervisor", full_name: "Vince Supervisor", orgUnit: "IT", jobRole: IT_SUPERVISOR, manager: "hr@demo.test" },
  { email: "employee@demo.test", password: "lolom0panot333", role: "employee", full_name: "Ella Employee", orgUnit: "IT", jobRole: JR_ANALYST, manager: "supervisor@demo.test" },
  { email: "employee2@demo.test", password: "lolom0panot444", role: "employee", full_name: "Eddie Employee", orgUnit: "Administration", jobRole: ADMIN_OFFICER, manager: "supervisor@demo.test" },
];

// Baseline self-ratings for the demo employee (by competency code). Some meet target, some lag.
const EMPLOYEE_BASELINE = {
  "NICS-ICTLIT": 2,
  "NICS-DIGLIT": 1,
  "NICS-CYBERSEC": 1, // critical gap
  "NICS-INFOSEC": 2,
  "NICS-DATA": 1,
  "NICS-ISM": 2,
  "NICS-COMMCOLLAB": 1,
};

async function findUserByEmail(email) {
  // Fresh demo project has few users; one page suffices.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email === email) ?? null;
}

async function ensureUser(u) {
  let existing = await findUserByEmail(u.email);
  if (!existing) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    if (error) throw error;
    existing = data.user;
    console.log("  created", u.email);
  } else {
    console.log("  exists ", u.email);
  }
  return existing.id;
}

async function main() {
  console.log("1) demo users");
  const idByEmail = {};
  for (const u of USERS) idByEmail[u.email] = await ensureUser(u);

  console.log("2) org units (a small hierarchy: Operations ▸ IT, Administration)");
  const unitIdByName = {};
  async function ensureUnit(name) {
    const { data: existing } = await admin.from("org_unit").select("id").eq("name", name).maybeSingle();
    let id = existing?.id;
    if (!id) {
      const { data, error } = await admin.from("org_unit").insert({ name }).select("id").single();
      if (error) throw error;
      id = data.id;
    }
    unitIdByName[name] = id;
    return id;
  }
  const opsId = await ensureUnit("Operations");
  for (const name of [...new Set(USERS.map((u) => u.orgUnit).filter(Boolean))]) await ensureUnit(name);
  // Nest the operational units under Operations (HR stays top-level).
  await admin.from("org_unit").update({ parent_id: opsId }).in("name", ["IT", "Administration"]);

  console.log("3) profiles (role, job role, org unit)");
  for (const u of USERS) {
    const { error } = await admin
      .from("profiles")
      .update({ role: u.role, full_name: u.full_name, org_unit_id: unitIdByName[u.orgUnit] ?? null, job_role_id: u.jobRole, status: "active" })
      .eq("id", idByEmail[u.email]);
    if (error) throw error;
  }

  console.log("4) manager hierarchy (second pass)");
  for (const u of USERS) {
    if (!u.manager) continue;
    const { error } = await admin
      .from("profiles")
      .update({ manager_id: idByEmail[u.manager] })
      .eq("id", idByEmail[u.email]);
    if (error) throw error;
  }

  // Lookup maps shared by the baseline build.
  const { data: levels } = await admin.from("proficiency_level").select("id, rank").eq("scale_id", SCALE_ID);
  const levelByRank = Object.fromEntries(levels.map((l) => [l.rank, l.id]));
  const rankByLevel = Object.fromEntries(levels.map((l) => [l.id, l.rank]));
  const { data: items } = await admin.from("assessment_item").select("id, competency_id, level_id").eq("response_type", "yes_no");
  const itemsByComp = {};
  for (const it of items ?? []) (itemsByComp[it.competency_id] ??= []).push({ id: it.id, levelRank: rankByLevel[it.level_id] });

  console.log("5) demo employee baseline (Year 1, validated, active ILDP)");
  const employeeId = idByEmail["employee@demo.test"];
  const supervisorId = idByEmail["supervisor@demo.test"];
  const hrId = idByEmail["hr@demo.test"];

  // Reset so the baseline rebuilds cleanly under the current (deep) TNA model — the cascade
  // clears the old tna_assessment / responses / competency_result / ildp / snapshots.
  await admin.from("dev_cycle").delete().eq("user_id", employeeId);

  // The employee's locked targets (with competency code + target rank).
  const { data: targets } = await admin
    .from("role_competency_target")
    .select("competency_id, weight, is_critical, competency:competency_id(code), level:target_level_id(rank)")
    .eq("job_role_id", JR_ANALYST);

  const snapshot = targets.map((t) => ({
    competencyId: t.competency_id,
    targetRank: t.level.rank,
    weight: t.weight,
    isCritical: t.is_critical,
  }));

  const year = new Date().getFullYear();
  const { data: cycle, error: cErr } = await admin
    .from("dev_cycle")
    .insert({ user_id: employeeId, baseline_year: year, current_year: 1, status: "active", snapshot_of_targets: snapshot })
    .select("id")
    .single();
  if (cErr) throw cErr;

  const now = new Date().toISOString();
  const { data: tna, error: tErr } = await admin
    .from("tna_assessment")
    .insert({ dev_cycle_id: cycle.id, cycle_year: 1, type: "baseline", status: "validated", submitted_at: now, validated_by: supervisorId, validated_at: now })
    .select("id")
    .single();
  if (tErr) throw tErr;

  const { data: ildp, error: iErr } = await admin
    .from("ildp")
    .insert({ dev_cycle_id: cycle.id, status: "active", acknowledged_by: employeeId, acknowledged_at: now, endorsed_by: supervisorId, endorsed_at: now, approved_by: hrId, approved_at: now })
    .select("id")
    .single();
  if (iErr) throw iErr;

  for (const t of targets) {
    const code = t.competency.code;
    const targetRank = t.level.rank;
    const assessed = EMPLOYEE_BASELINE[code] ?? targetRank;
    const gap = Math.max(0, targetRank - assessed);
    const status = assessed >= targetRank ? "closed" : "open";
    const priority = gap * t.weight * (t.is_critical ? 2 : 1);

    for (const it of itemsByComp[t.competency_id] ?? []) {
      await admin.from("tna_response").insert({ tna_assessment_id: tna.id, item_id: it.id, raw_answer: it.levelRank <= assessed ? "yes" : "no", derived_level_id: null });
    }
    await admin.from("competency_result").insert({ tna_assessment_id: tna.id, competency_id: t.competency_id, assessed_level_id: levelByRank[assessed], assessed_rank: assessed, score: assessed });
    await admin.from("ildp_item").insert({ ildp_id: ildp.id, competency_id: t.competency_id, baseline_level_id: levelByRank[assessed], target_level_id: levelByRank[targetRank], current_level_id: levelByRank[assessed], gap_size: gap, priority, gap_status: status, item_status: status === "closed" ? "completed" : "open" });
    await admin.from("progress_snapshot").insert({ dev_cycle_id: cycle.id, cycle_year: 1, competency_id: t.competency_id, assessed_rank: assessed, target_rank: targetRank, gap_size: gap, gap_status: status });
  }

  await admin.from("audit_log").insert([
    { actor_id: supervisorId, actor_email: "supervisor@demo.test", action: "validate", entity_type: "tna_assessment", entity_id: tna.id, after: { status: "validated" } },
    { actor_id: hrId, actor_email: "hr@demo.test", action: "approve", entity_type: "ildp", entity_id: ildp.id, after: { status: "active" } },
  ]);

  console.log("Done — demo employee has a validated baseline + active ILDP.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
