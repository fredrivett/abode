export type ReverseGeocodedPlace = {
  neighborhood?: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  formatted?: string;
  raw?: unknown; // Full Mapbox API response
};

export type LatLon = { latitude: number; longitude: number };

/**
 * Cost of one Mapbox reverse-geocoding request, so location spend is visible to
 * the usage $ backstops. Mapbox temporary geocoding is ~$0.75 per 1,000 requests
 * (after the free tier) → $0.00075/call. A rough per-call figure is enough for a
 * cost cap; update if the plan/rate changes.
 */
export const MAPBOX_GEOCODE_COST_USD = 0.00075;

/** Whether Mapbox is configured — i.e. a reverse-geocode will make a billable call. */
export function isMapboxConfigured(): boolean {
  return Boolean(process.env.MAPBOX_ACCESS_TOKEN);
}

/**
 * Converts latitude/longitude coordinates into a structured place description
 * using the Mapbox Geocoding API.
 *
 * Returns `null` if the API key is missing, the request fails, or no features
 * are found. Aborts after 5 seconds to avoid hanging on slow responses.
 *
 * @param coords - The latitude and longitude to look up.
 */
export async function reverseGeocode({
  latitude,
  longitude,
}: LatLon): Promise<ReverseGeocodedPlace | null> {
  const apiKey = process.env.MAPBOX_ACCESS_TOKEN;
  if (!apiKey) return null;

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json`,
  );
  url.searchParams.set("access_token", apiKey);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      features?: Array<{
        place_name?: string;
        context?: Array<{
          id?: string;
          text?: string;
          short_code?: string;
        }>;
      }>;
    };

    const feature = payload.features?.[0];
    if (!feature) return null;

    const context = feature.context ?? [];

    // Context is an array of objects with id like "neighborhood.xxx", "place.xxx", etc.
    const neighborhood = context.find((c) => c.id?.startsWith("neighborhood."));
    const place = context.find((c) => c.id?.startsWith("place."));
    const region = context.find((c) => c.id?.startsWith("region."));
    const country = context.find((c) => c.id?.startsWith("country."));

    return {
      neighborhood: neighborhood?.text,
      city: place?.text,
      region: region?.text,
      country: country?.text,
      countryCode: country?.short_code?.toUpperCase(),
      formatted: feature.place_name,
      raw: payload, // Store full Mapbox response
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
