import type { GapInput, GapStatus } from "./types";

/** required − assessed, floored at 0. A null assessment counts as rank 0 (not assessed). */
export function gapSize(targetRank: number, assessedRank: number | null): number {
  return Math.max(0, targetRank - (assessedRank ?? 0));
}

/** priority = gap × weight × (critical ? 2 : 1) — drives ILDP ordering (spec §5). */
export function priority(gap: number, weight: number, isCritical: boolean): number {
  return gap * weight * (isCritical ? 2 : 1);
}

/**
 * Classify a competency's gap per the §5 annual-diff rules. Precedence:
 *   closed (assessed ≥ target — a met target beats a regression or a role-change flag)
 *   → new → retargeted → open (Year 1) → regressed → improving → stalled.
 */
export function classifyGapStatus(input: GapInput): GapStatus {
  const assessed = input.assessedRank ?? 0;
  const previous = input.previousRank;

  if (assessed >= input.targetRank) return "closed";
  if (input.isNew) return "new";
  if (input.isRetargeted) return "retargeted";
  if (previous === null) return "open"; // Year 1, gap remains
  if (assessed < previous) return "regressed";
  if (assessed > previous) return "improving";
  return "stalled"; // unchanged and still below target
}

/** Assemble the computed fields of an ILDP item (caller maps ranks → level ids). */
export function buildIldpItem(args: {
  competencyId: string;
  targetRank: number;
  assessedRank: number | null;
  previousRank: number | null;
  baselineRank: number | null;
  weight: number;
  isCritical: boolean;
  isNew?: boolean;
  isRetargeted?: boolean;
}): {
  competencyId: string;
  gapSize: number;
  status: GapStatus;
  priority: number;
  assessedRank: number;
  targetRank: number;
  baselineRank: number | null;
} {
  const gap = gapSize(args.targetRank, args.assessedRank);
  const status = classifyGapStatus(args);
  return {
    competencyId: args.competencyId,
    gapSize: gap,
    status,
    priority: priority(gap, args.weight, args.isCritical),
    assessedRank: args.assessedRank ?? 0,
    targetRank: args.targetRank,
    baselineRank: args.baselineRank,
  };
}
