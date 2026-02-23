import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

function getAI() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

/** Retry a fn up to `attempts` times with exponential backoff on 429 */
async function withRetry(fn, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED');
      if (is429 && i < attempts - 1) {
        const delay = (i + 1) * 8000; // 8s, 16s
        console.warn(`[gemini] 429 — retrying in ${delay / 1000}s (attempt ${i + 1}/${attempts})`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
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
    text: `You are analyzing travel photos for a memoir book.
Examine the photos and return ONLY valid JSON:
{
  "locations": ["place names / cities / countries detected"],
  "timeline":  ["chronological events/scenes from photos"],
  "moods":     ["emotional tones: wonder, solitude, joy, adventure, etc."],
  "gaps":      ["2-3 narrative gaps — moments not shown that would enrich the story"],
  "days":      <estimated trip length as integer>
}
Be concise but specific.`,
  };

  return withRetry(async () => {
    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash',
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

  const prompt = `${guide}

TRIP DETAILS:
${description}

ANALYSIS:
- Locations: ${analysis.locations?.join(', ') || 'unknown'}
- Timeline: ${analysis.timeline?.join(' → ') || ''}
- Moods: ${analysis.moods?.join(', ') || ''}
- Narrative gaps to fill: ${analysis.gaps?.join('; ') || ''}

Write a travel memoir essay of 700–1000 words with 3–4 chapters.
Use "## Chapter Title" for each heading.
Write the actual essay — no placeholders.`;

  return withRetry(async () => {
    const stream = await getAI().models.generateContentStream({
      model: 'gemini-2.5-flash',
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
