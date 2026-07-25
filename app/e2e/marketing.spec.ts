import { expect, test } from "@playwright/test";

test.describe("Marketing page", () => {
  test("should display the homepage with logo and tagline", async ({
    page,
  }) => {
    await page.goto("/");

    // Check the title exists
    await expect(page.getByRole("heading", { name: "abode" })).toBeVisible();

    // Check the tagline
    await expect(page.getByText("your digital home")).toBeVisible();

    // Check theme toggle is present
    await expect(page.getByRole("button", { name: /theme/i })).toBeVisible();
  });

  test("should have accessible elements", async ({ page }) => {
    await page.goto("/");

    // The sr-only text should be accessible
    const heading = page.getByRole("heading", { name: "abode" });
    await expect(heading).toBeVisible();
  });

  // The theme bootstrap script must live in <head>, not as a `body > script`.
  // PostHog's loader inserts its own script before the first `body > script`;
  // if the theme script sat there, that insertion would shift its DOM position
  // and break hydration (see layout.tsx).
  test("renders the theme bootstrap script in <head>, not <body>", async ({
    page,
  }) => {
    await page.goto("/");

    // The inline theme bootstrap is an IIFE touching document.documentElement.
    // (Next's own scripts have a `src` or serialize the tree via __next_f.)
    const parentTags = await page.evaluate(() =>
      [...document.querySelectorAll("script")]
        .filter(
          (el) =>
            !el.src &&
            el.textContent.trim().startsWith("(function()") &&
            el.textContent.includes("document.documentElement"),
        )
        .map((el) => el.parentElement?.tagName),
    );

    // Exactly one theme script, and it lives in <head> (not a `body > script`).
    expect(parentTags).toEqual(["HEAD"]);
  });
});
