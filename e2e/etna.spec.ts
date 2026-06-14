import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Throwaway demo credentials — public on the sign-in page of the live demo.
const CREDS: Record<string, [string, string]> = {
  employee: ["employee@demo.test", "lolom0panot333"],
  employee2: ["employee2@demo.test", "lolom0panot444"],
  supervisor: ["supervisor@demo.test", "lolom0panot222"],
  hr: ["hr@demo.test", "lolom0panot111"],
  super: ["super@demo.test", "lolom0panot000"],
};

// The seeded permission defaults (super_admin omitted — always-on in code).
const DEFAULT_PERMS: [string, string][] = [
  ["employee", "take_own_tna"],
  ["supervisor", "take_own_tna"], ["supervisor", "validate_tna"], ["supervisor", "endorse_ildp"], ["supervisor", "view_team"],
  ["hr_admin", "take_own_tna"], ["hr_admin", "validate_tna"], ["hr_admin", "endorse_ildp"], ["hr_admin", "view_team"],
  ["hr_admin", "approve_ildp"], ["hr_admin", "view_org"], ["hr_admin", "manage_users"], ["hr_admin", "view_audit"], ["hr_admin", "advance_year"], ["hr_admin", "manage_library"],
];

async function signIn(page: Page, [email, password]: [string, string]) {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
}

// Make the happy-path test re-runnable: reset employee2 to "no cycle" before the suite.
test.beforeAll(async () => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const emp2 = data.users.find((u) => u.email === "employee2@demo.test");
  if (emp2) await admin.from("dev_cycle").delete().eq("user_id", emp2.id); // cascade clears TNA/ILDP/snapshots
});

test("the seeded employee sees a populated development dashboard", async ({ page }) => {
  await signIn(page, CREDS.employee);
  // Default tab is My Development; the seeded baseline includes a critical Cybersecurity gap.
  await expect(page.getByRole("heading", { name: "My Development" })).toBeVisible();
  await expect(page.getByText("Cybersecurity").first()).toBeVisible();
});

test("RBAC: an employee has no management tabs and no approve control", async ({ page }) => {
  await signIn(page, CREDS.employee);
  await expect(page.getByRole("button", { name: "My Development" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Team" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Organization" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Admin" })).toHaveCount(0);
  // Separation of duties at the UI: no approval control anywhere for an employee.
  await page.getByRole("button", { name: "My ILDP" }).click();
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
});

test("happy path: employee takes TNA → supervisor validates → plan generated", async ({ page }) => {
  await signIn(page, CREDS.employee2);
  await page.getByRole("button", { name: "My TNA" }).click();

  // employee2 has no cycle yet → start the baseline.
  const start = page.getByRole("button", { name: "Start baseline TNA" });
  await expect(start).toBeVisible();
  await start.click();

  // Check 2 of the 3 Basic items in each competency (≥ 50% threshold → assessed Basic),
  // leaving Intermediate/Advanced unchecked → gaps vs the role's higher targets. Then submit.
  const comps = page.getByTestId("tna-comp");
  await expect(comps.first()).toBeVisible();
  const count = await comps.count();
  for (let i = 0; i < count; i++) {
    const basics = comps.nth(i).locator('input[data-level="1"]');
    await basics.nth(0).check();
    await basics.nth(1).check();
  }
  const submit = page.getByRole("button", { name: "Submit for validation" });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText(/awaiting validation/i)).toBeVisible();
  await signOut(page);

  // Supervisor validates → the gap engine generates the ILDP.
  await signIn(page, CREDS.supervisor);
  await page.getByRole("button", { name: "Team" }).click();
  await page.getByRole("button", { name: /Eddie Employee/ }).click();
  await page.getByRole("button", { name: "Validate TNA" }).click();
  await expect(page.getByText(/plan generated/i)).toBeVisible();
});

// Tidy up any rows a failed run might leave behind (the happy path deletes its own).
test.afterAll(async () => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.from("training_resource").delete().like("title", "E2E Course%");
});

test("HR authors the content library: add then delete a training resource", async ({ page }) => {
  await signIn(page, CREDS.hr);
  await page.getByRole("button", { name: "Library" }).click();
  await page.getByTestId("lib-tab-training").click();

  const marker = `E2E Course ${Date.now()}`;
  await page.getByLabel("Title").fill(marker);
  await page.getByLabel("Provider").selectOption("internal");
  await page.getByRole("button", { name: "Add training" }).click();

  // The new row shows up in the catalog (client-side RLS write + audit succeeded).
  const row = page.getByRole("row").filter({ hasText: marker });
  await expect(row).toBeVisible();

  // Two-click delete removes it.
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await row.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await expect(page.getByText(marker)).toHaveCount(0);
});

test("supervisor sees the team competency report with the heatmap", async ({ page }) => {
  await signIn(page, CREDS.supervisor);
  await page.getByRole("button", { name: "Reports" }).click();
  // RLS scopes the report to direct reports → the supervisor gets the "Team report".
  await expect(page.getByRole("heading", { name: "Team report" })).toBeVisible();
  // Ella (a direct report) has a seeded Cybersecurity gap → it's a heatmap column.
  await expect(page.getByRole("columnheader", { name: "Cybersecurity" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Print / PDF" })).toBeVisible();
});

test("HR bulk-imports training resources from a pasted CSV", async ({ page }) => {
  await signIn(page, CREDS.hr);
  await page.getByRole("button", { name: "Library" }).click();
  await page.getByTestId("lib-tab-import").click();

  const ts = Date.now();
  const csv = [
    "title,provider,url,competency_code,target_level,mode,cost",
    `E2E Course Import-${ts}-1,internal,,,,online,0`,
    `E2E Course Import-${ts}-2,external,,,,classroom,500`,
  ].join("\n");
  await page.getByLabel("paste CSV").fill(csv);
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByTestId("training-import-import-btn").click();
  await expect(page.getByText("2 created")).toBeVisible();

  // The imported rows show up in the Training catalog editor (titles cleaned by the afterAll above).
  await page.getByTestId("lib-tab-training").click();
  await expect(page.getByText(`E2E Course Import-${ts}-1`)).toBeVisible();
});

// Restore the permission matrix to its seeded default after the permissions test.
test.afterAll(async () => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    await admin.from("role_permission").delete().neq("role", "");
    await admin.from("role_permission").insert(DEFAULT_PERMS.map(([role, capability]) => ({ role, capability })));
  } catch {
    /* table may not exist before 0003 is run — ignore */
  }
});

test("super admin configures role permissions (grants Organization view to supervisors)", async ({ page }) => {
  await signIn(page, CREDS.super);
  await page.getByRole("button", { name: "Admin" }).click();

  const cell = page.getByRole("checkbox", { name: "View organization for Supervisor" });
  await expect(cell).toBeVisible();
  await expect(cell).not.toBeChecked(); // default: supervisor lacks view_org
  await cell.click(); // controlled checkbox persists async — assert the outcome, not check()
  await expect(page.getByText(/Granted .* for Supervisor/)).toBeVisible();
  await expect(cell).toBeChecked();
  await signOut(page);

  // Live enforcement: the supervisor now sees the Organization tab.
  await signIn(page, CREDS.supervisor);
  await expect(page.getByRole("button", { name: "Organization" })).toBeVisible();
});

// Restore the seed baseline (only employee@demo.test keeps a cycle) after the scheduler test.
test.afterAll(async () => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const keep = data.users.find((u) => u.email === "employee@demo.test")?.id;
  if (keep) await admin.from("dev_cycle").delete().neq("user_id", keep); // cascades TNA/ILDP/snapshots
});

test("HR opens development cycles from the scheduler", async ({ page }) => {
  await signIn(page, CREDS.hr);
  await page.getByRole("button", { name: "Cycles" }).click();
  await expect(page.getByRole("heading", { name: "Cycle scheduler" })).toBeVisible();
  // Eligible = job role + no cycle (the supervisor qualifies); open them.
  await page.getByRole("button", { name: /Open \d+ cycle/ }).click();
  await expect(page.getByText("opened").first()).toBeVisible();
});
