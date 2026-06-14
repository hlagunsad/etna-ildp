import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserFromRequest } from "@/lib/auth";
import { mapUserRow } from "@/lib/import";

// Node runtime (needs `crypto`); allow headroom for the sequential auth-admin calls.
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ROWS = 50;

type RowResult = { line: number; label: string; status: "created" | "updated" | "skipped" | "error"; message?: string };

function genTempPassword(): string {
  // URL-safe, mixed character classes, ≥ 8 chars; never logged or audited.
  return "Tmp-" + randomBytes(9).toString("base64url");
}

// Bulk-create accounts from CSV rows (spec §6.2 "no public sign-up"). Super Admin can
// create any role; HR employees/supervisors only. Auth + role gate enforced here, then
// the privileged writes run with the secret key. One audit entry per created account.
export async function POST(req: Request) {
  const caller = await getUserFromRequest(req);
  if (!caller) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const db = getSupabaseAdmin();

  const { data: callerProfile } = await db.from("profiles").select("role").eq("id", caller.id).single();
  const callerRole = callerProfile?.role ?? null;
  if (callerRole !== "super_admin" && callerRole !== "hr_admin") {
    return NextResponse.json({ error: "Only HR / Super Admin can import accounts" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { rows?: Record<string, string>[] };
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Import is limited to ${MAX_ROWS} rows per file — split it into smaller batches.` }, { status: 400 });
  }

  // Lookups (once): job roles by name, and every existing account by email.
  const { data: jobRoles } = await db.from("job_role").select("id, name");
  const jobRoleIdByName = new Map(((jobRoles ?? []) as { id: string; name: string }[]).map((j) => [j.name.toLowerCase(), j.id]));
  const { data: usersPage } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  const idByEmail = new Map<string, string>();
  for (const u of usersPage?.users ?? []) if (u.email) idByEmail.set(u.email.toLowerCase(), u.id);

  const results: RowResult[] = [];
  const managerLinks: { resultIdx: number; email: string; managerEmail: string }[] = [];

  // Pass 1 — validate, create the auth user, set the profile. One bad row never aborts.
  let line = 1; // header is line 1
  for (const row of rows) {
    line += 1;
    const label = (row.email ?? "").trim() || "(no email)";
    try {
      const mapped = mapUserRow(row, { jobRoleIdByName, callerRole });
      if (!mapped.ok) {
        results.push({ line, label, status: "error", message: mapped.error });
        continue;
      }
      const p = mapped.payload;
      const emailLower = p.email.toLowerCase();
      if (idByEmail.has(emailLower)) {
        results.push({ line, label, status: "skipped", message: "Account already exists" });
        continue; // idempotent: don't touch existing accounts (incl. their manager)
      }

      const generated = !p.password;
      const password = p.password ?? genTempPassword();
      const { data: created, error: cErr } = await db.auth.admin.createUser({ email: p.email, password, email_confirm: true });
      if (cErr || !created?.user) {
        results.push({ line, label, status: "error", message: cErr?.message ?? "Could not create the user" });
        continue;
      }

      const { error: pErr } = await db
        .from("profiles")
        .update({ full_name: p.full_name, role: p.role, department: p.department, job_role_id: p.job_role_id, status: "active" })
        .eq("id", created.user.id);
      idByEmail.set(emailLower, created.user.id);
      if (pErr) {
        results.push({ line, label, status: "error", message: `Created but profile update failed: ${pErr.message}` });
        continue;
      }

      await db.from("audit_log").insert({
        actor_id: caller.id,
        actor_email: caller.email,
        action: "create",
        entity_type: "profiles",
        entity_id: created.user.id,
        after: { email: p.email, role: p.role }, // never the password
      });

      if (mapped.managerEmail) managerLinks.push({ resultIdx: results.length, email: emailLower, managerEmail: mapped.managerEmail });
      results.push({ line, label, status: "created", message: generated ? `Temp password: ${password}` : "Created" });
    } catch (e) {
      results.push({ line, label, status: "error", message: e instanceof Error ? e.message : "Failed" });
    }
  }

  // Pass 2 — resolve managers now that everyone in the batch exists.
  for (const { resultIdx, email, managerEmail } of managerLinks) {
    const userId = idByEmail.get(email);
    const managerId = idByEmail.get(managerEmail.toLowerCase());
    if (!userId) continue;
    if (!managerId) {
      const r = results[resultIdx];
      if (r) r.message = `${r.message ?? "Created"} (manager not found: ${managerEmail})`;
      continue;
    }
    await db.from("profiles").update({ manager_id: managerId }).eq("id", userId);
  }

  return NextResponse.json({ results });
}
