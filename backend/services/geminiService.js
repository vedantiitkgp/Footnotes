import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { withRetry } from './withRetry.js';

// Free-tier quota is per-project-per-model, so switching models gets a fresh
// bucket. Set GEMINI_MODEL in Render to change it without a code deploy.
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

const retry = (fn) => withRetry(fn, { label: 'gemini' });

function getAI() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

function fileToInlinePart(filePath) {
  const data     = fs.readFileSync(filePath);
  const ext      = path.extname(filePath).toLowerCase();
  const mimeMap  = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                     '.webp': 'image/webp', '.gif': 'image/gif', '.heic': 'image/heic' };
  const mimeType = mimeMap[ext] || 'image/jpeg';
  return { inlineData: { data: data.toString('base64'), mimeType } };
}

/**
 * Analyze uploaded photos.
 * Caps at 5 photos to keep token usage low.
 */
export async function analyzePhotos(photoPaths) {
  // Limit to 5 photos — enough for good analysis, much lower token cost
  const sample     = photoPaths.slice(0, 5);
  const imageParts = sample.map(fileToInlinePart);
  const promptPart = {
    text: `You are analyzing travel photos for a richly detailed memoir book.
Examine ALL the photos carefully and return ONLY valid JSON:
{
  "locations":  ["short, geocodable place names — city and country/state format ONLY — e.g. 'Paris, France', 'East Bay, California', 'Santorini, Greece', 'Marrakech, Morocco'. NO descriptive phrases, NO 'the rolling hills of', NO adjectives — just the place name itself"],
  "landmarks":  ["exact landmark/building/site names visible — e.g. 'Eiffel Tower', 'Blue Mosque', 'Piazza Navona'"],
  "people":     ["vivid descriptions of people visible — apparent role, age range, emotion, clothing — e.g. 'elderly chai vendor in saffron turban', 'laughing schoolchildren in uniforms', 'weathered fisherman mending nets'. Never name individuals."],
  "signText":   ["readable text from signs, menus, storefronts, street signs — e.g. 'Rue du Bac', 'Grand Bazaar', 'Café de Flore'"],
  "timeline":   ["chronological events/scenes from photos"],
  "moods":      ["emotional tones: wonder, solitude, joy, adventure, etc."],
  "gaps":       ["2-3 narrative gaps — moments not shown that would enrich the story"],
  "days":       <estimated trip length as integer>
}
Be specific and evocative. Prioritize unique, memorable details over generic ones.`,
  };

  return retry(async () => {
    const response = await getAI().models.generateContent({
      model: MODEL,
      contents: [{ parts: [...imageParts, promptPart] }],
    });

    const text  = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try {
      return JSON.parse(clean);
    } catch {
      console.warn('[gemini] analyzePhotos JSON parse failed, using defaults');
      return { locations: [], timeline: [], moods: [], gaps: [], days: 7 };
    }
  });
}

/**
 * Extract all location names mentioned in a completed essay.
 * Returns short geocodable strings like ["Paris, France", "Montmartre, Paris"].
 */
export async function extractLocationsFromEssay(essay) {
  const snippet = essay.slice(0, 5000);
  const prompt = `Extract every specific place name mentioned in this travel essay.
Return ONLY a valid JSON array of short, geocodable strings — city + country/state format.
Include cities, neighborhoods, landmarks, regions, and countries. No duplicates. No descriptions.
Example: ["Paris, France", "Montmartre, Paris", "Eiffel Tower, Paris", "East Bay, California"]

Essay:
"${snippet}"

Return ONLY the JSON array.`;

  return retry(async () => {
    const response = await getAI().models.generateContent({
      model: MODEL,
      contents: [{ parts: [{ text: prompt }] }],
    });
    const text  = response.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try { return JSON.parse(clean); } catch { return []; }
  });
}

/**
 * Generate 6 funny "What If?" questions + answers about the trip.
 */
export async function generateWhatIf({ locations, essay }) {
  const snippet = essay.slice(0, 900);
  const prompt = `You're a sharp, funny travel writer — think David Sedaris meets a chaotic group chat. Based on this memoir about ${locations.join(', ')}:

"${snippet}"

Generate exactly 6 "What if?" hypotheticals specific to THIS trip. Mix these angles:
- 2 about specific people or characters mentioned (their quirks, bad decisions, reactions)
- 2 about specific places or local culture encountered
- 2 painfully human moments — embarrassing "what if we'd done that differently" scenarios

Rules:
- Dig into the actual names, places, and events from the memoir — nothing generic
- Questions should sound like something a friend asks over drinks, not a trivia night
- Answers: 2–3 sentences, punchy, build to a funny or painfully relatable punchline
- Warm, self-deprecating, occasionally absurd — never mean-spirited
- Answer must stand completely alone without restating the question

Return ONLY valid JSON — exactly 6 objects:
[
  { "question": "What if...", "answer": "..." },
  { "question": "What if...", "answer": "..." },
  { "question": "What if...", "answer": "..." },
  { "question": "What if...", "answer": "..." },
  { "question": "What if...", "answer": "..." },
  { "question": "What if...", "answer": "..." }
]`;

  return retry(async () => {
    const response = await getAI().models.generateContent({
      model: MODEL,
      contents: [{ parts: [{ text: prompt }] }],
    });
    const text  = response.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try { return JSON.parse(clean); } catch { return []; }
  });
}

/**
 * Stream essay generation.
 * Calls `onChunk(text)` for each piece. Returns full essay.
 */
export async function streamEssay({ description, style, analysis, photoPaths, onChunk }) {
  const styleGuides = {
    literary:     'Write in the style of a literary travel essay — Pico Iyer meets Joan Didion. Rich metaphors, lyrical sentences, emotional depth.',
    journal:      'Write as a personal travel journal — intimate, confessional, present-tense moments interleaved with reflection.',
    journalistic: 'Write as long-form travel journalism — scene-setting, vivid reportage, real sensory detail, no clichés.',
    poetic:       'Write as lyrical prose-poetry — short intense paragraphs, sensory images, fragmentary yet coherent.',
  };
  const guide = styleGuides[style] || styleGuides.literary;

  // Only 2 sample photos in the essay prompt (text-only is sufficient after analysis)
  const samplePhotos = photoPaths.slice(0, 2).map(fileToInlinePart);

  const landmarkLine   = analysis.landmarks?.length    ? `- Landmarks seen: ${analysis.landmarks.join(', ')}` : '';
  const peopleLine     = analysis.people?.length       ? `- People encountered: ${analysis.people.join('; ')}` : '';
  const signLine       = analysis.signText?.length     ? `- Visible text/signs: ${analysis.signText.join(', ')}` : '';
  const gpsLine        = analysis.gpsLocations?.length ? `- GPS-confirmed locations (high accuracy): ${analysis.gpsLocations.join(', ')}` : '';
  const timelineLine   = analysis.photoTimeline        ? `- Actual photo dates: ${analysis.photoTimeline}` : '';

  const prompt = `${guide}

TRIP DETAILS:
${description}

ANALYSIS:
- Locations: ${analysis.locations?.join(', ') || 'unknown'}
${gpsLine}
${landmarkLine}
${peopleLine}
${signLine}
${timelineLine}
- Timeline: ${analysis.timeline?.join(' → ') || ''}
- Moods: ${analysis.moods?.join(', ') || ''}
- Narrative gaps to fill: ${analysis.gaps?.join('; ') || ''}

Write a travel memoir essay of 700–1000 words with 3–4 chapters.
Use "## Chapter Title" for each heading.
Weave in specific landmark names, vivid people descriptions, and any sign/place text naturally — don't list them, let them emerge in the prose.
Write the actual essay — no placeholders.`;

  return retry(async () => {
    const stream = await getAI().models.generateContentStream({
      model: MODEL,
      contents: [{ parts: [...samplePhotos, { text: prompt }] }],
    });

    let fullText = '';
    for await (const chunk of stream) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }
    return fullText;
  });
}
