"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

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
      <div className="text-center space-y-2">
        <p className="text-lg font-medium">you're on the list!</p>
        {position && position >= 50 && (
          <p className="text-sm text-muted-foreground">you're #{position}</p>
        )}
        <p className="text-sm text-muted-foreground">
          we'll email you when it's your turn.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="enter your email"
          required
          className="flex-1 h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:focus:ring-gray-100"
          disabled={formState === "submitting"}
        />
        <Button
          type="submit"
          disabled={formState === "submitting" || !email.trim()}
        >
          {formState === "submitting" ? "joining..." : "join"}
        </Button>
      </div>
      {formState === "error" && errorMessage && (
        <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
      )}
    </form>
  );
}
