import { getSupabase } from "./supabase";
import { buildMatrix, type PermissionMatrix } from "./permissions";
import type {
  Competency,
  CompetencyRow,
  DevCycle,
  Ildp,
  IldpItem,
  Level,
  ProficiencyLevel,
  Scale,
  Snapshot,
  Target,
  Tna,
} from "./types";

export async function loadLookups(): Promise<{ competencies: Competency[]; levels: Level[] }> {
  const sb = getSupabase();
  const [{ data: comps }, { data: levels }] = await Promise.all([
    sb.from("competency").select("id, code, name, comp_group, description"),
    sb.from("proficiency_level").select("id, rank, label"),
  ]);
  return { competencies: (comps ?? []) as Competency[], levels: (levels ?? []) as Level[] };
}

/**
 * Sibling lookups for the content-library editors: the full scale/level/competency
 * rows needed to populate cross-table dropdowns (e.g. a training's competency + level).
 */
export async function loadLibrary(): Promise<{
  scales: Scale[];
  levels: ProficiencyLevel[];
  competencies: CompetencyRow[];
}> {
  const sb = getSupabase();
  const [{ data: scales }, { data: levels }, { data: comps }] = await Promise.all([
    sb.from("proficiency_scale").select("id, name").order("name"),
    sb.from("proficiency_level").select("id, scale_id, rank, label").order("rank"),
    sb.from("competency").select("id, code, name, description, category, comp_group, scale_id").order("code"),
  ]);
  return {
    scales: (scales ?? []) as Scale[],
    levels: (levels ?? []) as ProficiencyLevel[],
    competencies: (comps ?? []) as CompetencyRow[],
  };
}

export type Board = {
  cycle: DevCycle | null;
  tnas: Tna[];
  ildp: Ildp | null;
  items: IldpItem[];
  snapshots: Snapshot[];
};

/** Load a user's whole development picture (RLS scopes what the caller may see). */
export async function loadBoard(userId: string): Promise<Board> {
  const sb = getSupabase();
  const { data: cycle } = await sb.from("dev_cycle").select("*").eq("user_id", userId).maybeSingle();
  if (!cycle) return { cycle: null, tnas: [], ildp: null, items: [], snapshots: [] };

  const [{ data: tnas }, { data: ildp }, { data: snapshots }] = await Promise.all([
    sb.from("tna_assessment").select("*").eq("dev_cycle_id", cycle.id).order("cycle_year", { ascending: false }),
    sb.from("ildp").select("*").eq("dev_cycle_id", cycle.id).maybeSingle(),
    sb.from("progress_snapshot").select("*").eq("dev_cycle_id", cycle.id),
  ]);

  let items: IldpItem[] = [];
  if (ildp) {
    const { data } = await sb.from("ildp_item").select("*").eq("ildp_id", ildp.id);
    items = (data ?? []) as IldpItem[];
  }

  return {
    cycle: cycle as DevCycle,
    tnas: (tnas ?? []) as Tna[],
    ildp: (ildp ?? null) as Ildp | null,
    items,
    snapshots: (snapshots ?? []) as Snapshot[],
  };
}

export type ReportData = {
  cycles: { id: string; user_id: string; current_year: number; snapshot_of_targets: Target[] }[];
  snapshots: Snapshot[];
  profiles: { id: string; full_name: string | null; email: string | null; department: string | null }[];
  competencies: Competency[];
  criticalByCompetency: Set<string>;
  tnas: { dev_cycle_id: string; cycle_year: number; status: string; due_date: string | null }[];
};

/**
 * Everything the Reports area needs, in one round trip. The four selects are
 * UNFILTERED — Row-Level Security scopes them automatically: org-wide for HR/super
 * (is_admin), only-direct-reports for a supervisor (is_manager_of). No role branching.
 */
export async function loadReportData(): Promise<ReportData> {
  const sb = getSupabase();
  const [lk, { data: cycles }, { data: snapshots }, { data: profiles }, { data: tnas }] = await Promise.all([
    loadLookups(),
    sb.from("dev_cycle").select("id, user_id, current_year, snapshot_of_targets"),
    sb.from("progress_snapshot").select("dev_cycle_id, cycle_year, competency_id, assessed_rank, target_rank, gap_size, gap_status"),
    sb.from("profiles").select("id, full_name, email, department"),
    sb.from("tna_assessment").select("dev_cycle_id, cycle_year, status, due_date"),
  ]);
  const cyc = (cycles ?? []) as ReportData["cycles"];
  const criticalByCompetency = new Set<string>();
  for (const c of cyc) for (const t of c.snapshot_of_targets ?? []) if (t.isCritical) criticalByCompetency.add(t.competencyId);
  return {
    cycles: cyc,
    snapshots: (snapshots ?? []) as Snapshot[],
    profiles: (profiles ?? []) as ReportData["profiles"],
    competencies: lk.competencies,
    criticalByCompetency,
    tnas: (tnas ?? []) as ReportData["tnas"],
  };
}

/**
 * The configurable permission matrix from `role_permission`, merged over the built-in
 * defaults. If the table is missing/empty (pre-0003), this yields the defaults.
 */
export async function loadPermissionMatrix(): Promise<PermissionMatrix> {
  const { data } = await getSupabase().from("role_permission").select("role, capability");
  return buildMatrix((data ?? []) as { role: string; capability: string }[]);
}
