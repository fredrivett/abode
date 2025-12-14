import { expect, test } from "@playwright/test";

test.describe("Marketing page", () => {
  test("should display the homepage with logo and tagline", async ({
    page,
  }) => {
    await page.goto("/");

    // Check the title exists
    await expect(page.getByRole("heading", { name: "abode" })).toBeVisible();

    // Check the tagline
    await expect(
      page.getByText("the home for your info"),
    ).toBeVisible();

    // Check theme toggle is present
    await expect(page.getByRole("button", { name: /theme/i })).toBeVisible();
  });

  test("should have accessible elements", async ({ page }) => {
    await page.goto("/");

    // The sr-only text should be accessible
    const heading = page.getByRole("heading", { name: "abode" });
    await expect(heading).toBeVisible();
  });
});
