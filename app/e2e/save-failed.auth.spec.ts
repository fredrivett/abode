import { expect, test } from "@playwright/test";

test.describe("Save share target — unreadable link", () => {
  test("surfaces an error and stays on /save when no URL can be parsed", async ({
    page,
  }) => {
    // A double-encoded value (the real share-sheet failure mode) that
    // extractSharedUrl can't parse — previously this silently bounced to the
    // dashboard with no feedback.
    await page.goto("/save?url=https%253A%252F%252Fexample.com%252Fchair");

    // The failure is surfaced rather than silent...
    await expect(
      page.getByText(/couldn.?t read a link from what you shared/i),
    ).toBeVisible();
    // ...and we show back the raw value we received, to make it diagnosable.
    await expect(page.getByText(/Received:/)).toBeVisible();
    // No silent redirect — the user stays on /save.
    await expect(page).toHaveURL(/\/save/);
  });
});
