import path from "node:path";
import { expect, test as setup } from "@playwright/test";
import { TEST_USERS } from "./auth-helpers";

const authFile = path.join(__dirname, ".auth/user.json");

setup("authenticate as default user", async ({ page }) => {
	await page.goto("/login");

	await page.getByLabel(/email/i).fill(TEST_USERS.default.email);
	await page.getByLabel(/password/i).fill(TEST_USERS.default.password);
	await page.getByRole("button", { name: /sign in/i }).click();

	// Wait for redirect to dashboard (confirms auth worked end-to-end)
	await expect(page).toHaveURL("/dashboard", { timeout: 15000 });

	// Save storage state (cookies + localStorage) for authenticated tests
	await page.context().storageState({ path: authFile });
});
