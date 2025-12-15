export type ReverseGeocodedPlace = {
  neighborhood?: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  formatted?: string;
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
        properties?: {
          place_formatted?: string;
          context?: {
            neighborhood?: { name?: string };
            place?: { name?: string };
            region?: { name?: string; region_code?: string };
            country?: { name?: string; country_code?: string };
          };
        };
      }>;
    };

    const feature = payload.features?.[0];
    if (!feature) return null;

    const context = feature.properties?.context ?? {};

    return {
      neighborhood: context.neighborhood?.name,
      city: context.place?.name,
      region: context.region?.name,
      country: context.country?.name,
      countryCode: context.country?.country_code?.toUpperCase(),
      formatted: feature.properties?.place_formatted ?? feature.place_name,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
