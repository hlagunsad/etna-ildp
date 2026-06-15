# Integrations

The app talks to the outside world through a small **adapter layer** that is **stubbed by default** — nothing reaches an external service unless you configure it. Each integration has one obvious seam in the code, a clear *Configured vs Stubbed* status (visible to admins under **Admin → Integrations**), and the production wiring described below.

The pure, testable parts — email renderers, HRIS/LMS row mappers, and the env-driven status resolver — live in [`src/lib/integrations.ts`](../src/lib/integrations.ts) (unit-tested in `integrations.test.ts`). The routes under `src/app/api/integrations/` are thin and capability-gated.

| Integration | Default state | Lives in |
|---|---|---|
| **Email** | Invites live (Supabase); notifications logged | `api/users/create`, `lib/integrations.ts`, `supabase/functions/notification-email` |
| **SSO** | Off (password sign-in) | `SignIn.tsx`, `app/auth/callback` |
| **HRIS sync** | Dry-run stub | `api/integrations/hris/sync` |
| **LMS sync** | Dry-run stub | `api/integrations/lms/sync` |

## Status model
`integrationStatuses(env)` reads which env vars are set and returns, per integration, a `configured | stubbed` flag plus a **non-sensitive** detail string — never a key value. **Admin → Integrations** renders this (via `POST /api/integrations/status`, gated by `manage_users`) and offers a **Send test email** button (`POST /api/integrations/test-send`) that exercises the email adapter end to end.

---

## 1. Email
Two distinct flows.

### Invites — **live**
New accounts are created with **Supabase invites** (`auth.admin.inviteUserByEmail`) in [`src/app/api/users/create/route.ts`](../src/app/api/users/create/route.ts). Supabase sends a "set your password" email; the link returns to the app, where [`App.tsx`](../src/components/App.tsx) detects the recovery session and shows [`SetPassword.tsx`](../src/components/SetPassword.tsx). HR can opt into a temporary-password flow instead (a checkbox on the create-user form) for environments without email.

- **Enable:** works out of the box on Supabase's built-in email (rate-limited — fine for a demo). For production volume, configure **custom SMTP** in Supabase → Authentication → Emails.
- **Bulk import** stays on temporary passwords — the free-tier invite rate limit makes bulk-invite impractical. Switch it to invites once custom SMTP is in place.

### Notifications — **logged (stub)**
Every in-app notification is inserted by the `notify()` SQL function (migration `0005`) into the `notification` table — *including* the client-direct endorse/approve writes. So the production email path is a **single Database Webhook on `notification` INSERT → an Edge Function → your provider**. One seam covers every notification type.

- **Reference:** [`supabase/functions/notification-email/index.ts`](../supabase/functions/notification-email/index.ts) is a ready-to-adapt Edge Function (looks up the recipient's email, renders the message, calls Resend). It is **not deployed** by this repo and is excluded from the app's TypeScript build.
- **The adapter:** `EmailAdapter` + `getEmailAdapter(env)` in `lib/integrations.ts`. Today it returns `loggingEmailAdapter`, which records only the recipient + subject — **never the body**, which may carry a link or password. Swap in a Resend/SMTP adapter inside `getEmailAdapter` and callers don't change.
- **Enable:** set `RESEND_API_KEY`, then deploy the Edge Function and create the webhook.

---

## 2. Single sign-on (SSO)
Off by default — the app uses password sign-in. List providers in `NEXT_PUBLIC_SSO_PROVIDERS` (e.g. `google,azure`) and [`SignIn.tsx`](../src/components/SignIn.tsx) renders "Continue with …" buttons that call `signInWithOAuth`, redirecting to [`/auth/callback`](../src/app/auth/callback/route.ts).

- **Enable:** (1) turn the provider on in Supabase → Authentication → Providers (Google, Microsoft Entra/Azure AD, or SAML for enterprise IdPs); (2) set `NEXT_PUBLIC_SSO_PROVIDERS`. The callback hands the auth code back to the browser client, which establishes the session.
- **Hardening:** for the PKCE flow, exchange the code server-side via `@supabase/ssr` in the callback route. `redirectTo` is pinned to the app's own origin (no open redirect).

---

## 3. HRIS sync
Keeps `profiles` + `org_unit` in step with the system of record (Workday, BambooHR, SAP SuccessFactors, …). **Stub today:** `POST /api/integrations/hris/sync` (gated by `manage_users`) does a **dry run** — it maps a representative sample with the pure `mapHrisRecord` and returns what it *would* upsert, with no external call and no write.

- **Production:** on a schedule, pull the worker feed from `HRIS_BASE_URL`, map each record (`email`, `full_name`, `org_unit` by name → id, `manager_email`, `employment_status`), upsert profiles (reusing the `users/import` pattern), and mark leavers `status: disabled`. Manager links resolve in a second pass, as in the CSV import.
- **Enable:** set `HRIS_BASE_URL` (+ a server-only credential) and replace the sample with a fetch.
- **Security:** server-only (secret key); allowlist the base URL (SSRF); keep credentials server-side, never `NEXT_PUBLIC_`.

---

## 4. LMS sync
Pulls course completions from the LMS (Moodle, Cornerstone, TalentLMS, …) into `training_record`. **Stub today:** `POST /api/integrations/lms/sync` (gated by `manage_users`) maps a couple of real training records via `mapLmsCompletion` and returns what it *would* update — no external call, no write.

- **Production:** poll `LMS_BASE_URL` for completions, match each to a `training_record` by an external key, and set `status: completed`, `completed_at`, and `evidence_url` (the certificate). A supervisor still verifies (`verified_by`) per the existing RLS.
- **Enable:** set `LMS_BASE_URL` (+ a credential) and replace the sample with a fetch.
- **Security:** same as HRIS — server-only, allowlisted, credentials server-side.

---

## Security
- **Every** integration route is gated: `getUserFromRequest` (401) + `hasCapability(manage_users)` (403). A dedicated `manage_integrations` capability is a sensible future refinement.
- **No secret leaves the server.** The status resolver returns flags + non-sensitive detail only; the logging email adapter omits the message body; nothing integration-related is written to the audit log (widening `audit_log.action` to record syncs is a future migration).
- **Invites** use Supabase's single-use, expiring tokens; `SetPassword` only calls `updateUser({ password })` on the recovery session.
- **SSO** `redirectTo` is pinned to the app's own origin.
- **Sync routes** are server-only and make no external calls in stub mode; production must allowlist the provider base URL (SSRF) and keep credentials server-side.

## Environment variables
All optional — absent means *stubbed*.

| Var | Integration | Effect |
|---|---|---|
| `RESEND_API_KEY` | Email | Marks email *Configured*; wire a provider adapter + the notification Edge Function. Server-only. |
| `NEXT_PUBLIC_SSO_PROVIDERS` | SSO | Comma list (`google,azure`) → SSO buttons on the sign-in page. |
| `HRIS_BASE_URL` | HRIS | Endpoint for the worker feed (the live pull is a follow-up). Server-only. |
| `LMS_BASE_URL` | LMS | Endpoint for completions (the live poll is a follow-up). Server-only. |
