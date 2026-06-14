import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserFromRequest } from "@/lib/auth";
import { hasCapability } from "@/lib/serverPermissions";

const ROLES = ["super_admin", "hr_admin", "supervisor", "employee"];

// Admin-created accounts (spec §6.2 "no public sign-up"). Super Admin can create any role;
// HR can create employees/supervisors only. Auth + role checks are enforced here in code,
// then the privileged write runs with the secret key. Writes an audit entry.
export async function POST(req: Request) {
  const caller = await getUserFromRequest(req);
  if (!caller) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const db = getSupabaseAdmin();

  const { data: callerProfile } = await db.from("profiles").select("role").eq("id", caller.id).single();
  const callerRole = callerProfile?.role ?? null;
  if (!(await hasCapability(db, callerRole, "manage_users"))) {
    return NextResponse.json({ error: "Not authorized to create accounts" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    full_name?: string; email?: string; password?: string; role?: string;
    department?: string; job_role_id?: string; manager_id?: string;
  };
  const email = body.email?.trim();
  const password = body.password ?? "";
  const role = body.role ?? "employee";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and a temporary password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Temporary password must be at least 8 characters" }, { status: 400 });
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (callerRole === "hr_admin" && (role === "super_admin" || role === "hr_admin")) {
    return NextResponse.json({ error: "HR can only create employees and supervisors" }, { status: 403 });
  }

  const { data: created, error: cErr } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (cErr || !created?.user) {
    return NextResponse.json({ error: cErr?.message ?? "Could not create the user" }, { status: 400 });
  }

  // The handle_new_user trigger created a default profile; set the real fields.
  const { error: pErr } = await db
    .from("profiles")
    .update({
      full_name: body.full_name?.trim() || null,
      role,
      department: body.department?.trim() || null,
      job_role_id: body.job_role_id || null,
      manager_id: body.manager_id || null,
      status: "active",
    })
    .eq("id", created.user.id);
  if (pErr) {
    return NextResponse.json({ error: `User created but profile update failed: ${pErr.message}` }, { status: 500 });
  }

  await db.from("audit_log").insert({
    actor_id: caller.id,
    actor_email: caller.email,
    action: "create",
    entity_type: "profiles",
    entity_id: created.user.id,
    after: { email, role },
  });

  return NextResponse.json({ id: created.user.id, email });
}
