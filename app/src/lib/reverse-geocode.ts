export type ReverseGeocodeProvider = "google" | "nominatim";

export type ReverseGeocodedPlace = {
  provider: ReverseGeocodeProvider;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  formatted?: string;
};

export type LatLon = { latitude: number; longitude: number };

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  return { controller, timeoutId };
}

async function reverseGeocodeGoogle({
  latitude,
  longitude,
}: LatLon): Promise<ReverseGeocodedPlace | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${latitude},${longitude}`);
  url.searchParams.set("key", key);

  const { controller, timeoutId } = withTimeout(5000);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      status?: string;
      results?: Array<{
        formatted_address?: string;
        types?: string[];
        address_components?: Array<{
          long_name?: string;
          short_name?: string;
          types?: string[];
        }>;
      }>;
    };

    if (payload.status !== "OK" || !payload.results?.length) return null;

    const best =
      payload.results.find((r) => r.types?.includes("locality")) ??
      payload.results.find((r) => r.types?.includes("street_address")) ??
      payload.results[0];

    const components = best.address_components ?? [];
    const getLong = (type: string) =>
      components.find((c) => c.types?.includes(type))?.long_name;
    const getShort = (type: string) =>
      components.find((c) => c.types?.includes(type))?.short_name;

    const city =
      getLong("locality") ??
      getLong("postal_town") ??
      getLong("administrative_area_level_3") ??
      getLong("administrative_area_level_2");

    const region = getLong("administrative_area_level_1");
    const country = getLong("country");
    const countryCode = getShort("country")?.toUpperCase();

    return {
      provider: "google",
      city,
      region,
      country,
      countryCode,
      formatted: best.formatted_address,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function reverseGeocodeNominatim({
  latitude,
  longitude,
}: LatLon): Promise<ReverseGeocodedPlace | null> {
  const userAgent = process.env.GEOCODE_USER_AGENT;
  if (!userAgent) return null;

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");

  const { controller, timeoutId } = withTimeout(5000);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": userAgent,
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      display_name?: string;
      address?: Record<string, string | undefined>;
    };

    const address = payload.address ?? {};
    const city =
      address.city ??
      address.town ??
      address.village ??
      address.hamlet ??
      address.municipality;

    const region = address.state ?? address.region ?? address.county;
    const country = address.country;
    const countryCode = address.country_code?.toUpperCase();

    return {
      provider: "nominatim",
      city,
      region,
      country,
      countryCode,
      formatted: payload.display_name,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function reverseGeocode(
  coords: LatLon,
): Promise<ReverseGeocodedPlace | null> {
  const provider = process.env.REVERSE_GEOCODE_PROVIDER;
  if (!provider || provider === "none") return null;

  if (provider === "google") return reverseGeocodeGoogle(coords);
  if (provider === "nominatim") return reverseGeocodeNominatim(coords);

  return null;
}
