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
};

function getCountryFlag(countryCode: string): string {
  return String.fromCodePoint(
    ...[...countryCode.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)),
  );
}

export function LocationPreview({
  location,
  showMap = true,
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
  const mapUrl =
    hasCoordinates && showMap
      ? `/api/v1/map-image?lat=${location.latitude}&lng=${location.longitude}&width=${width}&height=${height}`
      : null;

  return (
    <div className="space-y-2">
      {hasLocationData && (
        <div className="space-y-1 text-sm">
          {location.neighborhood && (
            <div className="flex justify-between gap-2">
              <span className="text-zinc-500 shrink-0">Neighborhood</span>
              <span className="font-medium text-right">
                {location.neighborhood}
              </span>
            </div>
          )}
          {location.city && (
            <div className="flex justify-between gap-2">
              <span className="text-zinc-500 shrink-0">City</span>
              <span className="font-medium text-right">{location.city}</span>
            </div>
          )}
          {location.region && (
            <div className="flex justify-between gap-2">
              <span className="text-zinc-500 shrink-0">Region</span>
              <span className="font-medium text-right">{location.region}</span>
            </div>
          )}
          {location.country && (
            <div className="flex justify-between gap-2">
              <span className="text-zinc-500 shrink-0">Country</span>
              <span className="font-medium text-right">
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
          className="block overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
        >
          {/* biome-ignore lint/performance/noImgElement: using proxied mapbox static image */}
          <img
            src={mapUrl}
            alt={`Map showing location: ${location.city || location.country || "Location"}`}
            width={width}
            height={height}
            className="w-full h-auto bg-zinc-100 dark:bg-zinc-800"
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
