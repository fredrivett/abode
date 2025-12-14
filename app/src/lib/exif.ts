import * as exifr from "exifr";

export type ExifGpsLocation = {
  latitude: number;
  longitude: number;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidLatLon(latitude: unknown, longitude: unknown) {
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  return true;
}

export async function extractExifGpsLocation(
  buffer: Buffer,
): Promise<ExifGpsLocation | null> {
  try {
    const gps = await exifr.gps(buffer);
    if (!gps) return null;

    if (!isValidLatLon(gps.latitude, gps.longitude)) return null;

    return { latitude: gps.latitude, longitude: gps.longitude };
  } catch {
    return null;
  }
}
