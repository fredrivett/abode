"use client";

import { useEffect, useState } from "react";

function isSaveDataEnabled(nav: Navigator): boolean {
  if (!("connection" in nav)) return false;
  const { connection } = nav;
  return (
    typeof connection === "object" &&
    connection !== null &&
    "saveData" in connection &&
    connection.saveData === true
  );
}

/**
 * Whether media should autoplay in the feed.
 *
 * False when the user prefers reduced motion or has data saver enabled.
 * Starts false (SSR-safe) and resolves on mount.
 */
export function useAutoplayAllowed(): boolean {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      setAllowed(!mediaQuery.matches && !isSaveDataEnabled(navigator));

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return allowed;
}
