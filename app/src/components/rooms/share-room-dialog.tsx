"use client";

import type { RoomVisibility } from "@prisma/client";
import { AlertCircle, BrickWall, Check, Code2, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { copyToClipboard } from "@/lib/copy";
import type { Filter } from "@/lib/search/types";
import { cn } from "@/lib/utils";
import { WidgetPreview } from "./widget-preview";

type WidgetType = "badge" | "preview";
type WidgetTheme = "auto" | "light" | "dark";
type WidgetSize = "compact" | "standard";
type ItemCount = 3 | 6 | 9;

type RoomItem = {
  id: string;
  kind: string | null;
  title: string | null;
  fileKey: string | null;
  coverFileKey: string | null;
  meta: Record<string, unknown> | null;
};

type ShareRoomDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: {
    id: string;
    name: string;
    emoji: string | null;
    visibility: RoomVisibility;
    itemCount: number;
    filters?: Filter[] | null;
  };
  username: string;
  items: RoomItem[];
};

function generateEmbedCode(
  roomId: string,
  config: {
    type: WidgetType;
    theme: WidgetTheme;
    size: WidgetSize;
    items: ItemCount;
    showFilters: boolean;
  },
): string {
  const attributes = [
    `data-abode-room="${roomId}"`,
    config.type !== "badge" && `data-type="${config.type}"`,
    config.theme !== "auto" && `data-theme="${config.theme}"`,
    config.size !== "standard" && `data-size="${config.size}"`,
    config.type === "preview" &&
      config.items !== 6 &&
      `data-items="${config.items}"`,
    config.type === "preview" &&
      !config.showFilters &&
      'data-show-filters="false"',
  ]
    .filter(Boolean)
    .join(" ");

  return `<!-- Abode Room Widget -->
<div ${attributes}></div>
<script src="${typeof window !== "undefined" ? window.location.origin : "https://www.abode.fyi"}/embed.js" async></script>`;
}

export function ShareRoomDialog({
  open,
  onOpenChange,
  room,
  username,
  items: roomItems,
}: ShareRoomDialogProps) {
  const [type, setType] = useState<WidgetType>("badge");
  const [theme, setTheme] = useState<WidgetTheme>("auto");
  const [size, setSize] = useState<WidgetSize>("standard");
  const [items, setItems] = useState<ItemCount>(6);
  const [showFilters, setShowFilters] = useState(true);
  const [copied, setCopied] = useState(false);

  const isPublic = room.visibility === "public";
  const hasFilters = (room.filters?.length ?? 0) > 0;
  const embedCode = generateEmbedCode(room.id, {
    type,
    theme,
    size,
    items,
    showFilters,
  });

  const handleCopy = async () => {
    const success = await copyToClipboard(embedCode);
    if (success) {
      setCopied(true);
      toast.success("Embed code copied!");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Failed to copy");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Share "{room.name}"</DialogTitle>
          <DialogDescription>
            Embed this room on your website or blog.
          </DialogDescription>
        </DialogHeader>

        {!isPublic ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>This room is private. Make it public to enable embedding.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Widget Type */}
            <div className="space-y-2">
              <Label>Widget Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("badge")}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
                    type === "badge"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/50",
                  )}
                >
                  <Code2
                    className={cn(
                      "size-4",
                      type === "badge"
                        ? "text-primary"
                        : "text-muted-foreground",
                    )}
                  />
                  <div>
                    <div className="font-medium">Badge</div>
                    <div className="text-xs text-muted-foreground">
                      Simple link pill
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setType("preview")}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
                    type === "preview"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/50",
                  )}
                >
                  <BrickWall
                    className={cn(
                      "size-4",
                      type === "preview"
                        ? "text-primary"
                        : "text-muted-foreground",
                    )}
                  />
                  <div>
                    <div className="font-medium">Preview</div>
                    <div className="text-xs text-muted-foreground">
                      Card with thumbnails
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Theme */}
            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="flex gap-2">
                {(["auto", "light", "dark"] as const).map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant={theme === t ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme(t)}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Size */}
            <div className="space-y-2">
              <Label>Size</Label>
              <div className="flex gap-2">
                {(["compact", "standard"] as const).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant={size === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSize(s)}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Items Count (preview only) */}
            {type === "preview" && (
              <div className="space-y-2">
                <Label>Max Preview Items</Label>
                <div className="flex gap-2">
                  {([3, 6, 9] as const).map((count) => (
                    <Button
                      key={count}
                      type="button"
                      variant={items === count ? "default" : "outline"}
                      size="sm"
                      onClick={() => setItems(count)}
                    >
                      {count}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Show Filters (preview only, when room has filters) */}
            {type === "preview" && hasFilters && (
              <div className="space-y-2">
                <Label>Show Filters</Label>
                <div className="flex gap-2">
                  {(["on", "off"] as const).map((opt) => (
                    <Button
                      key={opt}
                      type="button"
                      variant={
                        (opt === "on") === showFilters ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setShowFilters(opt === "on")}
                    >
                      {opt === "on" ? "On" : "Off"}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="flex justify-center rounded-lg border bg-muted/30 p-6">
                <WidgetPreview
                  room={room}
                  username={username}
                  config={{ type, theme, size, items, showFilters }}
                  roomItems={roomItems}
                />
              </div>
            </div>

            {/* Embed Code */}
            <div className="space-y-2">
              <Label>Embed Code</Label>
              <div className="relative">
                <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg border bg-muted/50 p-4 pr-12 text-xs">
                  <code>{embedCode}</code>
                </pre>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-2 right-2"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
