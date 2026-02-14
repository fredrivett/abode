import { expect, test } from "@playwright/test";

test.describe("Dashboard (authenticated)", () => {
	test("should display dashboard for logged-in user", async ({ page }) => {
		await page.goto("/dashboard");

		// Should NOT redirect to login — storageState provides auth
		await expect(page).toHaveURL("/dashboard");

		// Dashboard shows "Welcome home" for users with no items
		await expect(
			page.getByRole("heading", { name: /welcome home/i }),
		).toBeVisible();
	});
});
