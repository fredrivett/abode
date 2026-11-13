import type { Meta, StoryObj } from "@storybook/react";
import { expect, waitFor } from "storybook/test";
import { ArticleCard } from "@/components/article/article-card";
import { WebpageLinkCard } from "@/components/webpage/webpage-link-card";
import { type FaviconTone, loadFaviconTone } from "@/lib/favicon-tone";
import { cn } from "@/lib/utils";

/**
 * Each favicon tone on both places a favicon renders (the article card's
 * byline, the link card's tile), in light and dark. An ink-only favicon gets a
 * backdrop chip only in the theme it would vanish in.
 */

// Inline SVGs stand in for re-hosted favicons so the stories render offline
function svg(body: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${body}</svg>`,
  )}`;
}

// A single-ink glyph on a transparent background, like most personal sites'
const glyph = (ink: string) =>
  svg(
    `<path d="M8 26 16 6l8 20M11 19h10" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  );

const DARK_INK = glyph("#1a1a1a");
const LIGHT_INK = glyph("#ffffff");
const MID_TONE = glyph("#e5484d");
// A near-black tile of its own (like abode's): dark, but it brings its edge
const OWN_TILE = svg(
  `<rect width="32" height="32" rx="7" fill="#111"/><path d="M9 23 16 9l7 14M12 18h8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
);

function ThemePanels({ faviconUrl }: { faviconUrl: string }) {
  return (
    <div className="flex">
      {(["light", "dark"] as const).map((theme) => (
        <div
          key={theme}
          data-theme-panel={theme}
          className={cn(
            "flex w-[22rem] flex-col gap-6 bg-background p-6 text-foreground",
            theme === "dark" && "dark",
          )}
        >
          <div style={{ height: 180 }}>
            <ArticleCard
              title="Notes from a weekend of tinkering"
              content={null}
              domain="example.com"
              publishedAt="2026-10-23T00:00:00.000Z"
              readingTime={5}
              faviconUrl={faviconUrl}
            />
          </div>
          <WebpageLinkCard
            url="https://example.com/notes"
            title="Notes from a weekend of tinkering"
            faviconUrl={faviconUrl}
          />
        </div>
      ))}
    </div>
  );
}

const meta = {
  title: "Favicon/Tones",
  component: ThemePanels,
  tags: ["autodocs"],
} satisfies Meta<typeof ThemePanels>;

export default meta;
type Story = StoryObj<typeof meta>;

const TRANSPARENT = "rgba(0, 0, 0, 0)";

/**
 * Waits for the tone to be measured, then checks every favicon wrapper (byline
 * chip, link-card tile) carries it and is backed only in the theme it needs.
 */
async function expectTone(
  canvasElement: HTMLElement,
  faviconUrl: string,
  tone: FaviconTone | null,
) {
  await expect(await loadFaviconTone(faviconUrl)).toBe(tone);
  for (const panel of canvasElement.querySelectorAll<HTMLElement>(
    "[data-theme-panel]",
  )) {
    const wrappers = [
      ...panel.querySelectorAll<HTMLElement>(`img[src="${faviconUrl}"]`),
    ].map((img) => img.parentElement);
    await expect(wrappers).toHaveLength(2);
    const backed = panel.dataset.themePanel === tone;
    for (const wrapper of wrappers) {
      await waitFor(() =>
        expect(wrapper?.getAttribute("data-tone") ?? null).toBe(tone),
      );
      if (!wrapper) continue;
      const background = getComputedStyle(wrapper).backgroundColor;
      await expect(background !== TRANSPARENT).toBe(backed);
    }
  }
}

// Dark ink vanishes on the dark card: chipped in dark mode only
export const DarkInk: Story = {
  args: { faviconUrl: DARK_INK },
  play: ({ canvasElement }) => expectTone(canvasElement, DARK_INK, "dark"),
};

// White ink vanishes on the light card: chipped in light mode only
export const LightInk: Story = {
  args: { faviconUrl: LIGHT_INK },
  play: ({ canvasElement }) => expectTone(canvasElement, LIGHT_INK, "light"),
};

// A mid-tone ink contrasts with both cards: bare in both themes
export const MidTone: Story = {
  args: { faviconUrl: MID_TONE },
  play: ({ canvasElement }) => expectTone(canvasElement, MID_TONE, null),
};

// An icon with its own tile reads anywhere, however dark: bare in both
export const OwnTile: Story = {
  args: { faviconUrl: OWN_TILE },
  play: ({ canvasElement }) => expectTone(canvasElement, OWN_TILE, null),
};
