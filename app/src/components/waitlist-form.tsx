"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import { Card } from "./ui/card";

type FormState = "idle" | "submitting" | "success" | "error";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [position, setPosition] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setFormState("submitting");
    setErrorMessage("");

    try {
      const response = await fetch("/api/v1/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormState("error");
        setErrorMessage(data.error || "Something went wrong");
        return;
      }

      setFormState("success");
      setPosition(data.position);
    } catch {
      setFormState("error");
      setErrorMessage("Failed to join waitlist. Please try again.");
    }
  };

  if (formState === "success") {
    return (
      <Card className="items-center gap-2 p-6 text-center">
        <Check className="size-8 text-muted-foreground" />
        <p className="font-medium text-lg">you're on the waitlist!</p>
        {position && position >= 50 && (
          <p className="text-muted-foreground text-sm">you're #{position}</p>
        )}
        <p className="text-muted-foreground text-sm">
          we'll email you when it's your turn.
        </p>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
      <div className="flex">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="enter your email"
          required
          className="h-11 flex-1 rounded-l-md border border-gray-200 bg-white px-4 py-2 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:focus:ring-gray-100"
          disabled={formState === "submitting"}
        />
        <Button
          type="submit"
          className="h-11 rounded-l-none px-5 text-base"
          disabled={formState === "submitting" || !email.trim()}
        >
          {formState === "submitting" ? (
            <IsLoading label="joining waitlist" />
          ) : (
            "join waitlist"
          )}
        </Button>
      </div>
      {formState === "error" && errorMessage && (
        <p className="text-red-600 text-sm dark:text-red-400">{errorMessage}</p>
      )}
    </form>
  );
}
