import type { SupabaseClient } from "@supabase/supabase-js";
import { canWith, DEFAULT_MATRIX, type Capability } from "./permissions";
import type { Role } from "./types";

/**
 * Server-side capability check against the configurable `role_permission` table, for the
 * secret-key routes. super_admin is always allowed (lockout-proof). A role with ≥1 row is
 * authoritative; a role with no rows (pre-0003 / unseeded) falls back to the built-in
 * defaults, so the routes keep working before the migration runs.
 */
export async function hasCapability(
  db: SupabaseClient,
  role: string | null | undefined,
  cap: Capability,
): Promise<boolean> {
  if (!role) return false;
  if (role === "super_admin") return true;
  const { data } = await db.from("role_permission").select("capability").eq("role", role);
  const rows = (data ?? []) as { capability: string }[];
  if (rows.length === 0) return canWith(DEFAULT_MATRIX, role as Role, cap); // unseeded → defaults
  return rows.some((r) => r.capability === cap);
}
