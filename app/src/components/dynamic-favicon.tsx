"use client";

import { useEffect } from "react";
import { subscribeToThemeChanges } from "@/lib/theme";

function updateFavicon(isDark: boolean) {
  const favicon = isDark ? "/favicon-dark.png" : "/favicon-light.png";
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }

  link.href = favicon;
}

export function DynamicFavicon() {
  useEffect(() => {
    return subscribeToThemeChanges(updateFavicon);
  }, []);

  return null;
}
