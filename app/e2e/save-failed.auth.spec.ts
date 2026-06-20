import { expect, test } from "@playwright/test";

test.describe("Save share target — unreadable link", () => {
  test("redirects to the dashboard with an error toast when no URL parses", async ({
    page,
  }) => {
    // A double-encoded value (the real share-sheet failure mode) that
    // extractSharedUrl can't parse — previously this saved nothing silently.
    await page.goto("/save?url=https%253A%252F%252Fexample.com%252Fchair");

    // Lands on the dashboard (no dedicated full-screen /save view)...
    await expect(page).toHaveURL(/\/dashboard/);
    // ...with a toast surfacing the failure.
    await expect(
      page.getByText(/couldn.?t read a link from what you shared/i),
    ).toBeVisible({ timeout: 15000 });
  });
});
