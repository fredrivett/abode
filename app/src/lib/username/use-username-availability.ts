"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { validateUsernameFormat } from "./validation";

export type UsernameStatus =
  | { type: "idle" }
  | { type: "checking" }
  | { type: "available" }
  | { type: "unavailable"; error: string; suggestion?: string }
  | { type: "invalid"; error: string };

const DEBOUNCE_MS = 1000;

type UseUsernameAvailabilityOptions = {
  /** Current username to skip checking (for settings page) */
  currentUsername?: string | null;
};

export function useUsernameAvailability(
  options: UseUsernameAvailabilityOptions = {},
) {
  const { currentUsername = null } = options;

  const [username, setUsername] = useState(currentUsername || "");
  const [status, setStatus] = useState<UsernameStatus>({ type: "idle" });
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const checkAvailability = useCallback(
    async (value: string) => {
      clearTimer();

      // Skip if same as current (for settings page)
      if (currentUsername && value === currentUsername) {
        setStatus({ type: "idle" });
        return;
      }

      // Immediate format validation
      const formatResult = validateUsernameFormat(value);
      if (!formatResult.valid) {
        setStatus({ type: "invalid", error: formatResult.error || "" });
        return;
      }

      setStatus({ type: "checking" });

      debounceTimerRef.current = setTimeout(async () => {
        try {
          const response = await fetch(
            `/api/v1/username/check?username=${encodeURIComponent(value)}`,
          );
          const data = await response.json();

          if (data.available) {
            setStatus({ type: "available" });
          } else {
            setStatus({
              type: "unavailable",
              error: data.error || "Username is not available",
              suggestion: data.suggestion,
            });
          }
        } catch {
          setStatus({
            type: "invalid",
            error: "Failed to check availability",
          });
        }
      }, DEBOUNCE_MS);
    },
    [currentUsername, clearTimer],
  );

  const handleChange = useCallback(
    (value: string) => {
      setUsername(value);

      if (value.length === 0 || value === currentUsername) {
        setStatus({ type: "idle" });
        clearTimer();
        return;
      }

      void checkAvailability(value);
    },
    [currentUsername, checkAvailability, clearTimer],
  );

  const useSuggestion = useCallback(() => {
    if (status.type === "unavailable" && status.suggestion) {
      const suggestion = status.suggestion;
      setUsername(suggestion);
      void checkAvailability(suggestion);
    }
  }, [status, checkAvailability]);

  const reset = useCallback(() => {
    setUsername(currentUsername || "");
    setStatus({ type: "idle" });
    clearTimer();
  }, [currentUsername, clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  const isValid =
    status.type === "available" ||
    (status.type === "idle" && username === (currentUsername || ""));

  const hasChanged = username !== (currentUsername || "");

  return {
    username,
    status,
    isValid,
    hasChanged,
    setUsername,
    handleChange,
    checkAvailability,
    useSuggestion,
    reset,
  };
}
