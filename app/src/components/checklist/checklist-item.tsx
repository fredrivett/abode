"use client";

import type { MilestoneType } from "@prisma/client";
import { Check, Circle, Info } from "lucide-react";
import Link from "next/link";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatRelativeTime } from "@/lib/time";
import { cn } from "@/lib/utils";

type ChecklistItemProps = {
  type: MilestoneType;
  label: string;
  destination: string;
  isCompleted: boolean;
  completedAt?: string;
  onNavigate?: () => void;
};

export function ChecklistItem({
  label,
  destination,
  isCompleted,
  completedAt,
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
      <span className={cn("flex-1", isCompleted && "line-through")}>
        {label}
      </span>
      {isCompleted && completedAt && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="size-3.5 shrink-0 text-muted-foreground/50" />
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={8}>
            <span className="text-xs">
              Completed {formatRelativeTime(completedAt)}
            </span>
          </TooltipContent>
        </Tooltip>
      )}
    </Link>
  );
}
