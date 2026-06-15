import { describe, it, expect } from "vitest";
import { mapUserRow, mapTrainingRow, mapCompetencyRow, mapItemRow } from "./import";
import type { ProficiencyLevel } from "./types";

const jobRoleIdByName = new Map([["analyst", "jr1"]]);
const orgUnitIdByName = new Map([["it", "ou1"]]);

describe("mapUserRow", () => {
  it("maps a full valid row and carries the manager email", () => {
    const r = mapUserRow(
      { full_name: " Ann Lee ", email: "ann@x.com", role: "supervisor", org_unit: " IT ", job_role: "Analyst", manager_email: "boss@x.com", password: "secret12" },
      { jobRoleIdByName, orgUnitIdByName, callerRole: "hr_admin" },
    );
    expect(r).toEqual({
      ok: true,
      payload: { full_name: "Ann Lee", email: "ann@x.com", role: "supervisor", org_unit_id: "ou1", job_role_id: "jr1", password: "secret12" },
      managerEmail: "boss@x.com",
    });
  });
  it("defaults a blank role to employee and a blank job role to null", () => {
    const r = mapUserRow({ email: "a@b.com", role: "", job_role: "" }, { jobRoleIdByName, orgUnitIdByName, callerRole: "super_admin" });
    expect(r.ok && r.payload.role).toBe("employee");
    expect(r.ok && r.payload.job_role_id).toBeNull();
    expect(r.ok && r.payload.password).toBeUndefined();
    expect(r.ok && r.managerEmail).toBeUndefined();
  });
  it("rejects a missing or malformed email", () => {
    expect(mapUserRow({ email: "" }, { jobRoleIdByName, orgUnitIdByName, callerRole: "super_admin" })).toEqual({ ok: false, error: "Missing email" });
    expect(mapUserRow({ email: "nope" }, { jobRoleIdByName, orgUnitIdByName, callerRole: "super_admin" }).ok).toBe(false);
  });
  it("rejects an invalid role", () => {
    expect(mapUserRow({ email: "a@b.com", role: "boss" }, { jobRoleIdByName, orgUnitIdByName, callerRole: "super_admin" })).toEqual({ ok: false, error: "Invalid role: boss" });
  });
  it("blocks HR from creating admin accounts but lets super-admin do it", () => {
    expect(mapUserRow({ email: "a@b.com", role: "hr_admin" }, { jobRoleIdByName, orgUnitIdByName, callerRole: "hr_admin" }).ok).toBe(false);
    expect(mapUserRow({ email: "a@b.com", role: "super_admin" }, { jobRoleIdByName, orgUnitIdByName, callerRole: "hr_admin" }).ok).toBe(false);
    expect(mapUserRow({ email: "a@b.com", role: "hr_admin" }, { jobRoleIdByName, orgUnitIdByName, callerRole: "super_admin" }).ok).toBe(true);
  });
  it("rejects an unknown org unit", () => {
    expect(mapUserRow({ email: "a@b.com", org_unit: "Atlantis" }, { jobRoleIdByName, orgUnitIdByName, callerRole: "super_admin" })).toEqual({ ok: false, error: "Unknown org unit: Atlantis" });
  });
  it("rejects an unknown job role and a too-short password and a bad manager email", () => {
    expect(mapUserRow({ email: "a@b.com", job_role: "Wizard" }, { jobRoleIdByName, orgUnitIdByName, callerRole: "super_admin" })).toEqual({ ok: false, error: "Unknown job role: Wizard" });
    expect(mapUserRow({ email: "a@b.com", password: "short" }, { jobRoleIdByName, orgUnitIdByName, callerRole: "super_admin" }).ok).toBe(false);
    expect(mapUserRow({ email: "a@b.com", manager_email: "nope" }, { jobRoleIdByName, orgUnitIdByName, callerRole: "super_admin" }).ok).toBe(false);
  });
});

const competencyByCode = new Map([["nics-cyber", { id: "c1", scale_id: "s1" }]]);
const levels: ProficiencyLevel[] = [
  { id: "l1", scale_id: "s1", rank: 1, label: "Basic" },
  { id: "l2", scale_id: "s1", rank: 2, label: "Intermediate" },
  { id: "lx", scale_id: "s2", rank: 1, label: "Foundational" },
];

describe("mapTrainingRow", () => {
  it("maps a full valid row, resolving competency by code and level by label", () => {
    const r = mapTrainingRow(
      { title: " Sec 101 ", provider: "internal", url: " http://x ", competency_code: "NICS-CYBER", target_level: "Basic", mode: "online", cost: "100" },
      { competencyByCode, levels },
    );
    expect(r).toEqual({
      ok: true,
      payload: { title: "Sec 101", provider: "internal", url: "http://x", competency_id: "c1", target_level_id: "l1", mode: "online", cost: 100 },
    });
  });
  it("nulls blank optional fields and defaults blank cost to 0", () => {
    const r = mapTrainingRow({ title: "X", provider: "", mode: "", cost: "", url: "", competency_code: "", target_level: "" }, { competencyByCode, levels });
    expect(r).toEqual({ ok: true, payload: { title: "X", provider: null, url: null, competency_id: null, target_level_id: null, mode: null, cost: 0 } });
  });
  it("rejects missing title, bad provider/mode, and bad cost", () => {
    expect(mapTrainingRow({ title: "" }, { competencyByCode, levels })).toEqual({ ok: false, error: "Missing title" });
    expect(mapTrainingRow({ title: "X", provider: "youtube" }, { competencyByCode, levels }).ok).toBe(false);
    expect(mapTrainingRow({ title: "X", mode: "telepathy" }, { competencyByCode, levels }).ok).toBe(false);
    expect(mapTrainingRow({ title: "X", cost: "free" }, { competencyByCode, levels }).ok).toBe(false);
    expect(mapTrainingRow({ title: "X", cost: "-5" }, { competencyByCode, levels }).ok).toBe(false);
  });
  it("rejects an unknown competency code", () => {
    expect(mapTrainingRow({ title: "X", competency_code: "BOGUS" }, { competencyByCode, levels })).toEqual({ ok: false, error: "Unknown competency code: BOGUS" });
  });
  it("scopes the level to the competency's scale (a wrong-scale label errors)", () => {
    // Foundational only exists in scale s2; the competency is on s1 → error.
    expect(mapTrainingRow({ title: "X", competency_code: "NICS-CYBER", target_level: "Foundational" }, { competencyByCode, levels }).ok).toBe(false);
    // Without a competency, any level label resolves against all scales.
    const r = mapTrainingRow({ title: "X", target_level: "Foundational" }, { competencyByCode, levels });
    expect(r.ok && r.payload.target_level_id).toBe("lx");
  });
});

const scaleIdByName = new Map([["nics", "scaleA"]]);

describe("mapCompetencyRow", () => {
  it("maps a full valid row, resolving scale by name and lower-casing comp_group", () => {
    const r = mapCompetencyRow(
      { code: " NICS-X ", name: " New Comp ", description: " desc ", category: " Cat ", comp_group: "Core", scale: "NICS" },
      { scaleIdByName },
    );
    expect(r).toEqual({
      ok: true,
      payload: { code: "NICS-X", name: "New Comp", description: "desc", category: "Cat", comp_group: "core", scale_id: "scaleA" },
    });
  });
  it("nulls blank optional fields", () => {
    const r = mapCompetencyRow({ code: "C1", name: "N", scale: "NICS", description: "", category: "", comp_group: "" }, { scaleIdByName });
    expect(r).toEqual({ ok: true, payload: { code: "C1", name: "N", description: null, category: null, comp_group: null, scale_id: "scaleA" } });
  });
  it("rejects missing code/name/scale, an unknown scale, and a bad comp_group", () => {
    expect(mapCompetencyRow({ name: "N", scale: "NICS" }, { scaleIdByName })).toEqual({ ok: false, error: "Missing code" });
    expect(mapCompetencyRow({ code: "C", scale: "NICS" }, { scaleIdByName }).ok).toBe(false);
    expect(mapCompetencyRow({ code: "C", name: "N" }, { scaleIdByName })).toEqual({ ok: false, error: "Missing scale" });
    expect(mapCompetencyRow({ code: "C", name: "N", scale: "Ghost" }, { scaleIdByName })).toEqual({ ok: false, error: "Unknown scale: Ghost" });
    expect(mapCompetencyRow({ code: "C", name: "N", scale: "NICS", comp_group: "wizard" }, { scaleIdByName }).ok).toBe(false);
  });
});

describe("mapItemRow", () => {
  it("maps a full valid row, resolving competency by code and level by label (scoped to the scale)", () => {
    const r = mapItemRow(
      { competency_code: "NICS-CYBER", prompt_text: " Can I configure a firewall? ", level: "Basic", response_type: "yes_no" },
      { competencyByCode, levels },
    );
    expect(r).toEqual({
      ok: true,
      payload: { competency_id: "c1", prompt_text: "Can I configure a firewall?", response_type: "yes_no", level_id: "l1" },
    });
  });
  it("defaults response_type to yes_no and allows a blank level", () => {
    const r = mapItemRow({ competency_code: "NICS-CYBER", prompt_text: "X" }, { competencyByCode, levels });
    expect(r.ok && r.payload.response_type).toBe("yes_no");
    expect(r.ok && r.payload.level_id).toBeNull();
  });
  it("rejects missing competency_code/prompt, unknown competency, a wrong-scale level, and a bad response_type", () => {
    expect(mapItemRow({ prompt_text: "X" }, { competencyByCode, levels })).toEqual({ ok: false, error: "Missing competency_code" });
    expect(mapItemRow({ competency_code: "NICS-CYBER" }, { competencyByCode, levels })).toEqual({ ok: false, error: "Missing prompt_text" });
    expect(mapItemRow({ competency_code: "BOGUS", prompt_text: "X" }, { competencyByCode, levels })).toEqual({ ok: false, error: "Unknown competency code: BOGUS" });
    expect(mapItemRow({ competency_code: "NICS-CYBER", prompt_text: "X", level: "Foundational" }, { competencyByCode, levels }).ok).toBe(false);
    expect(mapItemRow({ competency_code: "NICS-CYBER", prompt_text: "X", response_type: "telepathy" }, { competencyByCode, levels }).ok).toBe(false);
  });
});
