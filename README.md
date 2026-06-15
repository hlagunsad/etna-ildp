# eTNA → ILDP

A competency development platform: admin-registered users take an annual **Training Needs Analysis (TNA)**, the system computes the gaps between their assessed levels and the target levels their role requires, and those gaps become a personal **Individual Learning & Development Plan (ILDP)** — tracked over a **3-year cycle**.

It started as a focused slice of a much larger spec — **role-based access with separation of duties** and the **TNA → gap → ILDP cycle engine** — and grew into a full L&D platform (see [Features](#features)).

**Live demo:** https://training-analyzer-ten.vercel.app

| Demo login | Password | Role |
|---|---|---|
| `super@demo.test` | `lolom0panot000` | Super Admin |
| `hr@demo.test` | `lolom0panot111` | HR / L&D Admin |
| `supervisor@demo.test` | `lolom0panot222` | Supervisor |
| `employee@demo.test` | `lolom0panot333` | Employee (has a baseline) |
| `employee2@demo.test` | `lolom0panot444` | Employee (fresh) |

The sign-in page lists these too — tap a row to fill the form.

## Roles (RBAC, enforced server-side)
| Role | Adds, on top of being a learner |
|---|---|
| **Employee** | Take own TNA, view own gaps/ILDP, log training. |
| **Supervisor** | Validate their team's TNAs, endorse plans, verify training. |
| **HR / L&D Admin** | Org-wide: final ILDP approval, org reports, the content library, the cycle scheduler, user management, the audit log. |
| **Super Admin** | Everything, plus the configurable permission matrix. |

Every user is also a learner with their own plan. **Separation of duties:** no one can validate their own TNA or approve their own ILDP. Capabilities are a **configurable matrix** — a super-admin tunes which role holds which capability, enforced in the UI, the routes, *and* the database (RLS).

## How it works
1. **Baseline (Year 1).** An employee self-rates each competency their role requires. A supervisor validates the ratings. The system locks the role's targets into the cycle, computes the gaps (`target − assessed`), and generates the ILDP.
2. **Gap engine.** Each gap gets a status (open / improving / stalled / regressed / closed / new / re-targeted) and a priority (`gap × weight × (critical ? 2 : 1)`). This pure logic is the unit-tested core.
3. **Annual re-assessment (Years 2–3).** The employee retakes the TNA; the system diffs the new levels against the locked targets *and* the previous year, updates the same plan in place, and writes a progress snapshot (the 3-year trend).
4. **Cycle close (Year 3).** *Passed* if all critical targets are met, else carry-over.

HR can open and advance cycles in bulk from the **cycle scheduler**, or walk a single cycle through all three years with the **"Advance year"** control.

## Features
- **Role-based access (4 roles) with separation of duties** — plus a **configurable permission matrix** enforced in the UI, the privileged routes, *and* the database via RLS.
- **TNA → gap → ILDP engine** — annual self-assessment, a pure gap/diff/readiness classifier, and a 3-year development cycle.
- **Content library** — author competencies, proficiency scales, job roles + target levels, the training catalog, assessment items, and the org-unit tree.
- **Org-unit hierarchy** — a real org tree (parent units) that reporting and the scheduler group by.
- **Team & org reporting** — a competency-gap heatmap, by-competency and by-org-unit rollups, readiness distribution, and CSV / PDF export.
- **Cycle scheduler** — open development cycles in bulk, set TNA due dates, and advance every active cycle a year (or close it) at once.
- **In-app notifications** — a database-trigger-driven feed: TNA validated, plan endorsed/approved, cycle opened/advanced/closed.
- **Bulk CSV import** — users, training resources, competencies, and assessment items, each with a template and per-row results.
- **User onboarding** — email invites (Supabase) with a set-password flow, or a temporary password.
- **Integration layer** — a stub-by-default adapter seam for email, SSO, HRIS, and LMS, with an Admin status panel.
- **Immutable audit log** of every privileged action.

## Documentation
- **[Usage guide](docs/usage.md)** — how to use every part of the app, by role, with the full lifecycle and a status glossary.
- **[Integrations](docs/integrations.md)** — the email / SSO / HRIS / LMS adapter layer and how to configure each.

## Architecture notes
- **The gap / diff / readiness engine is pure** (`src/lib/gap.ts`, `rollup.ts`, `readiness.ts`, `cycle.ts`) — no I/O, exhaustively unit-tested, and reused by both the server route and the seed script so they can't drift.
- **Scope-aware RLS** (self / team / org) via `SECURITY DEFINER` helpers, with **separation of duties** in the policy `with check` (e.g. `cycle_owner <> auth.uid()`).
- **The permission matrix is data-driven** (`role_permission`): tuned in the UI, re-checked in the secret-key routes (`hasCapability`), and enforced at the database (`app_has_cap` in the RLS policies). Super-admin is always allowed, so it can never lock itself out.
- The multi-table **validate → roll-up → gap → ILDP → snapshot → audit** transaction runs in a **server route holding the secret key**, after re-checking role + scope + SoD *in code*. RLS is defense-in-depth; the route is the real boundary (the shape of a payment-confirm endpoint).
- **Notifications** are created by database triggers, so they fire even for client-direct writes; the outward edges (email / SSO / HRIS / LMS) sit behind a small adapter layer.
- **Immutable audit log** — no update/delete policy.

## Tech
Next.js 16 (App Router) · TypeScript · Supabase (Postgres + Auth + RLS) · Tailwind · Vitest · Playwright · Vercel. Competency content seeded from the freely-reusable **DICT NICS** framework.

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

# 1. Run the SQL files in supabase/migrations/ in order (0001 → 0008) in the
#    Supabase SQL editor — schema + scope-aware RLS + the DICT NICS seed, then
#    each later phase (deep TNA, permissions, notifications, org units, capability RLS).
# 2. Create the demo accounts + a validated baseline:
npm run seed

npm run dev        # http://localhost:3000
npm test           # Vitest unit tests
npm run test:e2e   # Playwright end-to-end
```

## Tests
- **Unit (Vitest):** the deterministic core — gap sizing, the §5 diff-rule classifier with precedence, priority, readiness, cycle outcome, role/SoD permission checks, and the CSV-import + reporting mappers (~130 assertions).
- **E2E (Playwright):** the employee → supervisor → HR flow plus RBAC, reporting, the cycle scheduler, bulk import, org units, notifications, and integrations (11 specs).

## Scope
**Built:** the full platform described in [Features](#features) — on seeded demo data, covered by ~130 unit assertions and 11 end-to-end specs.

**Spec'd but deferred:** MFA, a full WCAG audit, localization, and *real* external integrations (the email / SSO / HRIS / LMS adapter layer ships as documented stubs — see [docs/integrations.md](docs/integrations.md)). Assessment data is sensitive personal information (PH Data Privacy Act, RA 10173) — this demo uses fabricated data.

## Credits
Competency library, proficiency levels, and target language adapted from the **DICT National ICT Competency Standards (NICS)**, which are freely reusable. The TESDA Self-Assessment Guides informed the "Can I…?" assessment format (the items here are our own wording).
