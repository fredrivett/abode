"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { applyDebugParam, useDebugFlag } from "@/lib/debug/debug-flag";
import { clearTrace, setTracingEnabled } from "@/lib/debug/trace";
import { useUserStore } from "@/stores/user-store";

const DebugSession = dynamic(() => import("./debug-session"), { ssr: false });

/**
 * Whether this viewer may run the debug tools: admins anywhere, anyone in
 * local dev (a local account often isn't flagged admin). `isAdmin` is
 * undefined until the header hydrates the user store — treat that as "not
 * yet", not "no".
 */
export function debugToolsAccess({
  isAdmin,
  isDevelopment,
}: {
  isAdmin: boolean | undefined;
  isDevelopment: boolean;
}): "allowed" | "denied" | "pending" {
  if (isDevelopment || isAdmin === true) return "allowed";
  return isAdmin === false ? "denied" : "pending";
}

/**
 * Admin debug tools gate. Mount once near the root (inside the query
 * provider). Renders nothing unless the per-browser debug flag is on and the
 * viewer is allowed; the session itself is code-split.
 */
export function DebugTools() {
  const flag = useDebugFlag();
  const isAdmin = useUserStore((state) => state.isAdmin);
  const access = debugToolsAccess({
    isAdmin,
    isDevelopment: process.env.NODE_ENV === "development",
  });

  useEffect(() => {
    applyDebugParam();
  }, []);

  // The trace store starts recording at load whenever the flag is set; stop it
  // once we know the viewer can't use it. (Switching the flag off unmounts the
  // session, whose cleanup stops recording.)
  useEffect(() => {
    if (access !== "denied") return;
    setTracingEnabled(false);
    // Anything recorded before we knew (tracing starts at load) isn't theirs to see
    clearTrace();
  }, [access]);

  if (!flag || access !== "allowed") return null;
  return <DebugSession />;
}
