"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  const lastSubmittedOtp = useRef<string | null>(null);

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
    if (lastSubmittedOtp.current === otp) return; // avoid resubmitting the same code

    lastSubmittedOtp.current = otp;
    formRef.current.requestSubmit();
  }, [otp, isVerifying]);

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
            className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:focus:ring-gray-100"
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isSigningUp}
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
