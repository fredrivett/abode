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

    // Check link to signup
    await expect(page.getByRole("link", { name: /sign up/i })).toBeVisible();
  });

  test("should navigate to signup page", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("link", { name: /sign up/i }).click();

    await expect(page).toHaveURL("/signup");
  });
});

test.describe("Signup page", () => {
  test("should display signup form", async ({ page }) => {
    await page.goto("/signup");

    // Check heading
    await expect(
      page.getByRole("heading", { name: /create.*account/i }),
    ).toBeVisible();

    // Check form elements exist
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();

    // Check link to login
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
  });

  test("should navigate to login page", async ({ page }) => {
    await page.goto("/signup");

    await page.getByRole("link", { name: /sign in/i }).click();

    await expect(page).toHaveURL("/login");
  });
});
