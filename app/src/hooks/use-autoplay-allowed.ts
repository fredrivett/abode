"use client";

import { useEffect, useState } from "react";

function getConnection(nav: Navigator): EventTarget | null {
  if (!("connection" in nav)) return null;
  const { connection } = nav;
  return connection instanceof EventTarget ? connection : null;
}

function isSaveDataEnabled(nav: Navigator): boolean {
  const connection = getConnection(nav);
  return (
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
    // navigator.connection fires "change" when Data Saver / network conditions change
    const connection = getConnection(navigator);
    connection?.addEventListener("change", update);
    return () => {
      mediaQuery.removeEventListener("change", update);
      connection?.removeEventListener("change", update);
    };
  }, []);

  return allowed;
}
