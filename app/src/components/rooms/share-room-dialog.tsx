"use client";

import type { RoomVisibility } from "@prisma/client";
import { AlertCircle, BrickWall, Check, Code2, Copy, Info } from "lucide-react";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { copyToClipboard } from "@/lib/copy";
import type { Filter } from "@/lib/search/types";
import { getAppBaseUrl } from "@/lib/url";
import { cn } from "@/lib/utils";

type WidgetType = "badge" | "preview";
type WidgetTheme = "auto" | "light" | "dark";
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
    slug: string | null;
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
    items: ItemCount;
    showFilters: boolean;
    fontSize?: number;
    includeFontSize: boolean;
  },
): string {
  const attributes = [
    `data-abode-room="${roomId}"`,
    config.type !== "badge" && `data-type="${config.type}"`,
    config.theme !== "auto" && `data-theme="${config.theme}"`,
    config.type === "preview" &&
      config.items !== 6 &&
      `data-items="${config.items}"`,
    config.type === "preview" &&
      !config.showFilters &&
      'data-show-filters="false"',
  ]
    .filter(Boolean)
    .join(" ");

  const fontSizeStyle =
    config.includeFontSize && config.fontSize
      ? ` style="font-size: ${config.fontSize}px;"`
      : "";

  return `<!-- Abode Room Widget -->
<div ${attributes}${fontSizeStyle}></div>
<script src="${typeof window !== "undefined" ? window.location.origin : "https://www.abode.fyi"}/embed.js" async></script>`;
}

declare global {
  interface Window {
    ABODE_RENDER_WIDGET?: (container: HTMLElement) => void;
  }
}

type EmbedPreviewProps = {
  room: {
    id: string;
    slug: string | null;
    name: string;
    emoji: string | null;
    itemCount: number;
    filters?: Filter[] | null;
  };
  username: string;
  config: {
    type: WidgetType;
    theme: WidgetTheme;
    items: ItemCount;
    showFilters: boolean;
  };
  roomItems: RoomItem[];
};

function EmbedPreview({
  room,
  username,
  config,
  roomItems,
}: EmbedPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(
    typeof window !== "undefined" && !!window.ABODE_RENDER_WIDGET,
  );

  // Build the room data in the same format as the embed API
  const buildRoomData = useCallback(() => {
    const baseUrl = getAppBaseUrl();
    const slugOrId = room.slug ?? room.id;
    const roomUrl = `${baseUrl}/@${username}/${slugOrId}`;

    // Transform items to match API format
    const items = roomItems.slice(0, config.items).map((item) => {
      const meta = item.meta || {};
      const isArticle = item.kind === "article";
      const imageFileKey = isArticle ? item.coverFileKey : item.fileKey;

      return {
        id: item.id,
        kind: item.kind,
        title: item.title,
        imageUrl: imageFileKey
          ? `/api/v1/images/${encodeURIComponent(imageFileKey)}`
          : null,
        width: isArticle ? 16 : ((meta.width as number) ?? 1),
        height: isArticle ? 9 : ((meta.height as number) ?? 1),
      };
    });

    return {
      room: {
        id: room.id,
        name: room.name,
        emoji: room.emoji,
        slug: slugOrId,
        itemCount: room.itemCount,
        filters: room.filters ?? [],
      },
      owner: {
        username,
        displayName: username,
      },
      items,
      roomUrl,
    };
  }, [room, username, config.items, roomItems]);

  // Render the widget when config changes or script loads
  useEffect(() => {
    if (!containerRef.current || !scriptLoaded) return;

    // Clear any existing shadow DOM by replacing the element
    const parent = containerRef.current.parentElement;
    if (!parent) return;

    const newContainer = document.createElement("div");
    newContainer.setAttribute("data-abode-room", room.id);
    newContainer.setAttribute("data-type", config.type);
    newContainer.setAttribute("data-theme", config.theme);
    newContainer.setAttribute("data-items", String(config.items));
    newContainer.setAttribute(
      "data-show-filters",
      config.showFilters ? "true" : "false",
    );
    newContainer.setAttribute(
      "data-room-json",
      JSON.stringify(buildRoomData()),
    );

    parent.replaceChild(newContainer, containerRef.current);
    containerRef.current = newContainer;

    // Render the widget
    if (window.ABODE_RENDER_WIDGET) {
      window.ABODE_RENDER_WIDGET(newContainer);
    }
  }, [room.id, config, scriptLoaded, buildRoomData]);

  return (
    <>
      <Script
        src="/embed.js"
        strategy="lazyOnload"
        onLoad={() => setScriptLoaded(true)}
      />
      <div
        ref={containerRef}
        data-abode-room={room.id}
        data-type={config.type}
        data-theme={config.theme}
        data-items={config.items}
        data-show-filters={config.showFilters ? "true" : "false"}
        data-room-json={JSON.stringify(buildRoomData())}
      />
    </>
  );
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
  const [items, setItems] = useState<ItemCount>(6);
  const [showFilters, setShowFilters] = useState(true);
  const [fontSize, setFontSize] = useState(16);
  const [includeFontSize, setIncludeFontSize] = useState(false);
  const [copied, setCopied] = useState(false);

  const isPublic = room.visibility === "public";
  const hasFilters = (room.filters?.length ?? 0) > 0;
  const embedCode = generateEmbedCode(room.id, {
    type,
    theme,
    items,
    showFilters,
    fontSize,
    includeFontSize,
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
          <DialogTitle className="flex items-center gap-2">
            Share{" "}
            <Badge variant="outline" className="text-sm font-semibold">
              {room.emoji && <span>{room.emoji}</span>}
              {room.name}
            </Badge>
          </DialogTitle>
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

            {/* Font Size */}
            <div className="space-y-2">
              <Label htmlFor="font-size">Preview Font Size</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  id="font-size"
                  type="number"
                  min={8}
                  max={32}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-16"
                />
                <span className="text-sm text-muted-foreground">px</span>
                <div className="ml-3 flex items-center gap-2">
                  <Checkbox
                    id="include-font-size"
                    checked={includeFontSize}
                    onCheckedChange={(checked) =>
                      setIncludeFontSize(checked === true)
                    }
                  />
                  <Label
                    htmlFor="include-font-size"
                    className="cursor-pointer text-sm font-normal"
                  >
                    Include in embed code
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      When enabled, the widget will use a fixed font size
                      instead of inheriting from your page&apos;s styles.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Adjust to preview how the widget scales. Check the box to lock
                the font size in the embed code.
              </p>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div
                className="flex justify-center rounded-lg border bg-muted/30 p-6"
                style={{ fontSize: `${fontSize}px` }}
              >
                <EmbedPreview
                  room={room}
                  username={username}
                  config={{ type, theme, items, showFilters }}
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
