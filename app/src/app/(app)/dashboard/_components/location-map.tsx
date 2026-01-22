"use client";

import { MapPin } from "lucide-react";

type LocationMapProps = {
  latitude: number;
  longitude: number;
  locationName: string;
  /** Item ID for public access verification (required for unauthenticated users) */
  itemId?: string;
};

export function LocationMap({
  latitude,
  longitude,
  locationName,
  itemId,
}: LocationMapProps) {
  const width = 368;
  const height = 200;

  // Use server-side proxy to keep Mapbox token secret
  // Include itemId for public access verification when user is not authenticated
  const mapUrl = `/api/v1/map-image?lat=${latitude}&lng=${longitude}&width=${width}&height=${height}${itemId ? `&itemId=${itemId}` : ""}`;

  return (
    <div className="space-y-2">
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-md border border-zinc-200 transition-colors hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
      >
        {/* biome-ignore lint/performance/noImgElement: using proxied mapbox static image */}
        <img
          src={mapUrl}
          alt={`Map showing location: ${locationName}`}
          width={width}
          height={height}
          className="h-auto w-full bg-zinc-100 dark:bg-zinc-800"
          loading="lazy"
        />
      </a>
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <MapPin className="h-3 w-3" />
        <span>
          {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </span>
      </div>
    </div>
  );
}
