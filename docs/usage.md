# Usage guide

How to use eTNA → ILDP, by role, end to end. New here? Read [Getting started](#getting-started) and [The TNA → ILDP lifecycle](#the-tna--ildp-lifecycle), then jump to your role.

## Contents
- [Getting started](#getting-started)
- [The TNA → ILDP lifecycle](#the-tna--ildp-lifecycle)
- [Employee guide](#employee-guide)
- [Supervisor guide](#supervisor-guide)
- [HR / L&D Admin guide](#hr--ld-admin-guide)
- [Super Admin guide](#super-admin-guide)
- [Feature guides](#feature-guides)
- [Glossary](#glossary)

---

## Getting started

eTNA → ILDP turns an annual competency self-assessment into a personal, supervisor-validated development plan tracked over three years. People rate themselves against the levels their role requires, a supervisor signs off, and the system turns the gaps into a prioritised plan with mapped training.

**Open the demo:** https://training-analyzer-ten.vercel.app

Sign in with any of the demo accounts (the sign-in page lists them — tap a row to fill the form):

| Login | Password | Role |
|---|---|---|
| `super@demo.test` | `lolom0panot000` | Super Admin |
| `hr@demo.test` | `lolom0panot111` | HR / L&D Admin |
| `supervisor@demo.test` | `lolom0panot222` | Supervisor |
| `employee@demo.test` | `lolom0panot333` | Employee — already has a validated baseline |
| `employee2@demo.test` | `lolom0panot444` | Employee — no cycle yet, good for walking the flow from scratch |

If single sign-on is configured, "Continue with …" buttons appear above the demo list; otherwise it's email + password.

### Finding your way around

The left sidebar (a slide-out drawer on mobile) holds your tabs. What you see depends on your role:

| Tab | Who sees it |
|---|---|
| My Development, My TNA, My ILDP, My Training | Everyone |
| Team | Supervisor, HR, Super Admin |
| Organization | HR, Super Admin |
| Cycles | HR, Super Admin |
| Reports | Supervisor, HR, Super Admin |
| Library | HR, Super Admin |
| Admin | HR, Super Admin (the permission matrix inside it is Super-Admin-only) |

A **notification bell** sits at the top of the sidebar (and the mobile header) with an unread count — see [Notifications](#notifications). Whatever your role, you're also a learner with your own four "My …" tabs.

---

## The TNA → ILDP lifecycle

The whole app revolves around one loop, run once a year for three years.

```
Year 1 (baseline)
  Employee takes TNA  ──submit──►  Supervisor validates
                                          │
                                gaps computed, ILDP generated
                                          ▼
  Employee acknowledges ──► Supervisor endorses ──► HR approves ──► plan active
                                                                        │
                  Employee logs training  ◄────────────────────────────┘

Years 2–3 (re-assessment)
  HR advances the year ──► new TNA opens ──► employee retakes ──► supervisor validates
                          (diffed vs locked targets + last year; the same plan is updated)

End of Year 3 ──► cycle closes: passed (all critical gaps closed) or carry-over
```

Step by step:

1. **Baseline.** An employee starts their TNA. The system locks the target levels their job role requires into the cycle — so later library edits don't move the goalposts mid-cycle — and opens the first self-assessment.
2. **Self-assessment.** The employee checks off the "Can I …?" statements they can already do. Their level for each competency is worked out from the answers.
3. **Validation.** A supervisor reviews and validates. That one action computes the gaps (target − assessed), classifies each, sets a priority, and generates the ILDP.
4. **Approval chain.** The employee acknowledges the plan, the supervisor endorses it, and HR gives final approval. Now it's active.
5. **Training.** The employee works through courses mapped to their open gaps and marks progress; a supervisor can verify completion.
6. **Re-assessment (Years 2–3).** HR advances the year, which opens a fresh TNA. On validation the system compares the new levels against both the locked targets and last year's, updates the same plan in place, and records the year's snapshot for the trend.
7. **Close.** After Year 3 the cycle is **passed** if every critical competency is at or above target, otherwise **carry-over**.

Every status word above is defined in the [Glossary](#glossary).

---

## Employee guide

Your four tabs: **My Development**, **My TNA**, **My ILDP**, **My Training**.

### My Development
Your home screen. Before you've started it invites you to **Start baseline TNA**. Once you have a cycle it shows:
- Your **cycle year** (1–3) and plan status, and a **readiness** pill — On Track, At Risk, or Behind.
- **Competency gaps, by priority** — your open gaps, highest-priority first, each with its current → target level and status.
- **3-year trend** — your assessed level per year, so you can see movement.

### My TNA
Your self-assessment for the current year.
- With no cycle yet, **Start baseline TNA** opens one (this locks your role's targets for the three years).
- While it's open you get one card per competency, with "Can I …?" statements grouped by level (Basic, Intermediate, Advanced). Check everything you can already do.
- **Save draft** keeps your progress; **Submit for validation** sends it to your supervisor. After submitting it's read-only until they validate.

Your level for each competency is derived from your answers — you don't pick a level directly.

### My ILDP
Your development plan, and where it sits in the approval chain: **Draft → Endorsement → Approval → Active**.
- When the plan is freshly generated you'll see **Acknowledge plan** — confirm you've reviewed it to send it on for endorsement.
- **Plan items** lists each competency with its gap size, priority, and status.

A plan only appears once your TNA has been validated.

### My Training
Free courses mapped to your open gaps.
- One card per open gap, with the courses that target it. Each course has a link, a **Start** button, and **Mark completed**.
- Your supervisor verifies completions. Closed gaps drop off the list.

---

## Supervisor guide

You have everything an employee has, plus **Team** and **Reports**.

### My Team
Your direct reports, as cards. Each shows their org unit and current cycle / TNA / ILDP status, with an **Action needed** flag when something is waiting on you (a submitted TNA, or a plan ready to endorse). Open a card for the member's detail.

### Acting on a member
A member's detail shows whichever actions apply right now:
- **Validate TNA** — when their TNA is submitted. This is the big one: it computes their gaps and generates their plan.
- **Endorse ILDP** — when their plan is awaiting endorsement.
- **Advance year** — if you've been granted it.

Below the buttons is the member's own development view, so you can see what you're signing off.

**Separation of duties:** you can't validate or endorse your *own* TNA or plan — those actions only appear for other people, and someone else handles yours.

### Reports
A competency-gap heatmap across your direct reports, plus readiness and rollups — see [Reports](#reports-heatmap-and-rollups).

### Verifying training
When a report marks a course completed you can verify it — and, by the same rule, the verifier can't be the learner.

---

## HR / L&D Admin guide

HR sees the whole organisation and owns the content and the cycle calendar. On top of the supervisor tabs you get **Organization**, **Cycles**, **Library**, and **Admin**.

### Organization
The org-wide view: headline counts (cycles, validated TNAs, cycles passed), a **most-gapped competencies** table (who to train, on what), and the **ILDP approval queue** — plans waiting for final sign-off, each with an **Approve** button.

### Approving plans
Approval is HR's step in the chain, after the supervisor's endorsement. Approve from the Organization queue or from a member's detail. As with validation and endorsement, you can't approve your own plan.

### Cycles — the scheduler
**Cycles** runs the development calendar for everyone at once (full detail in [Cycle scheduler](#cycle-scheduler)).
- **Open cycles** starts a baseline cycle + TNA for everyone who has a job role but no cycle yet. Optionally limit it to one org unit and set a TNA due date.
- **Advance the year** moves every active cycle to its next year (opening a new annual TNA), or closes it at Year 3 with an outcome.

### Library — the content
**Library** is where the competency framework lives. Edits apply to *new* cycles; assessments already under way keep their targets locked at baseline. Seven tabs: Competencies, Scales, Job roles & targets, Training catalog, Assessment items, Org units, and Import — see [Content library](#content-library).

### Admin — users and the audit log
- **Create user account** — add a person and choose **Send an invite email** (they get a link to set their own password) or untick it to set a temporary password yourself. Assign role, org unit, job role, and manager.
- **Import users (CSV)** — the same, in bulk; see [Bulk CSV import](#bulk-csv-import).
- **Integrations** — the status of email / SSO / HRIS / LMS, with **Send test email**; see [Integrations](#integrations).
- **Audit log** — an append-only record of every privileged action (who, what, when). It can't be edited or deleted.

---

## Super Admin guide

Everything HR can do, plus one thing only you control: the **permission matrix**. (The audit log in Admin is shared with HR.)

### Permissions matrix
**Admin → Permissions** is a grid of roles × capabilities. Tick or untick a capability for a role and it takes effect immediately — in the UI, in the privileged routes, and at the database. Detail in [Permissions](#permissions-matrix).

Two guarantees:
- **Super Admin always holds every capability** and can't be locked out, so any change is reversible.
- Revoking a capability is enforced for real: even the writes that go straight from the browser (endorse, approve, library edits) are blocked at the database, not just hidden in the UI.

---

## Feature guides

### Content library
Each tab authors one kind of content:
- **Competencies** — the skills being assessed (code, name, group: core / common / technical, and the scale they use).
- **Scales** — proficiency scales and their level labels (e.g. Basic / Intermediate / Advanced).
- **Job roles & targets** — for each role, the target level per competency, which ones are **critical**, and a weight that feeds gap priority.
- **Training catalog** — courses, with provider, mode, cost, and the competency they develop.
- **Assessment items** — the "Can I …?" statements, grouped by competency and level.
- **Org units** — the org tree (a unit can sit under a parent). People are assigned to units in Admin.
- **Import** — bulk-load the above from CSV (below).

Because targets are snapshotted into each cycle when it starts, editing the library never disturbs an assessment already running.

### Reports (heatmap and rollups)
Supervisors see their team; HR sees the whole org (the data is scoped automatically). The report has:
- **Headline stats** — people in scope, the readiness split (On Track / At Risk / Behind), and open critical gaps.
- **The heatmap** — a person × competency grid. Each cell shows `assessed→target` for the person's current year, coloured by gap status; a dash means the competency isn't targeted for them.
- **Gaps by competency** — where the biggest needs are, with a Critical flag.
- **By org unit** — headcount and readiness per unit.
- **Export CSV** (opens cleanly in Excel) and **Print / PDF**.

### Cycle scheduler
The org-wide calendar.
- **Eligible to open** counts people who have a job role but no cycle yet; **Open cycles** starts a baseline for them (optionally filtered to one org unit, with a TNA due date).
- **Advance the year** advances every active cycle — a confirm step guards it — opening a new annual TNA or closing Year 3 with an outcome.
- **Overdue TNAs** flags cycles whose due date has passed while the TNA is still open; these pull a person's readiness down.

Each bulk action returns a per-person result: opened, advanced, closed, skipped, or error.

### Notifications
The bell shows an unread count and opens a feed. The person notified is always the employee, never the actor. They're told when:
- their **TNA is validated** (their plan is ready),
- their **ILDP is endorsed**, then **approved** (now active),
- a **cycle is opened** for them, **advances** a year, or **closes**.

Click a notification to jump to the relevant screen, or **Mark all read**. The feed loads when you open it (there's no live push yet, so a brand-new item may need a re-open).

### Bulk CSV import
Two places, one pattern: **Admin → Import users**, and **Library → Import** for competencies, assessment items, and training — in that order, since each builds on the one before.

Every importer lets you **download a template**, paste or upload a CSV, **preview** the parsed rows, then import, and shows a per-row result table (created / skipped / error, with a reason). Columns:
- **Users** — `full_name, email (required), role, org_unit, job_role, manager_email, password`. Leave password blank to auto-generate one (shown once); a manager listed in the same file is linked afterward; existing emails are skipped.
- **Competencies** — `code, name, scale (required), description, category, comp_group`. Scale is matched by name; existing codes are skipped.
- **Assessment items** — `competency_code, prompt_text (required), level, response_type`. Competency by code, level by label.
- **Training** — `title (required), provider, url, competency_code, target_level, mode, cost`.

Values resolve to records by their human label (a job role, a scale, a competency code), so a wrong value reports a clear per-row error instead of a broken insert.

### Permissions matrix
Ten capabilities gate the app:

| Capability | Lets the role… |
|---|---|
| `take_own_tna` | take their own TNA |
| `validate_tna` | validate a report's TNA |
| `endorse_ildp` | endorse a plan |
| `approve_ildp` | give a plan final approval |
| `advance_year` | open / advance cycles |
| `view_team` | see their team and team reports |
| `view_org` | see org-wide data |
| `view_audit` | see the audit log and Admin |
| `manage_users` | create / import users |
| `manage_library` | author the content library |

Defaults: employees take their own TNA; supervisors add validate / endorse / view-team; HR holds all ten; Super Admin always holds all ten. A Super Admin can retune any role's set in **Admin → Permissions**, and the change takes effect everywhere at once — the UI, the privileged routes, and the database — so a revoked capability is genuinely blocked, even for a direct API call.

### Integrations
**Admin → Integrations** shows each external service — Email, SSO, HRIS, LMS — as **Configured** or **Stubbed**, and offers **Send test email**. By default everything is stubbed; user invites are the one live email path (via Supabase). Wiring up a real email provider, SSO, or HRIS/LMS sync is covered in **[Integrations](integrations.md)**.

---

## Glossary

**TNA status** — `not_started` · `in_progress` · `returned` (open / editable) · `submitted` (awaiting validation) · `validated` (gaps computed, plan generated) · `finalized` (year archived, read-only).

**ILDP status** — `draft` (awaiting the employee's acknowledgement) · `pending_endorsement` (awaiting the supervisor) · `pending_approval` (awaiting HR) · `active` (approved; training can be logged).

**Cycle status** — `active` (a year in progress) · `passed` (Year 3 done, all critical gaps closed) · `carry_over` (Year 3 done, critical gaps remain).

**Gap status** — `open` (gap remains) · `improving` (up since last year) · `stalled` (unchanged, still short) · `regressed` (down since last year) · `closed` (at or above target) · `new` (competency newly added to the role) · `retargeted` (target changed mid-cycle).

**Readiness** — `on_track` · `at_risk` · `behind`. Driven by open critical gaps and whether the TNA is on time.

**Roles** — Employee · Supervisor · HR / L&D Admin · Super Admin. Every role is also a learner with their own plan.

---

For the moving parts under the hood — the pure gap engine, the layered access control, and the server-side transaction — see the [README](../README.md) and [EXPLAINER](../EXPLAINER.md).
