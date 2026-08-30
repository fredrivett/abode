import { expect, test } from "@playwright/test";
import { createUserWithoutUsername, deleteUserByEmail } from "./helpers/user";

test.describe("Incomplete signup (no username)", () => {
  const testEmail = "no-username@test.local";

  test.afterEach(async () => {
    await deleteUserByEmail(testEmail);
  });

  test("authenticated user without an invite cannot complete signup (invite-only)", async ({
    browser,
  }) => {
    // 1. Create a user via admin API WITHOUT username or invite metadata.
    //    Represents an orphaned/authenticated-but-never-completed account with no
    //    invite - under the invite-only gate this must NOT become an account.
    const user = await createUserWithoutUsername({
      email: testEmail,
      password: "test-password-123!",
    });

    // 2. Log in via the UI
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/password/i).fill(user.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Verify the form action is running (confirms React hydration)
    await expect(page.getByText(/signing in/i)).toBeVisible({ timeout: 10000 });

    // 3. Still routed to /complete-signup (this redirect is unchanged)
    await expect(page).toHaveURL(/\/complete-signup/, { timeout: 30000 });
    await expect(
      page.getByRole("heading", { name: /complete your profile/i }),
    ).toBeVisible();

    // 4. Attempting to complete without an invite is rejected
    const usernameInput = page.getByLabel(/username/i);
    await usernameInput.clear();
    await usernameInput.fill("nouser_gated");
    await expect(page.getByText("available")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /continue/i }).click();

    // 5. Error surfaced, and the user stays on /complete-signup (no account)
    await expect(page.getByText(/invite is required/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveURL(/\/complete-signup/);

    await context.close();
  });
});
