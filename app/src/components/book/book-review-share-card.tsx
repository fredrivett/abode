import type { ReactNode } from "react";
import { DEFAULT_BOOK_COVER_RATIO } from "@/lib/book-cover";
import {
  coverOverhang,
  coverSlices,
  pageSlices,
  planeOutline,
} from "@/lib/books/cover-perspective";
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
const BOOK_MAX_HEIGHT = 384;
const BOOK_MAX_WIDTH = 300;
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
   * The cover image, drawn into an SVG <image>: a data URI in next/og (whose
   * SVG renderer can't fetch), any URL in the DOM; null for a book without
   * one, which gets a plain board in its cover colour
   */
  coverHref: string | null;
  /** Prefix for the book's SVG ids, unique on the page */
  svgId?: string;
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
 * the real link unfurl — and in the DOM as the share dialog's preview. next/og
 * must call it as a function (see cardBook) so its cover image loads. Every
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
  coverHref,
  svgId = "book-review-card",
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
        {/* Called, not rendered as a component: satori only preloads an SVG
            <image> it can reach through plain elements */}
        {cardBook({
          size: bookSize(coverRatio),
          coverColor: coverColor ?? null,
          coverHref,
          id: svgId,
        })}

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
              {/* Satori has no italic Geist, so "by" is slanted with a skew,
                  which renders the same in next/og and the DOM preview */}
              <span
                style={{
                  display: "flex",
                  marginRight: "0.3em",
                  transform: "skewX(-12deg)",
                }}
              >
                by
              </span>
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

type Point = [number, number];

// BOOK_SPINE_HINGE_BG and BOOK_PAGE_EDGE_BG's wash (BookCover3D), as SVG stops
const SPINE_STOPS = [
  [0, "#000", 0.28],
  [0.03, "#000", 0.05],
  [0.045, "#fff", 0.14],
  [0.07, "#000", 0.22],
  [0.1, "#000", 0],
] as const;
const PAGE_WASH_STOPS = [
  [0, "#fff", 0.3],
  [0.25, "#000", 0],
  [0.6, "#000", 0.06],
  [1, "#000", 0.24],
] as const;

// Satori only takes intrinsic elements inside <svg>, so stops are built by a
// plain function rather than a component
function gradientStops(stops: readonly (readonly [number, string, number])[]) {
  return stops.map(([offset, color, opacity]) => (
    <stop
      key={offset}
      offset={offset}
      stopColor={color}
      stopOpacity={opacity}
    />
  ));
}

/**
 * The app's 3D hardback (BookCover3D) at the same angle, for a renderer
 * without 3D transforms. Drawn as SVG: the back board, then the page block and
 * the turned front cover, the cover as thin slices each clipped to its exact
 * projected outline and scaled by its depth.
 */
function cardBook({
  size,
  coverColor,
  coverHref,
  id,
}: {
  size: { width: number; height: number };
  coverColor: string | null;
  coverHref: string | null;
  /** Prefix for the SVG's ids, unique per page */
  id: string;
}) {
  const { width, height } = size;
  const board = coverColor ?? BLANK_BOARD;
  const overhang = coverOverhang(height);
  // Below the book, for its contact shadow
  const floor = height * 0.06;
  const cover = coverSlices({ width, height });
  const pages = pageSlices({ width, height });
  const coverOutline = planeOutline(cover);
  const pagesOutline = planeOutline(pages);
  const points = (pts: Point[]) =>
    pts
      .map(([x, y]) => `${x.toFixed(2)},${(y + overhang).toFixed(2)}`)
      .join(" ");
  const url = (name: string) => `url(#${id}-${name})`;

  return (
    <svg
      width={width}
      height={height + 2 * overhang + floor}
      viewBox={`0 0 ${width} ${height + 2 * overhang + floor}`}
      style={{ display: "flex", flexShrink: 0, overflow: "visible" }}
      aria-hidden
    >
      <defs>
        <filter
          id={`${id}-shadow`}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation={10} />
        </filter>
        <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={5} />
        </filter>
        <linearGradient id={`${id}-spine`} x1="0" y1="0" x2="1" y2="0">
          {gradientStops(SPINE_STOPS)}
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="0">
          <stop offset={0.97} stopColor="#fff" stopOpacity={0} />
          <stop offset={1} stopColor="#fff" stopOpacity={0.3} />
        </linearGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset={0} stopColor="#fff" stopOpacity={0.12} />
          <stop offset={0.6} stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <linearGradient id={`${id}-pages`} x1="0" y1="0" x2="1" y2="0">
          {gradientStops(PAGE_WASH_STOPS)}
        </linearGradient>
        {/* Defined once and reused: the cover is a data URI in next/og, and
            a copy per slice would bloat the SVG past its parser's limits */}
        {coverHref && (
          <image
            id={`${id}-cover`}
            href={coverHref}
            x={0}
            y={0}
            width={width}
            height={height}
            preserveAspectRatio="xMidYMid slice"
          />
        )}
        <clipPath id={`${id}-back`}>
          <rect x={0} y={overhang} width={width} height={height} rx={3} />
        </clipPath>
        {cover.map((slice, i) => (
          <clipPath key={slice.from} id={`${id}-slice-${i}`}>
            <polygon
              // A hair wider than the slice so no seam shows between them
              points={points(
                i === cover.length - 1
                  ? slice.quad
                  : [
                      slice.quad[0],
                      [slice.quad[1][0] + 3, slice.quad[1][1]],
                      [slice.quad[2][0] + 3, slice.quad[2][1]],
                      slice.quad[3],
                    ],
              )}
            />
          </clipPath>
        ))}
      </defs>

      {/* Contact shadow beneath the book */}
      <ellipse
        cx={width / 2}
        cy={overhang + height + floor * 0.15}
        rx={width * 0.42}
        ry={floor * 0.45}
        fill="#000"
        fillOpacity={0.45}
        filter={url("soft")}
      />

      {/* Back board, in shadow behind the pages */}
      <rect
        x={2}
        y={overhang + 4}
        width={width}
        height={height}
        rx={3}
        fill="#000"
        fillOpacity={0.35}
        filter={url("soft")}
      />
      <g clipPath={url("back")}>
        <rect x={0} y={overhang} width={width} height={height} fill={board} />
        {coverHref && <use href={`#${id}-cover`} y={overhang} />}
        <rect
          x={0}
          y={overhang}
          width={width}
          height={height}
          fill="#000"
          fillOpacity={0.5}
        />
      </g>

      {/* Page block fore-edge, lined like page edges */}
      <polygon points={points(pagesOutline)} fill="#f6f1e7" />
      {pages
        .filter((_, i) => i % 2 === 1)
        .map((slice) => (
          <line
            key={slice.from}
            x1={slice.quad[0][0]}
            y1={slice.quad[0][1] + overhang}
            x2={slice.quad[3][0]}
            y2={slice.quad[3][1] + overhang}
            stroke="#cbc0a9"
            strokeWidth={0.5}
          />
        ))}
      <polygon points={points(pagesOutline)} fill={url("pages")} />

      {/* Shadow the turned cover casts */}
      <polygon
        points={points(coverOutline)}
        transform="translate(6 8)"
        fill="#000"
        fillOpacity={0.45}
        filter={url("shadow")}
      />

      {/* Front cover, slice by slice */}
      {cover.map((slice, i) => (
        <g key={slice.from} clipPath={url(`slice-${i}`)}>
          <g
            // Put the slice's flat column, scaled, at its projected spot
            transform={`translate(${slice.left} ${overhang + slice.top}) scale(${slice.scaleX} ${slice.scaleY}) translate(${-slice.from} 0)`}
          >
            {/* resvg feathers an image at its clip's edge, so a backing
                board would show through as seams; the overlap from the
                slice before fills in instead */}
            {coverHref ? (
              <use href={`#${id}-cover`} />
            ) : (
              <rect
                x={slice.from - 1}
                y={0}
                width={slice.width + 2}
                height={height}
                fill={board}
              />
            )}
          </g>
        </g>
      ))}

      {/* Spine hinge groove, board edge catching the light, and a sheen */}
      <polygon points={points(coverOutline)} fill={url("spine")} />
      <polygon points={points(coverOutline)} fill={url("edge")} />
      <polygon points={points(coverOutline)} fill={url("sheen")} />
    </svg>
  );
}

function StarIcon({ size, fill }: { size: number; fill: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      // Never shrink to fit: the half star clips a full one in a half-width box
      style={{ display: "flex", flexShrink: 0 }}
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
