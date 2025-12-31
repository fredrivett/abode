"use client";

import type { ProcessingStatus } from "@prisma/client";
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { HighlightableArticle } from "@/components/article/highlightable-article";
import { HighlightsPanel } from "@/components/article/highlights-panel";
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
import { api } from "@/lib/api-client";
import { decodeHtmlEntities } from "@/lib/html-metadata";
import { createLogger } from "@/lib/logger.client";
import { createClient } from "@/lib/supabase/client";
import type { Item } from "@/lib/types/item";
import { cn } from "@/lib/utils";
import { ColorsBar } from "./_components/colors-bar";
import { LocationDropzone } from "./_components/location-dropzone";
import { LocationMap } from "./_components/location-map";

const log = createLogger("dashboard/item-card");

type ItemCardProps = {
  item: Item;
  name: string;
  size: string;
  mimeType?: string;
  /**
   * Use proxy URL instead of Supabase download.
   * Required for public room pages where users may not be authenticated.
   */
  useProxyUrl?: boolean;
};

function ProcessingOverlay({ status }: { status: ProcessingStatus }) {
  if (status === "completed") return null;

  const isProcessing = status === "processing";
  const isFailed = status === "failed";

  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex items-end justify-start rounded-lg p-2",
        isProcessing &&
          "bg-gradient-to-t from-black/60 via-transparent to-transparent",
        isFailed &&
          "bg-gradient-to-t from-red-900/70 via-transparent to-transparent",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium backdrop-blur-sm",
          isProcessing && "bg-white/20 text-white",
          isFailed && "bg-red-500/30 text-red-100",
        )}
      >
        {isProcessing ? (
          <>
            <Loader2 className="size-3 animate-spin" />
            <span>Analyzing</span>
          </>
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

export function ItemCard({
  item,
  name,
  size,
  mimeType,
  useProxyUrl = false,
}: ItemCardProps) {
  const supabase = createClient();
  const router = useRouter();
  const [itemName, setItemName] = useState(name);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const isArticle = item.kind === "article";
  const isProcessingUrl =
    item.sourceType === "url" && item.processingStatus === "processing";
  // For articles, use coverFileKey; for images, use fileKey
  const imageFileKey = isArticle ? item.coverFileKey : item.fileKey;
  // Has displayable image: either it's an image type OR it's an article with a cover
  const hasDisplayableImage =
    mimeType?.startsWith("image/") || (isArticle && !!item.coverFileKey);

  useEffect(() => {
    // Articles without a cover image don't need to load anything
    // URL items that are still processing don't have a file yet - that's expected
    if (!imageFileKey) {
      setPreviewUrl(null);
      if (!isArticle && !isProcessingUrl) {
        setError("Missing file");
      }
      return;
    }

    let revokedUrl: string | null = null;
    const load = async () => {
      setError(null);
      try {
        if (useProxyUrl) {
          // Use proxy URL for public rooms (no blob URL needed)
          const proxyUrl = `/api/v1/images/${encodeURIComponent(imageFileKey)}`;
          setPreviewUrl(proxyUrl);
        } else {
          // Download from Supabase and create blob URL
          const { data, error: downloadError } = await supabase.storage
            .from("items")
            .download(imageFileKey);

          if (downloadError || !data) {
            setError(downloadError?.message || "Unable to load preview");
            return;
          }

          const objectUrl = URL.createObjectURL(data);
          revokedUrl = objectUrl;
          setPreviewUrl(objectUrl);
        }
      } catch (err) {
        log.error({ error: err }, "Preview load error");
        setError("Unable to load preview");
      }
    };

    void load();

    return () => {
      if (revokedUrl) {
        URL.revokeObjectURL(revokedUrl);
      }
    };
  }, [imageFileKey, isArticle, isProcessingUrl, supabase, useProxyUrl]);

  useEffect(() => {
    setItemName(name);
  }, [name]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete("/api/v1/items", {
        body: JSON.stringify({ id: item.id }),
      });
      toast.success("Item deleted");
      setShowDeleteDialog(false);
      router.refresh();
    } catch (error) {
      log.error({ error }, "Delete error");
      toast.error("Failed to delete item");
      setIsDeleting(false);
    }
  };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  // Articles without cover images get a placeholder card
  if (isArticle && !previewUrl && !imageFileKey) {
    return (
      <>
        <button
          type="button"
          className="group relative flex h-full w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-4 transition-colors hover:border-gray-300 dark:border-gray-800 dark:from-gray-900 dark:to-gray-800 dark:hover:border-gray-700"
          onClick={() => setShowDetailDialog(true)}
        >
          <ProcessingOverlay status={item.processingStatus} />
          <FileText className="size-12 text-gray-400 dark:text-gray-500" />
          <div className="text-center">
            <p className="line-clamp-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              {itemName}
            </p>
            {item.articleDetails?.domain && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {item.articleDetails.domain}
              </p>
            )}
          </div>
        </button>

        <AnimatePresence>
          {showDetailDialog && (
            <ItemDetailDialog
              item={item}
              size={size}
              previewUrl={null}
              open={showDetailDialog}
              onOpenChange={setShowDetailDialog}
              name={itemName}
              onNameChange={setItemName}
              deleteOpen={showDeleteDialog}
              onDeleteOpenChange={setShowDeleteDialog}
              onDeleteConfirm={handleDelete}
              isDeleting={isDeleting}
            />
          )}
        </AnimatePresence>
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
          className="group relative flex h-full w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-4 transition-colors hover:border-gray-300 dark:border-gray-800 dark:from-gray-900 dark:to-gray-800 dark:hover:border-gray-700"
          onClick={() => setShowDetailDialog(true)}
        >
          <ProcessingOverlay status={item.processingStatus} />
          <ExternalLink className="size-12 text-gray-400 dark:text-gray-500" />
          <div className="text-center">
            <p className="line-clamp-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              {itemName}
            </p>
            {domain && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {domain}
              </p>
            )}
          </div>
        </button>

        <AnimatePresence>
          {showDetailDialog && (
            <ItemDetailDialog
              item={item}
              size={size}
              previewUrl={null}
              open={showDetailDialog}
              onOpenChange={setShowDetailDialog}
              name={itemName}
              onNameChange={setItemName}
              deleteOpen={showDeleteDialog}
              onDeleteOpenChange={setShowDeleteDialog}
              onDeleteConfirm={handleDelete}
              isDeleting={isDeleting}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  if (!previewUrl) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading preview...
        </p>
      </div>
    );
  }

  if (!hasDisplayableImage) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary underline"
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

  return (
    <>
      <div
        className={cn(
          "group relative h-full w-full rounded-lg",
          (showDetailDialog || isAnimating) && "z-50",
        )}
      >
        <ProcessingOverlay status={item.processingStatus} />
        <motion.div
          layoutId={`item-image-${item.id}`}
          className="h-full w-full cursor-pointer overflow-hidden rounded-lg !opacity-100"
          onClick={() => {
            setIsAnimating(true);
            setShowDetailDialog(true);
          }}
          transition={{
            layout: { duration: 0.3 },
          }}
        >
          {/* biome-ignore lint/performance/noImgElement: using blob URL for user-uploaded content */}
          <img
            src={previewUrl}
            alt={itemName}
            className="h-full w-full object-cover"
          />
        </motion.div>
      </div>

      <AnimatePresence onExitComplete={() => setIsAnimating(false)}>
        {showDetailDialog && (
          <ItemDetailDialog
            item={item}
            size={size}
            previewUrl={previewUrl}
            open={showDetailDialog}
            onOpenChange={setShowDetailDialog}
            name={itemName}
            onNameChange={setItemName}
            deleteOpen={showDeleteDialog}
            onDeleteOpenChange={setShowDeleteDialog}
            onDeleteConfirm={handleDelete}
            isDeleting={isDeleting}
          />
        )}
      </AnimatePresence>
    </>
  );
}

type ItemDetailDialogProps = {
  item: Item;
  size: string;
  previewUrl: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (value: string) => void;
  onDeleteOpenChange: (open: boolean) => void;
  deleteOpen: boolean;
  onDeleteConfirm: () => Promise<void>;
  isDeleting: boolean;
};

type DeleteItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
  itemName: string;
};

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
  open,
  onOpenChange,
  name,
  onNameChange,
  deleteOpen,
  onDeleteOpenChange,
  onDeleteConfirm,
  isDeleting,
}: ItemDetailDialogProps) {
  const [isSavingName, setIsSavingName] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isDescriptionClamped, setIsDescriptionClamped] = useState(false);
  const [excludeFromPublicRooms, setExcludeFromPublicRooms] = useState(
    item.excludeFromPublicRooms ?? false,
  );
  const [isSavingExclude, setIsSavingExclude] = useState(false);
  const [scrollToHighlightId, setScrollToHighlightId] = useState<string | null>(
    null,
  );
  const [hasCopiedUrl, setHasCopiedUrl] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);

  // Sync notes state when item.notes changes (e.g., from server refresh)
  useEffect(() => {
    setNotes(item.notes ?? "");
  }, [item.notes]);

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

  const saveNotes = useDebouncedCallback(async (value: string) => {
    setIsSavingNotes(true);
    try {
      await api.patch(`/api/v1/items/${item.id}`, { notes: value });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!max-w-[calc(100vw-1rem)] !w-[calc(100vw-1rem)] !h-[calc(100vh-1rem)] !max-h-[calc(100vh-1rem)] md:!h-[calc(100vh-2rem)] md:!w-[calc(100vw-2rem)] md:!max-w-[calc(100vw-2rem)] md:!max-h-[calc(100vh-2rem)] p-0 !opacity-100 !bg-transparent !border-0 !shadow-none [&>button]:hidden !scale-100 data-[state=open]:animate-none data-[state=closed]:animate-none data-[state=open]:scale-100 data-[state=closed]:scale-100"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
        }}
      >
        <motion.div
          className="w-full h-full rounded-lg border shadow-lg overflow-hidden"
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1 }}
          transition={{ duration: 0.2 }}
          style={{ willChange: "opacity" }}
        >
          <div className="flex flex-col md:flex-row h-full relative overflow-y-auto md:overflow-hidden">
            {/* Top (mobile) / Left (desktop) - Main content area */}
            <div
              className={cn(
                "shrink-0 flex items-center justify-center md:flex-1 md:overflow-hidden",
                !isArticle && "bg-gray-900",
              )}
            >
              {isArticle && item.articleDetails?.content ? (
                // Article content as main view - delayed fade-in after cover image transition
                <motion.div
                  className="flex w-full h-full bg-background"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                >
                  {/* Article content */}
                  <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-12">
                    <article className="w-full max-w-prose mx-auto">
                      {/* Use meta.originalName for the article's original title (from HTML) */}
                      {(meta.originalName as string | undefined) && (
                        <h1 className="font-serif text-2xl md:text-3xl lg:text-4xl font-bold mb-6 lg:mb-8 text-foreground">
                          {decodeHtmlEntities(meta.originalName as string)}
                        </h1>
                      )}
                      <HighlightableArticle
                        itemId={item.id}
                        content={item.articleDetails.content}
                        className="prose prose-sm md:prose-base lg:prose-lg prose-neutral dark:prose-invert prose-headings:font-serif prose-p:font-serif prose-li:font-serif max-w-none"
                        scrollToHighlightId={scrollToHighlightId}
                      />
                    </article>
                  </div>
                </motion.div>
              ) : previewUrl && !isArticle ? (
                // Non-article image
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
                  {/* biome-ignore lint/performance/noImgElement: using blob URL for user-uploaded content */}
                  <img
                    src={previewUrl}
                    alt={name}
                    className="max-h-[40vh] md:max-h-[80vh] max-w-full object-contain"
                  />
                </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
                  <FileText className="size-24 text-gray-600" />
                  <p className="text-lg font-medium text-gray-400">
                    {isArticle ? "No article content" : "No preview available"}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom (mobile) / Right (desktop) - Details */}
            <div className="flex flex-col bg-background md:w-[400px] md:overflow-hidden border-t md:border-t-0 md:border-l border-border">
              <DialogHeader className="p-6 pb-4 items-start">
                <DialogTitle className="sr-only">
                  Item details for {name}
                </DialogTitle>
                <EditableTitle
                  value={name}
                  onSubmit={handleNameSubmit}
                  size="xl"
                  isSaving={isSavingName}
                  multiline
                />
              </DialogHeader>

              <div className="flex-1 md:overflow-y-auto px-6 pb-6 flex flex-col gap-8">
                <div className="space-y-6 flex-1">
                  {/* Basic Info */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Details
                    </h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Type</span>
                        <span className="font-medium capitalize">
                          {item.kind ?? "unknown"}
                        </span>
                      </div>
                      {!isArticle && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Size</span>
                          <span className="font-medium">{size}</span>
                        </div>
                      )}
                      {!isArticle && width > 0 && height > 0 && (
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
                          {item.processingStatus}
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
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
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

                  {/* Article Cover Image (shown in details panel for articles) */}
                  {isArticle && previewUrl && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
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
                        {/* biome-ignore lint/performance/noImgElement: using blob URL for user-uploaded content */}
                        <img
                          src={previewUrl}
                          alt={name}
                          className="w-full object-cover"
                        />
                      </motion.div>
                    </div>
                  )}

                  {/* AI Analysis */}
                  {item.processingStatus === "completed" ? (
                    <>
                      {/* Description */}
                      {item.description && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Description
                          </h3>
                          <p
                            ref={descriptionRef}
                            className={cn(
                              "text-sm text-gray-600 dark:text-gray-400",
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
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {isDescriptionExpanded
                                ? "Show less"
                                : "Show more"}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Colors */}
                      {item.colors.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Colors
                          </h3>
                          <ColorsBar colors={item.colors} />
                        </div>
                      )}

                      {/* Objects */}
                      {item.objects.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Objects
                          </h3>
                          <div className="flex flex-wrap gap-1.5">
                            {item.objects.map((obj) => (
                              <span
                                key={obj}
                                className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                              >
                                {obj}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      {item.tags.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Tags
                          </h3>
                          <div className="flex flex-wrap gap-1.5">
                            {item.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* OCR Text */}
                      {item.ocrText && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Detected Text
                          </h3>
                          <div className="max-h-32 overflow-y-auto rounded-md bg-gray-50 p-3 dark:bg-gray-800/50">
                            <p className="whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-400">
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

                        return (
                          <LocationDropzone
                            itemId={item.id}
                            displayLocation={displayLocation}
                            originalExifLocation={exifLocation ?? null}
                            isManualOverride={isManualOverride}
                          >
                            {displayLocation ? (
                              <div className="space-y-2">
                                {(displayLocation.neighborhood ||
                                  displayLocation.city ||
                                  displayLocation.region ||
                                  displayLocation.country) && (
                                  <div className="space-y-1 text-sm">
                                    {displayLocation.neighborhood && (
                                      <div className="flex justify-between">
                                        <span className="text-zinc-500">
                                          Neighborhood
                                        </span>
                                        <span className="font-medium">
                                          {displayLocation.neighborhood}
                                        </span>
                                      </div>
                                    )}
                                    {displayLocation.city && (
                                      <div className="flex justify-between">
                                        <span className="text-zinc-500">
                                          City
                                        </span>
                                        <span className="font-medium">
                                          {displayLocation.city}
                                        </span>
                                      </div>
                                    )}
                                    {displayLocation.region && (
                                      <div className="flex justify-between">
                                        <span className="text-zinc-500">
                                          Region
                                        </span>
                                        <span className="font-medium">
                                          {displayLocation.region}
                                        </span>
                                      </div>
                                    )}
                                    {displayLocation.country && (
                                      <div className="flex justify-between">
                                        <span className="text-zinc-500">
                                          Country
                                        </span>
                                        <span className="font-medium">
                                          {displayLocation.countryCode && (
                                            <span className="mr-1">
                                              {String.fromCodePoint(
                                                ...[
                                                  ...displayLocation.countryCode.toUpperCase(),
                                                ].map(
                                                  (c) =>
                                                    127397 + c.charCodeAt(0),
                                                ),
                                              )}
                                            </span>
                                          )}
                                          {displayLocation.country}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {displayLocation.latitude != null &&
                                  displayLocation.longitude != null && (
                                    <LocationMap
                                      latitude={displayLocation.latitude}
                                      longitude={displayLocation.longitude}
                                      locationName={
                                        displayLocation.city ||
                                        displayLocation.country ||
                                        "Location"
                                      }
                                    />
                                  )}
                              </div>
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
                  ) : item.processingStatus === "processing" ? (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 text-sm text-gray-500">
                      <p>Analyzing image...</p>
                    </div>
                  ) : item.processingStatus === "failed" ? (
                    <div className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-600 dark:text-red-400">
                      <p>Analysis failed. Please try re-uploading the image.</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 text-sm text-gray-500">
                      <p>No analysis available.</p>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Notes
                    </h3>
                    {isSavingNotes && (
                      <span className="text-xs text-muted-foreground">
                        Saving...
                      </span>
                    )}
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    placeholder="Add your notes..."
                    className="w-full min-h-[100px] rounded-md border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                  />
                </div>

                {/* Highlights - articles only */}
                {isArticle && (
                  <div className="pt-8 border-t border-gray-200 dark:border-gray-800">
                    <HighlightsPanel
                      itemId={item.id}
                      onHighlightClick={(highlight) =>
                        setScrollToHighlightId(highlight.id)
                      }
                    />
                  </div>
                )}

                {/* Privacy Setting */}
                <div className="space-y-2 pt-6 border-t border-gray-200 dark:border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
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
                          ? "bg-primary"
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
                  <p className="text-xs text-muted-foreground">
                    When enabled, this item won't appear in public dynamic rooms
                  </p>
                </div>

                <div className="mt-auto flex justify-end">
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
                        Delete item
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 z-10 cursor-pointer rounded-sm p-1.5 bg-background/20 ring-offset-background transition-opacity hover:bg-background/30 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
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
