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

/**
 * Whether a role has a capability. This mirrors the RLS policies and is the client-side
 * guard for showing/hiding controls — the database (RLS + the secret-key route checks)
 * is the real security boundary.
 */
export function can(role: Role | null | undefined, cap: Capability): boolean {
  if (!role) return false;
  const supervisorUp = role === "supervisor" || role === "hr_admin" || role === "super_admin";
  const hrUp = role === "hr_admin" || role === "super_admin";
  switch (cap) {
    case "take_own_tna":
      return true; // every authenticated user is a learner
    case "validate_tna":
    case "endorse_ildp":
    case "view_team":
      return supervisorUp;
    case "approve_ildp":
    case "view_org":
    case "manage_users":
    case "view_audit":
    case "advance_year":
    case "manage_library":
      return hrUp;
  }
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
