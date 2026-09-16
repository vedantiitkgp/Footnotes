/**
 * Google Photos Picker import.
 *
 * The Photos Library API cannot help here — since April 2025 it only sees
 * content the app itself created. The Picker API is the only route: Google
 * hosts the picker, the user selects items, and we download just those.
 *
 * Downloads must happen server-side: picker baseUrls require an
 * Authorization header, and googleusercontent.com does not allow that header
 * cross-origin, so the browser cannot fetch the bytes itself.
 *
 * Optional integration — mirrors the supabaseEnabled pattern in supabase.js.
 */
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const googlePhotosEnabled = Boolean(process.env.GOOGLE_PHOTOS_CLIENT_ID);

const MAX_BYTES = 20 * 1024 * 1024;   // matches multer's fileSize in upload.js
const TIMEOUT_MS = 30_000;

// Every extension produced here must also exist in supabase.js's MIME map, or
// Storage objects get tagged application/octet-stream. Don't add one here
// without adding it there.
const EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/gif': '.gif',
};

function normalizeMime(mime) {
  return String(mime).split(';')[0].trim().toLowerCase();
}

export function extFromMime(mime) {
  return EXT[normalizeMime(mime)] || '.jpg';   // .jpg fallback mirrors upload.js
}

function isImageMime(mime) {
  return typeof mime === 'string' && normalizeMime(mime).startsWith('image/');
}

/**
 * SSRF allowlist for picker baseUrls, applied before any fetch.
 *
 * Parses rather than string-matches on purpose: `https://googleusercontent.com@evil.com/x`
 * has hostname `evil.com`, which a substring check would wave through. The
 * leading dot in the suffix matters too — without it `evilgoogleusercontent.com`
 * passes.
 */
export function isGooglePhotosUrl(url) {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:'
      && (hostname === 'googleusercontent.com' || hostname.endsWith('.googleusercontent.com'));
  } catch {
    return false;
  }
}

/**
 * Download picked items into <sessionDir>/photos as <uuid><ext>.
 *
 * Returns only the files that actually landed on disk, in the order they were
 * picked — photoFiles order drives the memoir photo reel.
 */
export async function downloadPickedItems(sessionDir, items, accessToken) {
  const photosDir = path.join(sessionDir, 'photos');
  let authExpired = false;

  const results = await Promise.all(items.map(async (item) => {
    try {
      if (!isGooglePhotosUrl(item?.baseUrl)) return null;
      if (!isImageMime(item?.mimeType)) return null;

      const res = await fetch(`${item.baseUrl}=d`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      // A lapsed token and an expired baseUrl are indistinguishable to the
      // user and have the same remedy: pick again.
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        authExpired = true;
        return null;
      }
      if (!res.ok) return null;

      const declared = Number(res.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > MAX_BYTES) return null;

      // The response's own content-type is authoritative — item.mimeType came
      // from the client and is untrusted.
      const actualMime = res.headers.get('content-type');
      if (!isImageMime(actualMime)) return null;

      // ponytail: buffers each response in memory; switch to a streaming byte
      // counter if a chunked response without Content-Length ever OOMs.
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;

      const filename = `${uuidv4()}${extFromMime(actualMime)}`;
      fs.writeFileSync(path.join(photosDir, filename), buf);
      return filename;
    } catch {
      return null;   // one bad item must not fail the batch
    }
  }));

  const filenames = results.filter(Boolean);   // Promise.all preserves order
  return { filenames, failed: items.length - filenames.length, authExpired };
}
