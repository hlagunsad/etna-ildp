/**
 * Central brand vocabulary. Rename the product or either of its two core features here
 * and the change flows through every label, page title, tab, and email that imports it.
 *
 * Internal identifiers intentionally keep their original names — they are never shown to
 * users: DB tables (`tna_response`, `ildp`, `dev_cycle`), capability keys (`take_own_tna`,
 * `validate_tna`, `endorse_ildp`, `approve_ildp`), and the `/api/tna/*` route paths.
 */
export const BRAND = {
  /** Product name. */
  app: "Caliber",
  /** The annual self-assessment an employee takes (formerly "TNA"). */
  assessment: "Competency Assessment",
  /** Short form, for tabs and other tight spaces. */
  assessmentShort: "Assessment",
  /** The development plan generated from the assessed gaps (formerly "ILDP"). */
  plan: "Growth Plan",
  /** Short form, for tabs and other tight spaces. */
  planShort: "Plan",
} as const;
