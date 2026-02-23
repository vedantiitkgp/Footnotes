import exifr from 'exifr';

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';

/**
 * Extract GPS coordinates and timestamps from photo EXIF data.
 */
export async function extractPhotoMetadata(photoPaths) {
  const results = await Promise.all(
    photoPaths.map(async (filePath) => {
      try {
        const data = await exifr.parse(filePath, {
          gps: true, tiff: true, exif: true, iptc: false, xmp: false,
        });
        if (!data) return null;
        return {
          filePath,
          lat: data.latitude  ?? null,
          lng: data.longitude ?? null,
          timestamp: data.DateTimeOriginal ?? data.DateTime ?? data.CreateDate ?? null,
        };
      } catch {
        return null;
      }
    })
  );
  return results.filter(Boolean);
}

/**
 * Reverse geocode a lat/lng to a human-readable place name.
 * Uses OpenStreetMap Nominatim — free, no API key, rate limit 1 req/s.
 */
export async function reverseGeocode(lat, lng) {
  try {
    const url = `${NOMINATIM}?lat=${lat}&lon=${lng}&format=json&zoom=10&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'GemHead-Memoir/1.0 (contact@gemhead.app)' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    // Prefer city/town > county > state > country
    return a.city || a.town || a.village || a.suburb || a.county || a.state || a.country || null;
  } catch {
    return null;
  }
}

/**
 * From an array of photo metadata, build GPS-confirmed location names
 * and a sorted timestamp list. Respects Nominatim's 1 req/s rate limit.
 */
export async function buildExifContext(metadata) {
  const gpsPoints = metadata.filter((m) => m.lat !== null && m.lng !== null);
  const timestamps = metadata
    .filter((m) => m.timestamp)
    .map((m) => new Date(m.timestamp))
    .filter((d) => !isNaN(d))
    .sort((a, b) => a - b);

  // Reverse geocode each unique GPS point (throttle 1/s for Nominatim)
  const locations = [];
  for (const point of gpsPoints) {
    const name = await reverseGeocode(point.lat, point.lng);
    if (name) locations.push(name);
    if (gpsPoints.indexOf(point) < gpsPoints.length - 1) {
      await new Promise((r) => setTimeout(r, 1100)); // respect rate limit
    }
  }

  // Calculate real trip duration from timestamps
  let days = null;
  if (timestamps.length >= 2) {
    days = Math.max(1, Math.ceil(
      (timestamps[timestamps.length - 1] - timestamps[0]) / (1000 * 60 * 60 * 24)
    ) + 1);
  }

  return {
    gpsLocations: [...new Set(locations)],
    timestamps,
    days,
  };
}
