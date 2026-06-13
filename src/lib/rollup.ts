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
