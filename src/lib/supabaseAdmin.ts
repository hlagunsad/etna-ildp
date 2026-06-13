import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the SECRET key. It bypasses RLS, so it is used
 * exclusively in route handlers (after an in-code role + scope + separation-of-duties
 * check) to run the engine writes atomically. Never import this into client code.
 */
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
