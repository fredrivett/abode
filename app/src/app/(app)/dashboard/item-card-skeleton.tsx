import { gridCardStyle } from "@/lib/grid-styles";

/**
 * Placeholder frames shown while the next page loads. Aspect ratios roughly
 * mirror the mix of real cards (portrait images, square notes, landscape
 * articles/videos) so the skeletons blend into the masonry layout.
 */
export const SKELETON_FRAMES: ReadonlyArray<{
  id: string;
  width: number;
  height: number;
}> = [
  { id: "sk-1", width: 3, height: 4 },
  { id: "sk-2", width: 1, height: 1 },
  { id: "sk-3", width: 4, height: 3 },
  { id: "sk-4", width: 3, height: 4 },
  { id: "sk-5", width: 16, height: 9 },
  { id: "sk-6", width: 1, height: 1 },
  { id: "sk-7", width: 3, height: 4 },
  { id: "sk-8", width: 4, height: 3 },
  { id: "sk-9", width: 3, height: 4 },
  { id: "sk-10", width: 1, height: 1 },
];

/**
 * Returns the skeleton frames in a fresh random order, so each load teases a
 * slightly different-looking grid rather than the same fixed shapes.
 */
export function shuffleSkeletonFrames(): (typeof SKELETON_FRAMES)[number][] {
  const frames = [...SKELETON_FRAMES];
  for (let i = frames.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [frames[i], frames[j]] = [frames[j], frames[i]];
  }
  return frames;
}

/**
 * A single pulsing placeholder card, shaped like a real grid card.
 */
export function ItemCardSkeleton() {
  return (
    <div
      className="h-full w-full animate-pulse bg-muted"
      style={gridCardStyle}
    />
  );
}
