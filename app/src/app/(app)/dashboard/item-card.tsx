"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { EditableTitle } from "@/components/ui/editable-title";
import { IsLoading } from "@/components/ui/is-loading";
import { api } from "@/lib/api-client";
import { createLogger } from "@/lib/logger.client";
import { createClient } from "@/lib/supabase/client";

const log = createLogger("dashboard/item-card");

type DashboardItem = {
  id: string;
  kind: string;
  processingStatus: string;
  fileKey: string | null;
  meta: Record<string, unknown> | null;
  source: string | null;
  createdAt: string;
};

type ItemCardProps = {
  item: DashboardItem;
  name: string;
  size: string;
  mimeType?: string;
};

export function ItemCard({ item, name, size, mimeType }: ItemCardProps) {
  const supabase = createClient();
  const router = useRouter();
  const [itemName, setItemName] = useState(name);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  useEffect(() => {
    if (!item.fileKey) {
      setPreviewUrl(null);
      setError("Missing file");
      return;
    }

    let revokedUrl: string | null = null;
    const load = async () => {
      setError(null);
      try {
        const { data, error: downloadError } = await supabase.storage
          .from("items")
          .download(item.fileKey ?? "");

        if (downloadError || !data) {
          setError(downloadError?.message || "Unable to load preview");
          return;
        }

        const objectUrl = URL.createObjectURL(data);
        revokedUrl = objectUrl;
        setPreviewUrl(objectUrl);
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
  }, [item.fileKey, supabase]);

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

  const isImage = mimeType?.startsWith("image/");

  if (error) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!previewUrl) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading preview...
        </p>
      </div>
    );
  }

  if (!isImage) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
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
      <div className="group relative h-full w-full rounded-lg">
        <motion.div
          layoutId={`item-image-${item.id}`}
          className="h-full w-full cursor-pointer overflow-hidden rounded-lg !opacity-100"
          onClick={() => {
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

      <AnimatePresence>
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
  item: DashboardItem;
  size: string;
  previewUrl: string;
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
            {`Are you sure you want to delete "${itemName}"? This action cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" disabled={isDeleting}>
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? <IsLoading label="Deleting" /> : "Delete item"}
            </Button>
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
  const meta = item.meta || {};
  const width = (meta.width as number | undefined) ?? 0;
  const height = (meta.height as number | undefined) ?? 0;

  const handleNameSubmit = async (nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === name.trim()) return;
    setIsSavingName(true);
    try {
      const nextMeta = { ...meta, name: trimmed };
      await api.patch(`/api/v1/items/${item.id}`, { meta: nextMeta });
      onNameChange(trimmed);
      toast.success("Name updated");
    } catch (error) {
      log.error({ error }, "Name update error");
      toast.error("Failed to update name");
    } finally {
      setIsSavingName(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!max-w-[calc(100vw-2rem)] !sm:max-w-[calc(100vw-2rem)] !w-[calc(100vw-2rem)] !h-[calc(100vh-2rem)] p-0 overflow-hidden !opacity-100 !bg-transparent !border-0 !shadow-none [&>button]:hidden !scale-100 data-[state=open]:animate-none data-[state=closed]:animate-none data-[state=open]:scale-100 data-[state=closed]:scale-100"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
        }}
      >
        <motion.div
          className="w-full h-full bg-background rounded-lg border shadow-lg overflow-hidden"
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1 }}
          transition={{ duration: 0.2 }}
          style={{ willChange: "opacity" }}
        >
          <div className="flex h-full relative">
            {/* Left side - Image container */}
            <div className="flex-1 flex items-center justify-center bg-zinc-900">
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
                  className="max-h-[80vh] max-w-full object-contain"
                />
              </motion.div>
            </div>

            {/* Right side - Details */}
            <div className="flex flex-col overflow-hidden bg-background w-[400px]">
              <DialogHeader className="p-6 pb-4 items-start">
                <EditableTitle
                  value={name}
                  onSubmit={handleNameSubmit}
                  size="xl"
                  isSaving={isSavingName}
                />
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
                {/* Basic Info */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Details
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Type</span>
                      <span className="font-medium">{item.kind}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Size</span>
                      <span className="font-medium">{size}</span>
                    </div>
                    {width > 0 && height > 0 && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Dimensions</span>
                        <span className="font-medium">
                          {width} × {height}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Status</span>
                      <span className="font-medium capitalize">
                        {item.processingStatus}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Created</span>
                      <DateTime date={item.createdAt} className="font-medium" />
                    </div>
                  </div>
                </div>

                {/* AI-generated content will go here */}
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 text-sm text-zinc-500">
                  <p>
                    AI analysis will appear here once processing is complete.
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    variant="destructive"
                    onClick={() => onDeleteOpenChange(true)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <IsLoading label="Deleting" />
                    ) : (
                      "Delete item"
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
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
