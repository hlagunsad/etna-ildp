import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Throwaway demo credentials — public on the sign-in page of the live demo.
const CREDS: Record<string, [string, string]> = {
  employee: ["employee@demo.test", "lolom0panot333"],
  employee2: ["employee2@demo.test", "lolom0panot444"],
  supervisor: ["supervisor@demo.test", "lolom0panot222"],
};

async function signIn(page: Page, [email, password]: [string, string]) {
  await page.goto("/");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
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

  // Rate every competency at "Basic" (guarantees gaps), then submit. Scope each click to
  // its own row so re-renders don't shift a global nth() index.
  const rows = page.getByTestId("tna-row");
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    await rows.nth(i).getByRole("button", { name: "Basic" }).click();
  }
  const submit = page.getByRole("button", { name: "Submit for validation" });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText(/awaiting your supervisor/i)).toBeVisible();
  await signOut(page);

  // Supervisor validates → the gap engine generates the ILDP.
  await signIn(page, CREDS.supervisor);
  await page.getByRole("button", { name: "Team" }).click();
  await page.getByRole("button", { name: /Eddie Employee/ }).click();
  await page.getByRole("button", { name: "Validate TNA" }).click();
  await expect(page.getByText(/plan generated/i)).toBeVisible();
});
