import { expect, test } from "@playwright/test";
import { getE2EPrisma } from "./helpers/db";
import { createUserWithMfa, enterMfaCode } from "./helpers/mfa";
import { generateTotp, waitForTotpWindowAfter } from "./helpers/totp";
import { deleteUserByEmail } from "./helpers/user";

// A 2FA user who has only entered their password (aal1) must not see private
// content anywhere — not just on the paths the middleware used to list.
test.describe("Pages require a completed MFA challenge", () => {
  test("an aal1 session sees no private rooms or items until verified", async ({
    browser,
  }) => {
    const email = "mfa-pages@test.local";
    const username = "mfa_pages_user";
    const { user, totpSecret } = await createUserWithMfa({ email, username });
    const mfaSetupAtMs = Date.now();
    const prisma = getE2EPrisma();
    const item = await prisma.item.create({
      data: {
        userId: user.id,
        kind: "note",
        sourceType: "compose",
        processingStatus: "completed",
        title: "Private diary entry",
        noteDetails: { create: { content: "Not for anyone else" } },
      },
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto("/login");
      await page.waitForLoadState("networkidle");
      await page.getByLabel(/email/i).fill(user.email);
      await page.getByLabel(/password/i).fill(user.password);
      await page.getByRole("button", { name: /sign in/i }).click();
      await expect(page).toHaveURL(/\/login\/verify-mfa/, { timeout: 30000 });

      // Room list: bounced to the challenge, like the dashboard
      await page.goto("/rooms");
      await expect(page).toHaveURL(/\/login\/verify-mfa\?next=%2Frooms/);

      // The owner's private item page: treated as a stranger (404), not the owner
      const itemPath = `/@${username}/items/${item.id}`;
      const response = await page.goto(itemPath);
      expect(response?.status()).toBe(404);
      await expect(page.getByText("Private diary entry")).toHaveCount(0);

      // Completing the challenge restores owner access
      await page.goto("/login/verify-mfa");
      await waitForTotpWindowAfter(mfaSetupAtMs);
      await enterMfaCode(page, generateTotp(totpSecret));
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });

      const verified = await page.goto(itemPath);
      expect(verified?.status()).toBe(200);
      await expect(page.getByText("Private diary entry").first()).toBeVisible();
    } finally {
      await context.close();
      await deleteUserByEmail(email);
    }
  });
});
