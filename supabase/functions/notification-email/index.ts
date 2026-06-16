// supabase/functions/notification-email/index.ts
//
// REFERENCE STUB (Deno / Supabase Edge Functions) — NOT deployed by this repo and excluded
// from the app's TypeScript build (tsconfig "exclude"). It documents the production path for
// emailing notifications: a Supabase Database Webhook on `notification` INSERT invokes this
// function with the new row; it looks up the recipient's email and hands off to a provider.
// This single seam covers EVERY notification (including the client-direct endorse/approve
// writes) because they all funnel through the one `notification` table. See docs/integrations.md.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

interface NotificationRow {
  recipient_id: string;
  title: string;
  body: string | null;
  link: string | null;
}

serve(async (req: Request) => {
  // Database Webhook payload: { type, table, record, old_record }.
  const { record } = (await req.json()) as { record: NotificationRow };

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  // Resolve the recipient's email server-side (service role; never exposed to clients).
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${record.recipient_id}&select=email`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const [profile] = (await res.json()) as { email: string | null }[];
  if (!profile?.email || !RESEND_API_KEY) return new Response("skipped", { status: 204 });

  // Subject = the notification title; body mirrors renderNotificationEmail in src/lib/integrations.ts.
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Caliber <noreply@example.com>",
      to: profile.email,
      subject: record.title,
      text: `${record.body ?? record.title}\n\nOpen the app to view it.`,
    }),
  });

  return new Response("ok", { status: 200 });
});
