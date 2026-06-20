import { expect, test } from "@playwright/test";
import { getE2EPrisma } from "./helpers/db";
import { createUser, deleteUserByEmail } from "./helpers/user";

test.describe("Save share target + login redirect", () => {
  test("unauthenticated /save preserves the destination as ?next= on login", async ({
    page,
  }) => {
    await page.goto("/save?url=https://example.com/chair");

    // Middleware should bounce us to /login carrying the original destination
    await expect(page).toHaveURL(/\/login\?next=/);
    const next = new URL(page.url()).searchParams.get("next");
    expect(next).not.toBeNull();

    // The preserved next must resolve back to the original /save destination
    const destination = new URL(next ?? "", "http://localhost");
    expect(destination.pathname).toBe("/save");
    expect(destination.searchParams.get("url")).toBe(
      "https://example.com/chair",
    );
  });

  test("logging in from a share link returns to /save and stores the item", async ({
    browser,
  }) => {
    const email = "save-share@test.local";
    const sharedUrl = "https://example.com/save-share-roundtrip";
    const user = await createUser({ email, username: "save_share_user" });

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // 1. Hit the share target while logged out → redirected to login with next
      await page.goto(`/save?url=${encodeURIComponent(sharedUrl)}`);
      await expect(page).toHaveURL(/\/login\?next=/);

      // 2. Sign in (wait for hydration so the form action actually fires)
      await page.waitForLoadState("networkidle");
      await page.getByLabel(/email/i).fill(user.email);
      await page.getByLabel(/password/i).fill(user.password);
      await page.getByRole("button", { name: /sign in/i }).click();
      await expect(page.getByText(/signing in/i)).toBeVisible({
        timeout: 10000,
      });

      // 3. Login returns to /save, which auto-saves and replaces to /dashboard
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });

      // 4. The shared URL was actually saved as an item for this user
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
