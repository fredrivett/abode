"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import { requestPasswordReset } from "./actions";

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordReset,
    {},
  );

  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  if (state.success) {
    return (
      <div className="space-y-2 text-center">
        <h1 className="font-semibold text-2xl tracking-tight">
          Check your email
        </h1>
        <p className="text-gray-500 text-sm dark:text-gray-400">
          If an account exists for {state.email}, we've sent a link to reset
          your password.
        </p>
        <p className="text-gray-500 text-sm dark:text-gray-400">
          Click the link in the email to set a new password.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 text-center">
        <h1 className="font-semibold text-2xl tracking-tight">
          Reset your password
        </h1>
        <p className="text-gray-500 text-sm dark:text-gray-400">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      <form action={formAction} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="email" className="font-medium text-sm leading-none">
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

        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending ? <IsLoading label="Sending link" /> : "Send reset link"}
        </Button>
      </form>
    </>
  );
}
