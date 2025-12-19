import * as exifr from "exifr";
import { createLogger } from "./logger.server";

const log = createLogger("exif");

export type ExifGpsLocation = {
  latitude: number;
  longitude: number;
};

export type ExifData = {
  gps: ExifGpsLocation | null;
  captureDate: Date | null;
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
 * Extract all EXIF data (GPS and capture date) in a single pass
 */
export async function extractExifData(buffer: Buffer): Promise<ExifData> {
  try {
    const exif = await exifr.parse(buffer, {
      gps: true,
      pick: ["DateTimeOriginal", "CreateDate", "DateTimeDigitized"],
    });

    log.debug({ exif }, "exifr.parse result for full EXIF data");

    let gps: ExifGpsLocation | null = null;
    let captureDate: Date | null = null;

    // Extract GPS
    if (exif?.latitude !== undefined && exif?.longitude !== undefined) {
      if (isValidLatLon(exif.latitude, exif.longitude)) {
        gps = { latitude: exif.latitude, longitude: exif.longitude };
        log.debug(gps, "Valid GPS location extracted");
      } else {
        log.debug(
          { latitude: exif.latitude, longitude: exif.longitude },
          "Invalid lat/lon values",
        );
      }
    }

    // Extract capture date
    const dateValue =
      exif?.DateTimeOriginal || exif?.CreateDate || exif?.DateTimeDigitized;
    if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
      captureDate = dateValue;
      log.debug({ captureDate }, "Valid capture date extracted");
    }

    return { gps, captureDate };
  } catch (error) {
    log.debug({ error }, "Error extracting EXIF data");
    return { gps: null, captureDate: null };
  }
}
