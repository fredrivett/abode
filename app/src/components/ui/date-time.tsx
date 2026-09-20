"use client";

import { format, formatDistanceToNow } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type DateTimeProps = {
  date: Date | string | number;
  className?: string;
};

export function DateTime({ date, className }: DateTimeProps) {
  const dateObj = date instanceof Date ? date : new Date(date);

  // Relative to the viewer's clock, so the server's value (render time) and the
  // client's (a moment later, at hydration) can legitimately differ when they
  // straddle a "minute ago" boundary. There's no server value that stays
  // correct on the client, so we suppress the hydration mismatch (React #418)
  // on this node rather than trying to reconcile it.
  const relativeTime = formatDistanceToNow(dateObj, { addSuffix: true });

  const time = format(dateObj, "HH:mm");
  const localDate = dateObj.toLocaleDateString();
  const timezone = dateObj
    .toLocaleTimeString("en-US", { timeZoneName: "short" })
    .split(" ")
    .pop();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          suppressHydrationWarning
          className={cn("cursor-default", className)}
        >
          {relativeTime}
        </span>
      </TooltipTrigger>
      <TooltipContent side="left">
        <span>
          {time} · {localDate} ({timezone})
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
