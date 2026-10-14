"use client";

import { Check, Copy, Loader2, X } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import {
  type CopyStatus,
  useCopyToClipboard,
} from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";

/** The copy icon for each stage of a copy: idle, waiting, landed, failed */
export function CopyStatusIcon({
  status,
  className,
}: {
  status: CopyStatus;
  className?: string;
}) {
  if (status === "copying") {
    return <Loader2 aria-hidden className={cn("animate-spin", className)} />;
  }
  if (status === "copied") return <Check aria-hidden className={className} />;
  if (status === "failed") {
    return <X aria-hidden className={cn("text-destructive", className)} />;
  }
  return <Copy aria-hidden className={className} />;
}

/** Accessible name for a copy control at each stage */
export function copyStatusLabel({
  status,
  label,
}: {
  status: CopyStatus;
  label: string;
}) {
  if (status === "copying") return "Copying";
  if (status === "copied") return "Copied";
  if (status === "failed") return "Copy failed";
  return label;
}

type CopyButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "onClick" | "children" | "asChild"
> & {
  /** Text written to the clipboard */
  text: string;
  /** Accessible name while idle, e.g. "Copy URL" */
  label: string;
  successMessage?: string;
  errorMessage?: string;
  iconClassName?: string;
};

/**
 * Icon button that copies `text`, showing a tick only once the clipboard write
 * landed — a spinner while the browser decides, a cross (and toast) if not.
 */
export function CopyButton({
  text,
  label,
  successMessage,
  errorMessage,
  iconClassName,
  variant = "outline",
  size = "icon",
  ...props
}: CopyButtonProps) {
  const { status, copy } = useCopyToClipboard({ successMessage, errorMessage });

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      aria-label={copyStatusLabel({ status, label })}
      onClick={() => void copy(text)}
      {...props}
    >
      <CopyStatusIcon status={status} className={iconClassName} />
    </Button>
  );
}
