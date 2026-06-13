import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Identify the caller from the `Authorization: Bearer <supabase access token>` header.
 * Returns the Supabase user, or null if the token is missing/invalid.
 */
export async function getUserFromRequest(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const { data } = await getSupabaseAdmin().auth.getUser(token);
  return data.user;
}
