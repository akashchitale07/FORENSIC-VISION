import ExifReader from 'exifreader';
import { GpsData, MetadataEntry } from '../types/forensics';

export interface ParsedMetadataResult {
  entries: MetadataEntry[];
  gps: GpsData;
  software?: string;
  cameraModel?: string;
  cameraMake?: string;
  captureTime?: string;
  hasExif: boolean;
  warnings: string[];
}

export async function parseImageMetadata(buffer: ArrayBuffer): Promise<ParsedMetadataResult> {
  const entries: MetadataEntry[] = [];
  const warnings: string[] = [];
  let gpsData: GpsData = { hasGps: false };
  let software: string | undefined;
  let cameraModel: string | undefined;
  let cameraMake: string | undefined;
  let captureTime: string | undefined;
  let hasExif = false;

  try {
    const tags = await ExifReader.load(buffer, { expanded: true });

    // 1. Process EXIF
    if (tags.exif) {
      hasExif = true;
      for (const [key, tagObj] of Object.entries(tags.exif)) {
        if (!tagObj || !tagObj.description) continue;
        const valStr = String(tagObj.description);
        const cleanedVal = cleanDisplayValue(valStr);
        if (!cleanedVal) continue;

        entries.push({
          tag: key,
          label: formatTagLabel(key),
          value: cleanedVal,
          category: 'EXIF',
          description: tagObj.value ? String(tagObj.value) : undefined,
        });

        if (key.toLowerCase() === 'make' && cleanedVal.length > 1) cameraMake = cleanedVal;
        if (key.toLowerCase() === 'model' && cleanedVal.length > 1) cameraModel = cleanedVal;
        if (key.toLowerCase() === 'software' && cleanedVal.length > 1) software = cleanedVal;
        if (['datetimeoriginal', 'createdate', 'datetime'].includes(key.toLowerCase()) && !captureTime) {
          captureTime = cleanedVal;
        }
      }
    }

    // 2. Process IPTC
    if (tags.iptc) {
      for (const [key, tagObj] of Object.entries(tags.iptc)) {
        if (!tagObj || !tagObj.description) continue;
        const valStr = String(tagObj.description).trim();
        if (!valStr) continue;

        entries.push({
          tag: key,
          label: formatTagLabel(key),
          value: valStr,
          category: 'IPTC',
        });
      }
    }

    // 3. Process XMP
    if (tags.xmp) {
      for (const [key, tagObj] of Object.entries(tags.xmp)) {
        if (!tagObj || !tagObj.description) continue;
        const valStr = String(tagObj.description).trim();
        if (!valStr) continue;

        entries.push({
          tag: key,
          label: formatTagLabel(key),
          value: valStr,
          category: 'XMP',
        });

        if (key.toLowerCase().includes('creatortool') && !software) {
          software = valStr;
        }
      }
    }

    // 4. Process ICC
    if (tags.icc) {
      for (const [key, tagObj] of Object.entries(tags.icc)) {
        if (!tagObj || !tagObj.description) continue;
        const valStr = String(tagObj.description).trim();
        if (!valStr) continue;

        entries.push({
          tag: key,
          label: formatTagLabel(key),
          value: valStr,
          category: 'ICC',
        });
      }
    }

    // 5. Process GPS
    if (tags.gps) {
      const lat = tags.gps.Latitude;
      const lon = tags.gps.Longitude;
      const alt = tags.gps.Altitude ? String(tags.gps.Altitude) : undefined;

      if (typeof lat === 'number' && typeof lon === 'number') {
        const latFormatted = `${Math.abs(lat).toFixed(6)}° ${lat >= 0 ? 'N' : 'S'}`;
        const lonFormatted = `${Math.abs(lon).toFixed(6)}° ${lon >= 0 ? 'E' : 'W'}`;
        const formattedCoords = `${latFormatted}, ${lonFormatted}`;
        const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;

        gpsData = {
          hasGps: true,
          latitude: lat,
          longitude: lon,
          altitude: alt ? `${alt}m` : undefined,
          formattedCoords,
          googleMapsUrl,
        };

        entries.push({
          tag: 'GPSCoordinates',
          label: 'GPS Coordinates',
          value: formattedCoords,
          category: 'GPS',
          description: `Lat: ${lat}, Lon: ${lon}`,
        });
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown metadata parsing error';
    // If no EXIF was present in the file, ExifReader may throw "No Exif data"
    if (message.toLowerCase().includes('no exif')) {
      warnings.push('No embedded EXIF headers found in evidence container. File metadata may have been stripped during export or upload.');
    } else {
      warnings.push(`Metadata extraction notice: ${message}`);
    }
  }

  return {
    entries,
    gps: gpsData,
    software,
    cameraModel,
    cameraMake,
    captureTime,
    hasExif,
    warnings,
  };
}

function cleanDisplayValue(str: string): string {
  if (!str) return '';
  // Strip control characters and unicode replacement character
  const cleaned = str.replace(/[\u0000-\u001F\u007F-\u009F\uFFFD]/g, '').trim();
  return cleaned;
}

function formatTagLabel(tag: string): string {
  // Convert camelCase or PascalCase to spaced string
  return tag
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
