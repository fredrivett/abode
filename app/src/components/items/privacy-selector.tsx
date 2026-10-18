"use client";

import type { ItemPrivacy } from "@prisma/client";
import { EyeOff, Globe, type LucideIcon, ShieldAlert } from "lucide-react";
import { ITEM_PRIVACY_LEVELS } from "@/lib/items/privacy";
import { cn } from "@/lib/utils";

const OPTIONS: Record<
  ItemPrivacy,
  { label: string; description: string; icon: LucideIcon }
> = {
  standard: {
    label: "Default",
    description: "Can appear in public rooms and be shared by link",
    icon: Globe,
  },
  unlisted: {
    label: "Keep out of public rooms",
    description: "Never in public rooms; can still be shared by link",
    icon: EyeOff,
  },
  sensitive: {
    label: "Sensitive",
    description:
      "Never in public rooms or shared by link; blurred, password to open",
    icon: ShieldAlert,
  },
};

type PrivacySelectorProps = {
  value: ItemPrivacy;
  onChange: (value: ItemPrivacy) => void;
  disabled?: boolean;
};

export function PrivacySelector({
  value,
  onChange,
  disabled = false,
}: PrivacySelectorProps) {
  return (
    <div className="grid gap-2">
      {ITEM_PRIVACY_LEVELS.map((level) => {
        const { label, description, icon: Icon } = OPTIONS[level];
        const selected = value === level;
        return (
          <button
            key={level}
            type="button"
            aria-pressed={selected}
            onClick={() => !selected && onChange(level)}
            disabled={disabled}
            className={cn(
              "flex items-start gap-2.5 rounded-lg border p-3 text-left text-sm transition-colors",
              selected
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                selected ? "text-primary" : "text-muted-foreground",
              )}
            />
            <div>
              <div className="font-medium">{label}</div>
              <div className="text-muted-foreground text-xs">{description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
