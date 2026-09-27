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
});
