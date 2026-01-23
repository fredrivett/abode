"use client";

import type { MilestoneType } from "@prisma/client";
import { ListTodo } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMilestoneStore } from "@/stores/milestone-store";

import { ChecklistItem } from "./checklist-item";

type MilestoneConfig = {
  label: string;
  destination: string;
  conditional?: "has_article";
};

type MilestonesResponse = {
  completed: MilestoneType[];
  pending: MilestoneType[];
  hasArticle: boolean;
  config: Record<MilestoneType, MilestoneConfig>;
};

export function ChecklistPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const [config, setConfig] = useState<Record<
    MilestoneType,
    MilestoneConfig
  > | null>(null);

  const { completed, pending, isLoaded, setMilestones } = useMilestoneStore();

  useEffect(() => {
    async function fetchMilestones() {
      try {
        const response = await fetch("/api/v1/user/milestones");
        if (!response.ok) return;

        const data: MilestonesResponse = await response.json();
        setMilestones(data.completed, data.pending, data.hasArticle);
        setConfig(data.config);
      } catch {
        // Silently fail - checklist is non-critical
      }
    }

    if (!isLoaded) {
      void fetchMilestones();
    }
  }, [isLoaded, setMilestones]);

  const handleNavigate = useCallback(() => {
    setIsOpen(false);
  }, []);

  const pendingCount = pending.length;

  // Show pending items first, then completed items (limited to 2 by default)
  const MAX_COMPLETED_PREVIEW = 2;
  const completedToShow = showAllCompleted
    ? completed
    : completed.slice(-MAX_COMPLETED_PREVIEW);
  const hiddenCompletedCount = completed.length - MAX_COMPLETED_PREVIEW;
  const hasHiddenCompleted = hiddenCompletedCount > 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost-subtle"
              size="icon"
              aria-label="Checklist"
              className="relative"
            >
              <ListTodo size={18} aria-hidden />
              {pendingCount > 0 && (
                <Badge
                  variant="outline"
                  className="absolute top-0 right-0 h-4 min-w-4 rounded border-muted-foreground/20 bg-muted px-1 py-0 text-[10px] text-muted-foreground leading-none"
                >
                  {pendingCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          <span className="font-mono">
            {pendingCount > 0
              ? `${pendingCount} task${pendingCount !== 1 ? "s" : ""} remaining`
              : "All done!"}
          </span>
        </TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-72 p-2">
        <div className="mb-2 flex items-center gap-2 px-2 py-1">
          <ListTodo className="size-4 shrink-0 text-muted-foreground" />
          <h3 className="font-medium text-sm">Get started</h3>
        </div>

        <p className="mb-2 px-2 text-muted-foreground text-xs">
          Welcome home. There's a lot to explore. Here's a few options to get
          started, complete them at your own pace, make yourself at home.
        </p>

        <p className="mb-2 px-2 text-muted-foreground text-xs">
          If you're ever confused, you've got my email:{" "}
          <a href="mailto:fred@abode.fyi" className="underline">
            fred@abode.fyi
          </a>
          , feel free to say hi anytime.
        </p>

        <p className="mb-3 flex items-center gap-1.5 px-2 text-muted-foreground text-xs">
          <span>—</span>
          <Link href="/@fr" className="shrink-0">
            <Image
              src="/avatars/fr.jpg"
              alt="Fred Rivett's avatar"
              width={16}
              height={16}
              className="size-4 rounded-full"
            />
          </Link>
          <Link href="/@fr" className="hover:underline">
            fred (@fr)
          </Link>
        </p>

        <div className="space-y-0.5">
          {config && (
            <>
              {/* Show more completed button */}
              {hasHiddenCompleted && !showAllCompleted && (
                <button
                  type="button"
                  onClick={() => setShowAllCompleted(true)}
                  className="w-full rounded px-2 py-1.5 text-left text-muted-foreground text-xs transition-colors hover:bg-muted/50"
                >
                  Show {hiddenCompletedCount} more completed{" "}
                  {hiddenCompletedCount === 1 ? "task" : "tasks"}
                </button>
              )}

              {/* Completed items */}
              {completedToShow.map((type) => {
                const itemConfig = config[type];
                if (!itemConfig) return null;

                return (
                  <ChecklistItem
                    key={type}
                    type={type}
                    label={itemConfig.label}
                    destination={itemConfig.destination}
                    isCompleted={true}
                    onNavigate={handleNavigate}
                  />
                );
              })}

              {/* Pending items */}
              {pending.map((type) => {
                const itemConfig = config[type];
                if (!itemConfig) return null;

                return (
                  <ChecklistItem
                    key={type}
                    type={type}
                    label={itemConfig.label}
                    destination={itemConfig.destination}
                    isCompleted={false}
                    onNavigate={handleNavigate}
                  />
                );
              })}
            </>
          )}

          {!config && (
            <div className="space-y-0.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex animate-pulse items-center gap-3 px-2 py-1.5"
                >
                  <div className="size-4 shrink-0 rounded-full bg-muted" />
                  <div
                    className="h-5 rounded bg-muted"
                    style={{ width: `${50 + i * 15}%` }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
