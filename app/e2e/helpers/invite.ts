import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { getE2EPrisma } from "./db";
import { clearMailbox, getConfirmationPath } from "./inbucket";
import { deleteUserByEmail } from "./user";

/**
 * Send an invite via the settings UI.
 * Assumes the page is authenticated and can navigate freely.
 * Cleans up orphaned invites and leftover users from failed retries.
 */
export async function sendInviteViaUI(
	page: Page,
	email: string,
): Promise<void> {
	// Clean up leftover state from failed retries
	await deleteUserByEmail(email);
	const prisma = getE2EPrisma();
	await prisma.invite.deleteMany({
		where: { email: email.toLowerCase(), inviterId: null },
	});

	await page.goto("/settings/invites");
	await page.getByPlaceholder("friend@example.com").fill(email);
	await page.getByRole("button", { name: /send invite/i }).click();
	// Wait for success toast
	await expect(page.getByText(`Invite sent to ${email}`)).toBeVisible({
		timeout: 10000,
	});
}

/**
 * Get the invite token from the database for a specific inviter + invitee email pair.
 */
export async function getInviteTokenFromDB(
	inviterId: string,
	inviteeEmail: string,
): Promise<string> {
	const prisma = getE2EPrisma();
	const invite = await prisma.invite.findFirst({
		where: { inviterId, email: inviteeEmail.toLowerCase() },
	});
	if (!invite) {
		throw new Error(
			`No invite found from ${inviterId} to ${inviteeEmail}`,
		);
	}
	return invite.token;
}

/**
 * Full signup flow via an invite link:
 * 1. Navigate to /join?token=...
 * 2. Fill username + password
 * 3. Submit form
 * 4. Wait for "check your email" confirmation
 * 5. Fetch confirmation link from Inbucket
 * 6. Navigate to confirmation link
 * 7. Wait for redirect to /dashboard
 */
export async function signupViaInvite(
	page: Page,
	token: string,
	credentials: { email: string; username: string; password: string },
): Promise<void> {
	// Clean up any leftover state from failed retries
	await deleteUserByEmail(credentials.email);
	await clearMailbox(credentials.email);

	// Navigate to join page with token
	await page.goto(`/join?token=${token}`);

	// Wait for the form to load (email field should be pre-filled)
	await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 10000 });

	// Fill username (clear auto-suggested value first)
	const usernameInput = page.getByLabel(/username/i);
	await usernameInput.clear();
	await usernameInput.fill(credentials.username);

	// Wait for username availability check to complete
	await expect(page.getByText("available")).toBeVisible({ timeout: 5000 });

	// Fill password
	await page.getByLabel(/password/i).fill(credentials.password);

	// Submit
	await page.getByRole("button", { name: /create account/i }).click();

	// Wait for "check your email" confirmation
	await expect(page.getByText(/check your email/i)).toBeVisible({
		timeout: 10000,
	});

	// Fetch confirmation link from Inbucket and navigate to it
	const confirmPath = await getConfirmationPath(credentials.email);
	await page.goto(confirmPath);

	// Should end up on /dashboard after completeSignup runs
	await expect(page).toHaveURL("/dashboard", { timeout: 20000 });
}

/**
 * Delete the current user's account via the settings UI.
 * Assumes the page is authenticated.
 */
export async function deleteAccountViaUI(
	page: Page,
	password: string,
): Promise<void> {
	await page.goto("/settings/account");

	// Click the Delete Account button to open the dialog
	await page.getByRole("button", { name: /delete account/i }).click();

	// Fill password in the confirmation dialog
	await page
		.getByLabel(/enter your password to confirm/i)
		.fill(password);

	// Click the confirmation Delete Account button (inside the dialog)
	await page
		.getByRole("button", { name: /delete account/i })
		.last()
		.click();

	// Wait for redirect to homepage with account-deleted param
	await expect(page).toHaveURL(/\?account-deleted=true/, {
		timeout: 20000,
	});
}
