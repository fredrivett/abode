import { expect, type Page, test } from "@playwright/test";
import { createAndLogin } from "./helpers/auth";
import { disconnectE2EPrisma, getE2EPrisma } from "./helpers/db";
import { createUser, type TestUser } from "./helpers/user";

// Several pages of 25: the grid may load the next page while still online,
// so the oldest has to be further away than that
const NOTES = 80;
const OLDEST = `Offline note ${NOTES - 1}`;

/** When the offline library last finished syncing, read from IndexedDB */
function lastSyncedAt(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string | null>((resolve) => {
        const open = indexedDB.open("abode-offline");
        open.onerror = () => resolve(null);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("meta")) return resolve(null);
          const get = db.transaction("meta").objectStore("meta").get("sync");
          get.onsuccess = () => resolve(get.result?.lastSyncedAt ?? null);
          get.onerror = () => resolve(null);
        };
      }),
  );
}

// Its own user so the seeded notes can't break the empty-state test
test.describe("Offline library", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  let user: TestUser;

  test.beforeAll(async () => {
    user = await createUser({
      email: "offline-library@test.local",
      username: "offline_library_user",
    });
    // Note 0 newest, note 79 oldest
    const now = Date.now();
    await Promise.all(
      Array.from({ length: NOTES }, (_, i) =>
        getE2EPrisma().item.create({
          data: {
            userId: user.id,
            kind: "note",
            sourceType: "compose",
            processingStatus: "completed",
            title: `Offline note ${i}`,
            addedAt: new Date(now - i * 60_000),
            noteDetails: { create: { content: `Body of offline note ${i}` } },
          },
        }),
      ),
    );
  });

  test.afterAll(async () => {
    await disconnectE2EPrisma();
  });

  test("shows the whole library and opens an item with no connection", async ({
    browser,
  }) => {
    const { context, page } = await createAndLogin(browser, user);
    await expect(page.getByText("Offline note 0", { exact: true })).toBeVisible(
      {
        timeout: 30_000,
      },
    );
    await expect
      .poll(() => lastSyncedAt(page), { timeout: 30_000 })
      .not.toBeNull();

    await context.setOffline(true);
    await expect(page.getByText(/You're offline/)).toBeVisible();

    // Beyond the first page: only the offline library can supply it now
    const oldest = page.getByText(OLDEST, { exact: true });
    await expect(async () => {
      await page.mouse.wheel(0, 4000);
      await expect(oldest).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 40_000 });

    await oldest.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Settled, not part-way through the dialog's open animation
    await dialog.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
    await expect(
      dialog.getByText(`Body of offline note ${NOTES - 1}`),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/offline-library-open-item.png",
    });

    await context.close();
  });
});
