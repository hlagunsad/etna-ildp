import type { GapStatus, Readiness } from "./types";

export type ReadinessItem = { isCritical: boolean; status: GapStatus };

/**
 * Cycle readiness (spec §5):
 *   Behind  — the annual TNA was missed, OR any critical competency regressed.
 *   At Risk — any critical competency stalled.
 *   On Track — otherwise.
 */
export function cycleReadiness(args: {
  items: ReadinessItem[];
  tnaOnTimeThisYear: boolean;
}): Readiness {
  if (!args.tnaOnTimeThisYear) return "behind";
  const critical = args.items.filter((i) => i.isCritical);
  if (critical.some((i) => i.status === "regressed")) return "behind";
  if (critical.some((i) => i.status === "stalled")) return "at_risk";
  return "on_track";
}

/** Percentage of competencies (all, and critical-only) whose gap is closed. */
export function attainment(items: ReadinessItem[]): { pctAll: number; pctCritical: number } {
  const pctClosed = (xs: ReadinessItem[]) =>
    xs.length === 0 ? 100 : Math.round((xs.filter((i) => i.status === "closed").length / xs.length) * 100);
  return { pctAll: pctClosed(items), pctCritical: pctClosed(items.filter((i) => i.isCritical)) };
}
