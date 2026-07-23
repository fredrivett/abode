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

  test("the required first line becomes the note title without typing markdown", async ({
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

    // The first line is a required title — type it as plain text (no `#`),
    // press Enter to drop into the body, then type the body.
    await composer.click();
    await page.keyboard.type("Reading list");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Books to read this quarter.");
    await page.getByRole("button", { name: /^save$/i }).click();

    // Card appears with the body text; open its detail dialog. Generous timeout
    // because CI runs 4-way parallel against a cold dev server, so this first
    // POST /notes waits on on-demand Turbopack route compilation under load.
    const readingCard = page
      .getByRole("button")
      .filter({ hasText: "Books to read this quarter." });
    await expect(readingCard).toBeVisible({ timeout: 30_000 });
    await readingCard.click();

    // The dialog's accessible name comes from the item title, so a dialog
    // named "Reading list" proves the first line became the title even though
    // no markdown heading was typed.
    await expect(
      page.getByRole("dialog", { name: /Reading list/i }),
    ).toBeVisible({ timeout: 15_000 });
    const dialog = page.getByRole("dialog");
    // The body keeps the remaining content but not the title
    const body = dialog.locator(".ProseMirror");
    await expect(body).toContainText("Books to read this quarter.", {
      timeout: 15_000,
    });
    await expect(body).not.toContainText("Reading list");
    await expect(page.getByRole("dialog", { name: /Untitled/i })).toHaveCount(
      0,
    );

    // Editing the body in the detail view persists after closing: append text,
    // close the dialog, and the grid card reflects the saved edit (the cache is
    // patched on close, not left stale).
    await body.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Start with Alexander.");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText(/Start with Alexander\./)).toBeVisible({
      timeout: 15_000,
    });

    await context.close();
  });

  test("auto-saves the note as a server-side draft, repopulated on load", async ({
    browser,
  }) => {
    const user = await createUser({
      email: "note-draft@test.local",
      username: "note_draft_user",
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

    const readDraft = () =>
      getE2EPrisma()
        .noteDraft.findUnique({ where: { userId: user.id } })
        .then((d) => d?.content ?? null);

    // Type a draft in one browser, then close it without saving.
    const typing = await browser.newContext();
    const typingPage = await typing.newPage();
    await loginAs(typingPage, user);
    await typingPage.goto("/dashboard");
    await typingPage.locator(".ProseMirror").first().click();
    await typingPage.keyboard.type("Draft title");
    await typingPage.keyboard.press("Enter");
    await typingPage.keyboard.type("Unsaved thoughts to keep.");

    // The debounced autosave (1s) persists the draft to the server.
    await expect
      .poll(readDraft, { timeout: 10_000 })
      .toContain("Unsaved thoughts to keep.");
    await typing.close();

    // A completely separate browser (no shared storage) repopulates the draft
    // from the server on load — proving it's server-side, not local.
    const fresh = await browser.newContext();
    const freshPage = await fresh.newPage();
    await loginAs(freshPage, user);
    await freshPage.goto("/dashboard");
    const composer = freshPage.locator(".ProseMirror").first();
    await expect(composer).toContainText("Unsaved thoughts to keep.", {
      timeout: 15_000,
    });
    await expect(composer).toContainText("Draft title");

    // Saving empties the composer (the placeholder only shows when empty) and
    // clears the server draft in the same request.
    await freshPage.getByRole("button", { name: /^save$/i }).click();
    await expect(freshPage.getByText("Take a note…")).toBeVisible({
      timeout: 30_000,
    });
    await expect.poll(readDraft, { timeout: 10_000 }).toBeNull();

    await fresh.close();
  });
});
