"use client";

import { MapPin } from "lucide-react";

type LocationData = {
  latitude?: number | null;
  longitude?: number | null;
  neighborhood?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  countryCode?: string | null;
};

type LocationPreviewProps = {
  location: LocationData;
  showMap?: boolean;
  /**
   * Item ID — the map proxy derives coordinates from the item server-side.
   * Omit it (e.g. previewing an unsaved/original location) to render no map.
   */
  itemId?: string;
};

function getCountryFlag(countryCode: string): string {
  return String.fromCodePoint(
    ...[...countryCode.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)),
  );
}

/**
 * Compact location summary showing geocoded place names, coordinates, and an optional map.
 */
export function LocationPreview({
  location,
  showMap = true,
  itemId,
}: LocationPreviewProps) {
  const hasLocationData =
    location.neighborhood ||
    location.city ||
    location.region ||
    location.country;

  const hasCoordinates =
    location.latitude != null && location.longitude != null;

  if (!hasLocationData && !hasCoordinates) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        No location data
      </div>
    );
  }

  const width = 300;
  const height = 160;
  // The proxy derives coordinates from the item, so a map is only shown when an
  // itemId is supplied (unsaved/original-location previews render text only).
  const mapUrl =
    hasCoordinates && showMap && itemId
      ? `/api/v1/map-image?itemId=${itemId}&width=${width}&height=${height}`
      : null;

  return (
    <div className="space-y-2">
      {hasLocationData && (
        <div className="space-y-1 text-sm">
          {location.neighborhood && (
            <div className="flex justify-between gap-2">
              <span className="shrink-0 text-zinc-500">Neighborhood</span>
              <span className="text-right font-medium">
                {location.neighborhood}
              </span>
            </div>
          )}
          {location.city && (
            <div className="flex justify-between gap-2">
              <span className="shrink-0 text-zinc-500">City</span>
              <span className="text-right font-medium">{location.city}</span>
            </div>
          )}
          {location.region && (
            <div className="flex justify-between gap-2">
              <span className="shrink-0 text-zinc-500">Region</span>
              <span className="text-right font-medium">{location.region}</span>
            </div>
          )}
          {location.country && (
            <div className="flex justify-between gap-2">
              <span className="shrink-0 text-zinc-500">Country</span>
              <span className="text-right font-medium">
                {location.countryCode && (
                  <span className="mr-1">
                    {getCountryFlag(location.countryCode)}
                  </span>
                )}
                {location.country}
              </span>
            </div>
          )}
        </div>
      )}
      {mapUrl && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-md border border-zinc-200 transition-colors hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
        >
          {/* biome-ignore lint/performance/noImgElement: using proxied mapbox static image */}
          <img
            src={mapUrl}
            alt={`Map showing location: ${location.city || location.country || "Location"}`}
            width={width}
            height={height}
            className="h-auto w-full bg-zinc-100 dark:bg-zinc-800"
            loading="lazy"
          />
        </a>
      )}
      {hasCoordinates && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <MapPin className="h-3 w-3" />
          <span>
            {location.latitude?.toFixed(6)}, {location.longitude?.toFixed(6)}
          </span>
        </div>
      )}
    </div>
  );
}
