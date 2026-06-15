import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserFromRequest } from "@/lib/auth";
import { hasCapability } from "@/lib/serverPermissions";
import { getEmailAdapter, renderNotificationEmail } from "@/lib/integrations";

export const runtime = "nodejs";
export const maxDuration = 30;

// Exercise the email adapter by sending a test message to the caller's own address.
// With the default logging stub nothing is actually sent — it just confirms the wiring.
export async function POST(req: Request) {
  const caller = await getUserFromRequest(req);
  if (!caller) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const db = getSupabaseAdmin();

  const { data: callerProfile } = await db.from("profiles").select("role").eq("id", caller.id).single();
  if (!(await hasCapability(db, callerProfile?.role ?? null, "manage_users"))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  if (!caller.email) return NextResponse.json({ error: "Your account has no email address" }, { status: 400 });

  const rendered = renderNotificationEmail({
    title: "Test email from the integration layer",
    body: "If you received this, the email adapter is wired correctly.",
    appName: "eTNA → ILDP",
    appUrl: new URL(req.url).origin,
  });
  const result = await getEmailAdapter().send({ to: caller.email, subject: rendered.subject, text: rendered.text });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, via: result.via, to: caller.email });
}
