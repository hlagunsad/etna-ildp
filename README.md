# eTNA → ILDP

A competency development platform: admin-registered users take an annual **Training Needs Analysis (TNA)**, the system computes the gaps between their assessed levels and the target levels their role requires, and those gaps become a personal **Individual Learning & Development Plan (ILDP)** — tracked over a **3-year cycle**.

This is a focused MVP of a much larger spec, built to showcase its heart: **role-based access with separation of duties** and the **TNA → gap → ILDP cycle engine**.

**Live demo:** https://training-analyzer-ten.vercel.app — demo logins are shown on the sign-in page.

## Roles (RBAC, enforced server-side)
| Role | Adds, on top of being a learner |
|---|---|
| **Employee** | Take own TNA, view own gaps/ILDP, log training. |
| **Supervisor** | Validate their team's TNAs, endorse plans, verify training. |
| **HR / L&D Admin** | Org-wide: final ILDP approval, org reports, user management. |
| **Super Admin** | Everything + the audit log. |

Every user is also a learner with their own plan. **Separation of duties:** no one can validate their own TNA or approve their own ILDP.

## How it works
1. **Baseline (Year 1).** An employee self-rates each competency their role requires. A supervisor validates the ratings. The system locks the role's targets into the cycle, computes the gaps (`target − assessed`), and generates the ILDP.
2. **Gap engine.** Each gap gets a status (open / improving / stalled / regressed / closed / new / re-targeted) and a priority (`gap × weight × (critical ? 2 : 1)`). This pure logic is the unit-tested core.
3. **Annual re-assessment (Years 2–3).** The employee retakes the TNA; the system diffs the new levels against the locked targets *and* the previous year, updates the same plan in place, and writes a progress snapshot (the 3-year trend).
4. **Cycle close (Year 3).** *Passed* if all critical targets are met, else carry-over.

A demo **"Advance year"** control (HR / Super Admin) walks a cycle through all three years without waiting.

## Architecture notes
- **The gap / diff / readiness engine is pure** (`src/lib/gap.ts`, `rollup.ts`, `readiness.ts`, `cycle.ts`) — no I/O, exhaustively unit-tested, and reused by both the server route and the seed script so they can't drift.
- **Scope-aware RLS** (self / team / org) via `SECURITY DEFINER` helpers, with **separation of duties** in the policy `with check` (e.g. `cycle_owner <> auth.uid()`).
- The multi-table **validate → roll-up → gap → ILDP → snapshot → audit** transaction runs in a **server route holding the secret key**, after re-checking role + scope + SoD *in code*. RLS is defense-in-depth; the route is the real boundary (the same shape as a payment-confirm endpoint).
- **Immutable audit log** — no update/delete policy.

## Tech
Next.js (App Router) · TypeScript · Supabase (Postgres + Auth + RLS) · Tailwind · Vitest · Playwright · Vercel. Competency content seeded from the freely-reusable **DICT NICS** framework.

## Run locally
```bash
npm install

# .env.local:
#   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
#   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
#   SUPABASE_SECRET_KEY=sb_secret_...        # server-only: seed script + engine routes
#   # Optional integrations (absent = stubbed) — see docs/integrations.md:
#   # NEXT_PUBLIC_SSO_PROVIDERS=google,azure
#   # RESEND_API_KEY=re_...                  # server-only: email provider
#   # HRIS_BASE_URL=  /  LMS_BASE_URL=       # server-only: sync endpoints

# 1. Run the SQL files in supabase/migrations/ in order, in the Supabase SQL editor
#    (schema + scope-aware RLS + the DICT NICS domain seed, then the later phases).
# 2. Create the demo accounts + a validated baseline:
npm run seed

npm run dev        # http://localhost:3000
npm test           # Vitest unit tests (the gap/diff/readiness engine)
npm run test:e2e   # Playwright (employee → supervisor flow + RBAC)
```

## Tests
- **Unit (Vitest):** the deterministic core — gap sizing, the §5 diff-rule classifier with precedence, priority, readiness, cycle outcome, and role/SoD permission checks (38 assertions).
- **E2E (Playwright):** an employee takes a TNA → a supervisor validates it → the engine generates the prioritized plan; plus an RBAC negative test (an employee sees no management screens and no approval control).

## Scope (this is an MVP)
**Built:** 4-role RBAC + separation of duties (with a configurable permission matrix), the TNA → gap → ILDP 3-year engine, role dashboards, an org-unit hierarchy, team/org competency reporting (heatmap + CSV/PDF), a cycle scheduler, in-app notifications, bulk user/training CSV import, email invites, an immutable audit log, and seeded demo data.

**Spec'd but deferred:** MFA, competency/assessment-item CSV importers, deep RLS enforcement of the permission matrix, a full WCAG audit, and localization. External integrations (email, SSO, HRIS, LMS) ship as a stubbed adapter layer — see [docs/integrations.md](docs/integrations.md). Assessment data is sensitive personal information (PH Data Privacy Act, RA 10173) — this demo uses fabricated data.

## Credits
Competency library, proficiency levels, and target language adapted from the **DICT National ICT Competency Standards (NICS)**, which are freely reusable. The TESDA Self-Assessment Guides informed the "Can I…?" assessment format (the items here are our own wording).
