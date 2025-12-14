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

  const relativeTime = formatDistanceToNow(dateObj, { addSuffix: true });

  const time = format(dateObj, "HH:mm");
  const localDate = dateObj.toLocaleDateString();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("cursor-default", className)}>{relativeTime}</span>
      </TooltipTrigger>
      <TooltipContent side="left">
        <span>
          {time} · {localDate}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
