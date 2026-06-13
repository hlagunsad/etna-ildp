import { describe, it, expect } from "vitest";
import { cycleReadiness, attainment } from "./readiness";

describe("cycleReadiness", () => {
  it("Behind when the annual TNA was missed (even if gaps look fine)", () => {
    expect(
      cycleReadiness({ items: [{ isCritical: true, status: "closed" }], tnaOnTimeThisYear: false }),
    ).toBe("behind");
  });
  it("Behind when a critical competency regressed", () => {
    expect(
      cycleReadiness({ items: [{ isCritical: true, status: "regressed" }], tnaOnTimeThisYear: true }),
    ).toBe("behind");
  });
  it("At Risk when a critical competency stalled", () => {
    expect(
      cycleReadiness({ items: [{ isCritical: true, status: "stalled" }], tnaOnTimeThisYear: true }),
    ).toBe("at_risk");
  });
  it("On Track otherwise", () => {
    expect(
      cycleReadiness({ items: [{ isCritical: true, status: "improving" }], tnaOnTimeThisYear: true }),
    ).toBe("on_track");
  });
  it("a non-critical stall does not lower readiness", () => {
    expect(
      cycleReadiness({
        items: [
          { isCritical: false, status: "stalled" },
          { isCritical: true, status: "improving" },
        ],
        tnaOnTimeThisYear: true,
      }),
    ).toBe("on_track");
  });
  it("regressed (Behind) outranks stalled (At Risk)", () => {
    expect(
      cycleReadiness({
        items: [
          { isCritical: true, status: "stalled" },
          { isCritical: true, status: "regressed" },
        ],
        tnaOnTimeThisYear: true,
      }),
    ).toBe("behind");
  });
});

describe("attainment", () => {
  it("is the percentage of competencies whose gap is closed", () => {
    expect(
      attainment([
        { isCritical: true, status: "closed" },
        { isCritical: false, status: "open" },
      ]),
    ).toEqual({ pctAll: 50, pctCritical: 100 });
  });
});
