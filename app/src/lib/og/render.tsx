/**
 * Shared building blocks for the dynamically generated Open Graph (social
 * share) images that live in `opengraph-image.tsx` files across the public
 * routes.
 *
 * These images only affect how a link looks when someone deliberately shares
 * it (a social unfurl) — they don't drive search indexing. We still only ever
 * render PUBLIC/shared content into them; anything private falls back to a
 * branded card via `FallbackCard`.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import { getProxyImageUrl, type ImageSize } from "@/lib/image-url";
import { getAppBaseUrl } from "@/lib/url";

// Standard OG canvas. 1200x630 (1.91:1) is the size every major network crops
// to, so we render at exactly that and never letterbox.
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

// The app is intentionally monochrome (see the grayscale theme in
// globals.css). Keep the OG palette on-brand: a near-black card, off-white
// text, muted grey for secondary lines.
export const OG_COLORS = {
  bg: "#171717",
  surface: "#1f1f1f",
  fg: "#fafafa",
  muted: "#8f8f8f",
  border: "rgba(255,255,255,0.10)",
} as const;

// OG images render off-thread by crawlers; they don't need to be fresh on every
// hit. Because these routes read from the DB (uncached), Next treats them as
// dynamic, so we set an explicit long-lived, revalidate-in-background policy.
const OG_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

type OgFont = {
  name: string;
  data: Buffer;
  weight: 400 | 600;
  style: "normal";
};

// Fonts are bundled under app/assets/fonts. Satori needs raw font bytes; read
// them once and memoize for the lifetime of the server process.
let fontsPromise: Promise<OgFont[]> | null = null;

function fontPath(file: string): string {
  return join(process.cwd(), "assets", "fonts", file);
}

export function loadOgFonts(): Promise<OgFont[]> {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      readFile(fontPath("Geist-Regular.ttf")),
      readFile(fontPath("Geist-SemiBold.ttf")),
      readFile(fontPath("HedvigLettersSerif-Regular.ttf")),
    ]).then(([regular, semibold, serif]) => [
      { name: "Geist", data: regular, weight: 400, style: "normal" },
      { name: "Geist", data: semibold, weight: 600, style: "normal" },
      { name: "Hedvig", data: serif, weight: 400, style: "normal" },
    ]);
  }
  return fontsPromise;
}

/** Absolute URL for a path on this deployment (crawlers need absolute URLs). */
export function absoluteUrl(path: string): string {
  return `${getAppBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Absolute image-proxy URL for a stored file key, or null when absent. */
export function coverImageUrl(
  fileKey: string | null | undefined,
  size: ImageSize = "detail",
): string | null {
  if (!fileKey) return null;
  return absoluteUrl(getProxyImageUrl(fileKey, size));
}

/** An avatar URL is only usable if it's already an absolute http(s) URL. */
export function safeAvatarUrl(
  avatarUrl: string | null | undefined,
): string | null {
  if (!avatarUrl) return null;
  return /^https?:\/\//.test(avatarUrl) ? avatarUrl : null;
}

/** Build the shared ImageResponse (fonts + cache headers wired in). */
export async function ogImageResponse(
  element: ReactElement,
): Promise<ImageResponse> {
  const fonts = await loadOgFonts();
  return new ImageResponse(element, {
    ...OG_SIZE,
    fonts,
    headers: { "Cache-Control": OG_CACHE_CONTROL },
  });
}

const BRAND = "abode";

/**
 * Outer frame shared by every OG card: full-bleed dark background, generous
 * padding, and the wordmark in the bottom-left corner.
 */
export function OgFrame({
  children,
}: {
  children: ReactElement | ReactElement[];
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: 72,
        backgroundColor: OG_COLORS.bg,
        color: OG_COLORS.fg,
        fontFamily: "Geist",
      }}
    >
      {children}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontFamily: "Hedvig",
          fontSize: 34,
          color: OG_COLORS.fg,
        }}
      >
        {BRAND}
      </div>
    </div>
  );
}

/** Circular avatar with an initials fallback. */
export function OgAvatar({
  src,
  initial,
  size = 132,
}: {
  src: string | null;
  initial: string;
  size?: number;
}) {
  if (src) {
    return (
      // biome-ignore lint/performance/noImgElement: next/og (satori) renders raw <img>; next/image is unavailable here
      <img
        src={src}
        width={size}
        height={size}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: size,
          objectFit: "cover",
          border: `2px solid ${OG_COLORS.border}`,
        }}
      />
    );
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: OG_COLORS.surface,
        border: `2px solid ${OG_COLORS.border}`,
        fontFamily: "Geist",
        fontWeight: 600,
        fontSize: size * 0.42,
        color: OG_COLORS.fg,
      }}
    >
      {initial.toUpperCase()}
    </div>
  );
}

/**
 * Branded fallback card for not-found / private / unavailable entities. Never
 * leaks any real content — just the wordmark and a neutral tagline.
 */
export async function fallbackOgImage(
  tagline = "the home for your info",
): Promise<ImageResponse> {
  return ogImageResponse(
    <OgFrame>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: "Hedvig",
            fontSize: 92,
            lineHeight: 1.05,
          }}
        >
          {BRAND}
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 34,
            color: OG_COLORS.muted,
          }}
        >
          {tagline}
        </div>
      </div>
    </OgFrame>,
  );
}
