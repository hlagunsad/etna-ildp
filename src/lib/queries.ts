import { getSupabase } from "./supabase";
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
