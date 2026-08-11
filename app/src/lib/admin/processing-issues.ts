import type { Prisma } from "@prisma/client";
import db from "@/lib/db";
import { STUCK_ITEM_THRESHOLD_MS } from "@/lib/items/reap-stuck-items";

/** How many sample rows to pull per group (counts are exact, lists are capped). */
const SAMPLE_LIMIT = 100;

/** Errors are actionable failures; "incomplete" items completed but lack data. */
export type IssueSeverity = "error" | "incomplete";

/**
 * How an admin "Reprocess" repairs a group's items — the cheapest path that
 * actually refills the gap:
 * - `"full-pipeline"`: re-run classify-url / analyze-image (paid — OpenAI +
 *   Google Vision + Replicate). Required when the missing data is *derived* from
 *   the source fetch or the AI analysis (the detail record, tags, colours) or
 *   the item genuinely failed and needs a fresh attempt.
 * - `"blur"`: regenerate only the LQIP placeholder from the stored image with
 *   sharp — no AI, no cost. The blur is a pure decode-time artifact, so re-running
 *   vision to refill it is pure waste (routed to the backfill-blur-placeholders
 *   task, scoped to the batch).
 */
export type RepairStrategy = "full-pipeline" | "blur";

export type IssueItem = {
  id: string;
  kind: string | null;
  title: string | null;
  sourceType: string | null;
  sourceUrl: string | null;
  processingError: string | null;
  updatedAt: string;
};

export type IssueGroup = {
  key: string;
  label: string;
  description: string;
  severity: IssueSeverity;
  repair: RepairStrategy;
  count: number;
  items: IssueItem[];
};

export type IssueSpec = Omit<IssueGroup, "count" | "items"> & {
  where: Prisma.ItemWhereInput;
};

/**
 * Derived (not persisted) definitions of "an item in a bad state". Each is a
 * scoped Item predicate — kind-scoped where needed so by-design empties (notes,
 * webpages, cover-less tweets, text-less kinds) aren't false-flagged. Order here
 * is the display order: errors first, then incomplete-data.
 */
export function issueSpecs(): IssueSpec[] {
  const stuckBefore = new Date(Date.now() - STUCK_ITEM_THRESHOLD_MS);
  return [
    {
      key: "failed",
      label: "Failed",
      description: "Processing ended in failure — each row shows the reason.",
      severity: "error",
      repair: "full-pipeline",
      where: { processingStatus: "failed" },
    },
    {
      key: "stuck",
      label: "Stuck",
      description:
        "Non-terminal past the reaper threshold — a run likely died. The hourly reaper marks these failed (stalled).",
      severity: "error",
      repair: "full-pipeline",
      where: {
        processingStatus: { in: ["processing", "pending"] },
        processingStartedAt: { lt: stuckBefore },
      },
    },
    {
      key: "missing-detail",
      label: "Missing detail record",
      description:
        "Completed but its kind-specific detail row (its core data) never landed.",
      severity: "incomplete",
      // The detail record is derived from the source fetch + AI analysis, so a
      // full re-run is genuinely required here.
      repair: "full-pipeline",
      where: {
        processingStatus: "completed",
        // webpage has no detail table, so it's intentionally excluded
        OR: [
          { kind: "article", articleDetails: { is: null } },
          { kind: "twitter", twitterDetails: { is: null } },
          { kind: "video", videoDetails: { is: null } },
          { kind: "product", productDetails: { is: null } },
          { kind: "book", bookDetails: { is: null } },
          { kind: "note", noteDetails: { is: null } },
          { kind: "image", imageDetails: { is: null } },
        ],
      },
    },
    {
      key: "missing-visual-vector",
      label: "Missing visual vector",
      description:
        "An image-bearing item completed without a CLIP visual vector — no similar-images match.",
      severity: "incomplete",
      // TODO: a CLIP embedding alone (1 Replicate call) would refill this without
      // re-running OpenAI/Google Vision — see the audit. Full pipeline for now.
      repair: "full-pipeline",
      where: {
        processingStatus: "completed",
        visualVectors: { none: {} },
        // images always; other cover kinds only when they actually have a cover
        OR: [
          { kind: "image" },
          {
            kind: { in: ["book", "product", "twitter"] },
            coverFileKey: { not: null },
          },
        ],
      },
    },
    {
      key: "missing-text-vector",
      label: "Missing text vector",
      description:
        "Completed with content (has tags) but no text embedding — weaker search. Mirrors enrich-item: a text vector is created whenever there was text to embed, and non-empty tags prove there was. Text-less items are correctly excluded.",
      severity: "incomplete",
      // TODO: one text embedding from the persisted tags would refill this
      // without re-running vision/tag-gen — see the audit. Full pipeline for now.
      repair: "full-pipeline",
      where: {
        processingStatus: "completed",
        // Non-empty tags ⇒ buildEmbeddingText was non-empty ⇒ a vector is owed.
        // (sourceText, the other input, isn't persisted, so tags is the proxy.)
        tags: { isEmpty: false },
        textVectors: { none: {} },
      },
    },
    {
      key: "missing-blur",
      label: "Missing blur placeholder",
      description:
        "Has image details but no blur (LQIP) placeholder — a decode-time gap.",
      severity: "incomplete",
      // Pure decode-time artifact — regenerate locally with sharp, no AI cost.
      repair: "blur",
      where: {
        processingStatus: "completed",
        imageDetails: { is: { blurDataUrl: null } },
      },
    },
  ];
}

/**
 * Current processing issues, derived live from item state (no history). Each
 * group has an exact count plus a capped, newest-first sample linking to the
 * item inspector. Runs every group's count + sample in parallel.
 */
export async function getProcessingIssues(): Promise<IssueGroup[]> {
  return Promise.all(
    issueSpecs().map(async ({ where, ...group }) => {
      const [count, items] = await Promise.all([
        db.item.count({ where }),
        db.item.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          take: SAMPLE_LIMIT,
          select: {
            id: true,
            kind: true,
            title: true,
            sourceType: true,
            sourceUrl: true,
            processingError: true,
            updatedAt: true,
          },
        }),
      ]);
      return {
        ...group,
        count,
        items: items.map((it) => ({
          ...it,
          updatedAt: it.updatedAt.toISOString(),
        })),
      };
    }),
  );
}
