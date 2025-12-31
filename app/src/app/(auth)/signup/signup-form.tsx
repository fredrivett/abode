"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import { LoadingEllipsis } from "@/components/ui/loading-ellipsis/loading-ellipsis";
import { parseEmailToUsername } from "@/lib/username/generate-from-email";
import { useUsernameAvailability } from "@/lib/username/use-username-availability";
import { signup } from "./actions";

export function SignupForm() {
  const [signupState, signupAction, isSigningUp] = useActionState(signup, {});
  const {
    username,
    status: usernameStatus,
    handleChange,
    useSuggestion,
  } = useUsernameAvailability();
  const hasAutoSuggestedRef = useRef(false);

  useEffect(() => {
    if (signupState.error) {
      toast.error(signupState.error);
    }
  }, [signupState]);

  // Auto-suggest username from email
  const handleEmailBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const email = e.target.value;
    if (email && !username && !hasAutoSuggestedRef.current) {
      const suggested = parseEmailToUsername(email);
      handleChange(suggested);
      hasAutoSuggestedRef.current = true;
    }
  };

  // Show confirmation message after successful signup
  if (signupState.success && signupState.email) {
    return (
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Check your email
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          We sent a verification link to {signupState.email}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Click the link in the email to complete your signup
        </p>
      </div>
    );
  }

  const isUsernameValid =
    usernameStatus.type === "available" ||
    (usernameStatus.type === "idle" && username.length === 0);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleChange(e.target.value);
  };

  return (
    <>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create an account
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Enter your details to get started
        </p>
      </div>

      <form action={signupAction} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium leading-none">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:focus:ring-gray-100"
            placeholder="you@example.com"
            onBlur={handleEmailBlur}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="username"
            className="text-sm font-medium leading-none"
          >
            Username
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
                Checking
                <LoadingEllipsis />
              </span>
            )}
            {usernameStatus.type === "available" && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600">
                Available
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
        </div>

        <div className="space-y-2">
          <label
            htmlFor="password"
            className="text-sm font-medium leading-none"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:focus:ring-gray-100"
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isSigningUp || !isUsernameValid}
        >
          {isSigningUp ? <IsLoading label="Creating account" /> : "Sign up"}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{" "}
        <a
          href="/login"
          className="font-medium text-gray-900 hover:underline dark:text-gray-100"
        >
          Sign in
        </a>
      </p>
    </>
  );
}
