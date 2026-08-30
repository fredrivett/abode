"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Show an error toast whenever a `useActionState` result carries an `error`.
 * Pass the action state directly; the effect re-runs on each new state object
 * (a fresh one per submission), so a repeated failure re-surfaces the toast.
 */
export function useActionErrorToast(state: { error?: string }): void {
  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    }
  }, [state]);
}
