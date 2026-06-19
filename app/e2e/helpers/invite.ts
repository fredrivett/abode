import type { ConsoleMessage, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { getE2EPrisma } from "./db";
import { clearMailbox, getConfirmationPath } from "./mailpit";
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
    timeout: 30000,
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
    throw new Error(`No invite found from ${inviterId} to ${inviteeEmail}`);
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
  // Capture console + page errors so a flaky failure has diagnostics
  const consoleLogs: string[] = [];
  const onConsole = (msg: ConsoleMessage) =>
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  const onPageError = (err: Error) =>
    consoleLogs.push(`[pageerror] ${err.message}`);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  try {
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

    // Submit — click() auto-waits for the button to be enabled and stable, so
    // it won't fire until username validation has settled
    await page.getByRole("button", { name: /create account/i }).click();

    // The confirmation renders in-place via useActionState (no navigation)
    // once the signup server action resolves — an auth round-trip + email
    // dispatch that can lag under CI load, so allow a generous timeout
    await expectSignupConfirmation(page, consoleLogs);

    // Fetch confirmation link from Inbucket and navigate to it
    const confirmPath = await getConfirmationPath(credentials.email);
    await page.goto(confirmPath);

    // Should end up on /dashboard after completeSignup runs
    await expect(page).toHaveURL("/dashboard", { timeout: 20000 });
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
  }
}

/**
 * Assert the post-signup "check your email" heading, attaching diagnostics
 * (error toasts + recent console output) if it never renders. The heading
 * appears in-place after the signup server action resolves, so the timeout
 * must cover an auth round-trip + email dispatch under CI load.
 */
export async function expectSignupConfirmation(
  page: Page,
  consoleLogs: string[] = [],
): Promise<void> {
  try {
    await expect(
      page.getByRole("heading", { name: /check your email/i }),
    ).toBeVisible({ timeout: 30000 });
  } catch (error) {
    // Signup may have surfaced an error toast instead of the confirmation
    const toasts = await page
      .locator("[data-sonner-toast]")
      .allInnerTexts()
      .catch(() => []);
    throw new Error(
      `"check your email" never rendered after "create account". ` +
        `Toasts: ${JSON.stringify(toasts)}. ` +
        `Recent console: ${consoleLogs.slice(-20).join(" | ") || "(none)"}. ` +
        `Cause: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
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

  // Wait for page to load fully
  await expect(
    page.getByRole("button", { name: /delete account/i }).first(),
  ).toBeVisible({ timeout: 10000 });

  // Click the Delete Account button to open the dialog
  await page
    .getByRole("button", { name: /delete account/i })
    .first()
    .click();

  // Wait for dialog to appear, then fill password
  const passwordInput = page.getByLabel(/enter your password to confirm/i);
  await expect(passwordInput).toBeVisible({ timeout: 5000 });
  await passwordInput.fill(password);

  // Click the confirmation Delete Account button (inside the dialog)
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: /delete account/i }).click();

  // Wait for redirect to homepage with account-deleted param
  await expect(page).toHaveURL(/\?account-deleted=true/, {
    timeout: 30000,
  });
}
