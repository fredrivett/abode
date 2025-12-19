"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MAX_USERNAME_CHANGES, validateUsernameFormat } from "@/lib/username";
import { changeUsername } from "../actions";

type UsernameStatus =
  | { type: "idle" }
  | { type: "checking" }
  | { type: "available" }
  | { type: "unavailable"; error: string; suggestion?: string }
  | { type: "invalid"; error: string };

type Props = {
  currentUsername: string | null;
  changesUsed: number;
};

export function UsernameSettings({ currentUsername, changesUsed }: Props) {
  const [state, action, isPending] = useActionState(changeUsername, {});
  const [username, setUsername] = useState(currentUsername || "");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>({
    type: "idle",
  });
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const changesRemaining = MAX_USERNAME_CHANGES - changesUsed;
  const canChange = changesRemaining > 0;
  const hasChanged = username !== currentUsername;

  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    }
    if (state.success) {
      toast.success("Username updated");
      setUsernameStatus({ type: "idle" });
    }
  }, [state]);

  // Check username availability with debounce
  const checkUsernameAvailability = useCallback(
    async (value: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Skip if same as current
      if (value === currentUsername) {
        setUsernameStatus({ type: "idle" });
        return;
      }

      // Immediate format validation
      const formatResult = validateUsernameFormat(value);
      if (!formatResult.valid) {
        setUsernameStatus({ type: "invalid", error: formatResult.error || "" });
        return;
      }

      setUsernameStatus({ type: "checking" });

      debounceTimerRef.current = setTimeout(async () => {
        try {
          const response = await fetch(
            `/api/v1/username/check?username=${encodeURIComponent(value)}`,
          );
          const data = await response.json();

          if (data.available) {
            setUsernameStatus({ type: "available" });
          } else {
            setUsernameStatus({
              type: "unavailable",
              error: data.error || "Username is not available",
              suggestion: data.suggestion,
            });
          }
        } catch {
          setUsernameStatus({
            type: "invalid",
            error: "Failed to check availability",
          });
        }
      }, 1000);
    },
    [currentUsername],
  );

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);

    if (value.length === 0 || value === currentUsername) {
      setUsernameStatus({ type: "idle" });
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      return;
    }

    void checkUsernameAvailability(value);
  };

  const useSuggestion = () => {
    if (usernameStatus.type === "unavailable" && usernameStatus.suggestion) {
      setUsername(usernameStatus.suggestion);
      setUsernameStatus({ type: "available" });
    }
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const isValid =
    usernameStatus.type === "available" ||
    (usernameStatus.type === "idle" && !hasChanged);

  return (
    <section className="rounded-xl border p-6">
      <h3 className="text-lg font-semibold">Username</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Your public profile URL will be{" "}
        <span className="font-medium">/@{username || "username"}</span>
      </p>

      <form action={action} className="mt-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              @
            </span>
            <input
              name="username"
              type="text"
              value={username}
              onChange={handleUsernameChange}
              disabled={!canChange}
              className={`flex h-10 w-full rounded-md border bg-background py-2 pl-7 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${
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
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                Checking...
              </span>
            )}
            {usernameStatus.type === "available" && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600">
                Available
              </span>
            )}
          </div>
          <Button
            type="submit"
            disabled={!canChange || !hasChanged || !isValid || isPending}
          >
            {isPending ? "Saving..." : "Save"}
          </Button>
        </div>

        {(usernameStatus.type === "invalid" ||
          usernameStatus.type === "unavailable") && (
          <p className="mt-2 text-xs text-red-600">
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

      <p className="mt-4 text-xs text-muted-foreground">
        {canChange ? (
          <>
            You can change your username{" "}
            <span className="font-medium">
              {changesRemaining} more time{changesRemaining !== 1 ? "s" : ""}
            </span>
            . Old profile URLs will stop working.
          </>
        ) : (
          "You have reached the maximum number of username changes. Contact support if you need assistance."
        )}
      </p>
    </section>
  );
}
