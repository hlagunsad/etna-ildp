import { describe, it, expect } from "vitest";
import {
  normalizeGapStatus,
  pickLatestYear,
  buildHeatmap,
  readinessDistribution,
  competencyRollup,
  orgUnitRollup,
  toCsv,
  type SnapshotRow,
  type CycleRow,
  type ProfileRow,
  type CompetencyRef,
  type TnaRow,
} from "./reporting";

// ── Fixtures ────────────────────────────────────────────────────────────────
// Competency names chosen so name-sort = Analytics(cB), Cybersecurity(cA), Writing(cC).
const COMPS: CompetencyRef[] = [
  { id: "cA", name: "Cybersecurity" },
  { id: "cB", name: "Analytics" },
  { id: "cC", name: "Writing" },
];
const CYCLES: CycleRow[] = [
  { id: "cyc1", user_id: "u1" },
  { id: "cyc2", user_id: "u2" },
];
const PROFILES: ProfileRow[] = [
  { id: "u1", full_name: "Ann", email: "ann@x", orgUnit: "IT" },
  { id: "u2", full_name: "Bob", email: "bob@x", orgUnit: null },
];
const SNAPS: SnapshotRow[] = [
  // u1 / cyc1 — year 1 then year 2 (latest wins)
  { dev_cycle_id: "cyc1", cycle_year: 1, competency_id: "cA", assessed_rank: 1, target_rank: 2, gap_status: "open" },
  { dev_cycle_id: "cyc1", cycle_year: 2, competency_id: "cA", assessed_rank: 2, target_rank: 3, gap_status: "improving" },
  { dev_cycle_id: "cyc1", cycle_year: 2, competency_id: "cB", assessed_rank: 3, target_rank: 3, gap_status: "closed" },
  // u2 / cyc2 — year 1 only
  { dev_cycle_id: "cyc2", cycle_year: 1, competency_id: "cA", assessed_rank: 1, target_rank: 3, gap_status: "regressed" },
  { dev_cycle_id: "cyc2", cycle_year: 1, competency_id: "cC", assessed_rank: 1, target_rank: null, gap_status: "open" },
];
const CRITICAL = new Set<string>(["cA"]);

const heat = () =>
  buildHeatmap({ snaps: SNAPS, cycles: CYCLES, profiles: PROFILES, competencies: COMPS, criticalByCompetency: CRITICAL });

// ── Tests ─────────────────────────────────────────────────────────────────
describe("normalizeGapStatus", () => {
  it("passes through a valid status", () => expect(normalizeGapStatus("regressed")).toBe("regressed"));
  it("maps null / unknown to open", () => {
    expect(normalizeGapStatus(null)).toBe("open");
    expect(normalizeGapStatus("bogus")).toBe("open");
  });
});

describe("pickLatestYear", () => {
  it("keeps only the max cycle_year rows per dev_cycle", () => {
    const latest = pickLatestYear(SNAPS);
    expect(latest.every((s) => !(s.dev_cycle_id === "cyc1" && s.cycle_year === 1))).toBe(true);
    expect(latest.filter((s) => s.dev_cycle_id === "cyc1").map((s) => s.cycle_year)).toEqual([2, 2]);
    expect(latest.filter((s) => s.dev_cycle_id === "cyc2")).toHaveLength(2); // cyc2 only has year 1
  });
});

describe("buildHeatmap", () => {
  it("builds columns from present competencies, sorted by name", () => {
    expect(heat().columns.map((c) => c.id)).toEqual(["cB", "cA", "cC"]); // Analytics, Cybersecurity, Writing
  });
  it("returns people sorted by name, one cell per column (absent → null)", () => {
    const { people } = heat();
    expect(people.map((p) => p.name)).toEqual(["Ann", "Bob"]);
    for (const p of people) expect(p.cells).toHaveLength(3);
    const ann = people[0];
    // columns [cB, cA, cC]: Ann has cB(closed) + cA(improving), no cC
    expect(ann.cells[0]?.label).toBe("3→3"); // cB closed
    expect(ann.cells[1]?.label).toBe("2→3"); // cA improving
    expect(ann.cells[2]).toBeNull(); // cC absent
  });
  it("labels a no-target cell with an em dash", () => {
    const bob = heat().people[1];
    expect(bob.cells[0]).toBeNull(); // cB absent for Bob
    expect(bob.cells[2]?.label).toBe("—"); // cC target null
  });
  it("derives readiness with the critical set (critical regressed → behind)", () => {
    const [ann, bob] = heat().people;
    expect(ann.readiness).toBe("on_track"); // only improving/closed
    expect(bob.readiness).toBe("behind"); // critical cA regressed
  });
  it("without the critical set, a regressed non-critical comp is not 'behind'", () => {
    const { people } = buildHeatmap({ snaps: SNAPS, cycles: CYCLES, profiles: PROFILES, competencies: COMPS, criticalByCompetency: new Set() });
    expect(people[1].readiness).not.toBe("behind");
  });
  it("counts open and critical gaps per person", () => {
    const [ann, bob] = heat().people;
    expect(ann.openGapCount).toBe(1); // cA improving (gap), cB closed (no)
    expect(ann.criticalGapCount).toBe(1); // cA critical
    expect(bob.openGapCount).toBe(1); // cA regressed (gap), cC no target (no)
  });
  it("skips snapshots whose cycle is not visible", () => {
    const withGhost: SnapshotRow[] = [
      ...SNAPS,
      { dev_cycle_id: "ghost", cycle_year: 1, competency_id: "cA", assessed_rank: 0, target_rank: 3, gap_status: "open" },
    ];
    const { people } = buildHeatmap({ snaps: withGhost, cycles: CYCLES, profiles: PROFILES, competencies: COMPS, criticalByCompetency: CRITICAL });
    expect(people.map((p) => p.userId).sort()).toEqual(["u1", "u2"]);
  });
});

describe("readinessDistribution", () => {
  it("counts people by readiness", () => {
    expect(readinessDistribution(heat().people)).toEqual({ on_track: 1, at_risk: 0, behind: 1 });
  });
});

describe("competencyRollup", () => {
  it("aggregates open gaps per competency, skipping closed / zero-gap, sorted by gap sum", () => {
    const rows = competencyRollup(pickLatestYear(SNAPS), COMPS, CRITICAL);
    expect(rows).toHaveLength(1); // only cA has gaps (cB closed, cC no target)
    expect(rows[0]).toMatchObject({ competencyId: "cA", name: "Cybersecurity", peopleWithGap: 2, gapSum: 3, isCritical: true });
  });
});

describe("orgUnitRollup", () => {
  it("groups by org unit (null → Unassigned) with readiness + open-gap counts, behind first", () => {
    const rows = orgUnitRollup(heat().people);
    expect(rows.map((r) => r.orgUnit)).toEqual(["Unassigned", "IT"]); // Bob (behind) sorts first
    const it = rows.find((r) => r.orgUnit === "IT")!;
    expect(it).toMatchObject({ headcount: 1, onTrack: 1, behind: 0, openGaps: 1 });
    const un = rows.find((r) => r.orgUnit === "Unassigned")!;
    expect(un).toMatchObject({ headcount: 1, behind: 1, openGaps: 1 });
  });
});

describe("toCsv", () => {
  it("escapes commas, quotes, and nulls; joins with CRLF", () => {
    const csv = toCsv(["a", "b"], [["x", "y"], ["p,q", 'he said "hi"'], [null, 1]]);
    expect(csv).toBe('a,b\r\n' + 'x,y\r\n' + '"p,q","he said ""hi"""\r\n' + ',1');
  });
});

describe("buildHeatmap readiness on-time", () => {
  it("an overdue, still-open TNA makes the person Behind", () => {
    const tnas: TnaRow[] = [
      { dev_cycle_id: "cyc1", cycle_year: 2, status: "in_progress", due_date: "2020-01-01" }, // Ann's current round, overdue
    ];
    const { people } = buildHeatmap({ snaps: SNAPS, cycles: CYCLES, profiles: PROFILES, competencies: COMPS, criticalByCompetency: CRITICAL, tnas, today: "2026-06-14" });
    expect(people.find((p) => p.userId === "u1")?.readiness).toBe("behind");
  });
});
