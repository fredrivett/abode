/**
 * Platform detection and metadata for external links.
 */

export type PlatformInfo = {
  id: string;
  name: string;
  /** Hostname patterns to match (without www.) */
  hostnames: string[];
};

/**
 * Supported platforms for external links.
 * Order matters - first match wins.
 */
export const PLATFORMS: PlatformInfo[] = [
  {
    id: "unsplash",
    name: "Unsplash",
    hostnames: ["unsplash.com"],
  },
  {
    id: "flickr",
    name: "Flickr",
    hostnames: ["flickr.com", "flic.kr"],
  },
  {
    id: "500px",
    name: "500px",
    hostnames: ["500px.com"],
  },
  {
    id: "instagram",
    name: "Instagram",
    hostnames: ["instagram.com", "instagr.am"],
  },
  {
    id: "twitter",
    name: "X",
    hostnames: ["twitter.com", "x.com"],
  },
  {
    id: "behance",
    name: "Behance",
    hostnames: ["behance.net"],
  },
  {
    id: "dribbble",
    name: "Dribbble",
    hostnames: ["dribbble.com"],
  },
  {
    id: "pinterest",
    name: "Pinterest",
    hostnames: ["pinterest.com", "pin.it"],
  },
  {
    id: "deviantart",
    name: "DeviantArt",
    hostnames: ["deviantart.com"],
  },
  {
    id: "artstation",
    name: "ArtStation",
    hostnames: ["artstation.com"],
  },
];

/**
 * Detect platform from URL.
 * Returns the platform ID or "other" if not recognized.
 */
export function detectPlatform(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();

    for (const platform of PLATFORMS) {
      if (platform.hostnames.some((h) => hostname === h || hostname.endsWith(`.${h}`))) {
        return platform.id;
      }
    }

    return "other";
  } catch {
    return "other";
  }
}

/**
 * Get platform info by ID.
 */
export function getPlatformInfo(platformId: string): PlatformInfo | null {
  return PLATFORMS.find((p) => p.id === platformId) ?? null;
}

/**
 * Get display name for a platform.
 * Falls back to extracting domain from URL for unknown platforms.
 */
export function getPlatformName(platformId: string, url?: string): string {
  const platform = getPlatformInfo(platformId);
  if (platform) {
    return platform.name;
  }

  // For "other" platforms, try to extract a readable name from the URL
  if (url) {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.replace(/^www\./, "");
      // Capitalize first letter
      return hostname.charAt(0).toUpperCase() + hostname.slice(1);
    } catch {
      // Fall through
    }
  }

  return "Link";
}
