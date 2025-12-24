"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { parseEmailToUsername } from "@/lib/username/generate-from-email";
import { useUsernameAvailability } from "@/lib/username/use-username-availability";
import { completeProfile } from "./actions";

type Props = {
  email: string;
  inviteToken?: string;
};

export function CompleteSignupForm({ email, inviteToken }: Props) {
  const [state, action, isPending] = useActionState(completeProfile, {});
  const {
    username,
    status: usernameStatus,
    handleChange,
    useSuggestion,
  } = useUsernameAvailability();
  const hasAutoSuggestedRef = useRef(false);

  // Auto-suggest username from email on mount
  useEffect(() => {
    if (!hasAutoSuggestedRef.current) {
      const suggested = parseEmailToUsername(email);
      handleChange(suggested);
      hasAutoSuggestedRef.current = true;
    }
  }, [email, handleChange]);

  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    }
  }, [state.error]);

  const isUsernameValid =
    usernameStatus.type === "available" ||
    (usernameStatus.type === "idle" && username.length === 0);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleChange(e.target.value);
  };

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="inviteToken" value={inviteToken || ""} />

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium leading-none">
          email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          readOnly
          disabled
          className="flex h-10 w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="username" className="text-sm font-medium leading-none">
          username
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            @
          </span>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="off"
            required
            value={username}
            onChange={handleUsernameChange}
            className={`flex h-10 w-full rounded-md border bg-white py-2 pl-7 pr-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 dark:bg-gray-950 ${
              usernameStatus.type === "available"
                ? "border-green-500 focus:ring-green-500"
                : usernameStatus.type === "invalid" ||
                    usernameStatus.type === "unavailable"
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-200 focus:ring-gray-900 dark:border-gray-800 dark:focus:ring-gray-100"
            }`}
            placeholder="username"
            minLength={2}
            maxLength={15}
          />
          {usernameStatus.type === "checking" && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              checking...
            </span>
          )}
          {usernameStatus.type === "available" && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600">
              available
            </span>
          )}
        </div>
        {(usernameStatus.type === "invalid" ||
          usernameStatus.type === "unavailable") && (
          <p className="text-xs text-red-600">
            {usernameStatus.error}
            {usernameStatus.type === "unavailable" &&
              usernameStatus.suggestion && (
                <>
                  {" "}
                  try{" "}
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
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isPending || !isUsernameValid}
      >
        {isPending ? "saving..." : "continue"}
      </Button>
    </form>
  );
}
