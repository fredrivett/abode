import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { disconnectE2EPrisma, getE2EPrisma } from "./helpers/db";
import { createUser } from "./helpers/user";

// Uses its own dedicated user (not the shared authenticated one) so seeding
// items here can't break the empty-state "Welcome home" test.
test.describe("Note composer", () => {
  test.describe.configure({ timeout: 120_000 });

  test.afterAll(async () => {
    await disconnectE2EPrisma();
  });

  test("a leading heading becomes the title; a plain note falls back to its first line", async ({
    browser,
  }) => {
    const user = await createUser({
      email: "note-compose@test.local",
      username: "note_compose_user",
    });

    // The composer only appears once the grid has an item, so seed one.
    await getE2EPrisma().item.create({
      data: {
        userId: user.id,
        kind: "note",
        sourceType: "compose",
        processingStatus: "completed",
        title: "Seed note",
        noteDetails: { create: { content: "Seed body" } },
      },
    });

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, user);
    await page.goto("/dashboard");

    const composer = page.locator(".ProseMirror").first();

    // 1. Heading → title, lifted out of the body
    await composer.click();
    await page.keyboard.type("# Reading list");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Books to read this quarter.");
    await page.getByRole("button", { name: /^save$/i }).click();

    // Card appears with the body text; open its detail dialog
    const readingCard = page
      .getByRole("button")
      .filter({ hasText: "Books to read this quarter." });
    await expect(readingCard).toBeVisible();
    await readingCard.click();

    // The dialog's accessible name comes from the item title, so a dialog
    // named "Reading list" proves the heading was promoted to the title.
    await expect(
      page.getByRole("dialog", { name: /Reading list/i }),
    ).toBeVisible();
    const dialog = page.getByRole("dialog");
    // The body keeps the remaining content but not the promoted heading
    const body = dialog.locator(".ProseMirror");
    await expect(body).toContainText("Books to read this quarter.");
    await expect(body).not.toContainText("Reading list");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    // 2. Plain-text note → no promoted title, but the name falls back to the
    // first line rather than "Untitled"
    await composer.click();
    await page.keyboard.type("A plain thought with no heading");
    await page.getByRole("button", { name: /^save$/i }).click();

    const plainCard = page
      .getByRole("button")
      .filter({ hasText: "A plain thought with no heading" });
    await expect(plainCard).toBeVisible();
    await plainCard.click();

    // Named after its first line, not "Untitled"
    await expect(
      page.getByRole("dialog", { name: /A plain thought with no heading/i }),
    ).toBeVisible();
    await expect(page.getByRole("dialog", { name: /Untitled/i })).toHaveCount(
      0,
    );

    await context.close();
  });
});
