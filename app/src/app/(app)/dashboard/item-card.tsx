"use client";

import type { ProcessingStatus } from "@prisma/client";
import {
  AlertCircle,
  BookOpen,
  Check,
  Copy,
  DoorOpen,
  Download,
  ExternalLink,
  FileText,
  Hand,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  ScanSearch,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  AnimatePresence,
  animate,
  motion,
  type PanInfo,
  useMotionValue,
  useTransform,
} from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import posthog from "posthog-js";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { useMediaQuery } from "usehooks-ts";
import { ArticleCard } from "@/components/article/article-card";
import { BookCover3D } from "@/components/book/book-cover-3d";
import { PlatformIcon } from "@/components/icons/platform-icons";
import { NoteCard } from "@/components/note/note-card";
import { TwitterCard } from "@/components/twitter/twitter-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BlurImage } from "@/components/ui/blur-image";
import { Button } from "@/components/ui/button";
import { DateTime } from "@/components/ui/date-time";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EditableTitle } from "@/components/ui/editable-title";
import { IsLoading } from "@/components/ui/is-loading";
import { Progress } from "@/components/ui/progress";
import { VideoCard } from "@/components/video/video-card";
import { api } from "@/lib/api-client";
import { useInvalidateItems } from "@/lib/api-hooks";
import {
  BOOK_TILE_PADDING_X,
  BOOK_TILE_PADDING_Y,
  getBookCoverRatio,
  getDominantCoverColor,
} from "@/lib/book-cover";
import { copyToClipboard } from "@/lib/copy";
import { getCurrencySymbol } from "@/lib/currency";
import { gridCardStyle } from "@/lib/grid-styles";
import { decodeHtmlEntities } from "@/lib/html-metadata";
import { getProxyImageUrl } from "@/lib/image-url";
import { getProcessingErrorCopy } from "@/lib/items/processing-error-copy";
import { supportsSimilarImages } from "@/lib/items/similar-images-support";
import {
  MAX_USER_TAG_LENGTH,
  MAX_USER_TAGS,
  USER_TAG_REGEX,
} from "@/lib/items/user-tag-validation";
import { createLogger } from "@/lib/logger.client";
import {
  shouldCompleteAddFirstTag,
  shouldCompleteSeeAiAnalysis,
} from "@/lib/milestones/conditions";
import { getPlatformName } from "@/lib/platforms";
import { useSearch } from "@/lib/search";
import { createFilterId } from "@/lib/search/types";
import { createClient } from "@/lib/supabase/client";
import type {
  ExternalLink as ExternalLinkType,
  Item,
  ItemRoom,
} from "@/lib/types/item";
import { getAppBaseUrl } from "@/lib/url";
import { isValidUrl } from "@/lib/url-utils";
import { cn } from "@/lib/utils";
import { useMilestoneStore } from "@/stores/milestone-store";
import { useUserStore } from "@/stores/user-store";
import { AddToRoomPopover } from "./_components/add-to-room-popover";
import { ColorHighlightOverlay } from "./_components/color-highlight-overlay";
import { ColorsBar } from "./_components/colors-bar";
import { ItemTypeField } from "./_components/item-type-field";
import { LocationDisplay } from "./_components/location-display";
import { LocationDropzone } from "./_components/location-dropzone";
import { SimilarImages } from "./_components/similar-images";

const log = createLogger("dashboard/item-card");

// Detail views render only inside the click-to-expand modal, never in the
// collapsed grid card. Load them lazily so they stay out of the dashboard
// grid's initial JS. ssr:false is safe because the modal is client-only.
const detailViewLoading = () => (
  <div className="flex h-full w-full items-center justify-center">
    <IsLoading label="Loading" />
  </div>
);

const ArticleDetailView = dynamic(
  () =>
    import("@/components/article/article-detail-view").then(
      (m) => m.ArticleDetailView,
    ),
  { ssr: false, loading: detailViewLoading },
);

const HighlightsPanel = dynamic(
  () =>
    import("@/components/article/highlights-panel").then(
      (m) => m.HighlightsPanel,
    ),
  { ssr: false, loading: detailViewLoading },
);

const BookDetailView = dynamic(
  () =>
    import("@/components/book/book-detail-view").then((m) => m.BookDetailView),
  { ssr: false, loading: detailViewLoading },
);

const BookReadingControls = dynamic(
  () =>
    import("@/components/book/book-reading-controls").then(
      (m) => m.BookReadingControls,
    ),
  { ssr: false },
);

const NoteDetailView = dynamic(
  () =>
    import("@/components/note/note-detail-view").then((m) => m.NoteDetailView),
  { ssr: false, loading: detailViewLoading },
);

const ProductDetailView = dynamic(
  () =>
    import("@/components/product/product-detail-view").then(
      (m) => m.ProductDetailView,
    ),
  { ssr: false, loading: detailViewLoading },
);

const TwitterDetailView = dynamic(
  () =>
    import("@/components/twitter/twitter-detail-view").then(
      (m) => m.TwitterDetailView,
    ),
  { ssr: false, loading: detailViewLoading },
);

const VideoDetailView = dynamic(
  () =>
    import("@/components/video/video-detail-view").then(
      (m) => m.VideoDetailView,
    ),
  { ssr: false, loading: detailViewLoading },
);

type ItemCardProps = {
  item: Item;
  name: string;
  size: string;
  mimeType?: string;
  /**
   * Whether the current user can edit this item.
   * When false, notes, privacy settings, delete button, and location editing are hidden.
   * Defaults to true for backwards compatibility.
   */
  canEdit?: boolean;
};

function ProcessingOverlay({ status }: { status: ProcessingStatus }) {
  if (status === "completed") return null;

  const isProcessing = status === "processing";
  const isFailed = status === "failed";

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 flex items-end justify-start p-2",
        isProcessing &&
          "bg-gradient-to-t from-black/60 via-transparent to-transparent",
        isFailed &&
          "bg-gradient-to-t from-red-900/70 via-transparent to-transparent",
      )}
      style={gridCardStyle}
    >
      <div
        className={cn(
          "pointer-events-auto flex cursor-default items-center gap-1.5 rounded-full px-2 py-1 font-medium text-xs backdrop-blur-sm",
          isProcessing && "bg-white/20 text-white",
          isFailed && "bg-red-500/30 text-red-100",
        )}
      >
        {isProcessing ? (
          <IsLoading label="Analyzing" iconClassName="size-3" />
        ) : isFailed ? (
          <>
            <AlertCircle className="size-3" />
            <span>Failed</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Grid card for a single item with click-to-expand detail dialog.
 *
 * Handles image/article/twitter/video content types, progressive image loading,
 * swipe-to-dismiss on touch devices, editing (name, tags, notes, links, location,
 * privacy), room membership, and deletion.
 */
export function ItemCard({
  item,
  name,
  size,
  mimeType,
  canEdit = true,
}: ItemCardProps) {
  const invalidateItems = useInvalidateItems();
  const [itemName, setItemName] = useState(name);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  // Tiny blurred placeholder (LQIP). Prefer the server-generated one stored in
  // imageDetails; fall back to the meta copy captured client-side at upload time
  // (instant, before analysis has run).
  const blurDataUrl =
    item.blurDataUrl ??
    (typeof item.meta?.blurDataUrl === "string" ? item.meta.blurDataUrl : null);

  const isArticle = item.kind === "article";
  const isWebpage = item.kind === "webpage";
  const isTwitter = item.kind === "twitter";
  const isVideo = item.kind === "video";
  const isProduct = item.kind === "product";
  const isBook = item.kind === "book";
  const isNote = item.kind === "note";
  const isArticleOrWebpage = isArticle || isWebpage;
  const isProcessingUrl =
    item.sourceType === "url" && item.processingStatus === "processing";
  // Failed URL items may not have a kind set yet (processing failed before classification)
  const isFailedUrl =
    item.sourceType === "url" && item.processingStatus === "failed";
  // For articles/webpages/products/books, use coverFileKey; for images, use fileKey
  const imageFileKey =
    isArticleOrWebpage || isProduct || isBook
      ? item.coverFileKey
      : item.fileKey;
  // Has displayable image: either it's an image type OR it's an article/webpage/product/book with a cover
  const hasDisplayableImage =
    mimeType?.startsWith("image/") ||
    (isArticleOrWebpage && !!item.coverFileKey) ||
    (isProduct && !!item.coverFileKey) ||
    (isBook && !!item.coverFileKey);

  useEffect(() => {
    // Articles/webpages without a cover image don't need to load anything
    // URL items that are still processing don't have a file yet - that's expected
    // Twitter items use TwitterCard which displays tweet content, not an image file
    // Video items use VideoCard which handles its own thumbnail display
    // Failed URL items won't have a file - they'll show a failed state placeholder
    if (!imageFileKey) {
      setPreviewUrl(null);
      if (
        !isArticleOrWebpage &&
        !isProcessingUrl &&
        !isTwitter &&
        !isVideo &&
        !isFailedUrl &&
        !isNote &&
        !isBook &&
        !isProduct
      ) {
        setError("Missing file");
      }
      return;
    }

    // Use optimized proxy URL for all users (CDN cached, WebP, sized for grid)
    const proxyUrl = getProxyImageUrl(imageFileKey, "grid");
    setError(null);
    setPreviewUrl(proxyUrl);
  }, [
    imageFileKey,
    isArticleOrWebpage,
    isProcessingUrl,
    isTwitter,
    isVideo,
    isFailedUrl,
    isNote,
    isBook,
    isProduct,
  ]);

  useEffect(() => {
    setItemName(name);
  }, [name]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete("/api/v1/items", {
        body: JSON.stringify({ id: item.id }),
      });

      // Track item deletion event
      posthog.capture("item_deleted", {
        item_id: item.id,
        item_kind: item.kind,
        source_type: item.sourceType,
      });

      toast.success("Item deleted");
      setShowDeleteDialog(false);
      invalidateItems();
    } catch (error) {
      log.error({ error }, "Delete error");
      posthog.captureException(error);
      toast.error("Failed to delete item");
      setIsDeleting(false);
    }
  };

  const handleOpenDetail = () => {
    setIsAnimating(true);
    setShowDetailDialog(true);

    // Track item details viewed event
    posthog.capture("item_details_viewed", {
      item_id: item.id,
      item_kind: item.kind,
      source_type: item.sourceType,
    });

    // Mark see_ai_analysis milestone if item processing is complete
    if (shouldCompleteSeeAiAnalysis(item.processingStatus)) {
      useMilestoneStore.getState().markComplete("see_ai_analysis");
      // Also persist to server (fire-and-forget)
      void api.post("/api/v1/user/milestones", { type: "see_ai_analysis" });
    }
  };

  if (error) {
    return (
      <div
        className="flex h-full items-center justify-center border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
        style={gridCardStyle}
      >
        <p className="text-destructive text-sm">{error}</p>
      </div>
    );
  }

  // Products without cover images get a placeholder card
  if (isProduct && !previewUrl && !imageFileKey) {
    return (
      <>
        <button
          type="button"
          className="group relative flex h-full w-full cursor-pointer flex-col items-center justify-center border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 transition-colors hover:border-gray-300 dark:border-gray-800 dark:from-gray-900 dark:to-gray-800 dark:hover:border-gray-700"
          style={{ ...gridCardStyle, padding: "1em", gap: "0.75em" }}
          onClick={handleOpenDetail}
        >
          <ProcessingOverlay status={item.processingStatus} />
          <ShoppingBag
            className="text-gray-400 dark:text-gray-500"
            style={{ width: "3em", height: "3em" }}
          />
          <div className="text-center">
            <p
              className="line-clamp-2 font-medium text-gray-700 dark:text-gray-300"
              style={{ fontSize: "0.875em" }}
            >
              {itemName}
            </p>
            {item.productDetails?.price && (
              <p
                className="font-medium text-gray-600 dark:text-gray-400"
                style={{ fontSize: "0.75em", marginTop: "0.25em" }}
              >
                {item.productDetails.currency
                  ? `${getCurrencySymbol(item.productDetails.currency)}${item.productDetails.price}`
                  : item.productDetails.price}
              </p>
            )}
            {item.productDetails?.domain && (
              <p
                className="text-gray-500 dark:text-gray-400"
                style={{ fontSize: "0.75em", marginTop: "0.25em" }}
              >
                {item.productDetails.domain}
              </p>
            )}
          </div>
        </button>

        <ItemDetailDialogWrapper
          show={showDetailDialog}
          item={item}
          size={size}
          previewUrl={null}
          imageFileKey={imageFileKey}
          onOpenChange={setShowDetailDialog}
          name={itemName}
          onNameChange={setItemName}
          deleteOpen={showDeleteDialog}
          onDeleteOpenChange={setShowDeleteDialog}
          onDeleteConfirm={handleDelete}
          isDeleting={isDeleting}
          canEdit={canEdit}
        />
      </>
    );
  }

  // Books without cover images get a placeholder card
  if (isBook && !previewUrl && !imageFileKey) {
    const bookAuthors = item.bookDetails?.authors ?? [];
    const authorLine = bookAuthors.length > 0 ? bookAuthors.join(", ") : null;
    return (
      <>
        <button
          type="button"
          className="group relative flex h-full w-full cursor-pointer flex-col items-center justify-center border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 transition-colors hover:border-gray-300 dark:border-gray-800 dark:from-gray-900 dark:to-gray-800 dark:hover:border-gray-700"
          style={{ ...gridCardStyle, padding: "1em", gap: "0.75em" }}
          onClick={handleOpenDetail}
        >
          <ProcessingOverlay status={item.processingStatus} />
          <BookOpen
            className="text-gray-400 dark:text-gray-500"
            style={{ width: "3em", height: "3em" }}
          />
          <div className="text-center">
            <p
              className="line-clamp-2 font-medium text-gray-700 dark:text-gray-300"
              style={{ fontSize: "0.875em" }}
            >
              {itemName}
            </p>
            {authorLine && (
              <p
                className="line-clamp-1 text-gray-500 dark:text-gray-400"
                style={{ fontSize: "0.75em", marginTop: "0.25em" }}
              >
                {authorLine}
              </p>
            )}
            {item.bookDetails?.domain && (
              <p
                className="text-gray-500 dark:text-gray-400"
                style={{ fontSize: "0.75em", marginTop: "0.25em" }}
              >
                {item.bookDetails.domain}
              </p>
            )}
          </div>
        </button>

        <ItemDetailDialogWrapper
          show={showDetailDialog}
          item={item}
          size={size}
          previewUrl={null}
          imageFileKey={imageFileKey}
          onOpenChange={setShowDetailDialog}
          name={itemName}
          onNameChange={setItemName}
          deleteOpen={showDeleteDialog}
          onDeleteOpenChange={setShowDeleteDialog}
          onDeleteConfirm={handleDelete}
          isDeleting={isDeleting}
          canEdit={canEdit}
        />
      </>
    );
  }

  // Articles/webpages without cover images render their reader content as a
  // note-style text card (rather than a hollow icon placeholder)
  if (isArticleOrWebpage && !previewUrl && !imageFileKey) {
    let placeholderDomain = item.articleDetails?.domain;
    if (!placeholderDomain && item.sourceUrl) {
      try {
        placeholderDomain = new URL(item.sourceUrl).hostname;
      } catch {}
    }
    return (
      <>
        <div className="relative h-full w-full">
          <ProcessingOverlay status={item.processingStatus} />
          <ArticleCard
            title={itemName}
            content={item.articleDetails?.content ?? null}
            domain={placeholderDomain ?? null}
            readingTime={item.articleDetails?.readingTime ?? null}
            onClick={handleOpenDetail}
          />
        </div>

        <ItemDetailDialogWrapper
          show={showDetailDialog}
          item={item}
          size={size}
          previewUrl={null}
          imageFileKey={imageFileKey}
          onOpenChange={setShowDetailDialog}
          name={itemName}
          onNameChange={setItemName}
          deleteOpen={showDeleteDialog}
          onDeleteOpenChange={setShowDeleteDialog}
          onDeleteConfirm={handleDelete}
          isDeleting={isDeleting}
          canEdit={canEdit}
        />
      </>
    );
  }

  // URL items that are still processing show a special placeholder
  if (isProcessingUrl && !previewUrl) {
    const domain = item.sourceUrl ? new URL(item.sourceUrl).hostname : null;
    return (
      <>
        <button
          type="button"
          className="group relative flex h-full w-full cursor-pointer flex-col items-center justify-center border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 transition-colors hover:border-gray-300 dark:border-gray-800 dark:from-gray-900 dark:to-gray-800 dark:hover:border-gray-700"
          style={{ ...gridCardStyle, padding: "1em", gap: "0.75em" }}
          onClick={handleOpenDetail}
        >
          <ProcessingOverlay status={item.processingStatus} />
          <ExternalLink
            className="text-gray-400 dark:text-gray-500"
            style={{ width: "3em", height: "3em" }}
          />
          <div className="text-center">
            <p
              className="line-clamp-2 font-medium text-gray-700 dark:text-gray-300"
              style={{ fontSize: "0.875em" }}
            >
              {itemName}
            </p>
            {domain && (
              <p
                className="text-gray-500 dark:text-gray-400"
                style={{ fontSize: "0.75em", marginTop: "0.25em" }}
              >
                {domain}
              </p>
            )}
          </div>
        </button>

        <ItemDetailDialogWrapper
          show={showDetailDialog}
          item={item}
          size={size}
          previewUrl={null}
          imageFileKey={imageFileKey}
          onOpenChange={setShowDetailDialog}
          name={itemName}
          onNameChange={setItemName}
          deleteOpen={showDeleteDialog}
          onDeleteOpenChange={setShowDeleteDialog}
          onDeleteConfirm={handleDelete}
          isDeleting={isDeleting}
          canEdit={canEdit}
        />
      </>
    );
  }

  // Failed URL items (processing failed before classification) show a failure placeholder
  if (isFailedUrl && !previewUrl) {
    let domain: string | null = null;
    try {
      domain = item.sourceUrl ? new URL(item.sourceUrl).hostname : null;
    } catch {
      // Malformed URL, leave domain as null
    }
    return (
      <>
        <button
          type="button"
          className="group relative flex h-full w-full cursor-pointer flex-col items-center justify-center border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 transition-colors hover:border-gray-300 dark:border-gray-800 dark:from-gray-900 dark:to-gray-800 dark:hover:border-gray-700"
          style={{ ...gridCardStyle, padding: "1em", gap: "0.75em" }}
          onClick={handleOpenDetail}
        >
          <ProcessingOverlay status={item.processingStatus} />
          <ExternalLink
            className="text-gray-400 dark:text-gray-500"
            style={{ width: "3em", height: "3em" }}
          />
          <div className="text-center">
            <p
              className="line-clamp-2 font-medium text-gray-700 dark:text-gray-300"
              style={{ fontSize: "0.875em" }}
            >
              {itemName}
            </p>
            {domain && (
              <p
                className="text-gray-500 dark:text-gray-400"
                style={{ fontSize: "0.75em", marginTop: "0.25em" }}
              >
                {domain}
              </p>
            )}
          </div>
        </button>

        <ItemDetailDialogWrapper
          show={showDetailDialog}
          item={item}
          size={size}
          previewUrl={null}
          imageFileKey={imageFileKey}
          onOpenChange={setShowDetailDialog}
          name={itemName}
          onNameChange={setItemName}
          deleteOpen={showDeleteDialog}
          onDeleteOpenChange={setShowDeleteDialog}
          onDeleteConfirm={handleDelete}
          isDeleting={isDeleting}
          canEdit={canEdit}
        />
      </>
    );
  }

  // Note items render their text content directly (no cover image)
  if (isNote) {
    return (
      <>
        <div className="relative h-full w-full">
          <ProcessingOverlay status={item.processingStatus} />
          <NoteCard
            title={item.title}
            content={item.noteDetails?.content ?? ""}
            onClick={handleOpenDetail}
          />
        </div>

        <ItemDetailDialogWrapper
          show={showDetailDialog}
          item={item}
          size={size}
          previewUrl={null}
          imageFileKey={null}
          onOpenChange={setShowDetailDialog}
          name={itemName}
          onNameChange={setItemName}
          deleteOpen={showDeleteDialog}
          onDeleteOpenChange={setShowDeleteDialog}
          onDeleteConfirm={handleDelete}
          isDeleting={isDeleting}
          canEdit={canEdit}
        />
      </>
    );
  }

  // Twitter items get the custom TwitterCard
  if (isTwitter && item.twitterDetails) {
    return (
      <>
        <div className="relative h-full w-full">
          <ProcessingOverlay status={item.processingStatus} />
          <TwitterCard
            twitterDetails={item.twitterDetails}
            blurDataUrl={blurDataUrl}
            onClick={handleOpenDetail}
          />
        </div>

        <ItemDetailDialogWrapper
          show={showDetailDialog}
          item={item}
          size={size}
          previewUrl={null}
          imageFileKey={null}
          onOpenChange={setShowDetailDialog}
          name={itemName}
          onNameChange={setItemName}
          deleteOpen={showDeleteDialog}
          onDeleteOpenChange={setShowDeleteDialog}
          onDeleteConfirm={handleDelete}
          isDeleting={isDeleting}
          canEdit={canEdit}
        />
      </>
    );
  }

  // Video items get the custom VideoCard
  if (isVideo && item.videoDetails) {
    return (
      <>
        <div className="relative h-full w-full">
          <ProcessingOverlay status={item.processingStatus} />
          <VideoCard
            videoDetails={item.videoDetails}
            coverFileKey={item.coverFileKey}
            title={item.title}
            onClick={handleOpenDetail}
          />
        </div>

        <ItemDetailDialogWrapper
          show={showDetailDialog}
          item={item}
          size={size}
          previewUrl={null}
          imageFileKey={null}
          onOpenChange={setShowDetailDialog}
          name={itemName}
          onNameChange={setItemName}
          deleteOpen={showDeleteDialog}
          onDeleteOpenChange={setShowDeleteDialog}
          onDeleteConfirm={handleDelete}
          isDeleting={isDeleting}
          canEdit={canEdit}
        />
      </>
    );
  }

  // Books with a cover get the 3D book treatment on a neutral surface
  if (isBook && previewUrl) {
    return (
      <>
        <button
          type="button"
          className="group relative flex h-full w-full cursor-pointer items-center justify-center overflow-hidden bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-950"
          // % padding resolves against width on all sides, so these fractions
          // are of tile width; getBookTileFrame bakes them into the tile ratio
          style={{
            ...gridCardStyle,
            padding: `${BOOK_TILE_PADDING_Y * 100}% ${BOOK_TILE_PADDING_X * 100}%`,
          }}
          onClick={handleOpenDetail}
        >
          <ProcessingOverlay status={item.processingStatus} />
          <BookCover3D
            src={previewUrl}
            alt={itemName}
            layoutId={`item-image-${item.id}`}
            coverColor={getDominantCoverColor(item.colors)}
            blurDataUrl={blurDataUrl}
          />
        </button>

        <ItemDetailDialogWrapper
          show={showDetailDialog}
          item={item}
          size={size}
          previewUrl={previewUrl}
          imageFileKey={imageFileKey}
          onOpenChange={setShowDetailDialog}
          name={itemName}
          onNameChange={setItemName}
          deleteOpen={showDeleteDialog}
          onDeleteOpenChange={setShowDeleteDialog}
          onDeleteConfirm={handleDelete}
          isDeleting={isDeleting}
          canEdit={canEdit}
        />
      </>
    );
  }

  if (!previewUrl) {
    return (
      <div
        className="flex h-full items-center justify-center border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
        style={gridCardStyle}
      >
        <IsLoading
          label="Loading preview"
          className="text-gray-500 text-sm dark:text-gray-400"
        />
      </div>
    );
  }

  if (!hasDisplayableImage) {
    return (
      <div
        className="flex h-full items-center justify-center border border-gray-200 bg-gray-50 px-4 py-6 text-center dark:border-gray-800 dark:bg-gray-900"
        style={gridCardStyle}
      >
        <div className="flex flex-col items-center gap-4">
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary text-sm underline"
          >
            View file: {itemName}
          </a>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
            >
              Delete
            </Button>
          </div>
        </div>
        <DeleteItemDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onConfirm={handleDelete}
          isDeleting={isDeleting}
          itemName={itemName}
        />
      </div>
    );
  }

  // Get the top two dominant colors (by score) for the card background gradient
  const sortedColors = [...item.colors].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0),
  );
  const topColor = sortedColors[0] ?? null;
  const secondColor = sortedColors[1] ?? null;

  // Build background style: gradient if 2+ colors, solid if 1, muted fallback if none
  const backgroundStyle = topColor
    ? secondColor
      ? `linear-gradient(to bottom, ${secondColor.hex}, ${topColor.hex})`
      : topColor.hex
    : undefined;

  return (
    <>
      <div
        className={cn(
          "group relative h-full w-full transition-all duration-300",
          (showDetailDialog || isAnimating) && "z-50",
        )}
        style={gridCardStyle}
      >
        <ProcessingOverlay status={item.processingStatus} />
        <motion.div
          layoutId={`item-image-${item.id}`}
          className={cn(
            "!opacity-100 relative h-full w-full cursor-pointer overflow-hidden",
            !topColor && "bg-muted",
          )}
          style={{
            ...gridCardStyle,
            background: backgroundStyle,
          }}
          onClick={handleOpenDetail}
          transition={{
            layout: { duration: 0.3 },
          }}
          onLayoutAnimationComplete={() => {
            // Reset isAnimating when the image finishes flying back to grid
            if (!showDetailDialog) {
              setIsAnimating(false);
            }
          }}
        >
          <BlurImage
            src={previewUrl}
            alt={itemName}
            blurDataUrl={blurDataUrl}
            className="h-full w-full object-cover"
          />
          {isProduct && item.productDetails?.price && (
            <div className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-1 font-medium text-white text-xs backdrop-blur-sm">
              {item.productDetails.currency
                ? `${getCurrencySymbol(item.productDetails.currency)}${item.productDetails.price}`
                : item.productDetails.price}
            </div>
          )}
        </motion.div>
      </div>

      <ItemDetailDialogWrapper
        show={showDetailDialog}
        item={item}
        size={size}
        previewUrl={previewUrl}
        imageFileKey={imageFileKey}
        onOpenChange={setShowDetailDialog}
        name={itemName}
        onNameChange={setItemName}
        deleteOpen={showDeleteDialog}
        onDeleteOpenChange={setShowDeleteDialog}
        onDeleteConfirm={handleDelete}
        isDeleting={isDeleting}
        canEdit={canEdit}
      />
    </>
  );
}

type ItemDetailDialogProps = {
  item: Item;
  size: string;
  previewUrl: string | null;
  /** The file key for the image (used for progressive loading) */
  imageFileKey: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (value: string) => void;
  onDeleteOpenChange: (open: boolean) => void;
  deleteOpen: boolean;
  onDeleteConfirm: () => Promise<void>;
  isDeleting: boolean;
  /**
   * Whether the current user can edit this item.
   * When false, notes, privacy settings, delete button, and location editing are hidden.
   */
  canEdit: boolean;
};

type RemoveFromRoomButtonProps = {
  itemId: string;
  room: ItemRoom;
  onRemoved: () => void;
};

function RemoveFromRoomButton({
  itemId,
  room,
  onRemoved,
}: RemoveFromRoomButtonProps) {
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRemoving(true);

    try {
      await api.delete(`/api/v1/rooms/${room.id}/items`, {
        body: JSON.stringify({ itemId }),
      });
      onRemoved();
      toast.success(`Removed from ${room.name}`);
    } catch {
      toast.error("Failed to remove from room");
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleRemove}
      disabled={isRemoving}
      className={cn(
        "ml-auto p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100",
        isRemoving ? "hover:text-destructive" : "cursor-pointer",
      )}
      aria-label={`Remove from ${room.name}`}
    >
      {isRemoving ? (
        <Loader2 className="size-3.5" />
      ) : (
        <X className="size-3.5" />
      )}
    </button>
  );
}

type DeleteItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
  itemName: string;
};

/**
 * Wrapper component for the detail dialog with AnimatePresence.
 * Reduces duplication across different item card types.
 */
function ItemDetailDialogWrapper({
  show,
  item,
  size,
  previewUrl,
  imageFileKey,
  onOpenChange,
  name,
  onNameChange,
  deleteOpen,
  onDeleteOpenChange,
  onDeleteConfirm,
  isDeleting,
  canEdit,
  onExitComplete,
}: {
  show: boolean;
  item: Item;
  size: string;
  previewUrl: string | null;
  imageFileKey: string | null;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (value: string) => void;
  deleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
  onDeleteConfirm: () => Promise<void>;
  isDeleting: boolean;
  canEdit: boolean;
  onExitComplete?: () => void;
}) {
  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {show && (
        <ItemDetailDialog
          item={item}
          size={size}
          previewUrl={previewUrl}
          imageFileKey={imageFileKey}
          open={show}
          onOpenChange={onOpenChange}
          name={name}
          onNameChange={onNameChange}
          deleteOpen={deleteOpen}
          onDeleteOpenChange={onDeleteOpenChange}
          onDeleteConfirm={onDeleteConfirm}
          isDeleting={isDeleting}
          canEdit={canEdit}
        />
      )}
    </AnimatePresence>
  );
}

function DeleteItemDialog({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
  itemName,
}: DeleteItemDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete item</AlertDialogTitle>
          <AlertDialogDescription>
            {`Are you sure you want to delete "${decodeHtmlEntities(itemName)}"? This action cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" disabled={isDeleting}>
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? <IsLoading label="Deleting" /> : "Delete item"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ItemDetailDialog({
  item,
  size,
  previewUrl,
  imageFileKey,
  open,
  onOpenChange,
  name,
  onNameChange,
  deleteOpen,
  onDeleteOpenChange,
  onDeleteConfirm,
  isDeleting,
  canEdit,
}: ItemDetailDialogProps) {
  const invalidateItems = useInvalidateItems();
  const { setState: setSearchState } = useSearch();
  const [isSavingName, setIsSavingName] = useState(false);
  const [fullQualityUrl, setFullQualityUrl] = useState<string | null>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isDescriptionClamped, setIsDescriptionClamped] = useState(false);
  const [excludeFromPublicRooms, setExcludeFromPublicRooms] = useState(
    item.excludeFromPublicRooms ?? false,
  );
  const [isSavingExclude, setIsSavingExclude] = useState(false);
  const [isShared, setIsShared] = useState(item.sharedAt != null);
  const [sharedHighlights, setSharedHighlights] = useState(
    item.sharedHighlights ?? false,
  );
  const [isSavingShare, setIsSavingShare] = useState(false);
  const [isSavingSharedHighlights, setIsSavingSharedHighlights] =
    useState(false);
  const [hasCopiedShareLink, setHasCopiedShareLink] = useState(false);
  const [scrollToHighlightId, setScrollToHighlightId] = useState<string | null>(
    null,
  );
  const [hasCopiedUrl, setHasCopiedUrl] = useState(false);
  const [hasCopiedId, setHasCopiedId] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const hasTrackedNotesUpdate = useRef(false);
  const [userTags, setUserTags] = useState<string[]>(item.userTags ?? []);
  const [isSavingUserTags, setIsSavingUserTags] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [externalLinks, setExternalLinks] = useState<ExternalLinkType[]>(
    item.externalLinks ?? [],
  );
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [showAddLinkInput, setShowAddLinkInput] = useState(false);
  const [showAddTagInput, setShowAddTagInput] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [itemRooms, setItemRooms] = useState<ItemRoom[]>(item.rooms ?? []);
  const [isRetrying, setIsRetrying] = useState(false);
  const [currentProcessingStatus, setCurrentProcessingStatus] = useState(
    item.processingStatus,
  );
  const [hoveredColorHex, setHoveredColorHex] = useState<string | null>(null);
  const isAdmin = useUserStore((state) => state.isAdmin) ?? false;
  const username = useUserStore((state) => state.username);

  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Swipe-to-dismiss on touch devices
  const isTouchDevice = useMediaQuery("(hover: none) and (pointer: coarse)", {
    defaultValue: false,
    initializeWithValue: false,
  });
  const dragY = useMotionValue(0);
  const dragOpacity = useTransform(dragY, [0, 200], [1, 0.5]);
  const closingOpacity = useMotionValue(1);
  const combinedOpacity = useTransform(
    [dragOpacity, closingOpacity],
    ([drag, closing]) => (drag as number) * (closing as number),
  );

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const shouldDismiss = info.offset.y > 100 || info.velocity.y > 500;
    if (shouldDismiss) {
      onOpenChange(false);
    } else {
      void animate(dragY, 0, { type: "spring", stiffness: 300, damping: 30 });
    }
  };

  const handleDragStart = () => {
    // Check if scrollable content is at top - if not, prevent drag
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer && scrollContainer.scrollTop > 0) {
      return false;
    }
  };

  // Reset drag position when dialog opens, animate opacity when closing
  useEffect(() => {
    if (open) {
      dragY.set(0);
      closingOpacity.set(1);
    } else {
      // Animate dialog fade-out to match the layoutId animation duration
      void animate(closingOpacity, 0, { duration: 0.3, ease: "easeOut" });
    }
  }, [open, dragY, closingOpacity]);

  // Progressive loading: load full quality image when dialog opens
  useEffect(() => {
    if (!open || !imageFileKey) {
      setFullQualityUrl(null);
      setLoadingProgress(0);
      setShowProgress(false);
      return;
    }

    // Start progress animation
    setShowProgress(true);
    setLoadingProgress(0);

    // Animate to 50% quickly
    const progressTimer = setTimeout(() => {
      setLoadingProgress(50);
    }, 100);

    const detailUrl = getProxyImageUrl(imageFileKey, "detail");
    const img = new Image();
    img.onload = () => {
      // Animate to 100% then hide
      setLoadingProgress(100);
      setTimeout(() => {
        setFullQualityUrl(detailUrl);
        setShowProgress(false);
      }, 200);
    };
    img.src = detailUrl;

    return () => {
      img.onload = null;
      clearTimeout(progressTimer);
    };
  }, [open, imageFileKey]);

  // Sync notes state when item.notes changes (e.g., from server refresh)
  useEffect(() => {
    setNotes(item.notes ?? "");
  }, [item.notes]);

  // Sync userTags state when item.userTags changes
  useEffect(() => {
    setUserTags(item.userTags ?? []);
  }, [item.userTags]);

  // Sync externalLinks state when item.externalLinks changes
  useEffect(() => {
    setExternalLinks(item.externalLinks ?? []);
  }, [item.externalLinks]);

  // Sync itemRooms state when item.rooms changes
  useEffect(() => {
    setItemRooms(item.rooms ?? []);
  }, [item.rooms]);

  // Sync processingStatus when item.processingStatus changes (e.g., from polling)
  useEffect(() => {
    setCurrentProcessingStatus(item.processingStatus);
  }, [item.processingStatus]);

  // Reset scrollToHighlightId after animation completes so the same highlight can be clicked again
  useEffect(() => {
    if (!scrollToHighlightId) return;
    const timeout = setTimeout(() => {
      setScrollToHighlightId(null);
    }, 1600); // Slightly longer than animation duration (1500ms)
    return () => clearTimeout(timeout);
  }, [scrollToHighlightId]);
  const meta = item.meta || {};
  const width = (meta.width as number | undefined) ?? 0;
  const height = (meta.height as number | undefined) ?? 0;
  const isArticle = item.kind === "article";
  const isWebpage = item.kind === "webpage";
  const isTwitter = item.kind === "twitter";
  const isVideo = item.kind === "video";
  const isProduct = item.kind === "product";
  const isBook = item.kind === "book";
  const isNote = item.kind === "note";
  const isArticleOrWebpage = isArticle || isWebpage;

  // biome-ignore lint/correctness/useExhaustiveDependencies: Need to recheck clamping when description or expanded state changes
  useEffect(() => {
    const el = descriptionRef.current;
    if (el) {
      setIsDescriptionClamped(el.scrollHeight > el.clientHeight);
    }
  }, [item.description, isDescriptionExpanded]);

  const handleNameSubmit = async (nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === name.trim()) return;
    setIsSavingName(true);
    try {
      // Update item.title directly - it's the single source of truth for display name
      await api.patch(`/api/v1/items/${item.id}`, { title: trimmed });
      onNameChange(trimmed);

      // Track item title update
      posthog.capture("item_title_updated", {
        item_id: item.id,
        item_kind: item.kind,
      });

      toast.success("Name updated");
    } catch (error) {
      log.error({ error }, "Name update error");
      toast.error("Failed to update name");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleExcludeToggle = async () => {
    const newValue = !excludeFromPublicRooms;
    setIsSavingExclude(true);
    try {
      await api.patch(`/api/v1/items/${item.id}`, {
        excludeFromPublicRooms: newValue,
      });
      setExcludeFromPublicRooms(newValue);

      // Track item privacy change
      posthog.capture("item_privacy_updated", {
        item_id: item.id,
        exclude_from_public: newValue,
      });

      toast.success(
        newValue ? "Excluded from public rooms" : "Included in public rooms",
      );
    } catch (error) {
      log.error({ error }, "Exclude toggle error");
      toast.error("Failed to update setting");
    } finally {
      setIsSavingExclude(false);
    }
  };

  const shareUrl = username
    ? `${getAppBaseUrl()}/@${username}/items/${item.id}`
    : null;

  const handleShareToggle = async () => {
    const newValue = !isShared;
    setIsSavingShare(true);
    try {
      await api.patch(`/api/v1/items/${item.id}`, { shared: newValue });
      setIsShared(newValue);
      posthog.capture("item_share_toggled", {
        item_id: item.id,
        shared: newValue,
      });
      toast.success(newValue ? "Sharing enabled" : "Sharing stopped");
    } catch (error) {
      log.error({ error }, "Share toggle error");
      toast.error("Failed to update sharing");
    } finally {
      setIsSavingShare(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    setIsSavingShare(true);
    try {
      // Copying a link makes the item shareable if it wasn't already.
      if (!isShared) {
        await api.patch(`/api/v1/items/${item.id}`, { shared: true });
        setIsShared(true);
        posthog.capture("item_share_toggled", {
          item_id: item.id,
          shared: true,
        });
      }
      const copied = await copyToClipboard(shareUrl);
      if (copied) {
        setHasCopiedShareLink(true);
        toast.success("Link copied — anyone with the link can view this");
        setTimeout(() => setHasCopiedShareLink(false), 2000);
      } else {
        toast.error("Failed to copy link");
      }
    } catch (error) {
      log.error({ error }, "Copy share link error");
      toast.error("Failed to copy link");
    } finally {
      setIsSavingShare(false);
    }
  };

  const handleCopyId = async () => {
    const copied = await copyToClipboard(item.id);
    if (copied) {
      setHasCopiedId(true);
      toast.success("Item ID copied");
      setTimeout(() => setHasCopiedId(false), 2000);
    } else {
      toast.error("Failed to copy ID");
    }
  };

  const handleSharedHighlightsToggle = async () => {
    const newValue = !sharedHighlights;
    setIsSavingSharedHighlights(true);
    try {
      await api.patch(`/api/v1/items/${item.id}`, {
        sharedHighlights: newValue,
      });
      setSharedHighlights(newValue);
      toast.success(
        newValue
          ? "Highlights included in shared view"
          : "Highlights hidden from shared view",
      );
    } catch (error) {
      log.error({ error }, "Shared highlights toggle error");
      toast.error("Failed to update setting");
    } finally {
      setIsSavingSharedHighlights(false);
    }
  };

  const saveNotes = useDebouncedCallback(async (value: string) => {
    setIsSavingNotes(true);
    try {
      await api.patch(`/api/v1/items/${item.id}`, { notes: value });

      // Track notes update (once per mount)
      if (!hasTrackedNotesUpdate.current) {
        hasTrackedNotesUpdate.current = true;
        posthog.capture("item_notes_updated", {
          item_id: item.id,
        });
      }
    } catch (error) {
      log.error({ error }, "Notes save error");
      toast.error("Failed to save notes");
    } finally {
      setIsSavingNotes(false);
    }
  }, 500);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    saveNotes(value);
  };

  const saveUserTags = async (
    newTags: string[],
    action: "added" | "removed",
    tag: string,
  ) => {
    setIsSavingUserTags(true);
    try {
      await api.patch(`/api/v1/items/${item.id}`, { userTags: newTags });
      invalidateItems();

      // Mark milestone if user added their first tag
      if (shouldCompleteAddFirstTag(newTags)) {
        useMilestoneStore.getState().markComplete("add_first_tag");
      }

      // Track tag change
      posthog.capture(
        action === "added" ? "item_tag_added" : "item_tag_removed",
        {
          item_id: item.id,
          tag,
          tag_count: newTags.length,
        },
      );
    } catch (error) {
      log.error({ error }, "User tags save error");
      toast.error("Failed to save tags");
      // Revert on error
      setUserTags(item.userTags ?? []);
    } finally {
      setIsSavingUserTags(false);
    }
  };

  const handleAddUserTag = () => {
    const tag = newTagInput.trim();
    if (!tag) return;

    // Validation: max tags
    if (userTags.length >= MAX_USER_TAGS) {
      toast.error(`Maximum of ${MAX_USER_TAGS} tags allowed`);
      return;
    }

    // Validation: max characters
    if (tag.length > MAX_USER_TAG_LENGTH) {
      toast.error(`Tag must be ${MAX_USER_TAG_LENGTH} characters or less`);
      return;
    }

    // Validation: allowed characters — mirrors the server schema (USER_TAG_REGEX)
    // so a pasted tag with tabs/newlines is rejected here instead of 400ing on save
    if (!USER_TAG_REGEX.test(tag)) {
      toast.error(
        "Tag can only contain letters, numbers, spaces, hyphens, and underscores",
      );
      return;
    }

    // Don't add duplicates (case-insensitive)
    if (userTags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      toast.error("Tag already exists");
      setNewTagInput("");
      return;
    }
    const newTags = [...userTags, tag];
    setUserTags(newTags);
    setNewTagInput("");
    setShowAddTagInput(false);
    void saveUserTags(newTags, "added", tag);
  };

  const handleRemoveUserTag = (tagToRemove: string) => {
    const lowerTagToRemove = tagToRemove.toLowerCase();
    const newTags = userTags.filter(
      (t) => t.toLowerCase() !== lowerTagToRemove,
    );
    setUserTags(newTags);
    void saveUserTags(newTags, "removed", tagToRemove);
  };

  const handleDownload = async () => {
    if (!item.fileKey) {
      toast.error("No file available to download");
      return;
    }

    setIsDownloading(true);
    try {
      const { data, error: downloadError } = await supabase.storage
        .from("items")
        .download(item.fileKey);

      if (downloadError || !data) {
        toast.error(downloadError?.message || "Failed to download file");
        return;
      }

      // Create a download link and trigger it
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = name || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Track item download event
      posthog.capture("item_downloaded", {
        item_id: item.id,
        item_kind: item.kind,
      });

      toast.success("Download started");
    } catch (error) {
      log.error({ error }, "Download error");
      posthog.captureException(error);
      toast.error("Failed to download file");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleAddLink = async () => {
    const url = newLinkUrl.trim();
    if (!url) return;

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    setIsAddingLink(true);
    try {
      const response = await api.post(`/api/v1/items/${item.id}/links`, {
        url,
      });
      const data = response as { externalLinks: ExternalLinkType[] };
      setExternalLinks(data.externalLinks);
      setNewLinkUrl("");
      setShowAddLinkInput(false);

      // Track external link added event
      posthog.capture("external_link_added", {
        item_id: item.id,
        link_domain: new URL(url).hostname,
      });

      toast.success("Link added");
    } catch (error) {
      log.error({ error }, "Add link error");
      posthog.captureException(error);
      toast.error("Failed to add link");
    } finally {
      setIsAddingLink(false);
    }
  };

  const handleRemoveLink = async (url: string) => {
    try {
      const response = await api.delete(`/api/v1/items/${item.id}/links`, {
        body: JSON.stringify({ url }),
      });
      const data = response as { externalLinks: ExternalLinkType[] };
      setExternalLinks(data.externalLinks);
      toast.success("Link removed");
    } catch (error) {
      log.error({ error }, "Remove link error");
      toast.error("Failed to remove link");
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const response = await api.post<{ processingStatus: ProcessingStatus }>(
        `/api/v1/items/${item.id}/retry`,
      );
      setCurrentProcessingStatus(response.processingStatus);
      invalidateItems();

      // Track retry event
      posthog.capture("item_retry", {
        item_id: item.id,
        item_kind: item.kind,
        source_type: item.sourceType,
      });

      toast.success("Retrying analysis...");
    } catch (error) {
      log.error({ error }, "Retry error");
      posthog.captureException(error);
      toast.error("Failed to retry analysis");
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!h-[calc(100vh-1rem)] !max-h-[calc(100vh-1rem)] !w-[calc(100vw-1rem)] !max-w-[calc(100vw-1rem)] md:!h-[calc(100vh-2rem)] md:!max-h-[calc(100vh-2rem)] md:!w-[calc(100vw-2rem)] md:!max-w-[calc(100vw-2rem)] !opacity-100 !bg-transparent !border-0 !shadow-none !scale-100 p-0 data-[state=closed]:scale-100 data-[state=open]:scale-100 data-[state=closed]:animate-none data-[state=open]:animate-none [&>button]:hidden"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
        }}
      >
        <motion.div
          className="h-full w-full overflow-hidden rounded-lg border shadow-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={{ duration: 0.2 }}
          drag={isTouchDevice ? "y" : false}
          dragConstraints={{ top: 0 }}
          dragElastic={{ top: 0 }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          style={{
            y: dragY,
            opacity: combinedOpacity,
            willChange: "opacity, transform",
          }}
        >
          <div
            ref={scrollContainerRef}
            className="relative flex h-full flex-col overflow-y-auto md:flex-row md:overflow-hidden"
          >
            {/* Drag handle indicator on mobile */}
            {isTouchDevice && (
              <div className="absolute top-0 right-0 left-0 z-10 flex justify-center pt-2">
                <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
              </div>
            )}
            {/* Top (mobile) / Left (desktop) - Main content area */}
            <div
              className={cn(
                "flex shrink-0 items-center justify-center md:flex-1 md:overflow-hidden",
                !isArticleOrWebpage &&
                  !isProduct &&
                  !isBook &&
                  !isNote &&
                  "bg-gray-900",
              )}
            >
              {isNote ? (
                <motion.div
                  className="flex h-full w-full bg-background"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <NoteDetailView
                    itemId={item.id}
                    content={item.noteDetails?.content ?? ""}
                    canEdit={canEdit}
                  />
                </motion.div>
              ) : isArticle && item.articleDetails?.content ? (
                // Article content as main view - delayed fade-in after cover image transition
                <motion.div
                  className="flex h-full w-full bg-background"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                >
                  <ArticleDetailView
                    itemId={item.id}
                    content={item.articleDetails.content}
                    originalName={meta.originalName as string | undefined}
                    scrollToHighlightId={scrollToHighlightId}
                  />
                </motion.div>
              ) : isTwitter && item.twitterDetails ? (
                <motion.div
                  className="flex h-full w-full overflow-y-auto bg-background"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <TwitterDetailView
                    twitterDetails={item.twitterDetails}
                    sourceUrl={item.sourceUrl}
                    className="py-8"
                    onCoverImageChange={
                      canEdit
                        ? async (index) => {
                            try {
                              await api.patch(`/api/v1/items/${item.id}`, {
                                twitterCoverMediaIndex: index,
                              });
                              invalidateItems();
                            } catch {
                              toast.error("Failed to set cover image");
                            }
                          }
                        : undefined
                    }
                  />
                </motion.div>
              ) : isProduct && item.productDetails ? (
                <motion.div
                  className="flex h-full w-full overflow-y-auto bg-background"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <ProductDetailView
                    productDetails={item.productDetails}
                    title={item.title}
                    sourceUrl={item.sourceUrl}
                    coverFileKey={item.coverFileKey}
                    className="py-8"
                    onCoverImageChange={
                      canEdit
                        ? async (index) => {
                            try {
                              await api.patch(`/api/v1/items/${item.id}`, {
                                productCoverImageIndex: index,
                              });
                              invalidateItems();
                            } catch {
                              toast.error("Failed to set cover image");
                            }
                          }
                        : undefined
                    }
                  />
                </motion.div>
              ) : isBook && item.bookDetails ? (
                <div className="flex h-full w-full overflow-y-auto bg-background">
                  <BookDetailView
                    itemId={item.id}
                    bookDetails={item.bookDetails}
                    title={item.title}
                    sourceUrl={item.sourceUrl}
                    coverFileKey={item.coverFileKey}
                    coverRatio={getBookCoverRatio(item.meta)}
                    coverColor={getDominantCoverColor(item.colors)}
                    className="py-8"
                  />
                </div>
              ) : isVideo && item.videoDetails ? (
                <motion.div
                  className="flex h-full w-full overflow-y-auto bg-background"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <VideoDetailView
                    videoDetails={item.videoDetails}
                    coverFileKey={item.coverFileKey}
                    title={item.title}
                    sourceUrl={item.sourceUrl}
                    className="py-8"
                  />
                </motion.div>
              ) : isWebpage && previewUrl ? (
                <motion.div
                  className="flex h-full w-full items-center justify-center bg-background"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* biome-ignore lint/performance/noImgElement: using proxy URL for user-uploaded content */}
                  <img
                    src={fullQualityUrl || previewUrl}
                    alt={name}
                    className="max-h-[calc(100vh-2rem)] w-full object-contain"
                  />
                </motion.div>
              ) : previewUrl && !isArticleOrWebpage && !isProduct && !isBook ? (
                <motion.div
                  layoutId={`item-image-${item.id}`}
                  className="relative"
                  transition={{
                    layout: { duration: 0.3 },
                    opacity: { duration: 0 },
                  }}
                  initial={false}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 1 }}
                >
                  {/* Loading progress bar */}
                  {showProgress && (
                    <Progress
                      value={loadingProgress}
                      className="absolute top-0 right-0 left-0 z-10 h-0.5 rounded-none bg-transparent"
                    />
                  )}
                  {/* biome-ignore lint/performance/noImgElement: using proxy URL for user-uploaded content */}
                  <img
                    src={fullQualityUrl || previewUrl}
                    alt={name}
                    className="max-h-[calc(100vh-2rem)] w-full object-contain md:h-full"
                  />
                  {/* Color highlight overlay */}
                  {currentProcessingStatus === "completed" &&
                    item.colors.length > 0 && (
                      <ColorHighlightOverlay
                        imageUrl={fullQualityUrl || previewUrl}
                        hoveredColorHex={hoveredColorHex}
                      />
                    )}
                  {/* Color bar overlay at bottom of image */}
                  {currentProcessingStatus === "completed" &&
                    item.colors.length > 0 && (
                      <div className="absolute right-0 bottom-0 left-0">
                        <ColorsBar
                          colors={item.colors}
                          visible={!!fullQualityUrl}
                          onColorHover={setHoveredColorHex}
                          onColorHoverEnd={() => setHoveredColorHex(null)}
                          onColorSearch={(hex) => {
                            setSearchState({
                              query: "",
                              filters: [
                                {
                                  id: createFilterId(),
                                  type: "color",
                                  value: hex,
                                  negated: false,
                                },
                              ],
                            });
                            onOpenChange(false);
                          }}
                        />
                      </div>
                    )}
                </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
                  <FileText className="size-24 text-gray-600" />
                  <p className="font-medium text-gray-400 text-lg">
                    {isArticle
                      ? "No article content"
                      : isProduct
                        ? "No product images"
                        : "No preview available"}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom (mobile) / Right (desktop) - Details */}
            <div className="flex flex-col border-border border-t bg-background md:w-[400px] md:overflow-hidden md:border-t-0 md:border-l">
              <DialogHeader className="items-start p-6 pb-4">
                <DialogTitle className="sr-only">
                  Item details for {name}
                </DialogTitle>
                <EditableTitle
                  value={name}
                  onSubmit={handleNameSubmit}
                  size="xl"
                  isSaving={isSavingName}
                  multiline
                  disabled={!canEdit}
                />
              </DialogHeader>

              <div className="flex flex-1 flex-col gap-8 px-6 pb-6 md:overflow-y-auto">
                <div className="flex-1 space-y-6">
                  {/* Basic Info */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-gray-700 text-sm dark:text-gray-300">
                        Details
                      </h3>
                      {isAdmin && (
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/admin/items/${item.id}`}
                            target="_blank"
                            title="Open in admin item inspector"
                            className="inline-flex items-center gap-1 rounded text-muted-foreground text-xs hover:text-foreground"
                          >
                            <ScanSearch className="size-3" />
                            Inspect
                          </Link>
                          <button
                            type="button"
                            onClick={handleCopyId}
                            title={`Copy item ID: ${item.id}`}
                            className="inline-flex items-center gap-1 rounded font-mono text-muted-foreground text-xs hover:text-foreground"
                          >
                            {hasCopiedId ? (
                              <Check className="size-3" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                            {item.id.split("-")[0]}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Type</span>
                        <ItemTypeField
                          itemId={item.id}
                          kind={item.kind}
                          sourceType={item.sourceType}
                          canEdit={canEdit}
                          onReassigned={(status) => {
                            setCurrentProcessingStatus(status);
                            invalidateItems();
                          }}
                        />
                      </div>
                      {item.sourceType !== "url" && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Size</span>
                          <span className="font-medium">{size}</span>
                        </div>
                      )}
                      {item.sourceType !== "url" && width > 0 && height > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Dimensions</span>
                          <span className="font-medium">
                            {width} × {height}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-500">Status</span>
                        <span className="font-medium capitalize">
                          {currentProcessingStatus}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Saved</span>
                        <DateTime
                          date={item.createdAt}
                          className="font-medium"
                        />
                      </div>
                      {item.captureDate && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Captured</span>
                          <DateTime
                            date={item.captureDate}
                            className="font-medium"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Article Details */}
                  {isArticle && item.articleDetails && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-700 text-sm dark:text-gray-300">
                        Article Info
                      </h3>
                      <div className="space-y-1 text-sm">
                        {item.articleDetails.domain && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Source</span>
                            {item.sourceUrl ? (
                              <a
                                href={new URL(item.sourceUrl).origin}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                              >
                                <ExternalLink className="size-3" />
                                {item.articleDetails.domain}
                              </a>
                            ) : (
                              <span className="font-medium">
                                {item.articleDetails.domain}
                              </span>
                            )}
                          </div>
                        )}
                        {item.articleDetails.author && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Author</span>
                            <span className="font-medium">
                              {item.articleDetails.author}
                            </span>
                          </div>
                        )}
                        {item.articleDetails.publishedAt && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Published</span>
                            <DateTime
                              date={item.articleDetails.publishedAt}
                              className="font-medium"
                            />
                          </div>
                        )}
                        {item.articleDetails.readingTime && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Reading time</span>
                            <span className="font-medium">
                              {item.articleDetails.readingTime} min
                            </span>
                          </div>
                        )}
                      </div>
                      {item.sourceUrl && (
                        <div className="mt-2 flex items-center gap-1">
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="size-3.5" />
                              View original article
                            </a>
                          </Button>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => {
                              if (item.sourceUrl) {
                                navigator.clipboard.writeText(item.sourceUrl);
                                setHasCopiedUrl(true);
                                setTimeout(() => setHasCopiedUrl(false), 2000);
                              }
                            }}
                            aria-label="Copy URL"
                          >
                            {hasCopiedUrl ? (
                              <Check className="size-3.5" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Product Details */}
                  {isProduct && item.productDetails && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-700 text-sm dark:text-gray-300">
                        Product Info
                      </h3>
                      <div className="space-y-1 text-sm">
                        {item.productDetails.price && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Price</span>
                            <span className="font-medium">
                              {item.productDetails.currency
                                ? `${getCurrencySymbol(item.productDetails.currency)}${item.productDetails.price}`
                                : item.productDetails.price}
                            </span>
                          </div>
                        )}
                        {item.productDetails.brand && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Brand</span>
                            <span className="font-medium">
                              {item.productDetails.brand}
                            </span>
                          </div>
                        )}
                        {item.productDetails.domain && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Store</span>
                            {item.sourceUrl ? (
                              <a
                                href={new URL(item.sourceUrl).origin}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                              >
                                <ExternalLink className="size-3" />
                                {item.productDetails.domain}
                              </a>
                            ) : (
                              <span className="font-medium">
                                {item.productDetails.domain}
                              </span>
                            )}
                          </div>
                        )}
                        {item.productDetails.availability && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Availability</span>
                            <span className="font-medium">
                              {item.productDetails.availability}
                            </span>
                          </div>
                        )}
                      </div>
                      {item.sourceUrl && (
                        <div className="mt-2 flex items-center gap-1">
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="size-3.5" />
                              View product
                            </a>
                          </Button>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => {
                              if (item.sourceUrl) {
                                navigator.clipboard.writeText(item.sourceUrl);
                                setHasCopiedUrl(true);
                                setTimeout(() => setHasCopiedUrl(false), 2000);
                              }
                            }}
                            aria-label="Copy URL"
                          >
                            {hasCopiedUrl ? (
                              <Check className="size-3.5" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reading status (editable) */}
                  {isBook && item.bookDetails && canEdit && (
                    <BookReadingControls
                      itemId={item.id}
                      bookDetails={item.bookDetails}
                    />
                  )}

                  {/* Book Details */}
                  {isBook && item.bookDetails && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-700 text-sm dark:text-gray-300">
                        Book Info
                      </h3>
                      <div className="space-y-1 text-sm">
                        {item.bookDetails.authors.length > 0 && (
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">
                              {item.bookDetails.authors.length > 1
                                ? "Authors"
                                : "Author"}
                            </span>
                            <span className="text-right font-medium">
                              {item.bookDetails.authors.join(", ")}
                            </span>
                          </div>
                        )}
                        {item.bookDetails.publisher && (
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Publisher</span>
                            <span className="text-right font-medium">
                              {item.bookDetails.publisher}
                            </span>
                          </div>
                        )}
                        {item.bookDetails.publishedAt && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Published</span>
                            <DateTime
                              date={item.bookDetails.publishedAt}
                              className="font-medium"
                            />
                          </div>
                        )}
                        {item.bookDetails.pageCount && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Pages</span>
                            <span className="font-medium">
                              {item.bookDetails.pageCount}
                            </span>
                          </div>
                        )}
                        {item.bookDetails.isbn && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">ISBN</span>
                            <span className="font-medium">
                              {item.bookDetails.isbn}
                            </span>
                          </div>
                        )}
                        {item.bookDetails.domain && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Source</span>
                            {item.sourceUrl && isValidUrl(item.sourceUrl) ? (
                              <a
                                href={new URL(item.sourceUrl).origin}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                              >
                                <ExternalLink className="size-3" />
                                {item.bookDetails.domain}
                              </a>
                            ) : (
                              <span className="font-medium">
                                {item.bookDetails.domain}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {item.sourceUrl && isValidUrl(item.sourceUrl) && (
                        <div className="mt-2 flex items-center gap-1">
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="size-3.5" />
                              View book
                            </a>
                          </Button>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => {
                              if (item.sourceUrl) {
                                navigator.clipboard.writeText(item.sourceUrl);
                                setHasCopiedUrl(true);
                                setTimeout(() => setHasCopiedUrl(false), 2000);
                              }
                            }}
                            aria-label="Copy URL"
                          >
                            {hasCopiedUrl ? (
                              <Check className="size-3.5" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cover Image (shown in details panel for articles/webpages) */}
                  {isArticleOrWebpage && previewUrl && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-700 text-sm dark:text-gray-300">
                        Cover Image
                      </h3>
                      <motion.div
                        layoutId={`item-image-${item.id}`}
                        className="overflow-hidden rounded-md"
                        transition={{
                          layout: { duration: 0.3 },
                          opacity: { duration: 0 },
                        }}
                        initial={false}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 1 }}
                      >
                        {/* biome-ignore lint/performance/noImgElement: using proxy URL for user-uploaded content */}
                        <img
                          src={fullQualityUrl || previewUrl}
                          alt={name}
                          className="max-h-[300px] w-full object-contain"
                        />
                      </motion.div>
                    </div>
                  )}

                  {/* AI Analysis */}
                  {currentProcessingStatus === "completed" ? (
                    <>
                      {/* Description */}
                      {item.description && (
                        <div className="space-y-2">
                          <h3 className="font-semibold text-gray-700 text-sm dark:text-gray-300">
                            Description
                          </h3>
                          <p
                            ref={descriptionRef}
                            className={cn(
                              "text-gray-600 text-sm dark:text-gray-400",
                              !isDescriptionExpanded && "line-clamp-3",
                            )}
                          >
                            {decodeHtmlEntities(item.description)}
                          </p>
                          {(isDescriptionClamped || isDescriptionExpanded) && (
                            <button
                              type="button"
                              onClick={() =>
                                setIsDescriptionExpanded(!isDescriptionExpanded)
                              }
                              className="font-medium text-primary text-sm hover:underline"
                            >
                              {isDescriptionExpanded
                                ? "Show less"
                                : "Show more"}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Objects */}
                      {item.objects.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="font-semibold text-gray-700 text-sm dark:text-gray-300">
                            Objects
                          </h3>
                          <div className="flex flex-wrap gap-1.5">
                            {item.objects.map((obj) => (
                              <span
                                key={obj}
                                className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 font-medium text-blue-800 text-xs dark:bg-blue-900/30 dark:text-blue-300"
                              >
                                {obj}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tags - User Tags + Auto-generated Tags */}
                      {(userTags.length > 0 ||
                        item.tags.length > 0 ||
                        canEdit) && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-gray-700 text-sm dark:text-gray-300">
                              Tags
                            </h3>
                            {canEdit && !showAddTagInput && (
                              <button
                                type="button"
                                onClick={() => setShowAddTagInput(true)}
                                className="flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
                              >
                                <Plus className="size-3.5" />
                                Add tag
                              </button>
                            )}
                          </div>
                          {(userTags.length > 0 || item.tags.length > 0) && (
                            <div className="flex flex-wrap gap-1.5">
                              {/* User-added tags (primary styling, removable) */}
                              {userTags.map((tag) => (
                                <span
                                  key={`user-${tag}`}
                                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs dark:bg-primary/20"
                                >
                                  {tag}
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveUserTag(tag)}
                                      className="ml-0.5 hover:text-primary/70 focus:outline-none"
                                      aria-label={`Remove tag ${tag}`}
                                    >
                                      <X className="size-3" />
                                    </button>
                                  )}
                                </span>
                              ))}
                              {/* Auto-generated tags (secondary/gray styling, read-only) */}
                              {item.tags.map((tag) => (
                                <span
                                  key={`auto-${tag}`}
                                  className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 font-medium text-gray-700 text-xs dark:bg-gray-800 dark:text-gray-300"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {/* Tag input - only for users who can edit */}
                          {canEdit && showAddTagInput && (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={newTagInput}
                                onChange={(e) => setNewTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddUserTag();
                                  } else if (e.key === "Escape") {
                                    setShowAddTagInput(false);
                                    setNewTagInput("");
                                  }
                                }}
                                placeholder="Add a tag..."
                                className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 lg:text-sm"
                                autoFocus
                                disabled={isSavingUserTags}
                              />
                              <Button
                                size="sm"
                                onClick={handleAddUserTag}
                                disabled={
                                  isSavingUserTags || !newTagInput.trim()
                                }
                              >
                                {isSavingUserTags ? (
                                  <IsLoading
                                    label="Adding"
                                    iconClassName="size-3"
                                  />
                                ) : (
                                  "Add"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setShowAddTagInput(false);
                                  setNewTagInput("");
                                }}
                                disabled={isSavingUserTags}
                              >
                                <X className="size-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* OCR Text */}
                      {item.ocrText && (
                        <div className="space-y-2">
                          <h3 className="font-semibold text-gray-700 text-sm dark:text-gray-300">
                            Detected Text
                          </h3>
                          <div className="max-h-32 overflow-y-auto rounded-md bg-gray-50 p-3 dark:bg-gray-800/50">
                            <p className="whitespace-pre-wrap text-gray-600 text-xs dark:text-gray-400">
                              {item.ocrText}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Location */}
                      {(() => {
                        // Show manual override if exists, otherwise show exif/original location
                        const manualLocation = item.locations.find(
                          (l) => l.source === "manual",
                        );
                        const exifLocation = item.locations.find(
                          (l) => l.source === "exif",
                        );
                        const displayLocation =
                          manualLocation ?? exifLocation ?? null;
                        const isManualOverride = manualLocation !== undefined;

                        // For read-only view (no edit access), only show if there's location data
                        if (!canEdit) {
                          if (!displayLocation) return null;

                          return (
                            <div className="space-y-2">
                              <h3 className="font-semibold text-sm text-zinc-700 dark:text-zinc-300">
                                Location
                              </h3>
                              <LocationDisplay
                                location={displayLocation}
                                itemId={item.id}
                              />
                            </div>
                          );
                        }

                        // Editable view with LocationDropzone
                        return (
                          <LocationDropzone
                            itemId={item.id}
                            displayLocation={displayLocation}
                            originalExifLocation={exifLocation ?? null}
                            isManualOverride={isManualOverride}
                          >
                            {displayLocation ? (
                              <LocationDisplay
                                location={displayLocation}
                                itemId={item.id}
                              />
                            ) : (
                              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                Drop an image here to set location from EXIF
                                data
                              </p>
                            )}
                          </LocationDropzone>
                        );
                      })()}
                    </>
                  ) : currentProcessingStatus === "processing" ? (
                    <div className="rounded-lg border border-gray-200 p-4 text-gray-500 text-sm dark:border-gray-800">
                      <IsLoading
                        label={
                          item.sourceType === "url"
                            ? "Analyzing URL"
                            : "Analyzing image"
                        }
                      />
                    </div>
                  ) : currentProcessingStatus === "failed" ? (
                    (() => {
                      const errorCopy = getProcessingErrorCopy(
                        item.processingError,
                      );
                      return (
                        <div className="space-y-3">
                          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600 text-sm dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="mt-0.5 size-4 shrink-0" />
                              <p>{errorCopy.message}</p>
                            </div>
                          </div>
                          {canEdit && errorCopy.retryable && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleRetry}
                              disabled={isRetrying}
                              className="w-full"
                            >
                              {isRetrying ? (
                                <IsLoading
                                  label="Retrying"
                                  iconClassName="size-3"
                                />
                              ) : (
                                <>
                                  <RefreshCw className="size-3.5" />
                                  Retry analysis
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="rounded-lg border border-gray-200 p-4 text-gray-500 text-sm dark:border-gray-800">
                      <p>No analysis available.</p>
                    </div>
                  )}
                </div>

                {/* Similar images - visual discovery from the owner's library.
                    Renders nothing when there are no matches above threshold. */}
                <SimilarImages
                  itemId={item.id}
                  enabled={open && supportsSimilarImages(item.kind)}
                  onNavigate={() => onOpenChange(false)}
                />

                {/* Rooms - only shown to users who can edit */}
                {canEdit && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-1.5 font-semibold text-gray-700 text-sm dark:text-gray-300">
                        <DoorOpen className="size-4" />
                        Rooms
                        <span className="font-normal text-muted-foreground text-xs">
                          (private)
                        </span>
                      </h3>
                      <AddToRoomPopover
                        itemId={item.id}
                        currentRooms={itemRooms}
                        onRoomsChange={setItemRooms}
                      />
                    </div>
                    {itemRooms.length > 0 ? (
                      <ul className="space-y-1">
                        {itemRooms.map((room) => (
                          <li
                            key={room.id}
                            className="group flex items-center gap-1"
                          >
                            {room.emoji && (
                              <span className="text-sm">{room.emoji}</span>
                            )}
                            {room.username && room.slug ? (
                              <Link
                                href={`/@${room.username}/${room.slug}`}
                                className="text-blue-600 text-sm hover:underline dark:text-blue-400"
                              >
                                {room.name}
                              </Link>
                            ) : (
                              <span className="text-sm">{room.name}</span>
                            )}
                            {room.type === "smart" ? (
                              <Sparkles className="size-3 text-muted-foreground" />
                            ) : (
                              <Hand className="size-3 text-muted-foreground" />
                            )}
                            {room.type === "manual" && (
                              <RemoveFromRoomButton
                                itemId={item.id}
                                room={room}
                                onRemoved={() => {
                                  setItemRooms(
                                    itemRooms.filter((r) => r.id !== room.id),
                                  );
                                }}
                              />
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        This item isn't in any rooms yet.
                      </p>
                    )}
                  </div>
                )}

                {/* External Links - only shown to users who can edit */}
                {canEdit && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-1.5 font-semibold text-gray-700 text-sm dark:text-gray-300">
                        <Link2 className="size-4" />
                        Links
                        <span className="font-normal text-muted-foreground text-xs">
                          (private)
                        </span>
                      </h3>
                      {!showAddLinkInput && (
                        <button
                          type="button"
                          onClick={() => setShowAddLinkInput(true)}
                          className="flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
                        >
                          <Plus className="size-3.5" />
                          Add link
                        </button>
                      )}
                    </div>
                    {externalLinks.length > 0 && (
                      <ul className="space-y-1">
                        {externalLinks.map((link) => (
                          <li
                            key={link.url}
                            className="group flex items-center gap-2"
                          >
                            <PlatformIcon
                              platform={link.platform}
                              className="size-4 shrink-0 text-muted-foreground"
                            />
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 truncate text-blue-600 text-sm hover:underline dark:text-blue-400"
                            >
                              {getPlatformName(link.platform, link.url)}
                            </a>
                            <button
                              type="button"
                              onClick={() => handleRemoveLink(link.url)}
                              className="p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                              aria-label="Remove link"
                            >
                              <X className="size-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {showAddLinkInput && (
                      <div className="flex items-center gap-2">
                        <input
                          type="url"
                          value={newLinkUrl}
                          onChange={(e) => setNewLinkUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void handleAddLink();
                            } else if (e.key === "Escape") {
                              setShowAddLinkInput(false);
                              setNewLinkUrl("");
                            }
                          }}
                          placeholder="Paste URL..."
                          className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 lg:text-sm"
                          autoFocus
                          disabled={isAddingLink}
                        />
                        <Button
                          size="sm"
                          onClick={handleAddLink}
                          disabled={isAddingLink || !newLinkUrl.trim()}
                        >
                          {isAddingLink ? (
                            <IsLoading label="Adding" iconClassName="size-3" />
                          ) : (
                            "Add"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setShowAddLinkInput(false);
                            setNewLinkUrl("");
                          }}
                          disabled={isAddingLink}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes - only shown to users who can edit */}
                {canEdit && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-700 text-sm dark:text-gray-300">
                        Notes
                        <span className="ml-2 font-normal text-muted-foreground text-xs">
                          (private)
                        </span>
                      </h3>
                      {isSavingNotes && (
                        <IsLoading
                          label="Saving"
                          className="text-muted-foreground text-xs"
                          iconClassName="size-3"
                        />
                      )}
                    </div>
                    <textarea
                      value={notes}
                      onChange={(e) => handleNotesChange(e.target.value)}
                      placeholder="Add your notes..."
                      className="min-h-[100px] w-full resize-y rounded-md border border-gray-200 bg-transparent px-3 py-2 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 lg:text-sm dark:border-gray-800"
                    />
                  </div>
                )}

                {/* Highlights - articles only */}
                {isArticle && (
                  <div className="border-gray-200 border-t pt-8 dark:border-gray-800">
                    <HighlightsPanel
                      itemId={item.id}
                      onHighlightClick={(highlight) =>
                        setScrollToHighlightId(highlight.id)
                      }
                      canEdit={canEdit}
                    />
                  </div>
                )}

                {/* Share Setting - only shown to users who can edit */}
                {canEdit && (
                  <div className="space-y-2 border-gray-200 border-t pt-6 dark:border-gray-800">
                    <h3 className="font-semibold text-gray-700 text-sm dark:text-gray-300">
                      Share
                    </h3>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        Share via link
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isShared}
                        onClick={handleShareToggle}
                        disabled={isSavingShare}
                        className={cn(
                          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          isShared
                            ? "bg-green-700"
                            : "bg-gray-200 dark:bg-gray-700",
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform",
                            isShared ? "translate-x-5" : "translate-x-0",
                          )}
                        />
                      </button>
                    </label>
                    <p className="text-muted-foreground text-xs">
                      When enabled, anyone with the link can view this item,
                      even if it isn't in a public room.
                    </p>

                    {isShared && (
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={shareUrl ?? ""}
                            onFocus={(e) => e.currentTarget.select()}
                            className="min-w-0 flex-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-gray-600 text-xs dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleCopyShareLink}
                            disabled={isSavingShare || !shareUrl}
                          >
                            {hasCopiedShareLink ? (
                              <Check className="size-4" />
                            ) : (
                              <Copy className="size-4" />
                            )}
                            <span className="ml-1.5">Copy</span>
                          </Button>
                        </div>

                        {isArticle && (
                          <label className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-gray-600 dark:text-gray-400">
                              Include my highlights
                            </span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={sharedHighlights}
                              onClick={handleSharedHighlightsToggle}
                              disabled={isSavingSharedHighlights}
                              className={cn(
                                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                "disabled:cursor-not-allowed disabled:opacity-50",
                                sharedHighlights
                                  ? "bg-green-700"
                                  : "bg-gray-200 dark:bg-gray-700",
                              )}
                            >
                              <span
                                className={cn(
                                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform",
                                  sharedHighlights
                                    ? "translate-x-5"
                                    : "translate-x-0",
                                )}
                              />
                            </button>
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Privacy Setting - only shown to users who can edit */}
                {canEdit && (
                  <div className="space-y-2 border-gray-200 border-t pt-6 dark:border-gray-800">
                    <h3 className="font-semibold text-gray-700 text-sm dark:text-gray-300">
                      Privacy
                    </h3>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        Exclude from public rooms
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={excludeFromPublicRooms}
                        onClick={handleExcludeToggle}
                        disabled={isSavingExclude}
                        className={cn(
                          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          excludeFromPublicRooms
                            ? "bg-green-700"
                            : "bg-gray-200 dark:bg-gray-700",
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform",
                            excludeFromPublicRooms
                              ? "translate-x-5"
                              : "translate-x-0",
                          )}
                        />
                      </button>
                    </label>
                    <p className="text-muted-foreground text-xs">
                      When enabled, this item won't appear in public dynamic
                      rooms
                    </p>
                  </div>
                )}

                {/* Action buttons - reanalyse is admin-only; download/delete require edit access */}
                {(canEdit || isAdmin) && (
                  <div className="mt-auto flex justify-end gap-2">
                    {isAdmin && (
                      <Button
                        variant="outline"
                        onClick={handleRetry}
                        disabled={isRetrying}
                      >
                        {isRetrying ? (
                          <IsLoading label="Reanalysing" />
                        ) : (
                          <>
                            <RefreshCw className="size-4" />
                            Reanalyse
                          </>
                        )}
                      </Button>
                    )}
                    {canEdit && item.fileKey && (
                      <Button
                        variant="outline"
                        onClick={handleDownload}
                        disabled={isDownloading}
                      >
                        {isDownloading ? (
                          <IsLoading label="Downloading" />
                        ) : (
                          <>
                            <Download className="size-4" />
                            Download
                          </>
                        )}
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        variant="destructive-outline"
                        onClick={() => onDeleteOpenChange(true)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <IsLoading label="Deleting" />
                        ) : (
                          <>
                            <Trash2 className="size-4" />
                            Delete
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 z-10 cursor-pointer rounded-sm bg-background/20 p-1.5 ring-offset-background transition-opacity hover:bg-background/30 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
              <span className="sr-only">Close</span>
            </button>
          </div>
        </motion.div>
      </DialogContent>

      <DeleteItemDialog
        open={deleteOpen}
        onOpenChange={onDeleteOpenChange}
        onConfirm={onDeleteConfirm}
        isDeleting={isDeleting}
        itemName={name}
      />
    </Dialog>
  );
}
