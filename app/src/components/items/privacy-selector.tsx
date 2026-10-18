"use client";

import type { ItemPrivacy } from "@prisma/client";
import { EyeOff, Globe, type LucideIcon, ShieldAlert } from "lucide-react";
import { useId } from "react";
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
  const name = useId();
  return (
    // Native radios: one labelled single-choice group for assistive tech, with
    // arrow-key movement between levels
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="sr-only">Privacy</legend>
      {ITEM_PRIVACY_LEVELS.map((level) => {
        const { label, description, icon: Icon } = OPTIONS[level];
        const selected = value === level;
        return (
          <label
            key={level}
            className={cn(
              "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-left text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              selected
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <input
              type="radio"
              name={name}
              value={level}
              checked={selected}
              onChange={() => onChange(level)}
              className="sr-only"
            />
            <Icon
              aria-hidden="true"
              className={cn(
                "mt-0.5 size-4 shrink-0",
                selected ? "text-primary" : "text-muted-foreground",
              )}
            />
            <span>
              <span className="block font-medium">{label}</span>
              <span className="block text-muted-foreground text-xs">
                {description}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
