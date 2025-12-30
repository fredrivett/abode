"use client";

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

/**
 * Extract GPS location from an image file (client-side)
 * Returns null if no valid GPS data is found
 */
export async function extractGpsFromFile(
  file: File,
): Promise<ExifGpsLocation | null> {
  try {
    // exifr can parse File objects directly in the browser
    const exif = await exifr.parse(file, {
      gps: true,
    });

    if (exif?.latitude !== undefined && exif?.longitude !== undefined) {
      if (isValidLatLon(exif.latitude, exif.longitude)) {
        return { latitude: exif.latitude, longitude: exif.longitude };
      }
    }

    return null;
  } catch {
    return null;
  }
}
