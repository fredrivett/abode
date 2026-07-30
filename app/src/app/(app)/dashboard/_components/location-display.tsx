"use client";

import type { ItemLocation } from "@/lib/types/item";
import { LocationMap } from "./location-map";

type LocationDisplayProps = {
  location: ItemLocation;
  /** Item ID — required so the map proxy can derive coordinates server-side */
  itemId: string;
};

/**
 * Displays location data (neighborhood, city, region, country) and a map.
 * Used by both editable (LocationDropzone) and read-only contexts.
 */
export function LocationDisplay({ location, itemId }: LocationDisplayProps) {
  const hasLocationData =
    location.neighborhood ||
    location.city ||
    location.region ||
    location.country;

  return (
    <div className="space-y-2">
      {hasLocationData && (
        <div className="space-y-1 text-sm">
          {location.neighborhood && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Neighborhood</span>
              <span className="font-medium">{location.neighborhood}</span>
            </div>
          )}
          {location.city && (
            <div className="flex justify-between">
              <span className="text-zinc-500">City</span>
              <span className="font-medium">{location.city}</span>
            </div>
          )}
          {location.region && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Region</span>
              <span className="font-medium">{location.region}</span>
            </div>
          )}
          {location.country && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Country</span>
              <span className="font-medium">
                {location.countryCode && (
                  <span className="mr-1">
                    {String.fromCodePoint(
                      ...[...location.countryCode.toUpperCase()].map(
                        (c) => 127397 + c.charCodeAt(0),
                      ),
                    )}
                  </span>
                )}
                {location.country}
              </span>
            </div>
          )}
        </div>
      )}
      {location.latitude != null && location.longitude != null && (
        <LocationMap
          latitude={location.latitude}
          longitude={location.longitude}
          locationName={location.city || location.country || "Location"}
          itemId={itemId}
        />
      )}
    </div>
  );
}
