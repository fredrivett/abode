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

export async function extractExifGpsLocation(
  buffer: Buffer,
): Promise<ExifGpsLocation | null> {
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

/**
 * Extract capture date from EXIF data (DateTimeOriginal or CreateDate)
 */
export async function extractExifCaptureDate(
  buffer: Buffer,
): Promise<Date | null> {
  try {
    const exif = await exifr.parse(buffer, {
      pick: ["DateTimeOriginal", "CreateDate", "DateTimeDigitized"],
    });

    log.debug({ exif }, "exifr.parse result for capture date");

    if (!exif) {
      log.debug("No EXIF data returned from exifr");
      return null;
    }

    // Try DateTimeOriginal first (when the photo was actually taken)
    // Then CreateDate (when the digital file was created)
    // Then DateTimeDigitized (when the image was digitized)
    const captureDate =
      exif.DateTimeOriginal || exif.CreateDate || exif.DateTimeDigitized;

    if (!captureDate) {
      log.debug("No capture date found in EXIF");
      return null;
    }

    // exifr returns Date objects for date fields
    if (captureDate instanceof Date && !Number.isNaN(captureDate.getTime())) {
      log.debug({ captureDate }, "Valid capture date extracted");
      return captureDate;
    }

    log.debug({ captureDate }, "Invalid capture date value");
    return null;
  } catch (error) {
    log.debug({ error }, "Error extracting EXIF capture date");
    return null;
  }
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
