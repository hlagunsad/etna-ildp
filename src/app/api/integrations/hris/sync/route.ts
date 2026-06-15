import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserFromRequest } from "@/lib/auth";
import { hasCapability } from "@/lib/serverPermissions";
import { mapHrisRecord } from "@/lib/integrations";

export const runtime = "nodejs";
export const maxDuration = 30;

// STUB. In production this pulls people from the HRIS (HRIS_BASE_URL) and upserts profiles +
// org units, marking leavers disabled. Today it's a DRY RUN — it maps a representative sample
// with the pure mapper and reports what it WOULD upsert, with no external call and no write.
// See docs/integrations.md for the production design (auth, field mapping, scheduling, SSRF).
export async function POST(req: Request) {
  const caller = await getUserFromRequest(req);
  if (!caller) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const db = getSupabaseAdmin();

  const { data: callerProfile } = await db.from("profiles").select("role").eq("id", caller.id).single();
  if (!(await hasCapability(db, callerProfile?.role ?? null, "manage_users"))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const configured = !!process.env.HRIS_BASE_URL?.trim();

  // Resolve org units once so the dry-run mapping is real.
  const { data: units } = await db.from("org_unit").select("id, name");
  const orgUnitIdByName = new Map(((units ?? []) as { id: string; name: string }[]).map((u) => [u.name.toLowerCase(), u.id]));

  const sample: Record<string, string>[] = [
    { email: "new.hire@example.com", full_name: "New Hire", org_unit: "IT", manager_email: "supervisor@demo.test", employment_status: "active" },
    { email: "former.staff@example.com", full_name: "Former Staff", employment_status: "terminated" },
  ];
  const wouldUpsert = sample.map((r) => {
    const m = mapHrisRecord(r, { orgUnitIdByName });
    return m.ok ? m.payload : { error: m.error };
  });

  return NextResponse.json({
    status: "stubbed",
    configured,
    message: configured
      ? "HRIS_BASE_URL is set, but live sync isn't implemented in this stub — see docs/integrations.md."
      : "Dry run — no HRIS configured. Set HRIS_BASE_URL to enable a live pull.",
    wouldUpsert,
  });
}
