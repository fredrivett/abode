"use client";

import type { ProcessingStatus } from "@prisma/client";
import {
  AlertCircle,
  Check,
  Copy,
  DoorOpen,
  Download,
  ExternalLink,
  FileText,
  Hand,
  Link2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { HighlightableArticle } from "@/components/article/highlightable-article";
import { HighlightsPanel } from "@/components/article/highlights-panel";
import { PlatformIcon } from "@/components/icons/platform-icons";
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
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api-client";
import { useInvalidateItems } from "@/lib/api-hooks";
import { decodeHtmlEntities } from "@/lib/html-metadata";
import { getProxyImageUrl } from "@/lib/image-url";
import { createLogger } from "@/lib/logger.client";
import { getPlatformName } from "@/lib/platforms";
import { createClient } from "@/lib/supabase/client";
import type { ExternalLink as ExternalLinkType, Item } from "@/lib/types/item";
import { cn } from "@/lib/utils";
import { ColorsBar } from "./_components/colors-bar";
import { LocationDisplay } from "./_components/location-display";
import { LocationDropzone } from "./_components/location-dropzone";

const log = createLogger("dashboard/item-card");

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

    // Use optimized proxy URL for all users (CDN cached, WebP, sized for grid)
    const proxyUrl = getProxyImageUrl(imageFileKey, "grid");
    setError(null);
    setPreviewUrl(proxyUrl);
  }, [imageFileKey, isArticle, isProcessingUrl]);

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
      invalidateItems();
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
              imageFileKey={imageFileKey}
              open={showDetailDialog}
              onOpenChange={setShowDetailDialog}
              name={itemName}
              onNameChange={setItemName}
              deleteOpen={showDeleteDialog}
              onDeleteOpenChange={setShowDeleteDialog}
              onDeleteConfirm={handleDelete}
              isDeleting={isDeleting}
              canEdit={canEdit}
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
              imageFileKey={imageFileKey}
              open={showDetailDialog}
              onOpenChange={setShowDetailDialog}
              name={itemName}
              onNameChange={setItemName}
              deleteOpen={showDeleteDialog}
              onDeleteOpenChange={setShowDeleteDialog}
              onDeleteConfirm={handleDelete}
              isDeleting={isDeleting}
              canEdit={canEdit}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  if (!previewUrl) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
        <IsLoading
          label="Loading preview"
          className="text-sm text-gray-500 dark:text-gray-400"
        />
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
            imageFileKey={imageFileKey}
            open={showDetailDialog}
            onOpenChange={setShowDetailDialog}
            name={itemName}
            onNameChange={setItemName}
            deleteOpen={showDeleteDialog}
            onDeleteOpenChange={setShowDeleteDialog}
            onDeleteConfirm={handleDelete}
            isDeleting={isDeleting}
            canEdit={canEdit}
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
  const [isSavingName, setIsSavingName] = useState(false);
  const [fullQualityUrl, setFullQualityUrl] = useState<string | null>(null);
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
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const supabase = createClient();

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

  const saveUserTags = async (newTags: string[]) => {
    setIsSavingUserTags(true);
    try {
      await api.patch(`/api/v1/items/${item.id}`, { userTags: newTags });
      invalidateItems();
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

    // Validation: max 100 tags
    if (userTags.length >= 100) {
      toast.error("Maximum of 100 tags allowed");
      return;
    }

    // Validation: max 50 characters
    if (tag.length > 50) {
      toast.error("Tag must be 50 characters or less");
      return;
    }

    // Validation: allowed characters (letters, numbers, spaces, hyphens, underscores)
    if (!/^[\w\s-]+$/u.test(tag)) {
      toast.error("Tag can only contain letters, numbers, spaces, hyphens, and underscores");
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
    void saveUserTags(newTags);
  };

  const handleRemoveUserTag = (tagToRemove: string) => {
    const lowerTagToRemove = tagToRemove.toLowerCase();
    const newTags = userTags.filter(
      (t) => t.toLowerCase() !== lowerTagToRemove,
    );
    setUserTags(newTags);
    void saveUserTags(newTags);
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

      toast.success("Download started");
    } catch (error) {
      log.error({ error }, "Download error");
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
      toast.success("Link added");
    } catch (error) {
      log.error({ error }, "Add link error");
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
                // Non-article image with explicit dimensions for smooth transition
                (() => {
                  // Calculate target dimensions based on aspect ratio and viewport constraints
                  // This ensures the container animates to the correct size immediately,
                  // so the preview image stretches to fill it (pixelated) until full quality loads
                  const aspectRatio = width && height ? width / height : 4 / 3;
                  const maxHeightVh = 80; // md:max-h-[80vh]
                  const maxWidthVw = 60; // Approximate available width (100vw - 400px sidebar - padding)

                  return (
                    <motion.div
                      layoutId={`item-image-${item.id}`}
                      className="relative overflow-hidden"
                      transition={{
                        layout: { duration: 0.3 },
                        opacity: { duration: 0 },
                      }}
                      initial={false}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 1 }}
                      style={{
                        // Set explicit dimensions using CSS clamp to respect viewport constraints
                        // Height: min of 80vh or width-based height from aspect ratio
                        // Width: height * aspectRatio, clamped to available width
                        maxHeight: `${maxHeightVh}vh`,
                        maxWidth: `${maxWidthVw}vw`,
                        aspectRatio: `${aspectRatio}`,
                      }}
                    >
                      {/* Loading progress bar */}
                      {showProgress && (
                        <Progress
                          value={loadingProgress}
                          className="absolute top-0 left-0 right-0 z-10 h-0.5 rounded-none bg-transparent"
                        />
                      )}
                      {/* biome-ignore lint/performance/noImgElement: using proxy URL for user-uploaded content */}
                      <img
                        src={fullQualityUrl || previewUrl}
                        alt={name}
                        className="h-full w-full object-contain"
                      />
                    </motion.div>
                  );
                })()
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
                  disabled={!canEdit}
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
                        {/* biome-ignore lint/performance/noImgElement: using proxy URL for user-uploaded content */}
                        <img
                          src={fullQualityUrl || previewUrl}
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

                      {/* Tags - User Tags + Auto-generated Tags */}
                      {(userTags.length > 0 || item.tags.length > 0 || canEdit) && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                              Tags
                            </h3>
                            {isSavingUserTags && (
                              <IsLoading
                                label="Saving"
                                className="text-xs text-muted-foreground"
                                iconClassName="size-3"
                              />
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {/* User-added tags (primary styling, removable) */}
                            {userTags.map((tag) => (
                              <span
                                key={`user-${tag}`}
                                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary dark:bg-primary/20"
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
                                className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          {/* Tag input - only for users who can edit */}
                          {canEdit && (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newTagInput}
                                onChange={(e) => setNewTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddUserTag();
                                  }
                                }}
                                placeholder="Add a tag..."
                                className="flex-1 rounded-md border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleAddUserTag}
                                disabled={!newTagInput.trim() || isSavingUserTags}
                              >
                                <Plus className="size-4" />
                              </Button>
                            </div>
                          )}
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

                        // For read-only view (no edit access), only show if there's location data
                        if (!canEdit) {
                          if (!displayLocation) return null;

                          return (
                            <div className="space-y-2">
                              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
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
                  ) : item.processingStatus === "processing" ? (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 text-sm text-gray-500">
                      <IsLoading label="Analyzing image" />
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

                {/* Rooms - only shown to users who can edit */}
                {canEdit && (
                  <div className="space-y-2">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      <DoorOpen className="size-4" />
                      Rooms
                      <span className="text-xs font-normal text-muted-foreground">
                        (private)
                      </span>
                    </h3>
                    {item.rooms && item.rooms.length > 0 ? (
                      <ul className="space-y-1">
                        {item.rooms.map((room) => (
                          <li key={room.id} className="flex items-center gap-1">
                            {room.emoji && (
                              <span className="text-sm">{room.emoji}</span>
                            )}
                            <Link
                              href={`/rooms/${room.id}`}
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {room.name}
                            </Link>
                            {room.type === "smart" ? (
                              <Sparkles className="size-3 text-muted-foreground" />
                            ) : (
                              <Hand className="size-3 text-muted-foreground" />
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        This item isn't in any rooms yet.
                      </p>
                    )}
                  </div>
                )}

                {/* External Links - only shown to users who can edit */}
                {canEdit && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        <Link2 className="size-4" />
                        Links
                        <span className="text-xs font-normal text-muted-foreground">
                          (private)
                        </span>
                      </h3>
                      {!showAddLinkInput && (
                        <button
                          type="button"
                          onClick={() => setShowAddLinkInput(true)}
                          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
                            className="flex items-center gap-2 group"
                          >
                            <PlatformIcon
                              platform={link.platform}
                              className="size-4 text-muted-foreground shrink-0"
                            />
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate flex-1"
                            >
                              {getPlatformName(link.platform, link.url)}
                            </a>
                            <button
                              type="button"
                              onClick={() => handleRemoveLink(link.url)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-opacity"
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
                          className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Notes
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          (private)
                        </span>
                      </h3>
                      {isSavingNotes && (
                        <IsLoading
                          label="Saving"
                          className="text-xs text-muted-foreground"
                          iconClassName="size-3"
                        />
                      )}
                    </div>
                    <textarea
                      value={notes}
                      onChange={(e) => handleNotesChange(e.target.value)}
                      placeholder="Add your notes..."
                      className="w-full min-h-[100px] rounded-md border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                    />
                  </div>
                )}

                {/* Highlights - articles only */}
                {isArticle && (
                  <div className="pt-8 border-t border-gray-200 dark:border-gray-800">
                    <HighlightsPanel
                      itemId={item.id}
                      onHighlightClick={(highlight) =>
                        setScrollToHighlightId(highlight.id)
                      }
                      canEdit={canEdit}
                    />
                  </div>
                )}

                {/* Privacy Setting - only shown to users who can edit */}
                {canEdit && (
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
                      When enabled, this item won't appear in public dynamic
                      rooms
                    </p>
                  </div>
                )}

                {/* Action buttons - only shown to users who can edit */}
                {canEdit && (
                  <div className="mt-auto flex justify-end gap-2">
                    {item.fileKey && (
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
                )}
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
