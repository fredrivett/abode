import { expect, test } from "@playwright/test";
import { getE2EPrisma } from "./helpers/db";
import { createUserWithMfa, enterMfaCode } from "./helpers/mfa";
import { generateTotp, waitForTotpWindowAfter } from "./helpers/totp";
import { deleteUserByEmail } from "./helpers/user";

test.describe("Save share target + MFA login redirect", () => {
  test("aal1 user following a share link is routed through MFA with next preserved", async ({
    browser,
  }) => {
    const email = "save-mfa@test.local";
    const sharedUrl = "https://example.com/save-mfa-roundtrip";
    const { user, totpSecret } = await createUserWithMfa({
      email,
      username: "save_mfa_user",
    });
    // Setup just burned an enrollment TOTP; remember its window so the login
    // challenge below uses a code from a later one (Supabase rejects reused
    // periods, which would otherwise flake when the two land in the same window)
    const mfaSetupAtMs = Date.now();

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Sign in with password — an MFA-enrolled user lands on the challenge (aal1)
      await page.goto("/login");
      await page.waitForLoadState("networkidle");
      await page.getByLabel(/email/i).fill(user.email);
      await page.getByLabel(/password/i).fill(user.password);
      await page.getByRole("button", { name: /sign in/i }).click();
      await expect(page).toHaveURL(/\/login\/verify-mfa/, { timeout: 30000 });

      // Still aal1 — follow a share link. The middleware must bounce us back to
      // the MFA challenge while preserving the destination as ?next=.
      await page.goto(`/save?url=${encodeURIComponent(sharedUrl)}`);
      await expect(page).toHaveURL(/\/login\/verify-mfa\?next=/);
      const next = new URL(page.url()).searchParams.get("next");
      const destination = new URL(next ?? "", "http://localhost");
      expect(destination.pathname).toBe("/save");
      expect(destination.searchParams.get("url")).toBe(sharedUrl);

      // Complete the challenge — verification returns us to /save, which saves
      // the item and replaces to /dashboard. Wait for a fresh TOTP window first
      // so the challenge code can't collide with the enrollment code or roll
      // over mid-entry.
      await waitForTotpWindowAfter(mfaSetupAtMs);
      await enterMfaCode(page, generateTotp(totpSecret));
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });

      // The shared URL survived the whole password → MFA → save journey.
      const prisma = getE2EPrisma();
      await expect
        .poll(
          async () =>
            prisma.item.count({
              where: { userId: user.id, sourceUrl: sharedUrl },
            }),
          { timeout: 15000 },
        )
        .toBe(1);
    } finally {
      await context.close();
      await deleteUserByEmail(email);
    }
  });
});
