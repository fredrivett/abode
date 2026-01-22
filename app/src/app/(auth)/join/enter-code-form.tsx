"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";

export function EnterCodeForm() {
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setIsSubmitting(true);
    router.push(`/join?token=${encodeURIComponent(code.trim())}`);
  };

  return (
    <>
      <div className="space-y-2 text-center">
        <h1 className="font-semibold text-2xl tracking-tight">
          enter your invite code
        </h1>
        <p className="text-gray-500 text-sm dark:text-gray-400">
          paste the invite code from your email
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="code" className="font-medium text-sm leading-none">
            invite code
          </label>
          <input
            id="code"
            name="code"
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:focus:ring-gray-100"
            placeholder="paste your invite code"
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isSubmitting || !code.trim()}
        >
          {isSubmitting ? <IsLoading label="checking" /> : "continue"}
        </Button>
      </form>

      <div className="space-y-3">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-gray-200 border-t dark:border-gray-800" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-gray-500 dark:text-gray-400">
              or
            </span>
          </div>
        </div>

        <p className="text-center text-gray-500 text-sm dark:text-gray-400">
          don&apos;t have an invite?{" "}
          <a
            href="/"
            className="font-medium text-gray-900 hover:underline dark:text-gray-100"
          >
            join the waitlist
          </a>
        </p>

        <p className="text-center text-gray-500 text-sm dark:text-gray-400">
          already have an account?{" "}
          <a
            href="/login"
            className="font-medium text-gray-900 hover:underline dark:text-gray-100"
          >
            login
          </a>
        </p>
      </div>
    </>
  );
}
