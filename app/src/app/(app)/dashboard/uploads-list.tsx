"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BalancedMasonryGrid, Frame } from "@masonry-grid/react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type DashboardItem = {
  id: string;
  kind: string;
  processingStatus: string;
  fileKey: string | null;
  meta: Record<string, unknown> | null;
  source: string | null;
  createdAt: string;
};

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${
    units[exponent]
  }`;
}

export function UploadsList({ items }: { items: DashboardItem[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  return (
    <div className="w-full max-w-7xl space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Your uploads</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Private to you; links refresh when you open them.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No uploads yet.
        </p>
      ) : (
        <BalancedMasonryGrid frameWidth={250} gap={16}>
          {items.map((item) => {
            const meta = item.meta || {};
            const name =
              (meta.originalName as string | undefined) ??
              item.fileKey ??
              "Untitled";
            const size = formatBytes(meta.size as number | undefined);
            const mimeType = meta.type as string | undefined;

            // Use actual image dimensions if available, fallback to 3:4 aspect ratio
            const width = (meta.width as number | undefined) ?? 3;
            const height = (meta.height as number | undefined) ?? 4;

            return (
              <Frame key={item.id} width={width} height={height}>
                <MasonryItem
                  supabase={supabase}
                  item={item}
                  name={name}
                  size={size}
                  mimeType={mimeType}
                  router={router}
                />
              </Frame>
            );
          })}
        </BalancedMasonryGrid>
      )}
    </div>
  );
}

type MasonryItemProps = {
  supabase: ReturnType<typeof createClient>;
  item: DashboardItem;
  name: string;
  size: string;
  mimeType?: string;
  router: ReturnType<typeof useRouter>;
};

function MasonryItem({
  supabase,
  item,
  name,
  size,
  mimeType,
  router,
}: MasonryItemProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
          .download(item.fileKey!);

        if (downloadError || !data) {
          setError(downloadError?.message || "Unable to load preview");
          return;
        }

        const objectUrl = URL.createObjectURL(data);
        revokedUrl = objectUrl;
        setPreviewUrl(objectUrl);
      } catch (err) {
        console.error("Preview load error:", err);
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
      console.error("Delete error:", error);
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
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary underline"
        >
          View file: {name}
        </a>
      </div>
    );
  }

  return (
    <div className="group relative h-full w-full overflow-hidden rounded-lg">
      <img
        src={previewUrl}
        alt={name}
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="flex justify-end">
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogTrigger asChild>
              <Button
                size="icon"
                variant="destructive"
                className="h-8 w-8"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this item?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the
                  item and remove it from storage.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete();
                  }}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <div className="space-y-1 text-white">
          <p className="font-medium text-sm">{name}</p>
          <div className="flex flex-wrap gap-1 text-xs text-white/80">
            <span>{item.kind}</span>
            <span>•</span>
            <span>{item.processingStatus}</span>
          </div>
          <p className="text-xs text-white/70">
            {size} • {new Date(item.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

type UploadPreviewProps = {
  supabase: ReturnType<typeof createClient>;
  fileKey: string | null;
  mimeType?: string;
  alt: string;
};

function UploadPreview({
  supabase,
  fileKey,
  mimeType,
  alt,
}: UploadPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileKey) {
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
          .download(fileKey);

        if (downloadError || !data) {
          setError(downloadError?.message || "Unable to load preview");
          return;
        }

        const objectUrl = URL.createObjectURL(data);
        revokedUrl = objectUrl;
        setPreviewUrl(objectUrl);
      } catch (err) {
        console.error("Preview load error:", err);
        setError("Unable to load preview");
      }
    };

    void load();

    return () => {
      if (revokedUrl) {
        URL.revokeObjectURL(revokedUrl);
      }
    };
  }, [fileKey, supabase]);

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {error} — try reloading the page.
      </p>
    );
  }

  if (!previewUrl) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Loading preview...
      </p>
    );
  }

  const isImage = mimeType?.startsWith("image/");

  return isImage ? (
    <div className="overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <img
        src={previewUrl}
        alt={alt}
        className="h-auto max-h-96 w-full object-contain"
      />
    </div>
  ) : (
    <a
      href={previewUrl}
      target="_blank"
      rel="noreferrer"
      className="text-sm text-primary underline"
    >
      View file
    </a>
  );
}
