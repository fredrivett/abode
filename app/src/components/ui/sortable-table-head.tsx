"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { TableHead } from "@/components/ui/table";
import {
  buildSortQuery,
  nextSortState,
  type SortDirection,
} from "@/lib/table-sort";
import { cn } from "@/lib/utils";

type SortableTableHeadProps = {
  /** Stable key written to the `sort` query param and matched by the server */
  column: string;
  children: ReactNode;
  /** Aligns the label + indicator; use "right" for numeric columns */
  align?: "left" | "right";
  className?: string;
};

/**
 * A table header that toggles server-side sorting via the `sort` / `dir` query
 * params, cycling asc → desc → unset on click. Drop it in for any table whose
 * page reads those params (see `parseSortParams`) — it reads the current URL
 * itself, so no state needs threading through the table.
 */
export function SortableTableHead({
  column,
  children,
  align = "left",
  className,
}: SortableTableHeadProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeColumn = searchParams.get("sort");
  const direction: SortDirection =
    searchParams.get("dir") === "desc" ? "desc" : "asc";
  const isActive = activeColumn === column;

  const next = nextSortState({ column: activeColumn, direction }, column);
  const query = buildSortQuery(
    new URLSearchParams(searchParams.toString()),
    next,
  );
  const href = `${pathname}?${query.toString()}`;

  const Icon = !isActive
    ? ChevronsUpDown
    : direction === "asc"
      ? ArrowUp
      : ArrowDown;

  return (
    <TableHead
      className={className}
      aria-sort={
        isActive ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <Link
        href={href}
        scroll={false}
        className={cn(
          "-mx-2 flex items-center gap-1 px-2 py-1 transition-colors hover:text-foreground",
          align === "right" && "justify-end",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {children}
        <Icon
          className={cn("size-3.5 shrink-0", !isActive && "opacity-40")}
          aria-hidden
        />
      </Link>
    </TableHead>
  );
}
