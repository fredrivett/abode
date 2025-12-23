import { expect, test } from "@playwright/test";

test.describe("Login page", () => {
  test("should display login form", async ({ page }) => {
    await page.goto("/login");

    // Check heading
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await expect(page.getByText("Sign in to your account")).toBeVisible();

    // Check form elements exist
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

    // Check link to join page (invite-based signup)
    await expect(page.getByRole("link", { name: /join abode/i })).toBeVisible();
  });

  test("should navigate to join page", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("link", { name: /join abode/i }).click();

    await expect(page).toHaveURL("/join");
  });
});

test.describe("Join page (invite-based signup)", () => {
  test("should display enter code form when no token provided", async ({
    page,
  }) => {
    await page.goto("/join");

    // Check heading for enter code form
    await expect(
      page.getByRole("heading", { name: /enter your invite code/i }),
    ).toBeVisible();

    // Check form elements exist
    await expect(page.getByLabel(/invite code/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();

    // Check link to login
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
  });

  test("should navigate to login page", async ({ page }) => {
    await page.goto("/join");

    await page.getByRole("link", { name: /sign in/i }).click();

    await expect(page).toHaveURL("/login");
  });
});

test.describe("Signup page redirect", () => {
  test("should redirect /signup to homepage", async ({ page }) => {
    await page.goto("/signup");

    // Signup now requires an invite, so /signup redirects to homepage
    await expect(page).toHaveURL("/");
  });
});
