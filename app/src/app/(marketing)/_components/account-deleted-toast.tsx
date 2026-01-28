"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

export function AccountDeletedToast() {
  const searchParams = useSearchParams();
  const showToast = searchParams.get("account-deleted") === "true";

  useEffect(() => {
    if (showToast) {
      toast.success("Your account has been permanently deleted", {
        duration: Number.POSITIVE_INFINITY,
      });
    }
  }, [showToast]);

  return null;
}
