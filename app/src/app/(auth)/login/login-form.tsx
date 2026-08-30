"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import { useActionErrorToast } from "@/hooks/use-action-error-toast";
import { login } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState(login, {});

  useActionErrorToast(state);

  return (
    <form action={formAction} className="space-y-6">
      {next && <input type="hidden" name="next" value={next} />}
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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="font-medium text-sm leading-none"
          >
            Password
          </label>
          <a
            href="/forgot-password"
            className="text-gray-500 text-xs hover:underline dark:text-gray-400"
          >
            Forgot password?
          </a>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:focus:ring-gray-100"
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? <IsLoading label="Signing in" /> : "Sign in"}
      </Button>
    </form>
  );
}
