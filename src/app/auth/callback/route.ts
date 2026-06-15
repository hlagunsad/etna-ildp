import { NextResponse } from "next/server";

export const runtime = "nodejs";

// OAuth/SSO redirect target. With a provider configured (see docs/integrations.md),
// Supabase sends the user here after authenticating; we hand the auth code back to the
// home page, where the browser Supabase client (detectSessionInUrl) exchanges it for a
// session. (A server-side exchange via @supabase/ssr is the production-hardened option.)
export async function GET(req: Request) {
  const url = new URL(req.url);
  return NextResponse.redirect(new URL(`/${url.search}`, req.url));
}
