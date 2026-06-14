import { describe, it, expect } from "vitest";
import { nextYear, isFinalYear, cycleOutcome, lockTargets, eligibleForCycle, isTnaOnTime } from "./cycle";
import type { Target } from "./types";

describe("nextYear / isFinalYear", () => {
  it("advances years 1 and 2 and ends after year 3", () => {
    expect(nextYear(1)).toBe(2);
    expect(nextYear(2)).toBe(3);
    expect(nextYear(3)).toBeNull();
    expect(isFinalYear(2)).toBe(false);
    expect(isFinalYear(3)).toBe(true);
  });
});

describe("lockTargets", () => {
  it("keeps only the snapshot fields the cycle needs", () => {
    const input = [
      { competencyId: "c1", targetRank: 3, weight: 2, isCritical: true, extra: "ignored" },
    ] as unknown as Target[];
    expect(lockTargets(input)).toEqual([
      { competencyId: "c1", targetRank: 3, weight: 2, isCritical: true },
    ]);
  });
});

describe("cycleOutcome", () => {
  it("passed when every critical competency is met", () => {
    expect(
      cycleOutcome([
        { isCritical: true, status: "closed" },
        { isCritical: false, status: "open" }, // non-critical gap doesn't block passing
      ]),
    ).toBe("passed");
  });
  it("carry_over when a critical competency is unmet", () => {
    expect(cycleOutcome([{ isCritical: true, status: "stalled" }])).toBe("carry_over");
  });
});

describe("eligibleForCycle", () => {
  const profiles: { id: string; job_role_id: string | null }[] = [
    { id: "u1", job_role_id: "jr1" }, // has a role
    { id: "u2", job_role_id: "jr2" }, // has a role + a cycle
    { id: "u3", job_role_id: null }, // no role
  ];
  it("returns only people with a job role and no existing cycle", () => {
    expect(eligibleForCycle(profiles, new Set(["u2"])).map((p) => p.id)).toEqual(["u1"]);
  });
  it("returns none when everyone has a cycle or lacks a role", () => {
    expect(eligibleForCycle(profiles, new Set(["u1", "u2"]))).toEqual([]);
  });
});

describe("isTnaOnTime", () => {
  const today = "2026-06-14";
  it("is on-time when there is no due date", () => {
    expect(isTnaOnTime({ due_date: null, status: "in_progress" }, today)).toBe(true);
  });
  it("is late when the deadline passed and the TNA is still open", () => {
    expect(isTnaOnTime({ due_date: "2026-06-01", status: "in_progress" }, today)).toBe(false);
    expect(isTnaOnTime({ due_date: "2026-06-01", status: "not_started" }, today)).toBe(false);
  });
  it("is on-time once submitted/validated, even past the deadline", () => {
    expect(isTnaOnTime({ due_date: "2026-06-01", status: "submitted" }, today)).toBe(true);
    expect(isTnaOnTime({ due_date: "2026-06-01", status: "validated" }, today)).toBe(true);
  });
  it("is on-time when the deadline is still in the future", () => {
    expect(isTnaOnTime({ due_date: "2026-12-31", status: "in_progress" }, today)).toBe(true);
  });
});
