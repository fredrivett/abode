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
  DialogOrDrawer,
  DialogOrDrawerBody,
  DialogOrDrawerContent,
  DialogOrDrawerDescription,
  DialogOrDrawerHeader,
  DialogOrDrawerTitle,
} from "@/components/ui/dialog-or-drawer";
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
import { useMilestoneStore } from "@/stores/milestone-store";

type WidgetType = "badge" | "preview";
type WidgetTheme = "auto" | "light" | "dark";

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
    showFilters: boolean;
    showEmoji: boolean;
    fontSize?: number;
    includeFontSize: boolean;
    customText?: string;
  },
): string {
  const attributes = [
    `data-abode-room="${roomId}"`,
    config.type !== "badge" && `data-type="${config.type}"`,
    config.theme !== "auto" && `data-theme="${config.theme}"`,
    config.type === "preview" &&
      !config.showFilters &&
      'data-show-filters="false"',
    !config.showEmoji && 'data-show-emoji="false"',
    config.type === "badge" &&
      config.customText &&
      `data-text="${config.customText}"`,
  ]
    .filter(Boolean)
    .join(" ");

  const fontSizeStyle =
    config.includeFontSize && config.fontSize
      ? ` style="font-size: ${config.fontSize}px;"`
      : "";

  // Use span for badge (inline element), div for preview (block element)
  const tag = config.type === "badge" ? "span" : "div";

  // Badge doesn't need HTML comment since it's inline
  if (config.type === "badge") {
    return `<${tag} ${attributes}${fontSizeStyle}></${tag}>
<script src="${typeof window !== "undefined" ? window.location.origin : "https://www.abode.fyi"}/embed.js" async></script>`;
  }

  return `<!-- Abode Room Widget -->
<${tag} ${attributes}${fontSizeStyle}></${tag}>
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
    showFilters: boolean;
    showEmoji: boolean;
    customText?: string;
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

    // Transform items to match API format (hardcoded to 12 items max)
    const items = roomItems.slice(0, 12).map((item) => {
      const meta = item.meta || {};
      const isArticleOrWebpage =
        item.kind === "article" || item.kind === "webpage";
      const imageFileKey = isArticleOrWebpage
        ? item.coverFileKey
        : item.fileKey;

      return {
        id: item.id,
        kind: item.kind,
        title: item.title,
        imageUrl: imageFileKey
          ? `/api/v1/images/${encodeURIComponent(imageFileKey)}?w=200&q=75`
          : null,
        width: isArticleOrWebpage ? 16 : ((meta.width as number) ?? 1),
        height: isArticleOrWebpage ? 9 : ((meta.height as number) ?? 1),
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
  }, [room, username, roomItems]);

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
    newContainer.setAttribute(
      "data-show-filters",
      config.showFilters ? "true" : "false",
    );
    newContainer.setAttribute(
      "data-show-emoji",
      config.showEmoji ? "true" : "false",
    );
    if (config.customText) {
      newContainer.setAttribute("data-text", config.customText);
    }
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
        data-show-filters={config.showFilters ? "true" : "false"}
        data-show-emoji={config.showEmoji ? "true" : "false"}
        data-text={config.customText || undefined}
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
  const [showFilters, setShowFilters] = useState(true);
  const [showEmoji, setShowEmoji] = useState(true);
  const [fontSize, setFontSize] = useState(16);
  const [includeFontSize, setIncludeFontSize] = useState(false);
  const [customText, setCustomText] = useState("");
  const [copied, setCopied] = useState(false);

  const isPublic = room.visibility === "public";

  // Track share_room milestone when opening share dialog on a public room
  const { completed, markComplete } = useMilestoneStore();
  useEffect(() => {
    if (open && isPublic && !completed.some((m) => m.type === "share_room")) {
      fetch("/api/v1/user/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "share_room" }),
      })
        .then((res) => {
          if (res.ok) {
            markComplete("share_room");
          }
        })
        .catch(() => {
          // Silently fail - milestone tracking should not break main flow
        });
    }
  }, [open, isPublic, completed, markComplete]);

  const hasFilters = (room.filters?.length ?? 0) > 0;
  const hasEmoji = !!room.emoji;
  const embedCode = generateEmbedCode(room.id, {
    type,
    theme,
    showFilters,
    showEmoji,
    fontSize,
    includeFontSize,
    customText: customText.trim() || undefined,
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
    <DialogOrDrawer open={open} onOpenChange={onOpenChange}>
      <DialogOrDrawerContent className="sm:max-w-xl">
        <DialogOrDrawerHeader>
          <DialogOrDrawerTitle className="flex items-center gap-2">
            Share{" "}
            <Badge variant="outline" className="font-semibold text-sm">
              {room.emoji && <span>{room.emoji}</span>}
              {room.name}
            </Badge>
          </DialogOrDrawerTitle>
          <DialogOrDrawerDescription>
            Embed this room on your website or blog.
          </DialogOrDrawerDescription>
        </DialogOrDrawerHeader>

        <DialogOrDrawerBody>
          {!isPublic ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
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
                      <div className="text-muted-foreground text-xs">
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
                      <div className="text-muted-foreground text-xs">
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

              {/* Badge options: Include emoji + Custom text */}
              {type === "badge" && hasEmoji && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="show-emoji"
                    checked={showEmoji}
                    onCheckedChange={(checked) =>
                      setShowEmoji(checked === true)
                    }
                  />
                  <Label
                    htmlFor="show-emoji"
                    className="cursor-pointer font-normal text-sm"
                  >
                    Include emoji
                  </Label>
                </div>
              )}

              {/* Custom Text (badge only) */}
              {type === "badge" && (
                <div className="space-y-2">
                  <Label htmlFor="custom-text">Custom Link Text</Label>
                  <Input
                    id="custom-text"
                    type="text"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder={room.name}
                  />
                  <p className="text-muted-foreground text-xs">
                    Leave empty to show the room name. Useful for inline text
                    like &quot;check out my room&quot;.
                  </p>
                </div>
              )}

              {/* Show Emoji (preview, when room has emoji) */}
              {type === "preview" && hasEmoji && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="show-emoji-preview"
                    checked={showEmoji}
                    onCheckedChange={(checked) =>
                      setShowEmoji(checked === true)
                    }
                  />
                  <Label
                    htmlFor="show-emoji-preview"
                    className="cursor-pointer font-normal text-sm"
                  >
                    Include emoji
                  </Label>
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
                  <span className="text-muted-foreground text-sm">px</span>
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
                      className="cursor-pointer font-normal text-sm"
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
                <p className="text-muted-foreground text-xs">
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
                    config={{
                      type,
                      theme,
                      showFilters,
                      showEmoji,
                      customText: customText.trim() || undefined,
                    }}
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
        </DialogOrDrawerBody>
      </DialogOrDrawerContent>
    </DialogOrDrawer>
  );
}
