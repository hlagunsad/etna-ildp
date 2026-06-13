import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Load NEXT_PUBLIC_* + SUPABASE_SECRET_KEY so the dev server can reach Supabase during E2E.
config({ path: ".env.local" });

export default defineConfig({
  testDir: "./e2e",
  // One worker against a shared dev server avoids first-compile contention, and the
  // generous timeouts absorb Next dev's on-demand route compilation on first hit.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
