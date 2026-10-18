import type { Prisma } from "@prisma/client";
import type { ItemLocation } from "@/lib/types/item";

export const itemLocationSelect = {
  id: true,
  source: true,
  latitude: true,
  longitude: true,
  neighborhood: true,
  city: true,
  region: true,
  country: true,
  countryCode: true,
  formatted: true,
} satisfies Prisma.ItemLocationSelect;

/**
 * What a viewer may see of an item's locations: everything for its owner, but
 * only city, region and country for anyone else. Exact coordinates, the
 * neighborhood and the formatted street address would let a shared photo
 * reveal where someone lives.
 */
export function locationsForViewer({
  locations,
  isOwner,
}: {
  locations: ItemLocation[];
  isOwner: boolean;
}): ItemLocation[] {
  if (isOwner) return locations;
  return locations.map((location) => ({
    ...location,
    latitude: null,
    longitude: null,
    neighborhood: null,
    formatted: null,
  }));
}
