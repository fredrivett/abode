import { expect, test } from "@playwright/test";
import { createAndLogin } from "./helpers/auth";
import { createUser } from "./helpers/user";

// Each test gets its own user: the shared authenticated one is used by
// parallel specs that add items, which would swap out the empty state
test.describe("Empty dashboard", () => {
  // Serial: concurrent user creation overwhelms the local auth service
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test("'Paste a link' opens the Add item dialog with the URL field focused", async ({
    browser,
  }) => {
    const user = await createUser({
      email: "empty-dashboard-link@test.local",
      username: "empty_dash_link",
    });
    const { context, page } = await createAndLogin(browser, user);

    await expect(
      page.getByRole("heading", { name: /welcome home/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Paste a link" }).click();
    await expect(page.getByRole("dialog", { name: "Add Item" })).toBeVisible();
    await expect(page.getByPlaceholder("Paste URL...")).toBeFocused();

    await context.close();
  });

  test("'Upload a photo or PDF' saves the picked file as the first item", async ({
    browser,
  }) => {
    const user = await createUser({
      email: "empty-dashboard-upload@test.local",
      username: "empty_dash_upload",
    });
    const { context, page } = await createAndLogin(browser, user);

    // Stand in for Storage (the E2E Supabase runs without it)
    await page.route("**/storage/v1/object/items/**", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      const key = new URL(route.request().url()).pathname.split("/items/")[1];
      await route.fulfill({ json: { Key: `items/${key}`, Id: key } });
    });

    const saved = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        new URL(r.url()).pathname === "/api/v1/items/documents/pdf",
    );
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload a photo or PDF" }).click();
    await (await chooser).setFiles({
      name: "Lease.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(
        "%PDF-1.7\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n",
      ),
    });
    expect((await saved).status()).toBe(201);

    // The new item replaces the empty state
    await expect(
      page.getByRole("button", { name: /Lease\s*PDF/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /welcome home/i }),
    ).toBeHidden();

    await context.close();
  });
});
