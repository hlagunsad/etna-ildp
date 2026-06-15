/** Pure row mappers for bulk CSV import. No I/O — all validation/branching lives here. */

import { COMP_GROUPS, MODES, PROVIDERS, type ProficiencyLevel } from "./types";
import { levelsForScale } from "./library";

export type MapResult<P> = { ok: true; payload: P; managerEmail?: string } | { ok: false; error: string };

const ROLES = ["super_admin", "hr_admin", "supervisor", "employee"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type UserPayload = {
  full_name: string | null;
  email: string;
  role: string;
  org_unit_id: string | null;
  job_role_id: string | null;
  password?: string;
};

/** Validate a users-CSV row against the same rules as /api/users/create. */
export function mapUserRow(
  row: Record<string, string>,
  ctx: { jobRoleIdByName: Map<string, string>; orgUnitIdByName: Map<string, string>; callerRole: string | null },
): MapResult<UserPayload> {
  const email = (row.email ?? "").trim();
  if (!email) return { ok: false, error: "Missing email" };
  if (!EMAIL_RE.test(email)) return { ok: false, error: `Invalid email: ${email}` };

  const role = (row.role ?? "").trim() || "employee";
  if (!ROLES.includes(role as (typeof ROLES)[number])) return { ok: false, error: `Invalid role: ${role}` };
  if (ctx.callerRole === "hr_admin" && (role === "super_admin" || role === "hr_admin")) {
    return { ok: false, error: "HR cannot create admin accounts" };
  }

  const jobRoleName = (row.job_role ?? "").trim();
  let job_role_id: string | null = null;
  if (jobRoleName) {
    const id = ctx.jobRoleIdByName.get(jobRoleName.toLowerCase());
    if (!id) return { ok: false, error: `Unknown job role: ${jobRoleName}` };
    job_role_id = id;
  }

  const orgUnitName = (row.org_unit ?? "").trim();
  let org_unit_id: string | null = null;
  if (orgUnitName) {
    const id = ctx.orgUnitIdByName.get(orgUnitName.toLowerCase());
    if (!id) return { ok: false, error: `Unknown org unit: ${orgUnitName}` };
    org_unit_id = id;
  }

  const password = (row.password ?? "").trim();
  if (password && password.length < 8) return { ok: false, error: "Password must be at least 8 characters" };

  const managerEmail = (row.manager_email ?? "").trim();
  if (managerEmail && !EMAIL_RE.test(managerEmail)) return { ok: false, error: `Invalid manager email: ${managerEmail}` };

  const payload: UserPayload = {
    full_name: (row.full_name ?? "").trim() || null,
    email,
    role,
    org_unit_id,
    job_role_id,
  };
  if (password) payload.password = password;
  return { ok: true, payload, managerEmail: managerEmail || undefined };
}

export type TrainingPayload = {
  title: string;
  provider: string | null;
  url: string | null;
  competency_id: string | null;
  target_level_id: string | null;
  mode: string | null;
  cost: number;
};

/** Validate a training-CSV row, resolving competency by code + level by label (scoped to that competency's scale). */
export function mapTrainingRow(
  row: Record<string, string>,
  ctx: { competencyByCode: Map<string, { id: string; scale_id: string }>; levels: ProficiencyLevel[] },
): MapResult<TrainingPayload> {
  const title = (row.title ?? "").trim();
  if (!title) return { ok: false, error: "Missing title" };

  const providerRaw = (row.provider ?? "").trim();
  if (providerRaw && !PROVIDERS.includes(providerRaw as (typeof PROVIDERS)[number])) {
    return { ok: false, error: `Invalid provider: ${providerRaw}` };
  }
  const modeRaw = (row.mode ?? "").trim();
  if (modeRaw && !MODES.includes(modeRaw as (typeof MODES)[number])) {
    return { ok: false, error: `Invalid mode: ${modeRaw}` };
  }

  const costRaw = (row.cost ?? "").trim();
  let cost = 0;
  if (costRaw) {
    const n = Number(costRaw);
    if (Number.isNaN(n) || n < 0) return { ok: false, error: `Invalid cost: ${costRaw}` };
    cost = n;
  }

  const code = (row.competency_code ?? "").trim();
  let comp: { id: string; scale_id: string } | null = null;
  if (code) {
    const found = ctx.competencyByCode.get(code.toLowerCase());
    if (!found) return { ok: false, error: `Unknown competency code: ${code}` };
    comp = found;
  }

  let target_level_id: string | null = null;
  const levelLabel = (row.target_level ?? "").trim();
  if (levelLabel) {
    const pool = comp ? levelsForScale(comp.scale_id, ctx.levels) : ctx.levels;
    const match = pool.find((l) => l.label.toLowerCase() === levelLabel.toLowerCase());
    if (!match) return { ok: false, error: `Unknown level: ${levelLabel}` };
    target_level_id = match.id;
  }

  return {
    ok: true,
    payload: {
      title,
      provider: providerRaw || null,
      url: (row.url ?? "").trim() || null,
      competency_id: comp?.id ?? null,
      target_level_id,
      mode: modeRaw || null,
      cost,
    },
  };
}

export type CompetencyPayload = {
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  comp_group: string | null;
  scale_id: string;
};

/** Validate a competency-CSV row, resolving the proficiency scale by name. */
export function mapCompetencyRow(
  row: Record<string, string>,
  ctx: { scaleIdByName: Map<string, string> },
): MapResult<CompetencyPayload> {
  const code = (row.code ?? "").trim();
  if (!code) return { ok: false, error: "Missing code" };
  const name = (row.name ?? "").trim();
  if (!name) return { ok: false, error: "Missing name" };

  const group = (row.comp_group ?? "").trim().toLowerCase();
  if (group && !COMP_GROUPS.includes(group as (typeof COMP_GROUPS)[number])) {
    return { ok: false, error: `Invalid comp_group: ${group}` };
  }

  const scaleName = (row.scale ?? "").trim();
  if (!scaleName) return { ok: false, error: "Missing scale" };
  const scale_id = ctx.scaleIdByName.get(scaleName.toLowerCase());
  if (!scale_id) return { ok: false, error: `Unknown scale: ${scaleName}` };

  return {
    ok: true,
    payload: {
      code,
      name,
      description: (row.description ?? "").trim() || null,
      category: (row.category ?? "").trim() || null,
      comp_group: group || null,
      scale_id,
    },
  };
}

const RESPONSE_TYPES = ["scale", "yes_no"] as const;

export type ItemPayload = {
  competency_id: string;
  prompt_text: string;
  response_type: string;
  level_id: string | null;
};

/** Validate an assessment-item-CSV row, resolving competency by code + level by label (scoped to that competency's scale). */
export function mapItemRow(
  row: Record<string, string>,
  ctx: { competencyByCode: Map<string, { id: string; scale_id: string }>; levels: ProficiencyLevel[] },
): MapResult<ItemPayload> {
  const code = (row.competency_code ?? "").trim();
  if (!code) return { ok: false, error: "Missing competency_code" };
  const comp = ctx.competencyByCode.get(code.toLowerCase());
  if (!comp) return { ok: false, error: `Unknown competency code: ${code}` };

  const prompt_text = (row.prompt_text ?? "").trim();
  if (!prompt_text) return { ok: false, error: "Missing prompt_text" };

  const response_type = (row.response_type ?? "").trim() || "yes_no";
  if (!RESPONSE_TYPES.includes(response_type as (typeof RESPONSE_TYPES)[number])) {
    return { ok: false, error: `Invalid response_type: ${response_type}` };
  }

  let level_id: string | null = null;
  const levelLabel = (row.level ?? "").trim();
  if (levelLabel) {
    const match = levelsForScale(comp.scale_id, ctx.levels).find((l) => l.label.toLowerCase() === levelLabel.toLowerCase());
    if (!match) return { ok: false, error: `Unknown level: ${levelLabel}` };
    level_id = match.id;
  }

  return { ok: true, payload: { competency_id: comp.id, prompt_text, response_type, level_id } };
}
