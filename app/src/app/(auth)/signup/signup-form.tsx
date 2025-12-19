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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { validateUsernameFormat } from "@/lib/username";
import { parseEmailToUsername } from "@/lib/username/generate-from-email";
import { signup, verifyOtp } from "./actions";

type UsernameStatus =
  | { type: "idle" }
  | { type: "checking" }
  | { type: "available" }
  | { type: "unavailable"; error: string; suggestion?: string }
  | { type: "invalid"; error: string };

export function SignupForm() {
  const [signupState, signupAction, isSigningUp] = useActionState(signup, {});
  const [verifyState, verifyAction, isVerifying] = useActionState(
    verifyOtp,
    {},
  );
  const [otp, setOtp] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>({
    type: "idle",
  });
  const formRef = useRef<HTMLFormElement>(null);
  const lastSubmittedOtp = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAutoSuggestedRef = useRef(false);

  useEffect(() => {
    if (signupState.error) {
      toast.error(signupState.error);
    }
  }, [signupState]);

  useEffect(() => {
    if (verifyState.error) {
      toast.error(verifyState.error);
    }
  }, [verifyState]);

  // Auto-submit when OTP is complete
  useEffect(() => {
    if (otp.length < 6) {
      lastSubmittedOtp.current = null;
      return;
    }

    if (!formRef.current || isVerifying) return;
    if (lastSubmittedOtp.current === otp) return;

    lastSubmittedOtp.current = otp;
    formRef.current.requestSubmit();
  }, [otp, isVerifying]);

  // Check username availability with debounce
  const checkUsernameAvailability = useCallback(async (value: string) => {
    // Clear any pending timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Immediate format validation
    const formatResult = validateUsernameFormat(value);
    if (!formatResult.valid) {
      setUsernameStatus({ type: "invalid", error: formatResult.error || "" });
      return;
    }

    setUsernameStatus({ type: "checking" });

    // Debounce the API call
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
  }, []);

  // Handle username input change
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);

    if (value.length === 0) {
      setUsernameStatus({ type: "idle" });
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      return;
    }

    void checkUsernameAvailability(value);
  };

  // Auto-suggest username from email
  const handleEmailBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const email = e.target.value;
    if (email && !username && !hasAutoSuggestedRef.current) {
      const suggested = parseEmailToUsername(email);
      setUsername(suggested);
      hasAutoSuggestedRef.current = true;
      void checkUsernameAvailability(suggested);
    }
  };

  // Use suggestion
  const useSuggestion = () => {
    if (usernameStatus.type === "unavailable" && usernameStatus.suggestion) {
      setUsername(usernameStatus.suggestion);
      setUsernameStatus({ type: "available" });
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Show OTP input after successful signup
  if (signupState.success && signupState.email) {
    return (
      <>
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Check your email
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            We sent a code to {signupState.email}
          </p>
        </div>

        <form ref={formRef} action={verifyAction} className="space-y-6">
          <input type="hidden" name="email" value={signupState.email} />
          <input type="hidden" name="token" value={otp} />
          <input
            type="hidden"
            name="username"
            value={signupState.username || ""}
          />

          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={setOtp} autoFocus>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isVerifying || otp.length !== 6}
          >
            {isVerifying ? "Verifying..." : "Verify"}
          </Button>
        </form>
      </>
    );
  }

  const isUsernameValid =
    usernameStatus.type === "available" ||
    (usernameStatus.type === "idle" && username.length === 0);

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
                Checking...
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
          {isSigningUp ? "Creating account..." : "Sign up"}
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
