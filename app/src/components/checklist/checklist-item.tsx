"use client";

import type { MilestoneType } from "@prisma/client";
import { Check, Circle } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type ChecklistItemProps = {
  type: MilestoneType;
  label: string;
  destination: string;
  isCompleted: boolean;
  onNavigate?: () => void;
};

export function ChecklistItem({
  label,
  destination,
  isCompleted,
  onNavigate,
}: ChecklistItemProps) {
  return (
    <Link
      href={destination}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors",
        "hover:bg-accent",
        isCompleted && "text-muted-foreground",
      )}
    >
      {isCompleted ? (
        <Check className="size-4 shrink-0 text-green-500" />
      ) : (
        <Circle className="size-4 shrink-0 text-muted-foreground/50" />
      )}
      <span className={cn(isCompleted && "line-through")}>{label}</span>
    </Link>
  );
}
