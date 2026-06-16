import type { Role } from "./types";

export type Capability =
  | "take_own_tna"
  | "validate_tna"
  | "endorse_ildp"
  | "view_team"
  | "approve_ildp"
  | "view_org"
  | "manage_users"
  | "view_audit"
  | "advance_year"
  | "manage_library";

/** A role → granted-capabilities map. The DB `role_permission` table populates this at runtime. */
export type PermissionMatrix = Record<string, Capability[]>;

/** Display order + human labels for the permission-matrix editor. */
export const CAPABILITIES: Capability[] = [
  "take_own_tna",
  "validate_tna",
  "endorse_ildp",
  "approve_ildp",
  "advance_year",
  "view_team",
  "view_org",
  "view_audit",
  "manage_users",
  "manage_library",
];

export const CAPABILITY_LABEL: Record<Capability, string> = {
  take_own_tna: "Take own TNA",
  validate_tna: "Validate TNA",
  endorse_ildp: "Endorse ILDP",
  approve_ildp: "Approve ILDP",
  advance_year: "Advance cycle year",
  view_team: "View team",
  view_org: "View organization",
  view_audit: "View audit log",
  manage_users: "Manage users",
  manage_library: "Manage content library",
};

/**
 * The built-in defaults — the matrix the app ships with, and the fallback when the
 * `role_permission` table is empty/unseeded. super_admin holds every capability and is
 * also short-circuited in `canWith` so it can never be locked out.
 *
 * Mirrored in supabase/migrations/0008_capability_rls.sql (`default_has_cap`), which the RLS
 * policies consult — keep the two in sync if you change a role's default capabilities.
 */
export const DEFAULT_MATRIX: PermissionMatrix = {
  super_admin: [...CAPABILITIES],
  // Learner-scope (take_own_tna) is employees-only; management roles are not learners.
  hr_admin: CAPABILITIES.filter((c) => c !== "take_own_tna"),
  supervisor: ["validate_tna", "endorse_ildp", "view_team"],
  employee: ["take_own_tna"],
};

/**
 * Whether a role has a capability, against a given matrix. super_admin is always true
 * (omnipotent, lockout-proof). This is the client-side guard for showing/hiding controls;
 * the privileged secret-key routes re-check via `hasCapability`, and RLS is the DB backstop.
 */
export function canWith(matrix: PermissionMatrix, role: Role | null | undefined, cap: Capability): boolean {
  if (!role) return false;
  if (role === "super_admin") return true;
  return matrix[role]?.includes(cap) ?? false;
}

/** Convenience over the built-in defaults (keeps existing call sites + tests working). */
export function can(role: Role | null | undefined, cap: Capability): boolean {
  return canWith(DEFAULT_MATRIX, role, cap);
}

/**
 * Merge `role_permission` rows over the defaults: a role with ≥1 row becomes authoritative
 * (an omitted capability is revoked); a role with no rows keeps its defaults (so the app
 * still works before the 0003 migration seeds the table).
 */
export function buildMatrix(rows: { role: string; capability: string }[]): PermissionMatrix {
  const seeded = new Map<string, Capability[]>();
  for (const r of rows) {
    const list = seeded.get(r.role) ?? [];
    list.push(r.capability as Capability);
    seeded.set(r.role, list);
  }
  const matrix: PermissionMatrix = { ...DEFAULT_MATRIX };
  for (const [role, caps] of seeded) matrix[role] = caps;
  return matrix;
}

/** Separation of duties: an approver/validator must be a different person than the owner. */
export function canValidate(role: Role | null | undefined, actorId: string, ownerId: string): boolean {
  return can(role, "validate_tna") && actorId !== ownerId;
}

export function canEndorse(role: Role | null | undefined, actorId: string, ownerId: string): boolean {
  return can(role, "endorse_ildp") && actorId !== ownerId;
}

export function canApprove(role: Role | null | undefined, actorId: string, ownerId: string): boolean {
  return can(role, "approve_ildp") && actorId !== ownerId;
}
