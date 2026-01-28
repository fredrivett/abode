"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function AccountDeletedToast() {
  const searchParams = useSearchParams();
  const showToast = searchParams.get("account-deleted") === "true";
  const hasShownToast = useRef(false);

  useEffect(() => {
    if (showToast && !hasShownToast.current) {
      hasShownToast.current = true;
      toast.success("Your account has been permanently deleted", {
        duration: Number.POSITIVE_INFINITY,
      });
    }
  }, [showToast]);

  return null;
}
