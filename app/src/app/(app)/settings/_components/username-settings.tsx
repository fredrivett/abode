"use client";

import { AtSign } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import { LoadingEllipsis } from "@/components/ui/loading-ellipsis/loading-ellipsis";
import { MAX_USERNAME_CHANGES } from "@/lib/username";
import { useUsernameAvailability } from "@/lib/username/use-username-availability";
import { changeUsername } from "../actions";

type Props = {
  currentUsername: string | null;
  changesUsed: number;
};

export function UsernameSettings({ currentUsername, changesUsed }: Props) {
  const [state, action, isPending] = useActionState(changeUsername, {});
  const [isFocused, setIsFocused] = useState(false);
  const {
    username,
    status: usernameStatus,
    isValid,
    hasChanged,
    handleChange,
    useSuggestion,
    reset,
  } = useUsernameAvailability({ currentUsername });

  const changesRemaining = MAX_USERNAME_CHANGES - changesUsed;
  const canChange = changesRemaining > 0;

  // Check if username has meaningfully changed (not just case)
  const hasMeaningfulChange =
    currentUsername && username.toLowerCase() !== currentUsername.toLowerCase();

  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    }
    if (state.success) {
      toast.success("Username updated");
      reset();
    }
  }, [state, reset]);

  return (
    <section className="rounded-xl border p-6">
      <h3 className="flex items-center gap-2 font-semibold text-xl">
        <AtSign className="size-5 text-muted-foreground" />
        Username
      </h3>
      <p className="mt-1 font-mono text-muted-foreground text-sm">
        {hasMeaningfulChange ? (
          <>
            Your public profile URL will be{" "}
            <span className="font-medium">/@{username || "username"}</span>
          </>
        ) : (
          <>
            Your public profile URL is{" "}
            <Link
              href={`/@${username || "username"}`}
              target="_blank"
              className="font-medium underline"
            >
              /@{username || "username"}
            </Link>
          </>
        )}
      </p>

      <form action={action} className="mt-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <span className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 text-muted-foreground">
              @
            </span>
            <input
              name="username"
              type="text"
              autoComplete="off"
              value={username}
              onChange={(e) => handleChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={!canChange}
              className={`flex h-10 w-full rounded-md border bg-background py-2 pr-3 pl-7 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                usernameStatus.type === "available"
                  ? "border-green-500 focus:ring-green-500"
                  : usernameStatus.type === "invalid" ||
                      usernameStatus.type === "unavailable"
                    ? "border-red-500 focus:ring-red-500"
                    : "border-input focus:ring-ring"
              }`}
              placeholder="username"
              minLength={2}
              maxLength={15}
            />
            {usernameStatus.type === "checking" && (
              <span className="-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground text-xs">
                Checking
                <LoadingEllipsis />
              </span>
            )}
            {usernameStatus.type === "available" && (
              <span className="-translate-y-1/2 absolute top-1/2 right-3 text-green-600 text-xs">
                Available
              </span>
            )}
          </div>
          <Button
            type="submit"
            disabled={!canChange || !hasChanged || !isValid || isPending}
          >
            {isPending ? <IsLoading label="Saving" /> : "Save"}
          </Button>
        </div>

        {(usernameStatus.type === "invalid" ||
          usernameStatus.type === "unavailable") && (
          <p className="mt-2 text-red-600 text-xs">
            {usernameStatus.error}
            {usernameStatus.type === "unavailable" &&
              usernameStatus.suggestion && (
                <>
                  {" "}
                  Try{" "}
                  <button
                    type="button"
                    onClick={useSuggestion}
                    className="font-medium underline hover:no-underline"
                  >
                    @{usernameStatus.suggestion}
                  </button>
                  ?
                </>
              )}
          </p>
        )}
      </form>

      <div
        className={`grid transition-all duration-200 ease-out ${
          isFocused
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="mt-4 text-muted-foreground text-xs">
            {canChange ? (
              <>
                You can change your username{" "}
                <span className="font-medium">
                  {changesRemaining} more time
                  {changesRemaining !== 1 ? "s" : ""}
                </span>
                . Old profile URLs will stop working.
              </>
            ) : (
              "You have reached the maximum number of username changes. Contact support if you need assistance."
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
