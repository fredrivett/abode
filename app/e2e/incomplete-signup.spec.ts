import { expect, test } from "@playwright/test";
import { createUserWithoutUsername, deleteUserByEmail } from "./helpers/user";

test.describe("Incomplete signup (no username)", () => {
  const testEmail = "no-username@test.local";

  test.afterEach(async () => {
    await deleteUserByEmail(testEmail);
  });

  test("authenticated user without username is redirected to complete-signup", async ({
    browser,
  }) => {
    // 1. Create a user via admin API WITHOUT setting username.
    //    Simulates what happened to George: authenticated but completeSignup() never ran.
    const user = await createUserWithoutUsername({
      email: testEmail,
      password: "test-password-123!",
    });

    // 2. Log in via the UI
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/password/i).fill(user.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    // 3. Should be redirected to /complete-signup (not /dashboard)
    await expect(page).toHaveURL(/\/complete-signup/, { timeout: 15000 });

    // 4. User completes signup by choosing a username
    await expect(
      page.getByRole("heading", { name: /complete your profile/i }),
    ).toBeVisible();
    const usernameInput = page.getByLabel(/username/i);
    await usernameInput.clear();
    await usernameInput.fill("nouser_fixed");
    await expect(page.getByText("available")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /continue/i }).click();

    // 5. After completing signup, should reach dashboard
    await expect(page).toHaveURL("/dashboard", { timeout: 15000 });

    await context.close();
  });
});
