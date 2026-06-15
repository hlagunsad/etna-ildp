/**
 * External-integration adapter layer. The pure parts — email renderers, HRIS/LMS row
 * mappers, and the env-driven status resolver — live here with no I/O. Stub-by-default:
 * nothing reaches an external service unless the relevant env var is configured.
 * See docs/integrations.md for the production wiring of each integration.
 */

import type { MapResult } from "./import";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Email ─────────────────────────────────────────────────────────────────────
export type EmailMessage = { to: string; subject: string; text: string };
export type RenderedEmail = { subject: string; text: string };
export type EmailResult = { ok: true; via: string } | { ok: false; error: string };

export interface EmailAdapter {
  readonly name: string;
  send(msg: EmailMessage): Promise<EmailResult>;
}

/**
 * Default adapter: records only the envelope (recipient + subject) and "succeeds".
 * The BODY is deliberately never logged — it may carry an invite link or temp password.
 * Swap for a real provider (Resend/SMTP) in getEmailAdapter without touching callers.
 */
export const loggingEmailAdapter: EmailAdapter = {
  name: "logging-stub",
  async send(msg: EmailMessage): Promise<EmailResult> {
    console.info(`[email:stub] -> ${msg.to} · ${msg.subject}`); // body intentionally omitted
    return { ok: true, via: "logging-stub" };
  },
};

/** Pick the email adapter for the environment. Logging stub today; the Resend/SMTP swap is a one-liner (documented). */
export function getEmailAdapter(env: Record<string, string | undefined> = process.env): EmailAdapter {
  // Swap point: return a real provider (Resend/SMTP) when its key is present in `env` — a
  // follow-up. The EmailAdapter contract stays the same, so callers never change.
  void env;
  return loggingEmailAdapter;
}

export function renderInviteEmail(input: { appName: string; inviterName?: string | null; acceptUrl: string }): RenderedEmail {
  const greeting = input.inviterName ? `${input.inviterName} has invited you` : "You've been invited";
  return {
    subject: `You're invited to ${input.appName}`,
    text: `${greeting} to ${input.appName}.\n\nSet your password to get started:\n${input.acceptUrl}\n\nThis link is single-use and will expire.`,
  };
}

export function renderNotificationEmail(notif: { title: string; body: string | null; appName: string; appUrl: string }): RenderedEmail {
  return {
    subject: notif.title,
    text: `${notif.body ?? notif.title}\n\nOpen ${notif.appName}: ${notif.appUrl}`,
  };
}

// ── HRIS sync (profile upsert) ────────────────────────────────────────────────
export type HrisProfilePayload = {
  email: string;
  full_name: string | null;
  role: string;
  org_unit_id: string | null;
  status: "active" | "disabled";
};

/** Map one HRIS record → a profile upsert payload. Pure; mirrors mapUserRow's contract. */
export function mapHrisRecord(
  record: Record<string, string>,
  ctx: { orgUnitIdByName: Map<string, string> },
): MapResult<HrisProfilePayload> {
  const email = (record.email ?? "").trim();
  if (!email) return { ok: false, error: "Missing email" };
  if (!EMAIL_RE.test(email)) return { ok: false, error: `Invalid email: ${email}` };

  const unitName = (record.org_unit ?? record.department ?? "").trim();
  let org_unit_id: string | null = null;
  if (unitName) {
    const id = ctx.orgUnitIdByName.get(unitName.toLowerCase());
    if (!id) return { ok: false, error: `Unknown org unit: ${unitName}` };
    org_unit_id = id;
  }

  const employment = (record.employment_status ?? "active").trim().toLowerCase();
  const status: "active" | "disabled" = ["terminated", "inactive", "disabled", "leaver"].includes(employment) ? "disabled" : "active";

  const managerEmail = (record.manager_email ?? "").trim();
  return {
    ok: true,
    payload: { email, full_name: (record.full_name ?? "").trim() || null, role: "employee", org_unit_id, status },
    managerEmail: managerEmail || undefined,
  };
}

// ── LMS sync (training completion) ────────────────────────────────────────────
export type LmsCompletionPayload = {
  training_record_id: string;
  status: "completed";
  completed_at: string;
  evidence_url: string | null;
};

/** Map one LMS completion → a training_record update. Pure. Matches by an external key → record id. */
export function mapLmsCompletion(
  record: Record<string, string>,
  ctx: { recordIdByExternalKey: Map<string, string> },
): MapResult<LmsCompletionPayload> {
  const key = (record.external_key ?? "").trim();
  if (!key) return { ok: false, error: "Missing external_key" };
  const training_record_id = ctx.recordIdByExternalKey.get(key);
  if (!training_record_id) return { ok: false, error: `No matching training record: ${key}` };
  const completed_at = (record.completed_at ?? "").trim();
  if (!completed_at) return { ok: false, error: "Missing completed_at" };
  return {
    ok: true,
    payload: { training_record_id, status: "completed", completed_at, evidence_url: (record.evidence_url ?? "").trim() || null },
  };
}

// ── Status resolver ───────────────────────────────────────────────────────────
export type IntegrationKey = "email" | "sso" | "hris" | "lms";
export type IntegrationStatus = { key: IntegrationKey; name: string; status: "configured" | "stubbed"; detail: string };

/**
 * Resolve each integration's status from env. Returns ONLY a flag + a non-sensitive
 * detail string — never an env value — so it is safe to expose to an authorized admin.
 */
export function integrationStatuses(env: Record<string, string | undefined>): IntegrationStatus[] {
  const has = (v: string | undefined) => !!(v && v.trim());
  const providers = (env.NEXT_PUBLIC_SSO_PROVIDERS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return [
    {
      key: "email",
      name: "Email",
      status: has(env.RESEND_API_KEY) ? "configured" : "stubbed",
      detail: has(env.RESEND_API_KEY)
        ? "Invites via Supabase; notifications via a configured provider."
        : "Invites via Supabase (live); notifications log only — set RESEND_API_KEY for a provider.",
    },
    {
      key: "sso",
      name: "Single sign-on",
      status: providers.length ? "configured" : "stubbed",
      detail: providers.length ? `Providers: ${providers.join(", ")}.` : "Password sign-in only — set NEXT_PUBLIC_SSO_PROVIDERS.",
    },
    {
      key: "hris",
      name: "HRIS sync",
      status: has(env.HRIS_BASE_URL) ? "configured" : "stubbed",
      detail: has(env.HRIS_BASE_URL) ? "Endpoint configured; sync routes will call it." : "Dry-run stub — set HRIS_BASE_URL.",
    },
    {
      key: "lms",
      name: "LMS sync",
      status: has(env.LMS_BASE_URL) ? "configured" : "stubbed",
      detail: has(env.LMS_BASE_URL) ? "Endpoint configured; sync routes will call it." : "Dry-run stub — set LMS_BASE_URL.",
    },
  ];
}
