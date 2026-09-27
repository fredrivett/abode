import path from "node:path";
import { expect, type Page, test } from "@playwright/test";

// Chrome's built-in fake camera (a synthetic moving pattern) stands in for a
// real one; the fake UI flag auto-accepts the permission prompt
test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
  permissions: ["camera"],
  viewport: { width: 390, height: 844 },
});

const FIXTURE = path.join(__dirname, "fixtures/scanner-page.jpg");

async function openScanner(page: Page) {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByRole("button", { name: "Scan a document" }).click();
  await expect(
    page.getByRole("dialog", { name: "Scan a document" }),
  ).toBeVisible();
  // The worker has loaded scanic + the ML model once the hint moves on
  await expect(page.getByText("Getting ready…")).toBeHidden({
    timeout: 30_000,
  });
}

test.describe("Document scanner", () => {
  test("captures from the camera and reviews the page", async ({ page }) => {
    await openScanner(page);
    // Manual mode so the synthetic feed can't auto-capture mid-test
    await page.getByRole("button", { name: "Auto" }).click();
    await page.getByRole("button", { name: "Capture page" }).click();

    await expect(page.getByText("1 of 1")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByAltText("Page 1")).toBeVisible();
    await expect(page.getByRole("button", { name: "B&W" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.getByRole("button", { name: "Greyscale" }).click();
    await expect(
      page.getByRole("button", { name: "Greyscale" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("detects and flattens the page in an imported photo", async ({
    page,
  }) => {
    await openScanner(page);
    await page
      .locator("input[type=file][accept='image/*']")
      .setInputFiles(FIXTURE);

    const scanned = page.getByAltText("Page 1");
    await expect(scanned).toBeVisible({ timeout: 15_000 });
    // Visible doesn't mean decoded: wait so naturalWidth/Height are real
    await scanned.evaluate((img) =>
      img instanceof HTMLImageElement ? img.decode() : undefined,
    );
    // The fixture's page is portrait inside a larger photo: once detected and
    // flattened, the result is portrait and the surrounding desk is gone
    const { width, height } = await scanned.evaluate((img) => {
      if (!(img instanceof HTMLImageElement)) throw new Error("not an image");
      return { width: img.naturalWidth, height: img.naturalHeight };
    });
    expect(height / width).toBeGreaterThan(1.25);
    expect(height / width).toBeLessThan(1.6);
  });

  test("asks before discarding scanned pages", async ({ page }) => {
    await openScanner(page);
    await page
      .locator("input[type=file][accept='image/*']")
      .setInputFiles(FIXTURE);
    await expect(page.getByText("1 of 1")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Discard this scan?")).toBeVisible();
    await page.getByRole("button", { name: "Keep scanning" }).click();
    await expect(page.getByText("1 of 1")).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Discard" }).click();
    await expect(
      page.getByRole("dialog", { name: "Scan a document" }),
    ).toBeHidden();
  });

  test("saves a scanned document", async ({ page }) => {
    // The E2E Supabase runs without storage (excluded in supabase-setup), so
    // stand in for the browser's page uploads; the save API, database and
    // listing below are real
    const uploads: string[] = [];
    await page.route("**/storage/v1/object/items/**", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      const key = new URL(route.request().url()).pathname.split("/items/")[1];
      uploads.push(key);
      await route.fulfill({ json: { Key: `items/${key}`, Id: key } });
    });

    await openScanner(page);
    await page
      .locator("input[type=file][accept='image/*']")
      .setInputFiles(FIXTURE);
    await expect(page.getByText("1 of 1")).toBeVisible({ timeout: 15_000 });

    const saved = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        new URL(r.url()).pathname === "/api/v1/items/documents",
    );
    await page.getByRole("button", { name: "Save" }).click();
    expect((await saved).status()).toBe(201);
    await expect(page.getByText("Document saved")).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: "Scan a document" }),
    ).toBeHidden();
    // B&W page + its colour original
    expect(uploads).toHaveLength(2);

    const { items } = await (await page.request.get("/api/v1/items")).json();
    const document = items.find(
      (item: { kind: string }) => item.kind === "document",
    );
    expect(document.meta).toMatchObject({ pageCount: 1, type: "image/jpeg" });
    expect(uploads).toContain(document.fileKey);

    const deleted = await page.request.delete("/api/v1/items", {
      data: { id: document.id },
    });
    expect(deleted.status()).toBe(200);
  });
});
