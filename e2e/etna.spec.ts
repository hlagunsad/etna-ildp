import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Throwaway demo credentials — public on the sign-in page of the live demo.
const CREDS: Record<string, [string, string]> = {
  employee: ["employee@demo.test", "lolom0panot333"],
  employee2: ["employee2@demo.test", "lolom0panot444"],
  supervisor: ["supervisor@demo.test", "lolom0panot222"],
  hr: ["hr@demo.test", "lolom0panot111"],
};

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
