import { expect, type Page, test } from "@playwright/test";

// The browser only uploads the PDF and saves the item; rendering its pages
// runs in Trigger.dev, which E2E doesn't run. So these cover the upload flow up
// to the saved document, not the rendered pages (see import-pdf tests).
const PDF = {
  name: "Q1 energy bill.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.7\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n"),
};

/** Stand in for Storage (the E2E Supabase runs without it); returns the keys */
async function stubStorageUploads(page: Page): Promise<string[]> {
  const uploads: string[] = [];
  await page.route("**/storage/v1/object/items/**", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const key = new URL(route.request().url()).pathname.split("/items/")[1];
    uploads.push(key);
    await route.fulfill({ json: { Key: `items/${key}`, Id: key } });
  });
  return uploads;
}

const pdfSaved = (page: Page) =>
  page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname === "/api/v1/items/documents/pdf",
  );

async function findDocument(page: Page, fileKey: string) {
  const { items } = await (await page.request.get("/api/v1/items")).json();
  return items.find(
    (item: { sourceFileKey?: string }) => item.sourceFileKey === fileKey,
  );
}

async function deleteItem(page: Page, id: string) {
  const deleted = await page.request.delete("/api/v1/items", { data: { id } });
  expect(deleted.status()).toBe(200);
}

test.describe("PDF upload", () => {
  test("saves a PDF picked in the Add item dialog as a document", async ({
    page,
  }) => {
    const uploads = await stubStorageUploads(page);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByText("PDFs up to 25MB")).toBeVisible();

    const saved = pdfSaved(page);
    await page
      .locator("input[type=file][accept*='application/pdf']")
      .setInputFiles(PDF);
    expect((await saved).status()).toBe(201);
    await expect(page.getByText("PDF added — reading its pages")).toBeVisible();

    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toMatch(/\.pdf$/);
    const document = await findDocument(page, uploads[0]);
    expect(document).toBeTruthy();
    try {
      expect(document).toMatchObject({
        kind: "document",
        title: "Q1 energy bill",
        meta: { type: "application/pdf", originalName: "Q1 energy bill.pdf" },
      });
      // No cover until the import renders page 1: the card stands in for it
      expect(document.fileKey).toBeNull();
      const card = page.getByRole("button", { name: /Q1 energy bill\s*PDF/ });
      await expect(card).toBeVisible();
      // The original is downloadable before (or without) rendered pages
      await card.click();
      await expect(
        page.getByRole("button", { name: "Download PDF" }),
      ).toBeVisible();
    } finally {
      await deleteItem(page, document.id);
    }
  });

  test("uploads a PDF pasted onto the dashboard", async ({ page }) => {
    const uploads = await stubStorageUploads(page);
    await page.goto("/dashboard");
    // The button is server-rendered before React attaches the paste listener:
    // opening the dialog proves the page is hydrated, and pastes are ignored
    // while any dialog is open, so close it again first
    await page.getByRole("button", { name: "Add item" }).click();
    const dialog = page.getByRole("dialog", { name: "Add Item" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(
      page.locator('[role="dialog"][data-state="open"]'),
    ).toHaveCount(0);

    const saved = pdfSaved(page);
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.items.add(
        new File(["%PDF-1.7\n%%EOF\n"], "pasted.pdf", {
          type: "application/pdf",
        }),
      );
      document.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: data, bubbles: true }),
      );
    });
    expect((await saved).status()).toBe(201);

    const document = await findDocument(page, uploads[0]);
    expect(document).toBeTruthy();
    await deleteItem(page, document.id);
  });

  test("rejects a PDF over 25MB before uploading it", async ({ page }) => {
    const uploads = await stubStorageUploads(page);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Add item" }).click();

    await page
      .locator("input[type=file][accept*='application/pdf']")
      .setInputFiles({ ...PDF, buffer: Buffer.alloc(25 * 1024 * 1024 + 1) });
    await expect(
      page.getByText("PDF is too large. Max size is 25MB."),
    ).toBeVisible();
    expect(uploads).toHaveLength(0);
  });
});
