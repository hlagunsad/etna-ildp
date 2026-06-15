import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserFromRequest } from "@/lib/auth";
import { hasCapability } from "@/lib/serverPermissions";
import { mapLmsCompletion } from "@/lib/integrations";

export const runtime = "nodejs";
export const maxDuration = 30;

// STUB. In production this polls the LMS (LMS_BASE_URL) for course completions and updates the
// matching training_record (status completed, completed_at, evidence_url). Today it's a DRY RUN —
// it maps a couple of existing training records via the pure mapper and reports what it WOULD
// update, with no external call and no write. See docs/integrations.md.
export async function POST(req: Request) {
  const caller = await getUserFromRequest(req);
  if (!caller) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const db = getSupabaseAdmin();

  const { data: callerProfile } = await db.from("profiles").select("role").eq("id", caller.id).single();
  if (!(await hasCapability(db, callerProfile?.role ?? null, "manage_users"))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const configured = !!process.env.LMS_BASE_URL?.trim();

  // Use a few real training records so the dry-run mapping resolves to real ids.
  const { data: records } = await db.from("training_record").select("id").limit(2);
  const recs = (records ?? []) as { id: string }[];
  const recordIdByExternalKey = new Map(recs.map((r, i) => [`lms-key-${i}`, r.id]));
  const sample = recs.map((_, i) => ({ external_key: `lms-key-${i}`, completed_at: "2026-06-01T00:00:00Z", evidence_url: "https://lms.example/cert" }));
  const wouldUpdate = sample.map((s) => {
    const m = mapLmsCompletion(s, { recordIdByExternalKey });
    return m.ok ? m.payload : { error: m.error };
  });

  return NextResponse.json({
    status: "stubbed",
    configured,
    message: configured
      ? "LMS_BASE_URL is set, but live sync isn't implemented in this stub — see docs/integrations.md."
      : "Dry run — no LMS configured. Set LMS_BASE_URL to enable a live poll.",
    wouldUpdate,
  });
}
