"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function AccountDeletedToast({
  showToast,
}: {
  showToast: boolean;
}) {
  useEffect(() => {
    if (showToast) {
      toast.success("Your account has been permanently deleted", {
        duration: 10000,
      });
    }
  }, [showToast]);

  return null;
}
