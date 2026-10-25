import { ItemCardSkeleton, SKELETON_FRAMES } from "./item-card-skeleton";

// Two passes so wide screens get more than one row; the second reversed so the
// columns don't mirror each other
const FRAMES = [
  ...SKELETON_FRAMES.map((frame) => ({ ...frame, key: `a-${frame.id}` })),
  ...SKELETON_FRAMES.toReversed().map((frame) => ({
    ...frame,
    key: `b-${frame.id}`,
  })),
];

/**
 * Streams in under the header while the first page of items loads, so a slow
 * network shows the grid's shape instead of a frozen screen.
 */
export default function DashboardLoading() {
  return (
    <div role="status" className="columns-2 gap-3 sm:columns-[13rem]">
      <span className="sr-only">Loading your items</span>
      {FRAMES.map((frame) => (
        <div
          key={frame.key}
          className="mb-3 break-inside-avoid"
          style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
        >
          <ItemCardSkeleton />
        </div>
      ))}
    </div>
  );
}
