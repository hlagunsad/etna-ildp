# eTNA → ILDP — what it is and how it works

## The idea
Organizations run a yearly "are our people at the level their jobs need?" exercise. This app does that end to end: each employee is measured against the competencies their role requires, the shortfalls become a personal development plan, and that plan is worked and re-measured every year for three years.

I built a focused slice of a large enterprise spec, choosing the two parts that make it interesting: **who is allowed to do what** (role-based access with real separation of duties), and **the engine that turns assessments into a prioritized plan**.

## The loop, in plain terms
- An employee rates themselves on each competency their role needs (Basic / Intermediate / Advanced).
- Their supervisor reviews and validates those ratings — and can't validate their own, by design.
- The system compares the validated levels to the role's targets, and every shortfall becomes a plan item with a status and a priority (a critical gap counts double).
- The plan moves through an approval chain — the employee acknowledges it, the supervisor endorses it, HR approves it — and no one can approve their own.
- Each following year the employee re-rates; the system compares against last year (improving? stalled? slipped back?), updates the same plan, and records a yearly snapshot that becomes a 3-year trend.
- At the end, the cycle either passes (all the critical targets met) or rolls the remaining gaps into a fresh cycle.

There's a demo "Advance year" button so you can watch one person move through all three years in a minute instead of three years.

## The parts I'm proud of
**The engine is pure and tested hard.** All the logic — the size of a gap, which of seven statuses it gets, its priority, whether someone is on-track / at-risk / behind, whether the cycle passed — lives in plain functions with no database in sight. That makes it fast to test exhaustively (every diff rule, every edge case), and the same functions run on the server *and* in the seed script, so the two can't drift apart.

**Access control is enforced where it counts.** The controls you can see depend on your role, but that's just convenience. The real rules live in the database (row-level security scoped to yourself, your team, or the whole org) and in the server endpoints, which re-check your role, your scope, and the separation-of-duties rule before doing anything. Even bypassing the UI, the database refuses to let you validate your own assessment or approve your own plan.

**The risky operation runs server-side.** Validating an assessment touches several tables at once and runs the gap engine. Doing that from the browser would be fragile and easy to tamper with, so it runs in one server endpoint holding the privileged key — the same pattern you'd use to confirm a payment.

## How it's tested
- **Unit tests** cover the engine: gap math, the year-over-year diff rules, prioritization, readiness, and the permission checks.
- **End-to-end tests** drive a real browser through the actual flow — an employee completes an assessment, a supervisor signs in and validates it, and the prioritized plan appears — plus a check that an employee simply cannot see or reach the management screens.

## Tech
Next.js (App Router) · TypeScript · Supabase (Postgres + Auth + Row-Level Security) · Tailwind · Vitest · Playwright · deployed on Vercel. Competency content from the freely-reusable DICT NICS framework.
