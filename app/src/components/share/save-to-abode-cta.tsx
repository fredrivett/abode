"use client";

import { ArrowRight, Bookmark, Check } from "lucide-react";
import posthog from "posthog-js";
import { useId, useState } from "react";
import { AbodeText } from "@/components/abode-inline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IsLoading } from "@/components/ui/is-loading";
import { ApiClientError, api } from "@/lib/api-client";
import type { ShareInviteOutcome } from "@/lib/invites/share-invite";
import { ROUTES } from "@/lib/routes";

type Props = {
  itemId: string;
  /** The link to save; items without one can't be saved, only joined from */
  sourceUrl: string | null;
  /** The sharer, credited for the invite */
  ownerUsername: string | null;
  isSignedIn: boolean;
  /** The sharer has invites to give (and allows it); otherwise readers join the waitlist */
  invitesOpen: boolean;
};

type ResponseOutcome = Exclude<
  ShareInviteOutcome,
  { status: "invalid_email" } | { status: "unavailable" }
>;

type FormState =
  | { step: "idle" }
  | { step: "submitting" }
  | { step: "redirecting" }
  | { step: "waitlisted" }
  | { step: "has_account" }
  | { step: "error"; message: string };

function savePath(sourceUrl: string): string {
  return `/save?${new URLSearchParams({ url: sourceUrl })}`;
}

function loginToSavePath(sourceUrl: string | null): string {
  if (!sourceUrl) return ROUTES.LOGIN;
  return `${ROUTES.LOGIN}?${new URLSearchParams({ next: savePath(sourceUrl) })}`;
}

/**
 * "Save to your abode" on a shared item. Signed-in readers save the link
 * straight to their library; signed-out readers join abode with the sharer's
 * invite (or the waitlist, when the sharer has none left), and the item is
 * saved to their new abode once they're in.
 */
export function SaveToAbodeCta({
  itemId,
  sourceUrl,
  ownerUsername,
  isSignedIn,
  invitesOpen,
}: Props) {
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>({ step: "idle" });
  const ownerHandle = ownerUsername ? `@${ownerUsername}` : "the sharer";

  if (isSignedIn) {
    if (!sourceUrl) return null;
    return (
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
        <p className="text-muted-foreground text-sm">
          Want this in your own abode?
        </p>
        <Button asChild size="sm" variant="secondary">
          <a
            href={savePath(sourceUrl)}
            onClick={() =>
              posthog.capture("share_cta_save_clicked", { item_id: itemId })
            }
          >
            <Bookmark />
            Save to your abode
          </a>
        </Button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setState({ step: "submitting" });
    try {
      const outcome = await api.post<ResponseOutcome>("/api/v1/share-invites", {
        itemId,
        email: email.trim(),
      });
      posthog.capture("share_cta_submitted", {
        item_id: itemId,
        outcome: outcome.status,
      });
      if (outcome.status === "invited") {
        setState({ step: "redirecting" });
        window.location.assign(outcome.joinPath);
        return;
      }
      setState({ step: outcome.status });
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "Something went wrong. Please try again.";
      setState({ step: "error", message });
    }
  };

  const busy = state.step === "submitting" || state.step === "redirecting";

  return (
    <section className="mb-8 rounded-xl border border-border bg-muted/30 p-5 md:p-6">
      <div className="space-y-1">
        <h2 className="font-medium text-foreground">
          <AbodeText>
            {sourceUrl ? "Save this to your own abode" : "Start your own abode"}
          </AbodeText>
        </h2>
        <p className="text-muted-foreground text-sm">
          A calm home for everything you save: articles, images, links and
          notes.{" "}
          {invitesOpen
            ? `Join with ${ownerHandle}'s invite${sourceUrl ? " and this will be waiting for you." : "."}`
            : "Join the waitlist and we'll let you know when there's a spot."}
        </p>
      </div>

      {state.step === "waitlisted" ? (
        <p className="mt-4 flex items-center gap-2 text-sm">
          <Check className="size-4 text-green-600" />
          You&apos;re on the waitlist. We&apos;ll email you when there&apos;s a
          spot.
        </p>
      ) : state.step === "has_account" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm">You already have an abode.</p>
          <Button asChild size="sm" variant="secondary">
            <a href={loginToSavePath(sourceUrl)}>
              Log in{sourceUrl ? " to save it" : ""}
              <ArrowRight />
            </a>
          </Button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-4 flex flex-col gap-2 sm:flex-row"
        >
          <label htmlFor={inputId} className="sr-only">
            Email address
          </label>
          <Input
            id={inputId}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            required
            className="sm:flex-1"
          />
          <Button
            type="submit"
            variant="secondary"
            // Firmer than the light theme's near-white secondary, never black
            className="bg-gray-200 hover:bg-gray-300 dark:bg-secondary dark:hover:bg-secondary/80"
            disabled={busy || !email.trim()}
          >
            {busy ? (
              <IsLoading label="Joining" />
            ) : (
              <>
                {!invitesOpen
                  ? "Join the waitlist"
                  : sourceUrl
                    ? "Save to my abode"
                    : "Join abode"}
                <ArrowRight />
              </>
            )}
          </Button>
        </form>
      )}

      {state.step === "error" && (
        <p className="mt-2 text-destructive text-sm" role="alert">
          {state.message}
        </p>
      )}
    </section>
  );
}
