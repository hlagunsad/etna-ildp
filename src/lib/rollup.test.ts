import { describe, it, expect } from "vitest";
import { rollUpResponse, rollUpAssessment, rollUpCompetency } from "./rollup";

describe("rollUpResponse", () => {
  it("maps a single scale response to the assessed rank (MVP identity)", () => {
    expect(rollUpResponse(2)).toBe(2);
    expect(rollUpResponse(null)).toBeNull();
  });
});

describe("rollUpAssessment", () => {
  it("builds a competency → rank map from responses", () => {
    const m = rollUpAssessment([
      { competencyId: "c1", rank: 2 },
      { competencyId: "c2", rank: null },
    ]);
    expect(m.get("c1")).toBe(2);
    expect(m.get("c2")).toBeNull();
    expect(m.size).toBe(2);
  });
});

// Build 9 items (3 per level), with `yesByLevel[r]` of level r's items answered "yes".
function items(yesByLevel: Record<number, number>): { levelRank: number; yes: boolean }[] {
  const out: { levelRank: number; yes: boolean }[] = [];
  for (const rank of [1, 2, 3]) {
    const yes = yesByLevel[rank] ?? 0;
    for (let i = 0; i < 3; i++) out.push({ levelRank: rank, yes: i < yes });
  }
  return out;
}

describe("rollUpCompetency", () => {
  it("all items yes → Advanced (3)", () => {
    expect(rollUpCompetency(items({ 1: 3, 2: 3, 3: 3 }))).toBe(3);
  });
  it("Advanced fails → Intermediate (2)", () => {
    expect(rollUpCompetency(items({ 1: 3, 2: 3, 3: 1 }))).toBe(2);
  });
  it("Intermediate fails → Basic (1), even though Advanced passes", () => {
    expect(rollUpCompetency(items({ 1: 3, 2: 1, 3: 3 }))).toBe(1);
  });
  it("Basic fails → 0", () => {
    expect(rollUpCompetency(items({ 1: 1, 2: 3, 3: 3 }))).toBe(0);
  });
  it("ignores a non-contiguous Advanced pass", () => {
    expect(rollUpCompetency(items({ 1: 2, 2: 0, 3: 3 }))).toBe(1);
  });
  it("threshold is inclusive: 2/3 passes at 0.5 but fails at 0.7", () => {
    expect(rollUpCompetency(items({ 1: 2, 2: 0, 3: 0 }))).toBe(1);
    expect(rollUpCompetency(items({ 1: 2, 2: 0, 3: 0 }), 0.7)).toBe(0);
  });
  it("no answers → 0", () => {
    expect(rollUpCompetency([])).toBe(0);
  });
});
