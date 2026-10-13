import type { ReactNode } from "react";
import { highlightQuoteLayout, truncateAtWord } from "@/lib/highlights/share";
import { OG_COLORS } from "@/lib/og/theme";

export const HIGHLIGHT_CARD_SIZE = { width: 1200, height: 630 } as const;

// Matches the in-app highlight marks (Tailwind yellow-400)
const HIGHLIGHT_YELLOW = "#facc15";

export type HighlightShareCardProps = {
  text: string;
  /** Article title; omitted from the card when missing */
  title: string | null;
  domain: string | null;
  ownerUsername: string;
  /** Font families: "Hedvig"/"Geist" in next/og, CSS vars in the DOM */
  fonts: { serif: string; sans: string };
  /** The abode wordmark, rendered however the host can draw it */
  logo: ReactNode;
};

/**
 * The 1200x630 share card for a highlight. Inline styles only (flex layout,
 * no classes) so the exact same markup renders in next/og — the real link
 * unfurl — and in the DOM as the share dialog's preview.
 */
export function HighlightShareCard({
  text,
  title,
  domain,
  ownerUsername,
  fonts,
  logo,
}: HighlightShareCardProps) {
  const quote = highlightQuoteLayout(text);
  const byline = [domain, `highlighted by @${ownerUsername}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: HIGHLIGHT_CARD_SIZE.width,
        height: HIGHLIGHT_CARD_SIZE.height,
        padding: "72px 80px 64px",
        backgroundColor: OG_COLORS.bg,
        color: OG_COLORS.fg,
        fontFamily: fonts.sans,
      }}
    >
      <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 44, width: "100%" }}>
          <div
            style={{
              display: "flex",
              width: 8,
              flexShrink: 0,
              borderRadius: 4,
              backgroundColor: HIGHLIGHT_YELLOW,
            }}
          />
          <div
            style={{
              display: "flex",
              flex: 1,
              minWidth: 0,
              fontFamily: fonts.serif,
              fontSize: quote.fontSize,
              lineHeight: 1.3,
              letterSpacing: "-0.01em",
            }}
          >
            {`“${quote.text}”`}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 48,
          paddingTop: 36,
          borderTop: `1px solid ${OG_COLORS.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            minWidth: 0,
          }}
        >
          {title && (
            <div
              style={{
                display: "flex",
                fontSize: 28,
                fontWeight: 600,
                lineHeight: 1.2,
              }}
            >
              {truncateAtWord(title, 64)}
            </div>
          )}
          <div
            style={{ display: "flex", fontSize: 24, color: OG_COLORS.muted }}
          >
            {byline}
          </div>
        </div>
        <div style={{ display: "flex", flexShrink: 0 }}>{logo}</div>
      </div>
    </div>
  );
}
