import { describe, it, expect } from "vitest";
import { gapSize, priority, classifyGapStatus, buildIldpItem } from "./gap";

describe("gapSize", () => {
  it("is target minus assessed, floored at zero", () => {
    expect(gapSize(3, 1)).toBe(2);
    expect(gapSize(3, 3)).toBe(0);
    expect(gapSize(2, 3)).toBe(0); // exceeding the target is not a negative gap
  });
  it("treats a null assessment as rank 0", () => {
    expect(gapSize(3, null)).toBe(3);
  });
});

describe("priority", () => {
  it("is gap × weight, doubled for critical competencies", () => {
    expect(priority(2, 1, false)).toBe(2);
    expect(priority(2, 3, false)).toBe(6);
    expect(priority(1, 3, true)).toBe(6);
  });
  it("lets a small critical gap outrank a larger non-critical one", () => {
    expect(priority(1, 2, true)).toBeGreaterThan(priority(2, 1, false)); // 4 > 2
  });
  it("is zero for a closed gap", () => {
    expect(priority(0, 5, true)).toBe(0);
  });
});

describe("classifyGapStatus", () => {
  it("Year 1 with a remaining gap → open", () => {
    expect(classifyGapStatus({ targetRank: 3, assessedRank: 1, previousRank: null })).toBe("open");
  });
  it("Year 1 with the target already met → closed", () => {
    expect(classifyGapStatus({ targetRank: 3, assessedRank: 3, previousRank: null })).toBe("closed");
  });
  it("closed beats a regression when the target is still met", () => {
    expect(classifyGapStatus({ targetRank: 3, assessedRank: 3, previousRank: 5 })).toBe("closed");
  });
  it("improving when assessed rose but is still below target", () => {
    expect(classifyGapStatus({ targetRank: 3, assessedRank: 2, previousRank: 1 })).toBe("improving");
  });
  it("stalled when assessed is unchanged and still below target", () => {
    expect(classifyGapStatus({ targetRank: 3, assessedRank: 2, previousRank: 2 })).toBe("stalled");
  });
  it("regressed when assessed fell below the previous year", () => {
    expect(classifyGapStatus({ targetRank: 3, assessedRank: 1, previousRank: 2 })).toBe("regressed");
  });
  it("new when the competency was newly added to the role and a gap remains", () => {
    expect(classifyGapStatus({ targetRank: 3, assessedRank: 1, previousRank: null, isNew: true })).toBe("new");
  });
  it("retargeted when the target changed mid-cycle and a gap remains", () => {
    expect(classifyGapStatus({ targetRank: 4, assessedRank: 2, previousRank: 2, isRetargeted: true })).toBe("retargeted");
  });
  it("a met target stays closed even when flagged new", () => {
    expect(classifyGapStatus({ targetRank: 2, assessedRank: 3, previousRank: null, isNew: true })).toBe("closed");
  });
  it("treats null assessed as rank 0", () => {
    expect(classifyGapStatus({ targetRank: 1, assessedRank: null, previousRank: null })).toBe("open");
  });
});

describe("buildIldpItem", () => {
  it("assembles gap, status, and priority", () => {
    const item = buildIldpItem({
      competencyId: "c1",
      targetRank: 3,
      assessedRank: 1,
      previousRank: null,
      baselineRank: 1,
      weight: 2,
      isCritical: true,
    });
    expect(item).toMatchObject({
      competencyId: "c1",
      gapSize: 2,
      status: "open",
      priority: 8, // 2 × 2 × 2
      assessedRank: 1,
      targetRank: 3,
      baselineRank: 1,
    });
  });
  it("a met competency yields gap 0, status closed, priority 0", () => {
    const item = buildIldpItem({
      competencyId: "c2",
      targetRank: 2,
      assessedRank: 2,
      previousRank: 1,
      baselineRank: 1,
      weight: 3,
      isCritical: true,
    });
    expect(item).toMatchObject({ gapSize: 0, status: "closed", priority: 0 });
  });
});
