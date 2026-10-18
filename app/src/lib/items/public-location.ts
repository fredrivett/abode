import type { Prisma } from "@prisma/client";
import type { ItemLocation } from "@/lib/types/item";

/**
 * The location fields a visitor may see: city, region and country. Exact
 * coordinates, neighborhood and the formatted street address stay with the
 * owner, so a shared photo doesn't reveal where someone lives.
 */
export const publicLocationSelect = {
  id: true,
  source: true,
  city: true,
  region: true,
  country: true,
  countryCode: true,
} satisfies Prisma.ItemLocationSelect;

type PublicLocationRow = Prisma.ItemLocationGetPayload<{
  select: typeof publicLocationSelect;
}>;

/** A public location in the shared client shape, with the precise fields empty */
export function toPublicLocation(location: PublicLocationRow): ItemLocation {
  return {
    ...location,
    latitude: null,
    longitude: null,
    neighborhood: null,
    formatted: null,
  };
}
