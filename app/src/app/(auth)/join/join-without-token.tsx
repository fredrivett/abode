"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import { WaitlistForm } from "@/components/waitlist-form";
import {
  getJoinPath,
  parseInviteLinkInput,
} from "@/lib/invites/invite-link-input";

// /join without a token: invites only ever arrive as a link, so explain that,
// take a pasted link as a fallback, and let anyone without one join the waitlist
export function JoinWithoutToken() {
  const [link, setLink] = useState("");
  const [isInvalid, setIsInvalid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parts = parseInviteLinkInput(link);
    if (!parts) {
      setIsInvalid(true);
      return;
    }

    setIsSubmitting(true);
    router.push(getJoinPath(parts));
  };

  return (
    <>
      <div className="space-y-2 text-center">
        <h1 className="font-semibold text-2xl tracking-tight">join abode</h1>
        <p className="text-gray-500 text-sm dark:text-gray-400">
          abode is invite-only for now. invites arrive by email: open yours and
          click the link to get started.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <label
            htmlFor="invite-link"
            className="font-medium text-sm leading-none"
          >
            invite link
          </label>
          <p
            id="invite-link-hint"
            className="text-gray-500 text-sm dark:text-gray-400"
          >
            link not working? paste it here instead.
          </p>
          <input
            id="invite-link"
            name="invite-link"
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setIsInvalid(false);
            }}
            aria-invalid={isInvalid}
            aria-describedby={
              isInvalid
                ? "invite-link-hint invite-link-error"
                : "invite-link-hint"
            }
            className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 aria-invalid:border-red-600 dark:border-gray-800 dark:bg-gray-950 dark:aria-invalid:border-red-400 dark:focus:ring-gray-100"
            placeholder="paste your invite link"
          />
          {isInvalid && (
            <p
              id="invite-link-error"
              role="alert"
              className="text-red-600 text-sm dark:text-red-400"
            >
              that doesn&apos;t look like an invite link. copy the whole link
              from your invite email.
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isSubmitting || !link.trim()}
        >
          {isSubmitting ? <IsLoading label="checking" /> : "continue"}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-gray-200 border-t dark:border-gray-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-gray-500 dark:text-gray-400">
            or
          </span>
        </div>
      </div>

      <section aria-labelledby="no-invite-heading" className="space-y-3">
        <div className="space-y-1 text-center">
          <h2 id="no-invite-heading" className="font-medium">
            no invite yet?
          </h2>
          <p className="text-gray-500 text-sm dark:text-gray-400">
            join the waitlist and we&apos;ll email you an invite when it&apos;s
            your turn.
          </p>
        </div>
        <WaitlistForm />
      </section>

      <p className="text-center text-gray-500 text-sm dark:text-gray-400">
        already have an account?{" "}
        <a
          href="/login"
          className="font-medium text-gray-900 hover:underline dark:text-gray-100"
        >
          login
        </a>
      </p>
    </>
  );
}
