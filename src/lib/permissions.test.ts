import { describe, it, expect } from "vitest";
import { can, canValidate, canEndorse, canApprove } from "./permissions";
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
