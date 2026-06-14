import { describe, it, expect } from "vitest";
import {
  friendlyDbError,
  missingDescriptors,
  availableTargetCompetencies,
  levelsForScale,
} from "./library";
import type { ProficiencyLevel } from "./types";

const L = (id: string, scale_id: string, rank: number): ProficiencyLevel => ({ id, scale_id, rank, label: `L${rank}` });

describe("friendlyDbError", () => {
  it("returns an empty string when there is no error", () => {
    expect(friendlyDbError(null)).toBe("");
    expect(friendlyDbError(undefined)).toBe("");
  });
  it("maps a unique violation (23505) to the supplied message, else a generic one", () => {
    expect(friendlyDbError({ code: "23505", message: "dup" }, { unique: "Code already exists." })).toBe("Code already exists.");
    expect(friendlyDbError({ code: "23505", message: "dup" })).toBe("That value already exists.");
  });
  it("maps a foreign-key violation (23503) to the supplied fk message, else a generic 'in use' one", () => {
    expect(friendlyDbError({ code: "23503", message: "fk" }, { fk: "Still used by a TNA." })).toBe("Still used by a TNA.");
    expect(friendlyDbError({ code: "23503", message: "fk" })).toMatch(/in use/i);
  });
  it("maps a not-null violation (23502) to a required-fields message", () => {
    expect(friendlyDbError({ code: "23502", message: "null value" })).toMatch(/required/i);
  });
  it("passes through the raw message for unknown / missing codes", () => {
    expect(friendlyDbError({ code: "XX999", message: "boom" })).toBe("boom");
    expect(friendlyDbError({ message: "no code" })).toBe("no code");
  });
});

describe("missingDescriptors", () => {
  const levels = [L("b", "s1", 1), L("i", "s1", 2), L("a", "s1", 3)];
  it("returns every level when there are no descriptors", () => {
    expect(missingDescriptors(levels, []).map((l) => l.id)).toEqual(["b", "i", "a"]);
  });
  it("excludes levels that already have a non-empty indicator", () => {
    expect(missingDescriptors(levels, [{ level_id: "b", indicator_text: "can do X" }]).map((l) => l.id)).toEqual(["i", "a"]);
  });
  it("treats blank / whitespace indicators as still missing", () => {
    expect(missingDescriptors(levels, [{ level_id: "b", indicator_text: "   " }]).map((l) => l.id)).toEqual(["b", "i", "a"]);
  });
  it("returns none when every level is filled", () => {
    const ds = [
      { level_id: "b", indicator_text: "x" },
      { level_id: "i", indicator_text: "y" },
      { level_id: "a", indicator_text: "z" },
    ];
    expect(missingDescriptors(levels, ds)).toEqual([]);
  });
});

describe("availableTargetCompetencies", () => {
  const all = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];
  it("drops competencies that are already targeted", () => {
    expect(availableTargetCompetencies(all, [{ competency_id: "c2" }]).map((c) => c.id)).toEqual(["c1", "c3"]);
  });
  it("returns all of them when nothing is targeted yet", () => {
    expect(availableTargetCompetencies(all, []).map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
  });
});

describe("levelsForScale", () => {
  const levels = [L("a", "s1", 3), L("b", "s1", 1), L("x", "s2", 1), L("i", "s1", 2)];
  it("returns only the scale's levels, ordered by rank", () => {
    expect(levelsForScale("s1", levels).map((l) => l.id)).toEqual(["b", "i", "a"]);
  });
  it("returns an empty list for a null or unknown scale", () => {
    expect(levelsForScale(null, levels)).toEqual([]);
    expect(levelsForScale("nope", levels)).toEqual([]);
  });
});
