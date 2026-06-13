/**
 * Roll TNA responses up to an assessed level per competency.
 *
 * MVP: one scale item per competency, so the response rank IS the assessed level.
 * A threshold or weighted-average (for multi-item competencies) plugs in here without
 * changing any caller.
 */
export function rollUpResponse(rawRank: number | null): number | null {
  return rawRank;
}

export function rollUpAssessment(
  responses: { competencyId: string; rank: number | null }[],
): Map<string, number | null> {
  const result = new Map<string, number | null>();
  for (const r of responses) result.set(r.competencyId, rollUpResponse(r.rank));
  return result;
}

/**
 * Roll a competency's yes/no "Can I…?" answers up to an assessed rank (0–3).
 *
 * The assessed rank is the highest level L such that EVERY level from Basic (1) up to L
 * meets the threshold (fraction of that level's items answered "yes" >= threshold),
 * contiguous from Basic. A passing level above a failing lower level does not count, and
 * a level with no items stops the walk. Rank 0 means Basic itself wasn't met.
 */
export function rollUpCompetency(
  items: { levelRank: number; yes: boolean }[],
  threshold = 0.5,
): number {
  const byLevel = new Map<number, { yes: number; total: number }>();
  for (const it of items) {
    const bucket = byLevel.get(it.levelRank) ?? { yes: 0, total: 0 };
    bucket.total += 1;
    if (it.yes) bucket.yes += 1;
    byLevel.set(it.levelRank, bucket);
  }
  let assessed = 0;
  for (let rank = 1; rank <= 3; rank++) {
    const bucket = byLevel.get(rank);
    if (!bucket || bucket.total === 0) break; // no evidence for this level → stop
    if (bucket.yes / bucket.total >= threshold) assessed = rank;
    else break; // first level that fails the threshold ends the contiguous walk
  }
  return assessed;
}
