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
