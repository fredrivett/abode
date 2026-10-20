"use client";

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { AbodeLogo } from "@/components/abode-logo";
import { OG_COLORS } from "@/lib/og/theme";

/**
 * Renders a fixed-size share card (e.g. 1200x630) scaled down to the available
 * width, so the preview is pixel-for-pixel the image a chat app unfurls for
 * the link.
 */
export function ShareCardPreview({
  size,
  children,
}: {
  size: { width: number; height: number };
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  const scale = width / size.width;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10"
      style={{
        aspectRatio: `${size.width} / ${size.height}`,
        backgroundColor: OG_COLORS.bg,
      }}
    >
      {width > 0 && (
        <div
          aria-hidden
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: `scale(${scale})` }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** The DOM stand-ins for the fonts next/og loads by name. */
export const SHARE_CARD_DOM_FONTS = {
  serif: "var(--font-hedvig-serif, serif)",
  sans: "var(--font-geist-sans, sans-serif)",
};

const LOGO_HEIGHT = 30;

/** The abode wordmark at the size the next/og cards draw it. */
export function ShareCardLogo() {
  return (
    <AbodeLogo
      aria-hidden
      height={LOGO_HEIGHT}
      width={(LOGO_HEIGHT * 158) / 50}
      style={{ color: OG_COLORS.fg }}
    />
  );
}
