/** Pure helpers for the HR/Super-Admin content-library editors. No I/O — unit-tested. */

import type { ProficiencyLevel } from "./types";

export type DbErr = { code?: string; message: string } | null | undefined;

/**
 * Translate a Postgres/Supabase error into a friendly, user-facing message.
 * `ctx` lets each editor phrase the common violations in its own words.
 */
export function friendlyDbError(error: DbErr, ctx: { unique?: string; fk?: string } = {}): string {
  if (!error) return "";
  switch (error.code) {
    case "23505": // unique_violation
      return ctx.unique ?? "That value already exists.";
    case "23503": // foreign_key_violation
      return ctx.fk ?? "Can't do that — it's still in use elsewhere.";
    case "23502": // not_null_violation
      return "Please fill in all the required fields.";
    default:
      return error.message;
  }
}

/** The scale levels that still lack a (non-empty) indicator descriptor for a competency. */
export function missingDescriptors(
  scaleLevels: ProficiencyLevel[],
  descriptors: { level_id: string; indicator_text?: string | null }[],
): ProficiencyLevel[] {
  const filled = new Set(
    descriptors.filter((d) => (d.indicator_text ?? "").trim().length > 0).map((d) => d.level_id),
  );
  return scaleLevels.filter((l) => !filled.has(l.id));
}

/** Competencies not yet targeted for a role, so the add-target picker can't create a duplicate. */
export function availableTargetCompetencies<T extends { id: string }>(
  all: T[],
  alreadyTargeted: { competency_id: string }[],
): T[] {
  const taken = new Set(alreadyTargeted.map((t) => t.competency_id));
  return all.filter((c) => !taken.has(c.id));
}

/** The proficiency levels belonging to a given scale, ordered Basic→Advanced (by rank). */
export function levelsForScale(
  scaleId: string | null | undefined,
  levels: ProficiencyLevel[],
): ProficiencyLevel[] {
  if (!scaleId) return [];
  return levels.filter((l) => l.scale_id === scaleId).sort((a, b) => a.rank - b.rank);
}
