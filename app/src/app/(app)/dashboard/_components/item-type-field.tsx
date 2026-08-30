"use client";

import type { ItemKind, ProcessingStatus, SourceType } from "@prisma/client";
import { ChevronDown } from "lucide-react";
import posthog from "posthog-js";
import { useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IsLoading } from "@/components/ui/is-loading";
import { api, isDailyLimitError } from "@/lib/api-client";
import {
  ITEM_KIND_LABELS,
  isForcibleKind,
  reassignableTargets,
} from "@/lib/item-kind-reassignment";
import { createLogger } from "@/lib/logger.client";
import { DAILY_LIMIT_REACHED_MESSAGE } from "@/lib/usage-limits.shared";

const log = createLogger("dashboard/item-type-field");

type ItemTypeFieldProps = {
  itemId: string;
  kind: ItemKind | null;
  sourceType: SourceType | null;
  canEdit: boolean;
  /** Called after a reassignment is accepted, with the item's new status. */
  onReassigned: (status: ProcessingStatus) => void;
};

/**
 * The "Type" value in an item's details. For reassignable web-family items it
 * becomes a subtle dropdown (a chevron fades/grows in on hover) that re-runs
 * classification with the chosen kind forced; otherwise it's plain static text.
 */
export function ItemTypeField({
  itemId,
  kind,
  sourceType,
  canEdit,
  onReassigned,
}: ItemTypeFieldProps) {
  const [isReassigning, setIsReassigning] = useState(false);

  const label = kind ? ITEM_KIND_LABELS[kind] : "Unknown";
  const targets = reassignableTargets(kind);
  // Reassignment re-fetches the source, so it's only offered for URL items.
  const canReassign =
    canEdit && sourceType === "url" && targets.length > 0 && kind !== null;

  if (!canReassign) {
    return <span className="font-medium">{label}</span>;
  }

  // Current kind first, then its permitted targets — the full web family.
  const options: ItemKind[] = [kind, ...targets];

  const handleReassign = async (next: string) => {
    if (!isForcibleKind(next) || next === kind) return;

    setIsReassigning(true);
    try {
      const response = await api.post<{ processingStatus: ProcessingStatus }>(
        `/api/v1/items/${itemId}/reassign`,
        { kind: next },
      );
      onReassigned(response.processingStatus);
      posthog.capture("item_type_reassigned", {
        item_id: itemId,
        from_kind: kind,
        to_kind: next,
      });
      toast.success(`Reanalysing as ${ITEM_KIND_LABELS[next].toLowerCase()}…`);
    } catch (error) {
      log.error({ error }, "Reassign error");
      posthog.captureException(error);
      toast.error(
        isDailyLimitError(error)
          ? DAILY_LIMIT_REACHED_MESSAGE
          : "Failed to change type",
      );
    } finally {
      setIsReassigning(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isReassigning}>
        <button
          type="button"
          className="group -my-0.5 flex cursor-pointer items-center gap-0.5 rounded font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isReassigning ? (
            <IsLoading label={label} iconClassName="size-3" />
          ) : (
            label
          )}
          <ChevronDown
            aria-hidden
            className="size-3 origin-left scale-75 text-gray-500 opacity-0 transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 group-data-[state=open]:scale-100 group-data-[state=open]:opacity-100"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={kind} onValueChange={handleReassign}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {ITEM_KIND_LABELS[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
