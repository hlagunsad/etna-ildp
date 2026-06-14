import type { CycleOutcome, GapStatus, Target } from "./types";

/** The next cycle year, or null after Year 3 (cycle ends). */
export function nextYear(year: number): number | null {
  return year >= 3 ? null : year + 1;
}

export function isFinalYear(year: number): boolean {
  return year >= 3;
}

/** Snapshot only the target fields the cycle needs (locked at baseline). */
export function lockTargets(targets: Target[]): Target[] {
  return targets.map((t) => ({
    competencyId: t.competencyId,
    targetRank: t.targetRank,
    weight: t.weight,
    isCritical: t.isCritical,
  }));
}

/** End-of-cycle outcome: passed iff every critical competency is met (gap closed). */
export function cycleOutcome(items: { isCritical: boolean; status: GapStatus }[]): CycleOutcome {
  const allCriticalMet = items
    .filter((i) => i.isCritical)
    .every((i) => i.status === "closed");
  return allCriticalMet ? "passed" : "carry_over";
}

/** People the scheduler can open a cycle for: have a job role, no cycle yet. */
export function eligibleForCycle<T extends { id: string; job_role_id: string | null }>(
  profiles: T[],
  cycleUserIds: Set<string>,
): T[] {
  return profiles.filter((p) => p.job_role_id != null && !cycleUserIds.has(p.id));
}

// A TNA still awaiting the employee (not yet handed off for validation).
const OPEN_TNA_STATUSES = new Set(["not_started", "in_progress", "returned"]);

/**
 * Whether a TNA round is on time. No deadline → always on time; once submitted/validated
 * → on time; otherwise late only if the due date has passed. `today` is an ISO date
 * (YYYY-MM-DD) so string comparison is chronological.
 */
export function isTnaOnTime(tna: { due_date: string | null; status: string }, today: string): boolean {
  if (!tna.due_date) return true;
  if (!OPEN_TNA_STATUSES.has(tna.status)) return true;
  return tna.due_date >= today;
}
