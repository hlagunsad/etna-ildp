import { describe, it, expect } from "vitest";
import { rollUpResponse, rollUpAssessment } from "./rollup";

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
