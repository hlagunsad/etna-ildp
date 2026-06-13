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
  department: string | null;
  status: string;
};

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
