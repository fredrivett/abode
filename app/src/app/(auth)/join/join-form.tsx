"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { parseEmailToUsername } from "@/lib/username/generate-from-email";
import { useUsernameAvailability } from "@/lib/username/use-username-availability";
import { signupWithInvite, verifyOtp } from "./actions";

type JoinFormProps = {
  token: string;
  email: string;
  inviteType: string;
};

export function JoinForm({ token, email, inviteType }: JoinFormProps) {
  const [signupState, signupAction, isSigningUp] = useActionState(
    signupWithInvite,
    {},
  );
  const [verifyState, verifyAction, isVerifying] = useActionState(
    verifyOtp,
    {},
  );
  const [otp, setOtp] = useState("");
  const {
    username,
    status: usernameStatus,
    handleChange,
    useSuggestion,
  } = useUsernameAvailability();
  const formRef = useRef<HTMLFormElement>(null);
  const lastSubmittedOtp = useRef<string | null>(null);
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

  // Show OTP input after successful signup
  if (signupState.success && signupState.email) {
    return (
      <>
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            check your email
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            we sent a code to {signupState.email}
          </p>
        </div>

        <form ref={formRef} action={verifyAction} className="space-y-6">
          <input type="hidden" name="email" value={signupState.email} />
          <input type="hidden" name="otpToken" value={otp} />
          <input type="hidden" name="inviteToken" value={token} />
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
            {isVerifying ? "verifying..." : "verify"}
          </Button>
        </form>
      </>
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
          create your account
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {inviteType === "waitlist"
            ? "you're off the waitlist! let's get you set up."
            : "just a few details to get started"}
        </p>
      </div>

      <form action={signupAction} className="space-y-6">
        <input type="hidden" name="token" value={token} />

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
          <label
            htmlFor="username"
            className="text-sm font-medium leading-none"
          >
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

        <div className="space-y-2">
          <label
            htmlFor="password"
            className="text-sm font-medium leading-none"
          >
            password
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
          {isSigningUp ? "creating account..." : "create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        already have an account?{" "}
        <a
          href="/login"
          className="font-medium text-gray-900 hover:underline dark:text-gray-100"
        >
          sign in
        </a>
      </p>
    </>
  );
}
