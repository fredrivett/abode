import path from "node:path";
import { expect, test as setup } from "@playwright/test";
import { TEST_USERS } from "./auth-helpers";

const authFile = path.join(__dirname, ".auth/user.json");

setup("authenticate as default user", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel(/email/i).fill(TEST_USERS.default.email);
  await page.getByLabel(/password/i).fill(TEST_USERS.default.password);

  // Sign-in runs in a Next.js Server Action, so the browser never calls the
  // Supabase token endpoint directly — it POSTs the action back to /login.
  // Wait for that response so a failure to submit surfaces here rather than as
  // an opaque URL timeout below.
  const actionResponse = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" && new URL(r.url()).pathname === "/login",
    { timeout: 15_000 },
  );
  await page.getByRole("button", { name: /sign in/i }).click();
  await actionResponse;

  // On success the action redirects to /dashboard; on failure it re-renders the
  // form with a sonner error toast and stays on /login (e.g. a Supabase
  // cold-start transiently refusing the sign-in). Poll for the redirect, but
  // report the toast text if one appears so the failure mode is diagnosable
  // instead of a silent poll. The 30s budget also absorbs first-compile of the
  // (app) layout + dashboard route on a cold dev server under CI load — the
  // dashboard can only compile once authenticated, so this window is the first
  // time that cost is paid.
  const errorToast = page.locator("[data-sonner-toast][data-type='error']");
  await expect
    .poll(
      async () => {
        if (await errorToast.isVisible()) {
          return `sign-in error: ${((await errorToast.textContent()) ?? "").trim()}`;
        }
        return new URL(page.url()).pathname;
      },
      {
        timeout: 30_000,
        message: "expected sign-in to redirect to /dashboard",
      },
    )
    .toBe("/dashboard");

  // Save storage state (cookies + localStorage) for authenticated tests
  await page.context().storageState({ path: authFile });
});
