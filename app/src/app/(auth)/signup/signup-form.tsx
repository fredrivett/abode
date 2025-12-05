"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { signup, verifyOtp } from "./actions";

export function SignupForm() {
  const [signupState, signupAction, isSigningUp] = useActionState(signup, {});
  const [verifyState, verifyAction, isVerifying] = useActionState(
    verifyOtp,
    {},
  );
  const [otp, setOtp] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

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
    if (otp.length === 6 && formRef.current && !isVerifying) {
      formRef.current.requestSubmit();
    }
  }, [otp, isVerifying]);

  // Show OTP input after successful signup
  if (signupState.success && signupState.email) {
    return (
      <>
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Check your email
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            We sent a code to {signupState.email}
          </p>
        </div>

        <form ref={formRef} action={verifyAction} className="space-y-6">
          <input type="hidden" name="email" value={signupState.email} />
          <input type="hidden" name="token" value={otp} />

          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
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

          <button
            type="submit"
            disabled={isVerifying || otp.length !== 6}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isVerifying ? "Verifying..." : "Verify"}
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create an account
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
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
            className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:ring-zinc-100"
            placeholder="you@example.com"
          />
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
            className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:ring-zinc-100"
          />
        </div>

        <button
          type="submit"
          disabled={isSigningUp}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isSigningUp ? "Creating account..." : "Sign up"}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        Already have an account?{" "}
        <a
          href="/login"
          className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
        >
          Sign in
        </a>
      </p>
    </>
  );
}
