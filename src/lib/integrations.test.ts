import { describe, it, expect, vi } from "vitest";
import {
  renderInviteEmail,
  renderNotificationEmail,
  mapHrisRecord,
  mapLmsCompletion,
  integrationStatuses,
  loggingEmailAdapter,
  getEmailAdapter,
} from "./integrations";

describe("renderInviteEmail", () => {
  it("names the app + inviter and includes the accept link", () => {
    const r = renderInviteEmail({ appName: "Caliber", inviterName: "Hana HR", acceptUrl: "https://app/accept#tok" });
    expect(r.subject).toContain("Caliber");
    expect(r.text).toContain("Hana HR");
    expect(r.text).toContain("https://app/accept#tok");
    expect(r.text.toLowerCase()).toContain("set your password");
  });
  it("falls back to a generic greeting with no inviter", () => {
    const r = renderInviteEmail({ appName: "Caliber", acceptUrl: "https://app/accept" });
    expect(r.text.toLowerCase()).toContain("invited");
  });
});

describe("renderNotificationEmail", () => {
  it("uses the title as subject and includes body + app link", () => {
    const r = renderNotificationEmail({ title: "Competency Assessment validated", body: "Your Competency Assessment was validated.", appName: "Caliber", appUrl: "https://app" });
    expect(r.subject).toBe("Competency Assessment validated");
    expect(r.text).toContain("Your Competency Assessment was validated.");
    expect(r.text).toContain("https://app");
  });
  it("falls back to the title when there is no body", () => {
    const r = renderNotificationEmail({ title: "Cycle opened", body: null, appName: "Caliber", appUrl: "https://app" });
    expect(r.text).toContain("Cycle opened");
  });
});

const orgUnitIdByName = new Map([["it", "ou1"]]);

describe("mapHrisRecord", () => {
  it("maps a full record, resolving org unit + carrying the manager email", () => {
    const r = mapHrisRecord(
      { email: "ann@x.com", full_name: " Ann Lee ", department: "IT", manager_email: "boss@x.com", employment_status: "active" },
      { orgUnitIdByName },
    );
    expect(r).toEqual({
      ok: true,
      payload: { email: "ann@x.com", full_name: "Ann Lee", role: "employee", org_unit_id: "ou1", status: "active" },
      managerEmail: "boss@x.com",
    });
  });
  it("marks terminated employees disabled", () => {
    const r = mapHrisRecord({ email: "a@b.com", employment_status: "terminated" }, { orgUnitIdByName });
    expect(r.ok && r.payload.status).toBe("disabled");
  });
  it("rejects a missing/invalid email and an unknown org unit", () => {
    expect(mapHrisRecord({ email: "" }, { orgUnitIdByName })).toEqual({ ok: false, error: "Missing email" });
    expect(mapHrisRecord({ email: "nope" }, { orgUnitIdByName }).ok).toBe(false);
    expect(mapHrisRecord({ email: "a@b.com", department: "Atlantis" }, { orgUnitIdByName })).toEqual({ ok: false, error: "Unknown org unit: Atlantis" });
  });
});

const recordIdByExternalKey = new Map([["course-1:ann", "tr1"]]);

describe("mapLmsCompletion", () => {
  it("maps a completion to a training_record update", () => {
    const r = mapLmsCompletion(
      { external_key: "course-1:ann", completed_at: "2026-06-01T00:00:00Z", evidence_url: "https://lms/cert/1" },
      { recordIdByExternalKey },
    );
    expect(r).toEqual({
      ok: true,
      payload: { training_record_id: "tr1", status: "completed", completed_at: "2026-06-01T00:00:00Z", evidence_url: "https://lms/cert/1" },
    });
  });
  it("rejects a missing key, an unmatched key, and a missing completion date", () => {
    expect(mapLmsCompletion({ external_key: "" }, { recordIdByExternalKey }).ok).toBe(false);
    expect(mapLmsCompletion({ external_key: "ghost", completed_at: "x" }, { recordIdByExternalKey })).toEqual({ ok: false, error: "No matching training record: ghost" });
    expect(mapLmsCompletion({ external_key: "course-1:ann" }, { recordIdByExternalKey }).ok).toBe(false);
  });
});

describe("integrationStatuses", () => {
  it("reports stubbed when no integration env is set", () => {
    const s = integrationStatuses({});
    expect(s.map((x) => x.key)).toEqual(["email", "sso", "hris", "lms"]);
    expect(s.every((x) => x.status === "stubbed")).toBe(true);
  });
  it("reports configured per env flag", () => {
    const s = integrationStatuses({ RESEND_API_KEY: "re_123", NEXT_PUBLIC_SSO_PROVIDERS: "google, azure", HRIS_BASE_URL: "https://hris", LMS_BASE_URL: "" });
    const by = Object.fromEntries(s.map((x) => [x.key, x]));
    expect(by.email.status).toBe("configured");
    expect(by.sso.status).toBe("configured");
    expect(by.sso.detail).toContain("google");
    expect(by.hris.status).toBe("configured");
    expect(by.lms.status).toBe("stubbed"); // empty string is not configured
  });
  it("never leaks a secret value into the status detail", () => {
    const s = integrationStatuses({ RESEND_API_KEY: "re_SUPERSECRET", HRIS_BASE_URL: "https://hris" });
    for (const x of s) expect(x.detail).not.toContain("SUPERSECRET");
  });
});

describe("loggingEmailAdapter", () => {
  it("succeeds and never logs the message body (which may carry secrets)", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const res = await loggingEmailAdapter.send({ to: "a@b.com", subject: "Invite", text: "your password is HUNTER2 https://app/accept#token" });
    expect(res.ok).toBe(true);
    const logged = spy.mock.calls.flat().join(" ");
    expect(logged).not.toContain("HUNTER2");
    expect(logged).not.toContain("token");
    spy.mockRestore();
  });
  it("getEmailAdapter returns the logging stub by default", () => {
    expect(getEmailAdapter({}).name).toBe(loggingEmailAdapter.name);
  });
});
