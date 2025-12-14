import * as exifr from "exifr";
import { createLogger } from "./logger.server";

const log = createLogger("exif");

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
  log.debug({ bufferSize: buffer.length }, "Extracting EXIF GPS from buffer");
  try {
    const gps = await exifr.gps(buffer);
    log.debug({ gps }, "exifr.gps result");
    if (!gps) {
      log.debug("No GPS data returned from exifr");
      return null;
    }

    if (!isValidLatLon(gps.latitude, gps.longitude)) {
      log.debug(
        { latitude: gps.latitude, longitude: gps.longitude },
        "Invalid lat/lon values",
      );
      return null;
    }

    log.debug(
      { latitude: gps.latitude, longitude: gps.longitude },
      "Valid GPS location extracted",
    );
    return { latitude: gps.latitude, longitude: gps.longitude };
  } catch (error) {
    log.debug({ error }, "Error extracting EXIF GPS");
    return null;
  }
}
