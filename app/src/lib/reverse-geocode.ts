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
