"use client";

import { Pencil, Ticket } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IsLoading } from "@/components/ui/is-loading";
import {
  MAX_INVITE_ALLOCATION,
  parseInviteAllocation,
} from "@/lib/admin/invite-allocation";
import type { InviteUsage } from "@/lib/invites";
import type { SetInviteAllocationResult } from "../(protected)/actions";

type Props = {
  userId: string;
  initialUsage: InviteUsage;
  /** The setInviteAllocationAsAdmin server action, passed in by the page */
  saveAllocation: (args: {
    userId: string;
    allocation: number;
  }) => Promise<SetInviteAllocationResult>;
};

/**
 * Admin user page: shows a user's invites (used / allocation, left) and lets
 * an admin change their allocation inline.
 */
export function InviteAllocationEditor({
  userId,
  initialUsage,
  saveAllocation,
}: Props) {
  const inputId = useId();
  const [usage, setUsage] = useState(initialUsage);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(initialUsage.allocation));
  const [pending, startTransition] = useTransition();

  const parsed = parseInviteAllocation(draft);
  const unchanged = parsed === usage.allocation;

  const startEditing = () => {
    setDraft(String(usage.allocation));
    setEditing(true);
  };

  const save = () => {
    if (parsed === null || unchanged) return;
    startTransition(async () => {
      const result = await saveAllocation({
        userId,
        allocation: parsed,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setUsage(result.usage);
      setEditing(false);
      toast.success(`Invites set to ${result.usage.allocation}`);
    });
  };

  return (
    <div className="flex items-start gap-3">
      <Ticket className="mt-0.5 size-4 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <label htmlFor={inputId} className="text-muted-foreground text-xs">
          Invites
        </label>
        {editing ? (
          <form
            className="mt-1 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <Input
              id={inputId}
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_INVITE_ALLOCATION}
              step={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditing(false);
              }}
              className="h-8 w-24"
              disabled={pending}
              autoFocus
            />
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={pending || parsed === null || unchanged}
            >
              {pending ? <IsLoading label="Saving" /> : "Save"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm">
              <span className="font-medium">{usage.used}</span> used of{" "}
              <span className="font-medium">{usage.allocation}</span>
              <span className="text-muted-foreground">
                {" "}
                · {usage.available} left
              </span>
            </p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-6"
              aria-label="Edit invites"
              onClick={startEditing}
            >
              <Pencil className="size-3.5" />
            </Button>
          </div>
        )}
        {editing && parsed !== null && parsed < usage.used && (
          <p className="mt-1 text-muted-foreground text-xs">
            Below the {usage.used} already used, so they&apos;ll have none left.
            Sent invites aren&apos;t affected.
          </p>
        )}
      </div>
    </div>
  );
}
