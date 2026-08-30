"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import { useActionErrorToast } from "@/hooks/use-action-error-toast";
import { updatePassword } from "./actions";

export function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState(updatePassword, {});

  useActionErrorToast(state);

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="password" className="font-medium text-sm leading-none">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:focus:ring-gray-100"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="confirmPassword"
          className="font-medium text-sm leading-none"
        >
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:focus:ring-gray-100"
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? (
          <IsLoading label="Updating password" />
        ) : (
          "Update password"
        )}
      </Button>
    </form>
  );
}
