/** Pure aggregation engine for the Reports area. No I/O — unit-tested. */

import { cycleReadiness } from "./readiness";
import { gapSize } from "./gap";
import type { GapStatus, Readiness } from "./types";

// ── Row shapes (the caller passes raw Supabase rows) ──────────────────────────
export type SnapshotRow = {
  dev_cycle_id: string;
  cycle_year: number;
  competency_id: string;
  assessed_rank: number | null;
  target_rank: number | null;
  gap_status: string | null;
};
export type CycleRow = { id: string; user_id: string };
export type ProfileRow = { id: string; full_name: string | null; email: string | null; department: string | null };
export type CompetencyRef = { id: string; name: string };

export type HeatCell = {
  assessedRank: number | null;
  targetRank: number | null;
  gapStatus: GapStatus;
  label: string;
} | null; // null = this competency has no snapshot for this person

export type PersonRow = {
  userId: string;
  name: string;
  department: string | null;
  cycleYear: number;
  readiness: Readiness;
  cells: HeatCell[];
  openGapCount: number;
  criticalGapCount: number;
};

export type Heatmap = { columns: CompetencyRef[]; people: PersonRow[] };

export type RollupRow = { competencyId: string; name: string; peopleWithGap: number; gapSum: number; isCritical: boolean };
export type DeptRow = { department: string; headcount: number; onTrack: number; atRisk: number; behind: number; openGaps: number };

const GAP_STATUSES: readonly string[] = ["open", "improving", "stalled", "regressed", "closed", "new", "retargeted"];

export function normalizeGapStatus(s: string | null | undefined): GapStatus {
  return s && GAP_STATUSES.includes(s) ? (s as GapStatus) : "open";
}

/** Keep only the rows at each dev_cycle's highest cycle_year (the current year per person). */
export function pickLatestYear(snaps: SnapshotRow[]): SnapshotRow[] {
  const maxByCycle = new Map<string, number>();
  for (const s of snaps) {
    const cur = maxByCycle.get(s.dev_cycle_id);
    if (cur === undefined || s.cycle_year > cur) maxByCycle.set(s.dev_cycle_id, s.cycle_year);
  }
  return snaps.filter((s) => maxByCycle.get(s.dev_cycle_id) === s.cycle_year);
}

function isOpenGap(s: SnapshotRow): boolean {
  return normalizeGapStatus(s.gap_status) !== "closed" && gapSize(s.target_rank ?? 0, s.assessed_rank) > 0;
}

/**
 * The person × competency matrix. The person set is driven off SNAPSHOTS
 * (→ dev_cycle.user_id), not the profiles list — a caller's own cycle-less
 * profile row must never become a heatmap row. Profiles is a name/dept lookup.
 */
export function buildHeatmap(input: {
  snaps: SnapshotRow[];
  cycles: CycleRow[];
  profiles: ProfileRow[];
  competencies: CompetencyRef[];
  criticalByCompetency: Set<string>;
}): Heatmap {
  const { snaps, cycles, profiles, competencies, criticalByCompetency } = input;
  const latest = pickLatestYear(snaps);
  const userByCycle = new Map(cycles.map((c) => [c.id, c.user_id]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const nameByComp = new Map(competencies.map((c) => [c.id, c.name]));

  type Bucket = { userId: string; cycleYear: number; byComp: Map<string, SnapshotRow> };
  const buckets = new Map<string, Bucket>();
  const colIds = new Set<string>();
  for (const s of latest) {
    const userId = userByCycle.get(s.dev_cycle_id);
    if (!userId) continue; // snapshot whose cycle isn't visible (RLS / stale) → ignore
    let b = buckets.get(userId);
    if (!b) {
      b = { userId, cycleYear: s.cycle_year, byComp: new Map() };
      buckets.set(userId, b);
    }
    b.byComp.set(s.competency_id, s);
    colIds.add(s.competency_id);
  }

  const columns: CompetencyRef[] = [...colIds]
    .map((id) => ({ id, name: nameByComp.get(id) ?? "—" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const people: PersonRow[] = [];
  for (const b of buckets.values()) {
    const prof = profileById.get(b.userId);
    const cells: HeatCell[] = columns.map((col) => {
      const s = b.byComp.get(col.id);
      if (!s) return null;
      const gapStatus = normalizeGapStatus(s.gap_status);
      const label = s.target_rank == null ? "—" : `${s.assessed_rank ?? 0}→${s.target_rank}`;
      return { assessedRank: s.assessed_rank, targetRank: s.target_rank, gapStatus, label };
    });
    const rows = [...b.byComp.values()];
    const readiness = cycleReadiness({
      items: rows.map((s) => ({ isCritical: criticalByCompetency.has(s.competency_id), status: normalizeGapStatus(s.gap_status) })),
      tnaOnTimeThisYear: true, // a snapshot exists only because a TNA was validated
    });
    people.push({
      userId: b.userId,
      name: prof?.full_name ?? prof?.email ?? "—",
      department: prof?.department ?? null,
      cycleYear: b.cycleYear,
      readiness,
      cells,
      openGapCount: rows.filter(isOpenGap).length,
      criticalGapCount: rows.filter((s) => criticalByCompetency.has(s.competency_id) && isOpenGap(s)).length,
    });
  }
  people.sort((a, b) => a.name.localeCompare(b.name));
  return { columns, people };
}

export function readinessDistribution(people: PersonRow[]): Record<Readiness, number> {
  const dist: Record<Readiness, number> = { on_track: 0, at_risk: 0, behind: 0 };
  for (const p of people) dist[p.readiness]++;
  return dist;
}

/** Per-competency open-gap rollup, sorted by total gap descending. */
export function competencyRollup(
  latest: SnapshotRow[],
  competencies: CompetencyRef[],
  criticalByCompetency: Set<string>,
): RollupRow[] {
  const nameByComp = new Map(competencies.map((c) => [c.id, c.name]));
  const agg = new Map<string, { peopleWithGap: number; gapSum: number }>();
  for (const s of latest) {
    if (!isOpenGap(s)) continue;
    const a = agg.get(s.competency_id) ?? { peopleWithGap: 0, gapSum: 0 };
    a.peopleWithGap += 1;
    a.gapSum += gapSize(s.target_rank ?? 0, s.assessed_rank);
    agg.set(s.competency_id, a);
  }
  return [...agg.entries()]
    .map(([competencyId, v]) => ({
      competencyId,
      name: nameByComp.get(competencyId) ?? "—",
      peopleWithGap: v.peopleWithGap,
      gapSum: v.gapSum,
      isCritical: criticalByCompetency.has(competencyId),
    }))
    .sort((a, b) => b.gapSum - a.gapSum || a.name.localeCompare(b.name));
}

export function departmentRollup(people: PersonRow[]): DeptRow[] {
  const agg = new Map<string, DeptRow>();
  for (const p of people) {
    const department = (p.department && p.department.trim()) || "Unassigned";
    const d = agg.get(department) ?? { department, headcount: 0, onTrack: 0, atRisk: 0, behind: 0, openGaps: 0 };
    d.headcount += 1;
    if (p.readiness === "on_track") d.onTrack += 1;
    else if (p.readiness === "at_risk") d.atRisk += 1;
    else d.behind += 1;
    d.openGaps += p.openGapCount;
    agg.set(department, d);
  }
  return [...agg.values()].sort((a, b) => b.behind - a.behind || b.headcount - a.headcount);
}

/** RFC-4180 CSV: quote a field only if it contains a quote, comma, or newline. */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null): string => {
    const s = v == null ? "" : String(v);
    return /["\,\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((row) => row.map(esc).join(",")).join("\r\n");
}
