import { expect, test } from "@playwright/test";

test.describe("Marketing page", () => {
  test("should display the hero and waitlist form", async ({ page }) => {
    await page.goto("/");

    // Hero headline + subline
    await expect(
      page.getByRole("heading", { name: /your home should be yours/i }),
    ).toBeVisible();
    await expect(
      page.getByText("save everything. sort nothing. own it all."),
    ).toBeVisible();

    // Waitlist form (in the hero — a second one lives in the closing CTA, so
    // scope to <main> to keep the locators unambiguous)
    const hero = page.getByRole("main");
    await expect(hero.getByPlaceholder("enter your email")).toBeVisible();
    await expect(
      hero.getByRole("button", { name: /join waitlist/i }),
    ).toBeVisible();

    // Theme toggle is present
    await expect(page.getByRole("button", { name: /theme/i })).toBeVisible();
  });

  test("should have an accessible abode brand mark", async ({ page }) => {
    await page.goto("/");

    // The abode logo (an SVG with an accessible label) is present in the header
    await expect(
      page.getByRole("img", { name: "abode" }).first(),
    ).toBeVisible();
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
