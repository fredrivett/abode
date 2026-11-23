import { expect, type Page, test } from "@playwright/test";
import { createAndLogin } from "./helpers/auth";
import { disconnectE2EPrisma, getE2EPrisma } from "./helpers/db";
import { createUser, type TestUser } from "./helpers/user";

const SCROLLED_TO = 1200;

const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));

/** Scrolls down the grid, then saves a link through the header's Add item dialog */
async function saveLinkFromDeepInTheGrid(page: Page, url: string) {
  await expect(page.getByText(/^Seed note \d+$/).first()).toBeVisible({
    timeout: 30_000,
  });
  await page.evaluate((y) => window.scrollTo(0, y), SCROLLED_TO);
  await expect.poll(() => scrollY(page)).toBe(SCROLLED_TO);

  await page.getByRole("button", { name: "Add item" }).click();
  const dialog = page.getByRole("dialog", { name: "Add Item" });
  await dialog.getByPlaceholder("Paste URL...").fill(url);
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  // Completed without Trigger.dev, processing with it
  await expect(page.getByText(/^URL (saved|added)/)).toBeVisible({
    timeout: 30_000,
  });
}

// Its own user (not the shared authenticated one) so the seeded notes can't
// break the empty-state "Welcome home" test
test.describe("Saving a new item scrolls to it", () => {
  // Serial: concurrent user creation overwhelms the local auth service
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  let user: TestUser;

  test.beforeAll(async () => {
    user = await createUser({
      email: "save-scroll@test.local",
      username: "save_scroll_user",
    });
    // Enough tall notes that the dashboard scrolls well past SCROLLED_TO
    const body = "Some text to make the card tall. ".repeat(20);
    await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        getE2EPrisma().item.create({
          data: {
            userId: user.id,
            kind: "note",
            sourceType: "compose",
            processingStatus: "completed",
            title: `Seed note ${i}`,
            noteDetails: { create: { content: body } },
          },
        }),
      ),
    );
  });

  test.afterAll(async () => {
    await disconnectE2EPrisma();
  });

  test("scrolls the full list back to the top, where the new item lands", async ({
    browser,
  }) => {
    const { context, page } = await createAndLogin(browser, user);

    await saveLinkFromDeepInTheGrid(page, "https://example.com/save-scroll");

    await expect.poll(() => scrollY(page), { timeout: 5_000 }).toBe(0);
    await expect(
      page.getByRole("button").filter({ hasText: "example.com/save-scroll" }),
    ).toBeInViewport();

    await context.close();
  });

  test("keeps the place in filtered results, which may not show the new item", async ({
    browser,
  }) => {
    const { context, page } = await createAndLogin(browser, user);
    // The notes match; the saved link doesn't
    await page.goto("/dashboard?type=note");

    await saveLinkFromDeepInTheGrid(
      page,
      "https://example.com/save-scroll-filtered",
    );

    // A smooth scroll starts at once, so a second is plenty to catch one
    await page.waitForTimeout(1_000);
    expect(await scrollY(page)).toBe(SCROLLED_TO);

    // The link isn't in these results, so the toast's View is the way to it
    await page.getByRole("button", { name: "View", exact: true }).click();
    await expect(page).toHaveURL(/[?&]type=note&item=[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("dialog", { name: /save-scroll-filtered/ }),
    ).toBeVisible({ timeout: 15_000 });

    await context.close();
  });
});
