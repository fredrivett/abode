import type { ReactNode } from "react";
import {
  BOOK_PAGE_EDGE_BG,
  BOOK_SPINE_HINGE_BG,
  DEFAULT_BOOK_COVER_RATIO,
} from "@/lib/book-cover";
import {
  type BookReview,
  bookReviewByline,
  bookReviewCardLayout,
  reviewText,
} from "@/lib/books/review";
import { truncateAtWord } from "@/lib/highlights/share";
import { OG_COLORS } from "@/lib/og/theme";
import { hexToRgb } from "@/lib/search/color-utils";

export const BOOK_REVIEW_CARD_SIZE = { width: 1200, height: 630 } as const;

// Matches the in-app rating stars (Tailwind yellow-400)
const STAR_YELLOW = "#facc15";
const STAR_EMPTY = "rgba(255,255,255,0.16)";
// lucide's Star
const STAR_PATH =
  "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z";

// The book's box on the card: as tall as fits, unless a wide cover hits the
// width cap first
const BOOK_MAX_HEIGHT = 420;
const BOOK_MAX_WIDTH = 300;
// How far the page block and back board show past the front cover
const BOOK_DEPTH = 16;
const BLANK_BOARD = "#2a2a2a";

export type BookReviewShareCardProps = {
  title: string;
  authors: string[];
  review: BookReview;
  ownerUsername: string;
  /** Cover width/height; defaults to 2:3 */
  coverRatio?: number;
  /** Dominant cover colour: tints the glow behind the book and a blank board */
  coverColor?: string | null;
  /**
   * Draws the cover image at the given size, however the host can (a raw
   * <img> in next/og, a retrying <Img> in the DOM); null for a book without
   * one, which gets a typeset board instead
   */
  renderCover: ((size: { width: number; height: number }) => ReactNode) | null;
  /** Font families: "Hedvig"/"Geist" in next/og, CSS vars in the DOM */
  fonts: { serif: string; sans: string };
  /** The abode wordmark, rendered however the host can draw it */
  logo: ReactNode;
};

function rgba(hex: string | null | undefined, alpha: number): string | null {
  const rgb = hex ? hexToRgb(hex) : null;
  return rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})` : null;
}

function bookSize(ratio: number) {
  const height = Math.min(BOOK_MAX_HEIGHT, BOOK_MAX_WIDTH / ratio);
  return { width: Math.round(height * ratio), height: Math.round(height) };
}

/**
 * The 1200x630 share card for a book review. Inline styles only (flex layout,
 * no classes, no 3D transforms) so the exact same markup renders in next/og —
 * the real link unfurl — and in the DOM as the share dialog's preview. Every
 * part but the title is optional and the layout closes up around what's
 * missing.
 */
export function BookReviewShareCard({
  title,
  authors,
  review,
  ownerUsername,
  coverRatio = DEFAULT_BOOK_COVER_RATIO,
  coverColor,
  renderCover,
  fonts,
  logo,
}: BookReviewShareCardProps) {
  const layout = bookReviewCardLayout({ title, review: reviewText(review) });
  const authorLine =
    authors.length > 0 ? truncateAtWord(authors.join(", "), 48) : null;
  const glow = rgba(coverColor, 0.4);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: BOOK_REVIEW_CARD_SIZE.width,
        height: BOOK_REVIEW_CARD_SIZE.height,
        padding: "56px 80px 52px",
        backgroundColor: OG_COLORS.bg,
        // Satori chokes on an undefined style value, so omit it entirely
        ...(glow && {
          backgroundImage: `radial-gradient(circle at 21% 46%, ${glow} 0%, rgba(23,23,23,0) 40%)`,
        }),
        color: OG_COLORS.fg,
        fontFamily: fonts.sans,
      }}
    >
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          gap: 72,
          minHeight: 0,
        }}
      >
        <CardBook
          size={bookSize(coverRatio)}
          coverColor={coverColor ?? null}
          renderCover={renderCover}
          title={title}
          authors={authors}
          serif={fonts.serif}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minWidth: 0,
            maxHeight: "100%",
            // Last resort if the type steps misjudge a wrap: clip, never
            // spill over the footer
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: fonts.serif,
              fontSize: layout.title.fontSize,
              lineHeight: 1.1,
              letterSpacing: "-0.015em",
            }}
          >
            {layout.title.text}
          </div>
          {authorLine && (
            <div
              style={{
                display: "flex",
                marginTop: 14,
                fontSize: layout.review ? 26 : 30,
                color: OG_COLORS.muted,
              }}
            >
              {authorLine}
            </div>
          )}
          {review.rating !== null && (
            <div style={{ display: "flex", marginTop: 26 }}>
              <CardStars
                rating={review.rating}
                size={layout.review ? 32 : 40}
              />
            </div>
          )}
          {layout.review && (
            <div
              style={{
                display: "flex",
                marginTop: 30,
                fontFamily: fonts.serif,
                fontSize: layout.review.fontSize,
                lineHeight: 1.38,
                color: "#e5e5e5",
              }}
            >
              {`“${layout.review.text}”`}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 48,
          marginTop: 36,
          paddingTop: 28,
          borderTop: `1px solid ${OG_COLORS.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            minWidth: 0,
            fontSize: 24,
            color: OG_COLORS.muted,
          }}
        >
          {bookReviewByline({ username: ownerUsername, review })}
        </div>
        <div style={{ display: "flex", flexShrink: 0 }}>{logo}</div>
      </div>
    </div>
  );
}

/**
 * The app's hardback, flattened for a renderer without 3D transforms: the
 * front board, with the page block and back board showing past its fore-edge.
 */
function CardBook({
  size,
  coverColor,
  renderCover,
  title,
  authors,
  serif,
}: {
  size: { width: number; height: number };
  coverColor: string | null;
  renderCover: BookReviewShareCardProps["renderCover"];
  title: string;
  authors: string[];
  serif: string;
}) {
  const { width, height } = size;
  const board = coverColor ?? BLANK_BOARD;

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        flexShrink: 0,
        width: width + BOOK_DEPTH,
        height,
      }}
    >
      {/* Back board, in shadow behind the pages */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: BOOK_DEPTH,
          top: 5,
          width,
          height: height - 10,
          borderRadius: "2px 5px 5px 2px",
          backgroundColor: board,
          backgroundImage:
            "linear-gradient(to right, rgba(0,0,0,0.55), rgba(0,0,0,0.7))",
          boxShadow: "8px 18px 40px rgba(0,0,0,0.55)",
        }}
      />
      {/* Page block fore-edge */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: width - 8,
          top: 8,
          width: BOOK_DEPTH + 2,
          height: height - 16,
          backgroundImage: BOOK_PAGE_EDGE_BG,
        }}
      />
      {/* Front board */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          top: 0,
          width,
          height,
          overflow: "hidden",
          borderRadius: "3px 6px 6px 3px",
          backgroundColor: board,
          boxShadow: "14px 22px 44px rgba(0,0,0,0.5)",
        }}
      >
        {renderCover ? (
          renderCover({ width, height })
        ) : (
          <BlankCover
            width={width}
            title={title}
            authors={authors}
            serif={serif}
          />
        )}
        {/* Spine hinge groove down the left edge */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            top: 0,
            width,
            height,
            backgroundImage: BOOK_SPINE_HINGE_BG,
          }}
        />
        {/* Board edge catching the light, and a soft sheen */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            top: 0,
            width,
            height,
            backgroundImage:
              "linear-gradient(to left, rgba(255,255,255,0.28), rgba(255,255,255,0) 2%), linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0) 60%)",
          }}
        />
      </div>
    </div>
  );
}

/** A typeset cover for a book saved without a cover image. */
function BlankCover({
  width,
  title,
  authors,
  serif,
}: {
  width: number;
  title: string;
  authors: string[];
  serif: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: "100%",
        padding: "0 12%",
        textAlign: "center",
        color: "rgba(255,255,255,0.92)",
      }}
    >
      <div
        style={{
          display: "flex",
          fontFamily: serif,
          fontSize: Math.round(width * 0.12),
          lineHeight: 1.15,
        }}
      >
        {truncateAtWord(title, 60)}
      </div>
      {authors.length > 0 && (
        <div
          style={{
            display: "flex",
            marginTop: 18,
            paddingTop: 16,
            borderTop: "1px solid rgba(255,255,255,0.3)",
            fontSize: Math.round(width * 0.065),
            color: "rgba(255,255,255,0.7)",
          }}
        >
          {truncateAtWord(authors[0], 32)}
        </div>
      )}
    </div>
  );
}

function StarIcon({ size, fill }: { size: number; fill: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      style={{ display: "flex" }}
    >
      <path d={STAR_PATH} fill={fill} />
    </svg>
  );
}

/** Five stars filled to a /10 rating (odd values end on a half star). */
function CardStars({ rating, size }: { rating: number; size: number }) {
  return (
    <div style={{ display: "flex", gap: Math.round(size * 0.16) }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = n * 2 <= rating ? 1 : n * 2 - 1 === rating ? 0.5 : 0;
        return (
          <div
            key={n}
            style={{
              display: "flex",
              position: "relative",
              width: size,
              height: size,
            }}
          >
            <StarIcon size={size} fill={STAR_EMPTY} />
            {fill > 0 && (
              <div
                style={{
                  display: "flex",
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: size * fill,
                  height: size,
                  overflow: "hidden",
                }}
              >
                <StarIcon size={size} fill={STAR_YELLOW} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
