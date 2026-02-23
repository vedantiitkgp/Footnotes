import express from 'express';

const router = express.Router();
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const UA = 'GemHead-Memoir/1.0 (contact@gemhead.app)';

/** Try Nominatim with a query string; returns [lat, lng] or null. */
async function nominatimSearch(q) {
  const url = `${NOMINATIM}?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=0`;
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) return null;
  const data = await r.json();
  if (!data.length) return null;
  return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
}

/**
 * For verbose AI strings like "Rolling emerald hills of the East Bay, California",
 * progressively try shorter extracts: last 2 comma parts, last 1 comma part.
 * Each attempt needs 1s gap for Nominatim rate limit — caller handles throttling.
 */
async function geocodeWithFallback(query) {
  // Attempt 1: full query
  let coords = await nominatimSearch(query);
  if (coords) return coords;

  // Attempt 2: last 2 comma-separated parts (e.g. "East Bay, California")
  const parts = query.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length > 2) {
    await new Promise((r) => setTimeout(r, 1100));
    coords = await nominatimSearch(parts.slice(-2).join(', '));
    if (coords) return coords;
  }

  // Attempt 3: last single part (e.g. "California")
  if (parts.length > 1) {
    await new Promise((r) => setTimeout(r, 1100));
    coords = await nominatimSearch(parts[parts.length - 1]);
    if (coords) return coords;
  }

  return null;
}

// GET /api/geocode?q=Paris,France&q=Rome,Italy
// Accepts multiple `q` params, returns [{name, coords:[lat,lng]}] for successful lookups.
// Throttles at 1 req/s to respect Nominatim's usage policy.
router.get('/', async (req, res) => {
  const queries = [].concat(req.query.q || []).filter(Boolean).slice(0, 10);
  if (!queries.length) return res.json([]);

  const results = [];
  for (let i = 0; i < queries.length; i++) {
    try {
      const coords = await geocodeWithFallback(queries[i]);
      if (coords) results.push({ name: queries[i], coords });
    } catch {
      // skip failed lookups silently
    }
    // Nominatim rate limit: 1 req/s between top-level queries
    if (i < queries.length - 1) {
      await new Promise((r) => setTimeout(r, 1100));
    }
  }

  res.json(results);
});

export default router;
