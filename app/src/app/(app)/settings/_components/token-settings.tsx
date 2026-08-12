"use client";

import { formatDistanceToNow } from "date-fns";
import { Check, ChevronDown, Copy, KeyRound, Trash2 } from "lucide-react";
import posthog from "posthog-js";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { IsLoading } from "@/components/ui/is-loading";
import { Label } from "@/components/ui/label";
import { copyToClipboard } from "@/lib/copy";
import type { PersonalAccessTokenSummary } from "@/lib/personal-access-tokens";

// Expiry choices offered at creation; kept client-side so this file stays free
// of the server-only token lib. `days` maps to the API's `expiresInDays`.
const EXPIRY_OPTIONS = [
  { value: "never", label: "No expiry", days: null },
  { value: "30", label: "30 days", days: 30 },
  { value: "90", label: "90 days", days: 90 },
] as const;

type ExpiryValue = (typeof EXPIRY_OPTIONS)[number]["value"];

type TokenSettingsProps = {
  initialTokens: PersonalAccessTokenSummary[];
};

export function TokenSettings({ initialTokens }: TokenSettingsProps) {
  const [tokens, setTokens] = useState(initialTokens);
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState<ExpiryValue>("never");
  const [isCreating, setIsCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      const days = EXPIRY_OPTIONS.find((o) => o.value === expiry)?.days ?? null;
      const response = await fetch("/api/v1/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), expiresInDays: days }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Failed to create token");
        return;
      }

      posthog.capture("token_created", { has_expiry: days !== null });
      setTokens((prev) => [data.tokenSummary, ...prev]);
      setNewToken(data.token);
      setName("");
      setExpiry("never");
    } catch {
      toast.error("Failed to create token");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    const response = await fetch(`/api/v1/tokens/${id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(data.error || "Failed to revoke token");
      return;
    }

    posthog.capture("token_revoked");
    setTokens((prev) => prev.filter((t) => t.id !== id));
    toast.success("Token revoked");
  };

  const selectedExpiryLabel =
    EXPIRY_OPTIONS.find((o) => o.value === expiry)?.label ?? "No expiry";

  return (
    <>
      <section className="rounded-xl border p-6">
        <h3 className="flex items-center gap-2 font-semibold text-xl">
          <KeyRound className="size-5 text-muted-foreground" />
          Access tokens
        </h3>
        <p className="mt-1 text-muted-foreground text-sm">
          Personal access tokens let apps and scripts read your abode over the
          API — for example an MCP server that answers questions about what
          you've saved. Treat them like passwords.
        </p>

        <form
          onSubmit={handleCreate}
          className="mt-4 flex flex-col gap-2 sm:flex-row"
        >
          <div className="flex-1">
            <Label htmlFor="token-name" className="sr-only">
              Token name
            </Label>
            <Input
              id="token-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Claude Desktop"
              maxLength={100}
              required
              disabled={isCreating}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={isCreating}
                className="justify-between sm:w-36"
              >
                {selectedExpiryLabel}
                <ChevronDown className="size-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={expiry}
                onValueChange={(value) => setExpiry(value as ExpiryValue)}
              >
                {EXPIRY_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button type="submit" disabled={isCreating || !name.trim()}>
            {isCreating ? <IsLoading label="Creating" /> : "Create token"}
          </Button>
        </form>
      </section>

      <div className="mt-6">
        <h4 className="mb-3 font-medium text-muted-foreground text-sm">
          Your tokens
        </h4>
        {tokens.length > 0 ? (
          <div className="space-y-2">
            {tokens.map((token) => (
              <TokenRow key={token.id} token={token} onRevoke={handleRevoke} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border py-4 text-center text-muted-foreground text-sm">
            No tokens yet
          </p>
        )}
      </div>

      <NewTokenDialog token={newToken} onClose={() => setNewToken(null)} />
    </>
  );
}

function TokenRow({
  token,
  onRevoke,
}: {
  token: PersonalAccessTokenSummary;
  onRevoke: (id: string) => Promise<void>;
}) {
  const [isRevoking, setIsRevoking] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isExpired =
    token.expiresAt !== null && new Date(token.expiresAt) < new Date();

  const meta = () => {
    if (isExpired) return "expired";
    if (token.expiresAt) {
      return `expires ${formatDistanceToNow(new Date(token.expiresAt), { addSuffix: true })}`;
    }
    return "no expiry";
  };

  const lastUsed = token.lastUsedAt
    ? `used ${formatDistanceToNow(new Date(token.lastUsedAt), { addSuffix: true })}`
    : "never used";

  const handleClick = () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }
    setIsRevoking(true);
    void onRevoke(token.id).finally(() => {
      setIsRevoking(false);
      setShowConfirm(false);
    });
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-sm">{token.name}</span>
          <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-muted-foreground text-xs">
            {token.tokenPrefix}…
          </code>
        </div>
        <p className="mt-0.5 text-muted-foreground text-xs">
          {meta()} · {lastUsed}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        onBlur={() => !isRevoking && setShowConfirm(false)}
        disabled={isRevoking}
        aria-label="Revoke token"
        className="shrink-0 text-muted-foreground hover:text-destructive"
      >
        {isRevoking ? (
          <IsLoading label="Revoking" iconClassName="size-3" />
        ) : showConfirm ? (
          <span className="text-xs">Confirm revoke?</span>
        ) : (
          <Trash2 className="size-4" />
        )}
      </Button>
    </div>
  );
}

function NewTokenDialog({
  token,
  onClose,
}: {
  token: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!token) return;
    const ok = await copyToClipboard(token);
    if (ok) {
      setCopied(true);
      toast.success("Copied");
    } else {
      toast.error("Failed to copy");
    }
  };

  return (
    <Dialog
      open={token !== null}
      onOpenChange={(open) => {
        if (!open) {
          setCopied(false);
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copy your token now</DialogTitle>
          <DialogDescription>
            This is the only time you'll see it. Store it somewhere safe — if
            you lose it, revoke it and create a new one.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <code
            className="flex-1 truncate rounded-lg border bg-secondary px-3 py-2 font-mono text-sm"
            data-testid="new-token-value"
          >
            {token}
          </code>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleCopy}
            aria-label="Copy token"
          >
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
