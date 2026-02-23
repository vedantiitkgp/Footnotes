/**
 * Google Cloud Vision API — landmark detection, face attributes, sign text.
 * Enabled only when GOOGLE_VISION_API_KEY is set in .env.
 * All calls are fire-and-forget safe: returns null on any failure.
 */
import fs from 'fs';

const ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

export function isVisionEnabled() {
  return !!process.env.GOOGLE_VISION_API_KEY;
}

export async function analyzeWithVision(photoPaths) {
  const key = process.env.GOOGLE_VISION_API_KEY;
  if (!key) return null;

  // Cap at 5 photos to stay under quota
  const sample = photoPaths.slice(0, 5);

  const requests = sample.map((p) => ({
    image: { content: fs.readFileSync(p).toString('base64') },
    features: [
      { type: 'LANDMARK_DETECTION', maxResults: 5 },
      { type: 'FACE_DETECTION',     maxResults: 15 },
      { type: 'LABEL_DETECTION',    maxResults: 12 },
      { type: 'TEXT_DETECTION' },
    ],
  }));

  let data;
  try {
    const res = await fetch(`${ENDPOINT}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    });
    if (!res.ok) throw new Error(`Vision API ${res.status}: ${await res.text()}`);
    data = await res.json();
  } catch (err) {
    console.warn('[vision] API call failed:', err.message);
    return null;
  }

  const landmarks    = new Set();
  const faceSnippets = [];
  const signText     = new Set();
  const sceneLabels  = new Set();

  for (const result of data.responses || []) {
    // ── Landmarks ──────────────────────────────────────────────────────────
    for (const lm of result.landmarkAnnotations || []) {
      if (lm.score > 0.45) landmarks.add(lm.description);
    }

    // ── Faces → emotional descriptions ─────────────────────────────────────
    const faces = result.faceAnnotations || [];
    if (faces.length > 0) {
      const dominant = faces
        .map((f) => {
          if (isLikely(f.joyLikelihood))      return 'joyful';
          if (isLikely(f.surpriseLikelihood)) return 'surprised';
          if (isLikely(f.sorrowLikelihood))   return 'sorrowful';
          if (isLikely(f.angerLikelihood))    return 'intense';
          return null;
        })
        .filter(Boolean);

      const count = faces.length;
      const emoStr = dominant.length
        ? [...new Set(dominant)].join(' and ')
        : 'present';
      faceSnippets.push(`${count} ${count === 1 ? 'person' : 'people'} — ${emoStr}`);
    }

    // ── Readable text from signs / menus / storefronts ──────────────────────
    const textAnnotations = result.textAnnotations || [];
    if (textAnnotations.length > 0) {
      const full = textAnnotations[0]?.description || '';
      full.split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 2 && l.length < 45 && /[a-zA-Z]/.test(l))
        .slice(0, 6)
        .forEach((l) => signText.add(l));
    }

    // ── Scene labels for context ────────────────────────────────────────────
    for (const lb of result.labelAnnotations || []) {
      if (lb.score > 0.88) sceneLabels.add(lb.description.toLowerCase());
    }
  }

  return {
    landmarks:    [...landmarks],
    faceSnippets: [...new Set(faceSnippets)],
    signText:     [...signText].slice(0, 8),
    sceneLabels:  [...sceneLabels].slice(0, 8),
  };
}

function isLikely(val) {
  return val === 'LIKELY' || val === 'VERY_LIKELY';
}
