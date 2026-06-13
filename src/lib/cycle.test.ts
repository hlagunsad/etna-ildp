import { describe, it, expect } from "vitest";
import { nextYear, isFinalYear, cycleOutcome, lockTargets } from "./cycle";
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
