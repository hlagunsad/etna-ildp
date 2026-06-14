import { describe, it, expect } from "vitest";
import { can, canValidate, canEndorse, canApprove, canWith, buildMatrix, DEFAULT_MATRIX } from "./permissions";
import type { Role } from "./types";

const ROLES: Role[] = ["employee", "supervisor", "hr_admin", "super_admin"];

describe("can()", () => {
  it("every role can take their own TNA (learner baseline)", () => {
    for (const r of ROLES) expect(can(r, "take_own_tna")).toBe(true);
  });
  it("only supervisor and up can validate / endorse / view team", () => {
    expect(can("employee", "validate_tna")).toBe(false);
    expect(can("supervisor", "validate_tna")).toBe(true);
    expect(can("supervisor", "endorse_ildp")).toBe(true);
    expect(can("supervisor", "view_team")).toBe(true);
  });
  it("only HR and super-admin can approve / view org / manage users / view audit / advance year", () => {
    expect(can("supervisor", "approve_ildp")).toBe(false);
    expect(can("hr_admin", "approve_ildp")).toBe(true);
    expect(can("hr_admin", "view_org")).toBe(true);
    expect(can("hr_admin", "view_audit")).toBe(true);
    expect(can("super_admin", "manage_users")).toBe(true);
    expect(can("super_admin", "advance_year")).toBe(true);
  });
  it("only HR and super-admin can author the content library", () => {
    expect(can("employee", "manage_library")).toBe(false);
    expect(can("supervisor", "manage_library")).toBe(false);
    expect(can("hr_admin", "manage_library")).toBe(true);
    expect(can("super_admin", "manage_library")).toBe(true);
  });
  it("a missing role can do nothing", () => {
    expect(can(null, "take_own_tna")).toBe(false);
    expect(can(undefined, "view_org")).toBe(false);
  });
});

describe("separation of duties", () => {
  it("a supervisor can validate a report's TNA but never their own", () => {
    expect(canValidate("supervisor", "actor", "someone-else")).toBe(true);
    expect(canValidate("supervisor", "self", "self")).toBe(false);
  });
  it("a supervisor cannot endorse their own ILDP", () => {
    expect(canEndorse("supervisor", "self", "self")).toBe(false);
  });
  it("HR cannot approve their own ILDP", () => {
    expect(canApprove("hr_admin", "self", "self")).toBe(false);
    expect(canApprove("hr_admin", "actor", "someone-else")).toBe(true);
  });
  it("an employee can neither validate nor approve, even for others", () => {
    expect(canValidate("employee", "a", "b")).toBe(false);
    expect(canApprove("employee", "a", "b")).toBe(false);
  });
});

describe("canWith (matrix-driven)", () => {
  it("super_admin is omnipotent — true even against an empty matrix", () => {
    expect(canWith({}, "super_admin", "manage_users")).toBe(true);
    expect(canWith({}, "super_admin", "manage_library")).toBe(true);
  });
  it("denies a missing role and a non-super role absent from the matrix", () => {
    expect(canWith(DEFAULT_MATRIX, null, "take_own_tna")).toBe(false);
    expect(canWith({}, "employee", "take_own_tna")).toBe(false);
  });
  it("reads grants from the given matrix for non-super roles", () => {
    expect(canWith(DEFAULT_MATRIX, "supervisor", "view_team")).toBe(true);
    expect(canWith(DEFAULT_MATRIX, "supervisor", "view_org")).toBe(false);
  });
});

describe("buildMatrix", () => {
  it("returns the defaults when there are no rows", () => {
    const m = buildMatrix([]);
    expect(m.supervisor).toContain("view_team");
    expect(m.employee).toEqual(["take_own_tna"]);
    expect(m.hr_admin).toContain("manage_library");
  });
  it("makes a role with rows authoritative (omitted cap = revoked) and leaves unseeded roles at default", () => {
    const m = buildMatrix([
      { role: "supervisor", capability: "view_org" },
      { role: "supervisor", capability: "view_team" },
    ]);
    expect([...m.supervisor].sort()).toEqual(["view_org", "view_team"]); // exactly the rows; validate_tna revoked
    expect(canWith(m, "supervisor", "validate_tna")).toBe(false);
    expect(canWith(m, "supervisor", "view_org")).toBe(true);
    expect(m.employee).toEqual(["take_own_tna"]); // unseeded → default
  });
});
