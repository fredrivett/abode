import type { Browser, BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { TestUser } from "./user";

/**
 * Log in as a user via the login UI.
 * Assumes the page is not already authenticated.
 */
export async function loginAs(
	page: Page,
	user: Pick<TestUser, "email" | "password">,
): Promise<void> {
	await page.goto("/login");
	await page.getByLabel(/email/i).fill(user.email);
	await page.getByLabel(/password/i).fill(user.password);
	await page.getByRole("button", { name: /sign in/i }).click();
	await expect(page).toHaveURL("/dashboard", { timeout: 15000 });
}

/**
 * Create a new browser context, log in as a user, and return the context + page.
 * Caller is responsible for closing the context when done.
 */
export async function createAndLogin(
	browser: Browser,
	user: Pick<TestUser, "email" | "password">,
): Promise<{ context: BrowserContext; page: Page }> {
	const context = await browser.newContext();
	const page = await context.newPage();
	await loginAs(page, user);
	return { context, page };
}
