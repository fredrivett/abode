"use client";

import type { RoomVisibility } from "@prisma/client";
import { Globe, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type VisibilityToggleProps = {
  value: RoomVisibility;
  onChange: (value: RoomVisibility) => void;
  disabled?: boolean;
};

export function VisibilityToggle({
  value,
  onChange,
  disabled = false,
}: VisibilityToggleProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onChange("private")}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
          value === "private"
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <Lock
          className={cn(
            "size-4",
            value === "private" ? "text-primary" : "text-muted-foreground",
          )}
        />
        <div>
          <div className="font-medium">Private</div>
          <div className="text-xs text-muted-foreground">Only you can view</div>
        </div>
      </button>
      <button
        type="button"
        onClick={() => onChange("public")}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
          value === "public"
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <Globe
          className={cn(
            "size-4",
            value === "public" ? "text-primary" : "text-muted-foreground",
          )}
        />
        <div>
          <div className="font-medium">Public</div>
          <div className="text-xs text-muted-foreground">Anyone with link</div>
        </div>
      </button>
    </div>
  );
}
