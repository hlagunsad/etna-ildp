/** Shared domain types for the pure TNA → gap → ILDP engine. No I/O here. */

export type Role = "super_admin" | "hr_admin" | "supervisor" | "employee";

/** Gap status for a competency, per the spec §5 annual-diff rules. */
export type GapStatus =
  | "open" // Year 1 (no previous), gap remains
  | "improving"
  | "stalled"
  | "regressed"
  | "closed" // assessed ≥ target — achieved
  | "new" // competency newly added to the role this cycle
  | "retargeted"; // target changed mid-cycle

export type Readiness = "on_track" | "at_risk" | "behind";

export type CycleOutcome = "passed" | "carry_over";

/** A locked role target (stored in dev_cycle.snapshot_of_targets). Ranks, not level ids. */
export type Target = {
  competencyId: string;
  targetRank: number;
  weight: number;
  isCritical: boolean;
};

/** Input to the gap classifier for one competency at one TNA. */
export type GapInput = {
  targetRank: number;
  assessedRank: number | null; // null → treated as rank 0 (not assessed)
  previousRank: number | null; // null in Year 1 (baseline)
  isNew?: boolean; // competency newly added to the role this cycle
  isRetargeted?: boolean; // target changed mid-cycle
};

// ---- Database row shapes (loosely typed; the DB is the source of truth) ----

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  manager_id: string | null;
  job_role_id: string | null;
  org_unit_id: string | null;
  status: string;
};

export type OrgUnit = { id: string; name: string; description: string | null; parent_id: string | null };

export type Competency = {
  id: string;
  code: string;
  name: string;
  comp_group: string | null;
  description: string | null;
};

export type Level = { id: string; rank: number; label: string };

export type DevCycle = {
  id: string;
  user_id: string;
  baseline_year: number;
  current_year: number;
  status: string;
  snapshot_of_targets: Target[];
};

export type Tna = {
  id: string;
  dev_cycle_id: string;
  cycle_year: number;
  type: string;
  status: string;
  due_date?: string | null;
  validated_by: string | null;
};

export type Ildp = {
  id: string;
  dev_cycle_id: string;
  status: string;
  acknowledged_by: string | null;
  endorsed_by: string | null;
  approved_by: string | null;
};

export type IldpItem = {
  id: string;
  ildp_id: string;
  competency_id: string;
  baseline_level_id: string | null;
  target_level_id: string | null;
  current_level_id: string | null;
  gap_size: number;
  priority: number;
  gap_status: GapStatus;
  item_status: string;
};

export type Snapshot = {
  id: string;
  dev_cycle_id: string;
  cycle_year: number;
  competency_id: string;
  assessed_rank: number | null;
  target_rank: number | null;
  gap_size: number | null;
  gap_status: string | null;
};

// ---- Reference-content (library) row shapes — authored by HR/Super-Admin ----
// Kept separate from the narrow engine types above (Competency/Level) on purpose:
// widening those would ripple through loadLookups / the gap engine.

export const COMP_GROUPS = ["core", "common", "technical"] as const;
export const PROVIDERS = ["internal", "e-tesda", "coursebank", "external"] as const;
export const MODES = ["online", "classroom", "on-the-job"] as const;

export type Scale = { id: string; name: string };

export type ProficiencyLevel = { id: string; scale_id: string; rank: number; label: string };

export type CompetencyRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  comp_group: string | null;
  scale_id: string;
};

export type LevelDescriptor = {
  id: string;
  competency_id: string;
  level_id: string;
  indicator_text: string;
};

export type JobRoleRow = {
  id: string;
  name: string;
  description: string | null;
  department: string | null;
};

export type RoleTarget = {
  id: string;
  job_role_id: string;
  competency_id: string;
  target_level_id: string;
  weight: number;
  is_critical: boolean;
};

export type TrainingResource = {
  id: string;
  title: string;
  provider: string | null;
  url: string | null;
  competency_id: string | null;
  target_level_id: string | null;
  mode: string | null;
  cost: number | null;
};

export type AssessmentItem = {
  id: string;
  competency_id: string;
  prompt_text: string;
  response_type: string;
  level_id: string | null;
};
